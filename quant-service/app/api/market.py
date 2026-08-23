"""
Market Data API Router
FastAPI Endpoints for CN Market Spot, Indices, Overview, Stock Detail, History, Minute, and Chart.
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
    IndexResponseData,
    MarketOverviewData,
    StockDetailData,
    HistoryResponseData,
    ChartResponseData,
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
    page: int = Query(1, ge=1, description="页码，默认 1"),
    page_size: int = Query(50, ge=1, le=200, description="每页条数，默认 50，最大 200"),
    search: Optional[str] = Query(None, description="搜索关键词 (股票代码或名称)"),
    sort_by: Optional[str] = Query("change_pct", description="排序字段 (change_pct, turnover, volume, turnover_rate, total_market_cap, pe_dynamic, pb)"),
    sort_order: Optional[str] = Query("desc", description="排序方向 (asc 或 desc)"),
    exchange: Optional[str] = Query(None, description="交易所筛选 (SH / SZ / BJ)"),
    symbols: Optional[str] = Query(None, description="逗号分隔的6位股票代码列表 (例如: 600519,000001)"),
    _token: str = Depends(verify_quant_token)
):
    """
    Get real-time spot quotes for CN A-share market with server-side search, sort, and pagination.
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
        data = market_service.get_spot_data(
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order or "desc",
            exchange=exchange,
            symbols=symbol_list
        )
        return ApiResponse(success=True, data=data)
    except AKShareProviderError as e:
        status_code = 502 if e.code == "AKSHARE_UPSTREAM_ERROR" else (501 if e.code == "PERIOD_NOT_SUPPORTED" else 404)
        return JSONResponse(
            status_code=status_code,
            content={"success": False, "error": {"code": e.code, "message": e.message}}
        )
    except Exception:
        logger.exception("Unexpected error in get_cn_spot_market")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "量化行情服务内部异常"}}
        )

@router.get("/v1/market/cn/indices", response_model=ApiResponse[IndexResponseData])
def get_cn_indices(
    _token: str = Depends(verify_quant_token)
):
    """
    Get real-time market indices (上证指数, 深证成指, 创业板指, 沪深300).
    """
    try:
        data = market_service.get_indices_data()
        return ApiResponse(success=True, data=data)
    except AKShareProviderError as e:
        return JSONResponse(
            status_code=502 if e.code == "AKSHARE_UPSTREAM_ERROR" else 404,
            content={"success": False, "error": {"code": e.code, "message": e.message}}
        )
    except Exception:
        logger.exception("Unexpected error in get_cn_indices")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "量化行情服务内部异常"}}
        )

@router.get("/v1/market/cn/overview", response_model=ApiResponse[MarketOverviewData])
def get_cn_market_overview(
    _token: str = Depends(verify_quant_token)
):
    """
    Get market breadth and advance/decline distribution stats.
    """
    try:
        data = market_service.get_market_overview()
        return ApiResponse(success=True, data=data)
    except AKShareProviderError as e:
        return JSONResponse(
            status_code=502 if e.code == "AKSHARE_UPSTREAM_ERROR" else 404,
            content={"success": False, "error": {"code": e.code, "message": e.message}}
        )
    except Exception:
        logger.exception("Unexpected error in get_cn_market_overview")
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "量化行情服务内部异常"}}
        )

@router.get("/v1/market/cn/stocks/{symbol}", response_model=ApiResponse[StockDetailData])
def get_cn_stock_detail(
    symbol: str = Path(..., description="6位A股股票代码 (例如: 600519)"),
    _token: str = Depends(verify_quant_token)
):
    """
    Get real quote and basic company info for a single stock.
    """
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

    try:
        data = market_service.get_stock_detail(symbol.strip())
        return ApiResponse(success=True, data=data)
    except AKShareProviderError as e:
        return JSONResponse(
            status_code=502 if e.code == "AKSHARE_UPSTREAM_ERROR" else 404,
            content={"success": False, "error": {"code": e.code, "message": e.message}}
        )
    except Exception:
        logger.exception("Unexpected error in get_cn_stock_detail for %s", symbol)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "量化行情服务内部异常"}}
        )

