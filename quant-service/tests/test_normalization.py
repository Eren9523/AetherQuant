"""
Normalization & Schema Unit Tests
"""
import math
import pandas as pd
from app.services.market_service import MarketService
from app.schemas.market import SpotStockItem, KLineBar

def test_symbol_leading_zero_preserved():
    """Verify 000001 is preserved as string with leading zero, not converted to 1"""
    raw_data = {
        "代码": ["000001", "000002", "600519", "830001"],
        "名称": ["平安银行", "万科A", "贵州茅台", "北交测试"],
        "最新价": [10.5, 8.2, 1600.0, 5.0],
        "今开": [10.4, 8.1, 1590.0, 4.9],
        "最高": [10.6, 8.3, 1610.0, 5.1],
        "最低": [10.3, 8.0, 1585.0, 4.8],
        "昨收": [10.4, 8.2, 1590.0, 4.9],
        "涨跌额": [0.1, 0.0, 10.0, 0.1],
        "涨跌幅": [0.96, 0.0, 0.63, 2.04],
        "成交量": [100000, 50000, 20000, 1000],
        "成交额": [1050000.0, 410000.0, 32000000.0, 5000.0],
        "换手率": [0.5, 0.3, 0.2, 0.1],
        "振幅": [2.88, 3.66, 1.57, 6.12],
        "市盈率-动态": [5.2, 6.1, 28.5, 12.0],
        "市净率": [0.6, 0.7, 8.2, 1.5],
        "总市值": [200000000000.0, 95000000000.0, 2000000000000.0, 500000000.0],
        "流通市值": [200000000000.0, 95000000000.0, 2000000000000.0, 500000000.0]
    }
    df = pd.DataFrame(raw_data)
    
    svc = MarketService()
    # Mock spot df cache
    svc._cache["spot:full_market_df"] = type("MockEntry", (), {
        "data": df,
        "is_valid": lambda self: True,
        "created_at": "2026-08-23T00:00:00Z"
    })()
    
    res = svc.get_spot_data(symbols=["000001", "600519"])
    assert res.count == 2
    
    pingan = next(s for s in res.stocks if s.symbol == "000001")
    assert pingan.symbol == "000001"
    assert isinstance(pingan.symbol, str)
    assert pingan.exchange == "SZ"
    assert pingan.name == "平安银行"
    assert pingan.last == 10.5
    
    maotai = next(s for s in res.stocks if s.symbol == "600519")
    assert maotai.symbol == "600519"
    assert maotai.exchange == "SH"

def test_nan_and_inf_handling():
    """Verify NaN / Inf are sanitized to None (null in JSON)"""
    clean_fn = MarketService._clean_float
    assert clean_fn(None) is None
    assert clean_fn(float("nan")) is None
    assert clean_fn(float("inf")) is None
    assert clean_fn(float("-inf")) is None
    assert clean_fn("NaN") is None
    assert clean_fn(12.34567) == 12.3457

def test_exchange_detection():
    detect = MarketService._detect_exchange
    assert detect("600519") == "SH"
    assert detect("688981") == "SH"
    assert detect("000001") == "SZ"
    assert detect("300750") == "SZ"
    assert detect("830001") == "BJ"
    assert detect("430002") == "BJ"
    assert detect("920002") == "BJ"
