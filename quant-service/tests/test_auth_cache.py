"""
Authentication, Health & TTL Cache Unit Tests for P7.0.1 Hardening
"""
import time
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.market_service import MarketService
from app.providers.akshare_provider import AKShareProvider

client = TestClient(app)

def test_health_endpoint_when_akshare_missing():
    """Test G: Health endpoint truthfulness - if akshare is missing, status must not be 'healthy'"""
    with patch.object(AKShareProvider, "get_version", return_value="not_installed"):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == settings.SERVICE_NAME
        assert data["status"] == "unavailable"
        assert data["status"] != "healthy"
        assert data["akshare_version"] == "not_installed"

def test_quant_service_no_cors_wildcard():
    """Test H: Quant service response must NOT include Access-Control-Allow-Origin: *"""
    response = client.get("/health")
    assert "access-control-allow-origin" not in response.headers

def test_quant_auth_unconfigured_503():
    """Test A: If QUANT_SERVICE_TOKEN is not configured on server, all /v1/* return 503"""
    original_token = settings.QUANT_SERVICE_TOKEN
    try:
        settings.QUANT_SERVICE_TOKEN = None
        headers = {"Authorization": "Bearer any_token"}
        response = client.get("/v1/market/cn/spot", headers=headers)
        assert response.status_code == 503
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "QUANT_AUTH_NOT_CONFIGURED"
    finally:
        settings.QUANT_SERVICE_TOKEN = original_token

def test_quant_auth_required_401():
    """Accessing /v1/* without auth token returns 401 QUANT_AUTH_REQUIRED"""
    original_token = settings.QUANT_SERVICE_TOKEN
    try:
        settings.QUANT_SERVICE_TOKEN = "test_hardened_secret_token_123"
        response = client.get("/v1/market/cn/spot")
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "QUANT_AUTH_REQUIRED"
    finally:
        settings.QUANT_SERVICE_TOKEN = original_token

def test_quant_auth_invalid_401():
    """Test B: Accessing /v1/* with incorrect token returns 401 QUANT_AUTH_INVALID"""
    original_token = settings.QUANT_SERVICE_TOKEN
    try:
        settings.QUANT_SERVICE_TOKEN = "test_hardened_secret_token_123"
        headers = {"Authorization": "Bearer wrong_invalid_secret"}
        response = client.get("/v1/market/cn/spot", headers=headers)
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "QUANT_AUTH_INVALID"
    finally:
        settings.QUANT_SERVICE_TOKEN = original_token

def test_quant_auth_correct_token_pass():
    """Test C: Accessing /v1/* with correct token passes authentication (no 401 / 503 auth errors)"""
    original_token = settings.QUANT_SERVICE_TOKEN
    try:
        settings.QUANT_SERVICE_TOKEN = "test_hardened_secret_token_123"
        headers = {"Authorization": "Bearer test_hardened_secret_token_123"}
        # Sending request with invalid symbol to verify auth passed before business validation
        response = client.get("/v1/market/cn/spot?symbols=invalid_sym", headers=headers)
        # Should reach business validator (status 400 INVALID_SYMBOL), not 401 auth failure
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == "INVALID_SYMBOL"
    finally:
        settings.QUANT_SERVICE_TOKEN = original_token

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
