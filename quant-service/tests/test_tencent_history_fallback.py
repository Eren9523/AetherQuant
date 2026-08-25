"""Deterministic tests for the real Tencent AKShare history fallback."""
import pandas as pd

from app.providers.akshare_provider import AKShareProvider
from app.providers.data_source_manager import DataSourceManager
from app.core.config import settings
from app.services.market_service import MarketService


def _tencent_daily_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": ["2026-08-20", "2026-08-21", "2026-08-24"],
            "open": [11.20, 11.36, 11.38],
            "close": [11.40, 11.41, 11.56],
            "high": [11.40, 11.46, 11.58],
            "low": [11.19, 11.32, 11.35],
            "volume": [1183578.0, 869128.0, 1199025.0],
            "turnover": [0.0061, 0.0045, 0.0062],
            "amount": [1338932697.0, 990112066.0, 1383380014.0],
        }
    )


def test_tencent_history_is_used_when_eastmoney_fails(monkeypatch):
    import akshare as ak

    def fail_eastmoney(**_kwargs):
        raise ConnectionError("eastmoney unavailable")

    monkeypatch.setattr(ak, "stock_zh_a_hist", fail_eastmoney)
    monkeypatch.setattr(ak, "stock_zh_a_hist_tx", lambda **_kwargs: _tencent_daily_frame())

    df = AKShareProvider.get_cn_stock_history(
        symbol="000001",
        period="daily",
        start_date="20260820",
        end_date="20260824",
        adjust="qfq",
    )

    assert df.attrs["provider"] == "tencent"
    assert df.attrs["source"] == "akshare"
    assert list(df["日期"]) == ["2026-08-20", "2026-08-21", "2026-08-24"]
    assert float(df.iloc[-1]["收盘"]) == 11.56
    assert round(float(df.iloc[-1]["换手率"]), 2) == 0.62


def test_tencent_weekly_uses_last_actual_trade_date(monkeypatch):
    import akshare as ak

    monkeypatch.setattr(ak, "stock_zh_a_hist", lambda **_kwargs: (_ for _ in ()).throw(ConnectionError()))
    monkeypatch.setattr(ak, "stock_zh_a_hist_tx", lambda **_kwargs: _tencent_daily_frame())

    result = MarketService().get_stock_history(
        symbol="000001",
        period="weekly",
        start_date="20260820",
        end_date="20260824",
        adjust="qfq",
    )

    assert result.provider == "tencent"
    assert result.source == "akshare"
    assert result.count == 2
    assert result.bars[-1].time == "2026-08-24"
    assert result.bars[-1].close == 11.56


def test_full_spot_prefers_real_akshare_and_does_not_fake_ohlc(monkeypatch):
    import akshare as ak

    frame = pd.DataFrame(
        [{
            "code": "sz000001",
            "name": "平安银行",
            "zxj": 11.59,
            "zd": 0.03,
            "zdf": 0.26,
            "volume": 994881,
            "turnover": 115224,
            "hsl": 0.51,
            "zf": 0.95,
            "pe_ttm": 5.18,
            "zsz": 2249.15,
            "ltsz": 2249.12,
        }]
    )
    monkeypatch.setattr(ak, "stock_zh_a_spot_tx", lambda: frame)
    monkeypatch.setattr(settings, "MARKET_MIN_STOCK_COUNT", 1)

    stocks, warnings = DataSourceManager()._fetch_from_tencent()

    assert warnings == 0
    assert stocks[0]["source"] == "akshare"
    assert stocks[0]["provider"] == "tencent"
    assert stocks[0]["open"] is None
    assert stocks[0]["high"] is None
    assert stocks[0]["low"] is None
    assert stocks[0]["prev_close"] == 11.56
