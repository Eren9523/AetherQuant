
import pandas as pd
import numpy as np
import os
import sys
sys.path.insert(0, os.path.abspath('quant-service'))

from app.core.backtest import BacktestEngine

def get_dummy_data():
    dates = pd.date_range('2023-01-01', periods=20)
    symbols = ['000001.SZ', '000002.SZ']
    idx = pd.MultiIndex.from_product([dates, symbols], names=['date', 'symbol'])
    df = pd.DataFrame({
        'OPEN': np.linspace(10, 29, 40), # strictly increasing
        'HIGH': np.linspace(11, 30, 40),
        'LOW': np.linspace(9, 28, 40),
        'CLOSE': np.linspace(10.5, 29.5, 40),
        'VOLUME': np.random.rand(40) * 1000 + 10000,
    }, index=idx)
    return df

def test_t_plus_1_execution():
    df = get_dummy_data()
    dsl = {
        'universe': {'type': 'index', 'value': 'ALL_A'},
        'signals': [{'factor': 'MOM_20D', 'weight': 1.0}],
        'selection': {'method': 'top_n', 'n': 1},
        'rebalance': {'frequency': 'daily'}
    }
    
    engine = BacktestEngine(data=df, dsl=dsl, initial_capital=10000, commission_rate=0, slippage_bps=0)
    
    # Overwrite get_factor_data to mock a factor
    def mock_factor(factor):
        # 000001 always scores higher
        s = pd.Series(index=df.index, data=0)
        s.loc[(slice(None), '000001.SZ')] = 1.0
        return s
        
    engine.get_factor_data = mock_factor
    
    summary, nav, trades, pos = engine.run()
    
    assert not trades.empty
    
    # First trade should be at date index 1 (T+1)
    first_trade_date = trades.iloc[0]['date']
    dates = df.index.levels[0].strftime('%Y-%m-%d')
    assert first_trade_date == dates[1] # Signal at T=0, exec at T=1

def test_commission_and_slippage():
    df = get_dummy_data()
    dsl = {
        'universe': {'type': 'index', 'value': 'ALL_A'},
        'signals': [{'factor': 'MOM_20D', 'weight': 1.0}],
        'selection': {'method': 'top_n', 'n': 1},
        'rebalance': {'frequency': 'daily'}
    }
    
    def mock_factor(factor):
        s = pd.Series(index=df.index, data=0)
        s.loc[(slice(None), '000001.SZ')] = 1.0
        return s
        
    # Run with 0 cost
    engine1 = BacktestEngine(data=df, dsl=dsl, initial_capital=10000, commission_rate=0, slippage_bps=0)
    engine1.get_factor_data = mock_factor
    sum1, _, _, _ = engine1.run()
    
    # Run with cost
    engine2 = BacktestEngine(data=df, dsl=dsl, initial_capital=10000, commission_rate=0.01, slippage_bps=100)
    engine2.get_factor_data = mock_factor
    sum2, _, _, _ = engine2.run()
    
    # Cost should reduce return
    assert sum2['total_return'] < sum1['total_return']

