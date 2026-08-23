"""
Market Data API Router
FastAPI Endpoints for CN Market Spot & History
"""
import re
import secrets
import logging
import datetime
from typing import Optional, List
from fastapi import APIRouter, Header, HTTPException, Query, Path, Depends
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.providers.akshare_provider import AKShareProvider, AKShareProviderError
from app.services.market_service import market_service
from app.schemas.market import (
    ApiResponse,
    SpotResponseData,
    HistoryResponseData,
    HealthResponseData,
    ApiErrorDetail
)

logger = logging.getLogger("market_api")
router = APIRouter()

def verify_quant_token(authorization: Optional[str] = Header(None)) -> str:
    """
    Validates internal service Bearer token using constant-time comparison.
    If QUANT_SERVICE_TOKEN is not configured on server, returns 503 QUANT_AUTH_NOT_CONFIGURED.
    """
    expected_token = settings.QUANT_SERVICE_TOKEN
    if not expected_token or not expected_token.strip():
        raise HTTPException(
            status_code=503,
            detail={"code": "QUANT_AUTH_NOT_CONFIGURED", "message": "Quant Service 鉴权密钥未在服务端配置 (QUANT_SERVICE_TOKEN 未设置)"}
        )

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={"code": "QUANT_AUTH_REQUIRED", "message": "缺失 Quant Service 鉴权凭证 (Authorization Header)"}
        )
    
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail={"code": "QUANT_AUTH_INVALID", "message": "鉴权格式错误，必须为 Bearer <TOKEN>"}
        )
    
    token = parts[1].strip()
    if not secrets.compare_digest(token, expected_token.strip()):
        raise HTTPException(
            status_code=401,
            detail={"code": "QUANT_AUTH_INVALID", "message": "Quant Service 鉴权 Token 校验失败"}
        )
    
    return token

@router.get("/health", response_model=HealthResponseData)
def health_check():
    """
    Health check probe for Quant Service & AKShare status.
    Unauthenticated.
    """
    ak_ver = AKShareProvider.get_version()
    status = "healthy" if ak_ver not in ("not_installed", "unknown") else "unavailable"
    return HealthResponseData(
        service=settings.SERVICE_NAME,
        status=status,
        akshare_version=ak_ver,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z"
    )

@router.get("/v1/market/cn/spot", response_model=ApiResponse[SpotResponseData])
def get_cn_spot_market(
    symbols: Optional[str] = Query(None, description="逗号分隔的6位股票代码列表 (例如: 600519,000001)"),
    full_market: bool = Query(False, description="是否返回全市场5000+标的"),
    _token: str = Depends(verify_quant_token)
):
    """
    Get real-time spot quotes for CN A-share market.
    """
    symbol_list: Optional[List[str]] = None
    if symbols:
        raw_symbols = [s.strip() for s in symbols.split(",") if s.strip()]
        for s in raw_symbols:
            if not re.match(r"^\d{6}$", s):
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "error": {
                            "code": "INVALID_SYMBOL",
                            "message": f"股票代码格式错误 [{s}]，必须为 6 位数字"
                        }
                    }
                )
        symbol_list = raw_symbols

    try:
        data = market_service.get_spot_data(symbols=symbol_list, full_market=full_market)
        return ApiResponse(success=True, data=data)
    except AKShareProviderError as e:
        return JSONResponse(
            status_code=502 if e.code == "AKSHARE_UPSTREAM_ERROR" else 404,
            content={"success": False, "error": {"code": e.code, "message": e.message}}
        )
    except Exception:
        logger.exception("Unexpected error in get_cn_spot_market")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "量化行情服务内部异常"}}
        )

@router.get("/v1/market/cn/stocks/{symbol}/history", response_model=ApiResponse[HistoryResponseData])
def get_cn_stock_history(
    symbol: str = Path(..., description="6位A股股票代码 (例如: 600519)"),
    start: Optional[str] = Query(None, description="起始日期 (YYYYMMDD)"),
    end: Optional[str] = Query(None, description="结束日期 (YYYYMMDD)"),
    adjust: str = Query("none", description="复权类型 (none / qfq / hfq)"),
    _token: str = Depends(verify_quant_token)
):
    """
    Get historical daily K-line bars for a single CN stock.
    """
    # 1. Validate symbol
    if not re.match(r"^\d{6}$", symbol.strip()):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_SYMBOL",
                    "message": f"股票代码格式错误 [{symbol}]，必须为 6 位数字代码"
                }
            }
        )

    # 2. Validate start & end date format YYYYMMDD
    if start and not re.match(r"^\d{8}$", start.strip()):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_DATE_RANGE",
                    "message": f"起始日期格式错误 [{start}]，必须为 YYYYMMDD 格式"
                }
            }
        )

    if end and not re.match(r"^\d{8}$", end.strip()):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_DATE_RANGE",
                    "message": f"结束日期格式错误 [{end}]，必须为 YYYYMMDD 格式"
                }
            }
        )

    # 3. Validate adjust parameter
    clean_adjust = adjust.strip().lower()
    if clean_adjust not in ("none", "qfq", "hfq"):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_ADJUST",
                    "message": f"复权类型错误 [{adjust}]，仅允许 'none'、'qfq'、'hfq'"
                }
            }
        )

    try:
        data = market_service.get_stock_history(
            symbol=symbol,
            start_date=start,
            end_date=end,
            adjust=clean_adjust
        )
        return ApiResponse(success=True, data=data)
    except AKShareProviderError as e:
        return JSONResponse(
            status_code=502 if e.code == "AKSHARE_UPSTREAM_ERROR" else 404,
            content={"success": False, "error": {"code": e.code, "message": e.message}}
        )
    except Exception:
        logger.exception("Unexpected error in get_cn_stock_history for %s", symbol)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "量化行情服务内部异常"}}
        )
