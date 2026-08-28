from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
import uuid
import time
from datetime import datetime
import json
import io
import requests
import os
import hashlib
import logging

from app.core.backtest import BacktestEngine
from app.api.factor import AKShareProvider # reuse data fetcher

router = APIRouter()
logger = logging.getLogger(__name__)

class RunBacktestRequest(BaseModel):
    user_id: str
    run_id: str
    strategy_id: str
    strategy_version: int
    dsl: Dict[str, Any]
    start_date: str
    end_date: str
    initial_capital: float = 1000000.0
    commission_rate: float = 0.0003
    slippage_bps: float = 1.0
    worker_url: str
    worker_token: Optional[str] = None

class RunBacktestResponse(BaseModel):
    success: bool
    summary: Optional[Dict[str, Any]] = None
    result_r2_key: Optional[str] = None
    error: Optional[str] = None

@router.post("/run", response_model=RunBacktestResponse)
def run_backtest(req: RunBacktestRequest):
    try:
        # Cache check
        dsl_str = json.dumps(req.dsl, sort_keys=True)
        cache_str = f"{req.strategy_id}_{req.strategy_version}_{dsl_str}_{req.start_date}_{req.end_date}_{req.commission_rate}_{req.slippage_bps}_{req.initial_capital}"
        cache_hash = hashlib.sha256(cache_str.encode()).hexdigest()
        base_path = f"backtests/{req.user_id}/{req.run_id}" # use run_id to persist or use cache hash
        
        headers = {}
        if req.worker_token:
            headers["Authorization"] = f"Bearer {req.worker_token}"

        # Get Data
        df = None
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
                    hist = AKShareProvider.get_cn_stock_history(sym, start_date=req.start_date.replace('-',''), end_date=req.end_date.replace('-',''))
                    if not hist.empty:
                        hist['symbol'] = sym
                        hist = hist.rename(columns={'date': 'date', 'open': 'OPEN', 'high': 'HIGH', 'low': 'LOW', 'close': 'CLOSE', 'volume': 'VOLUME'})
                        dfs.append(hist)
                except Exception as e:
                    pass
            if not dfs:
                raise ValueError("BACKTEST_DATA_NOT_READY")
            df = pd.concat(dfs)
            df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
            df.to_parquet(cache_file)
            
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values(by=['date', 'symbol'])
        df = df.set_index(['date', 'symbol'])

        # Filter by dates
        start_ts = pd.to_datetime(req.start_date)
        end_ts = pd.to_datetime(req.end_date)
        
        # Need some history for factors (e.g. 60 days before start)
        # So we don't strict filter, evaluator handles rolling.
        
        engine = BacktestEngine(
            data=df,
            dsl=req.dsl,
            initial_capital=req.initial_capital,
            commission_rate=req.commission_rate,
            slippage_bps=req.slippage_bps
        )
        
        summary, df_nav, df_trades, df_pos = engine.run()
        
        # Ensure we filter output to start_date - end_date 
        df_nav['date_dt'] = pd.to_datetime(df_nav['date'])
        df_nav = df_nav[(df_nav['date_dt'] >= start_ts) & (df_nav['date_dt'] <= end_ts)]
        df_nav = df_nav.drop(columns=['date_dt'])
        
        # Save to R2
        def save_parquet(df_obj, filename):
            if df_obj.empty: return
            buf = io.BytesIO()
            df_obj.to_parquet(buf, engine='pyarrow')
            buf.seek(0)
            requests.put(f"{req.worker_url}/api/v1/datasets/internal/r2/{base_path}/{filename}", headers=headers, data=buf.read())

        save_parquet(df_nav, 'nav.parquet')
        save_parquet(df_trades, 'trades.parquet')
        save_parquet(df_pos, 'positions.parquet')
        
        # Save JSON for frontend
        df_nav_json = df_nav.to_dict(orient='records')
        df_trades_json = df_trades.to_dict(orient='records') if not df_trades.empty else []
        requests.put(f"{req.worker_url}/api/v1/datasets/internal/r2/{base_path}/nav.json", headers=headers, data=json.dumps(df_nav_json))
        requests.put(f"{req.worker_url}/api/v1/datasets/internal/r2/{base_path}/trades.json", headers=headers, data=json.dumps(df_trades_json))
        
        # Save Summary
        requests.put(f"{req.worker_url}/api/v1/datasets/internal/r2/{base_path}/summary.json", headers=headers, data=json.dumps(summary))

        return RunBacktestResponse(
            success=True,
            summary=summary,
            result_r2_key=base_path
        )
        
    except Exception as e:
        logger.exception("Backtest run failed")
        return RunBacktestResponse(success=False, error=str(e))
