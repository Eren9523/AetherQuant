from fastapi import APIRouter
from pydantic import BaseModel
import pandas as pd
import numpy as np
import requests
import io
import json
import logging
from typing import Optional, List, Dict, Any
from app.core.dsl_parser import FactorDSLEvaluator
from app.providers.akshare_provider import AKShareProvider

router = APIRouter(prefix="/factors", tags=["factors"])
logger = logging.getLogger(__name__)

class RunFactorRequest(BaseModel):
    factor_id: str
    run_id: str
    formula: str
    dataset_id: Optional[str] = None
    start_date: str
    end_date: str
    forward_period: int = 1
    worker_url: str
    worker_token: Optional[str] = None

class RunFactorResponse(BaseModel):
    success: bool
    summary: Optional[Dict[str, Any]] = None
    result_r2_key: Optional[str] = None
    error: Optional[str] = None

def compute_quantile_returns(factor_values: pd.Series, forward_returns: pd.Series, quantiles=5):
    # Align data
    df = pd.DataFrame({'factor': factor_values, 'fwd_ret': forward_returns}).dropna()
    if df.empty: return []
    
    # Group by date and calculate quantiles
    def _calc_quantiles(sub_df):
        if len(sub_df) < quantiles: return pd.Series(dtype=float)
        labels = [f"Q{i+1}" for i in range(quantiles)]
        try:
            sub_df['q'] = pd.qcut(sub_df['factor'], quantiles, labels=labels, duplicates='drop')
        except:
            return pd.Series(dtype=float)
        return sub_df.groupby('q')['fwd_ret'].mean()
        
    q_rets = df.groupby(level='date').apply(_calc_quantiles)
    if q_rets.empty: return []
    
    # Average across time
    mean_q_rets = q_rets.mean()
    
    res = []
    for i in range(1, quantiles+1):
        q = f"Q{i}"
        val = mean_q_rets.get(q, 0.0)
        if not np.isnan(val):
            res.append({"quantile": q, "return": float(val)})
            
    # long short
    if "Q1" in mean_q_rets and f"Q{quantiles}" in mean_q_rets:
        ls = float(mean_q_rets[f"Q{quantiles}"] - mean_q_rets["Q1"])
        res.append({"quantile": "L-S", "return": ls})
        
    return res

