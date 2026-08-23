"""
Penguin Quant Python Quant Service
FastAPI backend for AKShare data fetching, factor calculations, backtesting & ML.
"""
from fastapi import FastAPI, HTTPException, Header, Depends, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import akshare as ak
import pandas as pd
import numpy as np
import datetime

app = FastAPI(
    title="Penguin Quant Quant Core Service",
    version="1.0.0",
    description="High performance financial data & quantitative analytics engine"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERNAL_TOKEN = os.getenv("QUANT_SERVICE_TOKEN", "penguinquant_internal_dev_token")

def verify_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        # In local dev environment, allow if not configured
        return True
    token = authorization.replace("Bearer ", "").strip()
    if token != INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid Internal Quant Token")
    return True

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "penguinquant-quant-service",
        "version": "1.0.0",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "akshare_version": getattr(ak, "__version__", "1.15.50")
    }

# 1. Market Data: Spot & Realtime
@app.get("/api/v1/market/spot/cn")
def get_cn_spot(limit: int = 100):
    try:
        df = ak.stock_zh_a_spot_em()
        # Normalize columns according to Rule 44 & 45
        col_map = {
            "代码": "symbol",
            "名称": "name",
            "最新价": "price",
            "涨跌幅": "change_percent",
            "涨跌额": "change_amount",
            "成交量": "volume",
            "成交额": "amount",
            "振幅": "amplitude",
            "最高": "high",
            "最低": "low",
            "今开": "open",
            "昨收": "prev_close",
            "量比": "volume_ratio",
            "换手率": "turnover_rate",
            "市盈率-动态": "pe",
            "市净率": "pb",
            "总市值": "total_market_cap",
            "流通市值": "float_market_cap"
        }
        df = df.rename(columns=col_map)
        records = df.head(limit).to_dict(orient="records")
        return {
            "market": "CN",
            "source": "akshare",
            "fetched_at": datetime.datetime.now().isoformat(),
            "count": len(records),
            "data": records
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AKShare spot error: {str(e)}")

# 2. Historical K-Lines (Daily / QFQ)
@app.get("/api/v1/market/bars/cn")
def get_cn_kline(
    symbol: str = Query(..., description="Stock symbol, e.g., 600519 or 000001"),
    period: str = "daily",
    adjust: str = "qfq",
    start_date: str = "20240101",
    end_date: Optional[str] = None
):
    if not end_date:
        end_date = datetime.datetime.now().strftime("%Y%m%d")
    
    clean_symbol = symbol.split(".")[0]
    try:
        df = ak.stock_zh_a_hist(
            symbol=clean_symbol,
            period=period,
            start_date=start_date,
            end_date=end_date,
            adjust=adjust
        )
        col_map = {
            "日期": "date",
            "开盘": "open",
            "最高": "high",
            "最低": "low",
            "收盘": "close",
            "成交量": "volume",
            "成交额": "amount",
            "振幅": "amplitude",
            "涨跌幅": "change_percent",
            "换手率": "turnover_rate"
        }
        df = df.rename(columns=col_map)
        records = df.to_dict(orient="records")
        return {
            "symbol": symbol,
            "period": period,
            "adjust": adjust,
            "source": "akshare",
            "count": len(records),
            "data": records
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AKShare hist error for {symbol}: {str(e)}")

# 3. Macro & Index
@app.get("/api/v1/market/macro/gdp")
def get_macro_gdp():
    try:
        df = ak.macro_china_gdp()
        return {"data": df.head(20).to_dict(orient="records")}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AKShare macro error: {str(e)}")
