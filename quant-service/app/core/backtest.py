import pandas as pd
import numpy as np
import os
import json
from datetime import datetime
from typing import Dict, Any, List, Tuple
from app.core.dsl_parser import FactorDSLEvaluator
import logging

logger = logging.getLogger(__name__)

class BacktestEngine:
    def __init__(self, data: pd.DataFrame, dsl: Dict[str, Any], initial_capital: float = 1000000.0, commission_rate: float = 0.0003, slippage_bps: float = 1.0):
        self.data = data
        self.dsl = dsl
        self.initial_capital = initial_capital
        self.commission_rate = commission_rate
        self.slippage = slippage_bps / 10000.0

    def get_factor_data(self, factor_code: str) -> pd.Series:
        # For P4, since we don't have all factors precalculated, we parse the factor formula from the database.
        # But we don't have DB access here. Let's assume factor_code is just the formula for now, 
        # OR we just map standard factor codes to DSL formulas.
        # Let's map standard ones.
        factor_map = {
            'MOM_20D': 'CLOSE / Delay(CLOSE, 20) - 1',
            'MOM_60D': 'CLOSE / Delay(CLOSE, 60) - 1',
            'LOW_VOL_20D': 'TsMean(CLOSE, 20) / CLOSE', # Simplified surrogate
            'ROE_TTM': 'CLOSE' # Surrogate since we don't have fundamentals
        }
        formula = factor_map.get(factor_code, factor_code)
        
        evaluator = FactorDSLEvaluator(self.data)
        return evaluator.eval(formula)

    def run(self) -> Tuple[Dict[str, Any], pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        # 1. Compute composite signal
        logger.info("Computing composite signal...")
        signal_series_list = []
        for sig in self.dsl.get('signals', []):
            factor = sig.get('factor')
            weight = sig.get('weight', 0.0)
            if weight == 0: continue
            
            f_data = self.get_factor_data(factor)
            
            # Normalize cross-sectionally (Z-Score) so we can sum them meaningfully
            def _zscore(x):
                std = x.std()
                if std == 0 or np.isnan(std): return np.zeros_like(x)
                return (x - x.mean()) / std
            
            f_z = f_data.groupby(level='date').apply(_zscore).droplevel(0).sort_index()
            signal_series_list.append(f_z * weight)
            
        if not signal_series_list:
            raise ValueError("No valid signals")
            
        composite_signal = pd.concat(signal_series_list, axis=1).sum(axis=1)
        composite_signal.name = 'score'
        
        # 2. Determine rebalance dates
        freq = self.dsl.get('rebalance', {}).get('frequency', 'daily')
        dates = sorted(self.data.index.levels[0].unique())
        
        if freq == 'weekly':
            # Rebalance every 5 trading days
            reb_dates = dates[::5]
        elif freq == 'monthly':
            # Rebalance every 21 trading days
            reb_dates = dates[::21]
        else:
            reb_dates = dates
            
        reb_dates_set = set(reb_dates)
        
        # 3. Simulate
        logger.info("Running simulation...")
        cash = self.initial_capital
        positions = {} # symbol -> quantity
        
        nav_history = []
        trades = []
        pos_history = []
        
        # We need next day OPEN for T+1 execution. Lookahead prevention.
        # Signal at T, trade at T+1 OPEN.
        
        for i, current_date in enumerate(dates):
            current_date_data = self.data.loc[current_date] if current_date in self.data.index else pd.DataFrame()
            if current_date_data.empty: continue
                
            # Calculate current NAV using CLOSE prices
            portfolio_value = cash
            for sym, qty in positions.items():
                if sym in current_date_data.index:
                    portfolio_value += qty * current_date_data.loc[sym, 'CLOSE']
                else:
                    # Stale price or delisted. Assuming value is 0 for simplicity if not in data.
                    # Or keep last known. Here just ignore for simplicity if not trading.
                    pass
            
            nav_history.append({'date': current_date.strftime('%Y-%m-%d'), 'nav': portfolio_value})
            
            # Record positions
            for sym, qty in positions.items():
                if qty > 0:
                    pos_history.append({'date': current_date.strftime('%Y-%m-%d'), 'symbol': sym, 'quantity': qty})
                    
            if current_date in reb_dates_set and i < len(dates) - 1:
                # Generate target portfolio at T
                n = self.dsl.get('selection', {}).get('n', 10)
                if current_date in composite_signal.index.levels[0]:
                    todays_scores = composite_signal.loc[current_date].dropna()
                    top_n = todays_scores.nlargest(n)
                    target_symbols = top_n.index.tolist()
                else:
                    target_symbols = []
                
                # Execute at T+1 OPEN
                next_date = dates[i+1]
                next_date_data = self.data.loc[next_date] if next_date in self.data.index else pd.DataFrame()
                
                if next_date_data.empty: continue
                
                target_weights = {sym: 1.0 / len(target_symbols) for sym in target_symbols} if target_symbols else {}
                
                # First, sell positions not in target or adjust down
                for sym in list(positions.keys()):
                    if sym not in next_date_data.index: continue # Cannot sell if suspended/missing
                    
                    price = next_date_data.loc[sym, 'OPEN'] # Exec at OPEN
                    if pd.isna(price) or price <= 0: continue
                    
                    target_w = target_weights.get(sym, 0.0)
                    target_value = portfolio_value * target_w
                    current_qty = positions[sym]
                    
                    target_qty = int(target_value / price / 100) * 100 # 100 shares round lot
                    
                    if target_qty < current_qty:
                        sell_qty = current_qty - target_qty
                        # Simulate slippage (sell at a lower price)
                        exec_price = price * (1 - self.slippage)
                        proceeds = sell_qty * exec_price
                        comm = proceeds * self.commission_rate
                        
                        cash += (proceeds - comm)
                        positions[sym] = target_qty
                        if positions[sym] == 0: del positions[sym]
                        
                        trades.append({
                            'date': next_date.strftime('%Y-%m-%d'),
                            'symbol': sym,
                            'action': 'SELL',
                            'price': exec_price,
                            'amount': sell_qty,
                            'commission': comm,
                            'slippage_cost': price * sell_qty * self.slippage,
                            'notional': proceeds
                        })
                        
                # Then, buy target positions
                for sym, target_w in target_weights.items():
                    if sym not in next_date_data.index: continue
                    price = next_date_data.loc[sym, 'OPEN']
                    if pd.isna(price) or price <= 0: continue
                    
                    target_value = portfolio_value * target_w
                    current_qty = positions.get(sym, 0)
                    
                    target_qty = int(target_value / price / 100) * 100
                    
                    if target_qty > current_qty:
                        buy_qty = target_qty - current_qty
                        exec_price = price * (1 + self.slippage)
                        cost = buy_qty * exec_price
                        comm = cost * self.commission_rate
                        
                        total_cost = cost + comm
                        if cash >= total_cost:
                            cash -= total_cost
                            positions[sym] = target_qty
                            
                            trades.append({
                                'date': next_date.strftime('%Y-%m-%d'),
                                'symbol': sym,
                                'action': 'BUY',
                                'price': exec_price,
                                'amount': buy_qty,
                                'commission': comm,
                                'slippage_cost': price * buy_qty * self.slippage,
                                'notional': cost
                            })

        # 4. Metrics
        logger.info("Calculating metrics...")
        df_nav = pd.DataFrame(nav_history)
        if df_nav.empty:
            raise ValueError("No NAV history generated")
            
        df_nav['date'] = pd.to_datetime(df_nav['date'])
        df_nav = df_nav.set_index('date')
        df_nav['ret'] = df_nav['nav'].pct_change().fillna(0)
        
        total_return = (df_nav['nav'].iloc[-1] / self.initial_capital) - 1
        days = (df_nav.index[-1] - df_nav.index[0]).days
        ann_return = (1 + total_return) ** (365.0 / days) - 1 if days > 0 else 0
        
        daily_vol = df_nav['ret'].std()
        ann_vol = daily_vol * np.sqrt(252)
        sharpe = ann_return / ann_vol if ann_vol > 0 else 0
        
        cum_max = df_nav['nav'].cummax()
        drawdowns = (df_nav['nav'] - cum_max) / cum_max
        max_drawdown = drawdowns.min()
        
        calmar = ann_return / abs(max_drawdown) if max_drawdown < 0 else 0
        
        win_days = (df_nav['ret'] > 0).sum()
        total_trade_days = len(df_nav)
        win_rate = win_days / total_trade_days if total_trade_days > 0 else 0
        
        # Calculate turnover
        df_trades = pd.DataFrame(trades)
        turnover_rate = 0.0
        if not df_trades.empty:
            total_traded = df_trades['notional'].sum() / 2.0 # buy + sell
            avg_nav = df_nav['nav'].mean()
            turnover_rate = total_traded / avg_nav
            
            # Annualize turnover
            turnover_rate = turnover_rate * (252 / total_trade_days) if total_trade_days > 0 else 0
        
        # Format df_nav for output
        df_nav_out = df_nav.reset_index()
        df_nav_out['date'] = df_nav_out['date'].dt.strftime('%Y-%m-%d')
        
        # Generate dummy benchmark (buy and hold equal weight of all stocks at start)
        df_nav_out['benchmark'] = self.initial_capital * (1 + total_return * 0.5) # Fake benchmark logic for now, or we can use mean return.
        
        # Better benchmark: mean return of the universe
        mean_ret = self.data['CLOSE'].groupby(level='date').mean().pct_change().fillna(0)
        bench_nav = (1 + mean_ret).cumprod() * self.initial_capital
        
        bench_nav_df = bench_nav.reset_index()
        bench_nav_df['date'] = bench_nav_df['date'].dt.strftime('%Y-%m-%d')
        bench_nav_df = bench_nav_df.rename(columns={'CLOSE': 'benchmark'})
        
        df_nav_out = pd.merge(df_nav_out, bench_nav_df, on='date', how='left').fillna(method='ffill')
        if 'benchmark' not in df_nav_out.columns:
            df_nav_out['benchmark'] = df_nav_out['nav']
            
        summary = {
            'total_return': float(total_return),
            'annualized_return': float(ann_return),
            'sharpe_ratio': float(sharpe),
            'max_drawdown': float(max_drawdown),
            'calmar_ratio': float(calmar),
            'win_rate': float(win_rate),
            'turnover_rate': float(turnover_rate),
            'trade_count': len(trades)
        }
        
        return summary, df_nav_out, df_trades, pd.DataFrame(pos_history)
