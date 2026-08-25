"""
Quant Service Configuration Module
Penguin Quant Core Python Configuration
"""
import os
from typing import Optional, List

class Settings:
    SERVICE_NAME: str = "penguinquant-quant-service"
    VERSION: str = "2.0.0"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Internal Auth Token (Required for internal snapshot & pipeline endpoints)
    QUANT_SERVICE_TOKEN: Optional[str] = os.getenv("QUANT_SERVICE_TOKEN", "local-dev-quant-token-2026")
    
    # Provider Order (Comma-separated: tx,em,sina). Tencent is the default
    # primary path because the full-market endpoint is fetched concurrently;
    # EastMoney remains a real AKShare fallback.
    AKSHARE_PROVIDER_ORDER_RAW: str = os.getenv("AKSHARE_PROVIDER_ORDER", "tx,em,sina")
    
    # Cache TTL Configurations (Seconds)
    SPOT_CACHE_TTL_SECONDS: int = int(os.getenv("SPOT_CACHE_TTL_SECONDS", "20"))
    HISTORY_CACHE_TTL_SECONDS: int = int(os.getenv("HISTORY_CACHE_TTL_SECONDS", "1800")) # 30 mins
    
    # Validation
    MARKET_MIN_STOCK_COUNT: int = int(os.getenv("MARKET_MIN_STOCK_COUNT", "4000"))

    @property
    def provider_order(self) -> List[str]:
        return [p.strip().lower() for p in self.AKSHARE_PROVIDER_ORDER_RAW.split(",") if p.strip()]

settings = Settings()
