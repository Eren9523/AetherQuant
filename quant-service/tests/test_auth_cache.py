"""
Authentication & TTL Cache Unit Tests
"""
import time
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.market_service import MarketService, CacheEntry

client = TestClient(app)

def test_health_endpoint_unauthenticated():
    """Health check must pass without authentication"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == settings.SERVICE_NAME
    assert data["status"] == "healthy"
    assert "akshare_version" in data
    assert "timestamp" in data

def test_quant_auth_required():
    """Accessing /v1/* without auth token returns 401 QUANT_AUTH_REQUIRED"""
    response = client.get("/v1/market/cn/spot")
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "QUANT_AUTH_REQUIRED"

def test_quant_auth_invalid():
    """Accessing /v1/* with incorrect token returns 401 QUANT_AUTH_INVALID"""
    headers = {"Authorization": "Bearer wrong_invalid_secret"}
    response = client.get("/v1/market/cn/spot", headers=headers)
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "QUANT_AUTH_INVALID"

def test_ttl_cache_mechanism():
    """Verify TTL Cache behavior and expiration"""
    svc = MarketService()
    
    # Store test item with 1s TTL
    svc._set_cache("test:key", {"val": 123}, ttl_seconds=1)
    
    # Immediate fetch -> valid
    res = svc._get_cache("test:key")
    assert res is not None
    data, created_at = res
    assert data["val"] == 123
    
    # Sleep past expiration -> None
    time.sleep(1.1)
    res_expired = svc._get_cache("test:key")
    assert res_expired is None
