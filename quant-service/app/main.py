"""
Penguin Quant Core Python Service
FastAPI Application Entry Point
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.market import router as market_router
from app.providers.akshare_provider import AKShareProvider

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s"
)
logger = logging.getLogger("quant-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Log Python & AKShare version
    ak_ver = AKShareProvider.get_version()
    logger.info("==================================================")
    logger.info("Starting %s v%s", settings.SERVICE_NAME, settings.VERSION)
    logger.info("AKShare Installed Version: %s", ak_ver)
    logger.info("==================================================")
    yield
    logger.info("Shutting down %s", settings.SERVICE_NAME)

app = FastAPI(
    title="Penguin Quant Python Market Service",
    version=settings.VERSION,
    description="High-performance A-share market data normalization & gateway service powered by AKShare",
    lifespan=lifespan
)

# CORS Policy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers conforming to AetherQuant error schema
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": detail.get("code", "HTTP_ERROR"),
                    "message": detail.get("message", "请求处理失败")
                }
            }
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": str(detail)
            }
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "量化微服务发生未捕获的内部异常"
            }
        }
    )

# Include API Router
app.include_router(market_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False
    )
