"""
AKShare Live / Smoke Integration Tests
Validates upstream AKShare functions when network & dependencies are available.
"""
import pytest
from app.providers.akshare_provider import AKShareProvider, AKShareProviderError

def test_akshare_version_check():
    version = AKShareProvider.get_version()
    assert version is not None

def test_akshare_spot_smoke():
    """Smoke test: stock_zh_a_spot_em()"""
    try:
        df = AKShareProvider.get_cn_spot()
        assert df is not None
        assert not df.empty
        assert "代码" in df.columns
        assert "最新价" in df.columns
        assert "名称" in df.columns
    except AKShareProviderError as e:
        if e.code == "AKSHARE_UPSTREAM_ERROR":
            pytest.skip(f"AKShare upstream offline or dependencies unavailable: {e.message}")
        raise

def test_akshare_history_smoke_600519():
    """Smoke test: stock_zh_a_hist('600519') for recent period"""
    try:
        df = AKShareProvider.get_cn_stock_history(
            symbol="600519",
            start_date="20260101",
            end_date="20260301",
            adjust="qfq"
        )
        assert df is not None
        assert not df.empty
        assert "日期" in df.columns
        assert "收盘" in df.columns
        assert "开盘" in df.columns
        assert "最高" in df.columns
        assert "最低" in df.columns
    except AKShareProviderError as e:
        if e.code == "AKSHARE_UPSTREAM_ERROR":
            pytest.skip(f"AKShare upstream offline or dependencies unavailable: {e.message}")
        raise
