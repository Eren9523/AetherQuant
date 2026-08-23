"""
Quant Service Configuration Module
"""
import os
from typing import Optional

class Settings:
    SERVICE_NAME: str = "penguinquant-quant-service"
    VERSION: str = "1.0.0"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Internal Auth Token
    QUANT_SERVICE_TOKEN: str = os.getenv("QUANT_SERVICE_TOKEN", "penguinquant_internal_dev_token")
    
    # Cache TTL Configurations (Seconds)
    SPOT_CACHE_TTL_SECONDS: int = int(os.getenv("SPOT_CACHE_TTL_SECONDS", "20"))
    HISTORY_CACHE_TTL_SECONDS: int = int(os.getenv("HISTORY_CACHE_TTL_SECONDS", "1800")) # 30 mins

settings = Settings()