@router.get("/v1/market/cn/stocks/{symbol}/history", response_model=ApiResponse[HistoryResponseData])
def get_cn_stock_history(
    symbol: str = Path(..., description="6位A股股票代码 (例如: 600519)"),
    period: str = Query("daily", description="K线周期 (daily / weekly / monthly)"),
    start: Optional[str] = Query(None, description="起始日期 (YYYYMMDD)"),
    end: Optional[str] = Query(None, description="结束日期 (YYYYMMDD)"),
    adjust: str = Query("none", description="复权类型 (none / qfq / hfq)"),
    _token: str = Depends(verify_quant_token)
):
    """
    Get historical daily, weekly, or monthly K-line bars for a single CN stock.
    """
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

    clean_period = period.strip().lower()
    if clean_period not in ("daily", "weekly", "monthly"):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_PERIOD",
                    "message": f"周期类型错误 [{period}]，仅允许 'daily'、'weekly'、'monthly'"
                }
            }
        )

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
            period=clean_period,
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

@router.get("/v1/market/cn/stocks/{symbol}/minute", response_model=ApiResponse[HistoryResponseData])
def get_cn_stock_minute(
    symbol: str = Path(..., description="6位A股股票代码 (例如: 600519)"),
    period: str = Query("5", description="分钟周期 (1 / 5 / 15 / 30 / 60)"),
    start: Optional[str] = Query(None, description="起始时间 (YYYY-MM-DD HH:mm:ss)"),
    end: Optional[str] = Query(None, description="结束时间 (YYYY-MM-DD HH:mm:ss)"),
    adjust: str = Query("none", description="复权类型 (none / qfq / hfq)"),
    _token: str = Depends(verify_quant_token)
):
    """
    Get minute-level K-line bars for a single CN stock.
    """
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

    clean_period = str(period).strip().replace("m", "")
    if clean_period not in ("1", "5", "15", "30", "60"):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "PERIOD_NOT_SUPPORTED",
                    "message": f"不支持的分钟周期 [{period}]，仅支持 1, 5, 15, 30, 60"
                }
            }
        )

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
        data = market_service.get_stock_minute(
            symbol=symbol,
            period=clean_period,
            start_date=start,
            end_date=end,
            adjust=clean_adjust
        )
        return ApiResponse(success=True, data=data)
    except AKShareProviderError as e:
        status_code = 501 if e.code == "PERIOD_NOT_SUPPORTED" else (502 if e.code == "AKSHARE_UPSTREAM_ERROR" else 404)
        return JSONResponse(
            status_code=status_code,
            content={"success": False, "error": {"code": e.code, "message": e.message}}
        )
    except Exception:
        logger.exception("Unexpected error in get_cn_stock_minute for %s", symbol)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "量化行情服务内部异常"}}
        )

@router.get("/v1/market/cn/stocks/{symbol}/chart", response_model=ApiResponse[ChartResponseData])
def get_cn_stock_chart(
    symbol: str = Path(..., description="6位A股股票代码 (例如: 600519)"),
    interval: str = Query("1d", description="K线周期 (1m, 5m, 15m, 30m, 60m, 1d, 1w, 1M)"),
    adjust: str = Query("qfq", description="复权类型 (none / qfq / hfq)"),
    _token: str = Depends(verify_quant_token)
):
    """
    Unified chart query endpoint optimized for frontend chart components.
    """
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

    valid_intervals = ("1m", "5m", "15m", "30m", "60m", "1d", "1w", "1M", "daily", "weekly", "monthly")
    if interval.strip() not in valid_intervals:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_INTERVAL",
                    "message": f"不支持的图表周期 [{interval}]"
                }
            }
        )

    clean_adjust = adjust.strip().lower()
    if clean_adjust not in ("none", "qfq", "hfq"):
        clean_adjust = "qfq"

    try:
        data = market_service.get_stock_chart(
            symbol=symbol,
            interval=interval.strip(),
            adjust=clean_adjust
        )
        return ApiResponse(success=True, data=data)
    except AKShareProviderError as e:
        status_code = 501 if e.code == "PERIOD_NOT_SUPPORTED" else (502 if e.code == "AKSHARE_UPSTREAM_ERROR" else 404)
        return JSONResponse(
            status_code=status_code,
            content={"success": False, "error": {"code": e.code, "message": e.message}}
        )
    except Exception:
        logger.exception("Unexpected error in get_cn_stock_chart for %s", symbol)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "量化行情服务内部异常"}}
        )