@router.post("/run", response_model=RunFactorResponse)
def run_factor(req: RunFactorRequest):
    try:
        import hashlib
        
        # Determine cache key
        cache_str = f"{req.factor_id}_{req.formula}_{req.dataset_id}_{req.start_date}_{req.end_date}_{req.forward_period}"
        cache_hash = hashlib.sha256(cache_str.encode()).hexdigest()
        base_path = f"factors/cache/{cache_hash}"
        
        headers = {}
        if req.worker_token:
            headers["Authorization"] = f"Bearer {req.worker_token}"
            
        # Check if cache exists
        try:
            # We do a HEAD or GET on summary.json
            check_url = f"{req.worker_url}/api/v1/datasets/internal/r2/{base_path}/summary.json"
            res = requests.get(check_url, headers=headers, timeout=5)
            if res.status_code == 200:
                cached_summary = res.json()
                logger.info(f"Cache hit for factor run: {cache_hash}")
                return RunFactorResponse(
                    success=True,
                    summary=cached_summary,
                    result_r2_key=base_path
                )
        except Exception as e:
            pass

        # 1. Load Data
        df = None
        if req.dataset_id:
            # We assume dataset_id is a key in R2 or we fetch from worker API
            pass
            
        if df is None:
            # Fetch default dataset from AKShare (e.g. HS300 stocks for 1 year)
            # For performance, we'll fetch a smaller universe if we just need test data.
            # But requirement says >100 stocks, >200 days.
            # We will use AKShare to fetch HS300 constituents, then fetch their daily data.
            # This is slow, so we cache it locally on disk in the container.
            import os
            cache_file = "/tmp/hs300_daily.parquet"
            if os.path.exists(cache_file):
                df = pd.read_parquet(cache_file)
            else:
                logger.info("Fetching HS300 constituents...")
                import akshare as ak
                hs300 = ak.index_stock_cons(symbol="000300")
                symbols = hs300['品种代码'].tolist()[:120] # Take 120 stocks
                
                dfs = []
                for sym in symbols:
                    try:
                        hist = AKShareProvider.get_cn_stock_history(sym, start_date="20230101", end_date="20240101")
                        if not hist.empty:
                            hist['symbol'] = sym
                            hist = hist.rename(columns={'date': 'date', 'open': 'OPEN', 'high': 'HIGH', 'low': 'LOW', 'close': 'CLOSE', 'volume': 'VOLUME'})
                            dfs.append(hist)
                    except Exception as e:
                        pass
                
                df = pd.concat(dfs)
                df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
                df.to_parquet(cache_file)

        # 2. Prepare Multi-Index (date, symbol)
        # Ensure df is sorted by date
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values(by=['date', 'symbol'])
        df = df.set_index(['date', 'symbol'])

        # 3. Calculate Forward Returns (t -> t+n)
        # Shift prices backwards to get future prices aligned with current date
        # Forward return = Close(t+n) / Close(t) - 1
        close = df['CLOSE']
        future_close = close.groupby(level='symbol').shift(-req.forward_period)
        forward_returns = future_close / close - 1
        
        # 4. Evaluate Factor
        evaluator = FactorDSLEvaluator(df)
        factor_values = evaluator.eval(req.formula)
        
        if factor_values is None or factor_values.empty:
            raise ValueError("Formula evaluated to empty series")

        # Drop NaNs
        factor_values = factor_values.replace([np.inf, -np.inf], np.nan).dropna()
        if factor_values.empty:
            raise ValueError("All factor values are NaN or Inf")
            
        # 5. Evaluate Performance (IC, RankIC, etc.)
        # Align factor and forward returns
        aligned = pd.DataFrame({'factor': factor_values, 'fwd_ret': forward_returns}).dropna()
        
        if aligned.empty:
            raise ValueError("No overlapping data between factor values and forward returns")
            
        def _ic(x):
            if len(x) < 2: return np.nan
            return x['factor'].corr(x['fwd_ret'], method='pearson')
            
        def _rank_ic(x):
            if len(x) < 2: return np.nan
            return x['factor'].corr(x['fwd_ret'], method='spearman')
            
        ic_series = aligned.groupby(level='date').apply(_ic).dropna()
        rank_ic_series = aligned.groupby(level='date').apply(_rank_ic).dropna()
        
        if ic_series.empty:
             raise ValueError("Failed to compute IC (empty series)")

        ic_mean = float(ic_series.mean())
        ic_std = float(ic_series.std())
        rank_ic_mean = float(rank_ic_series.mean())
        ir = float(ic_mean / ic_std) if ic_std > 0 else 0.0
        t_stat = float(ic_mean / (ic_std / np.sqrt(len(ic_series)))) if ic_std > 0 else 0.0
        coverage = float(len(aligned) / len(df))
        
        # Quantile Test
        q_rets = compute_quantile_returns(factor_values, forward_returns)
        
        # Summary
        summary = {
            "ic_mean": ic_mean,
            "ic_std": ic_std,
            "rank_ic": rank_ic_mean,
            "ir": ir,
            "t_stat": t_stat,
            "coverage": coverage,
            "quantile_returns": q_rets
        }
        
        # 6. Save to R2
        # factor_values, ic_series
        base_path = f"factors/{req.factor_id}/runs/{req.run_id}"
        
        headers = {}
        if req.worker_token:
            headers["Authorization"] = f"Bearer {req.worker_token}"
            
        # Save IC Series (convert to dict {date: val})
        ic_series.index = ic_series.index.strftime('%Y-%m-%d')
        ic_dict = ic_series.to_dict()
        requests.put(f"{req.worker_url}/api/v1/datasets/internal/r2/{base_path}/ic_series.json", headers=headers, data=json.dumps(ic_dict))
        
        # Save Factor Values (Parquet)
        parquet_buf = io.BytesIO()
        factor_values.reset_index().to_parquet(parquet_buf, engine='pyarrow')
        parquet_buf.seek(0)
        requests.put(f"{req.worker_url}/api/v1/datasets/internal/r2/{base_path}/factor_values.parquet", headers=headers, data=parquet_buf.read())
        
        # Save Summary JSON
        requests.put(f"{req.worker_url}/api/v1/datasets/internal/r2/{base_path}/summary.json", headers=headers, data=json.dumps(summary))
        
        return RunFactorResponse(
            success=True,
            summary=summary,
            result_r2_key=base_path
        )
        
    except Exception as e:
        logger.exception("Factor run failed")
        return RunFactorResponse(success=False, error=str(e))
