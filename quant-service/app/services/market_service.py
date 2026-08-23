"""
Market Service Layer with Normalization & In-Memory TTL Cache
"""
import time
import math
import datetime
from typing import Optional, List, Dict, Any, Tuple
import pandas as pd

from app.core.config import settings
from app.providers.akshare_provider import AKShareProvider, AKShareProviderError
from app.schemas.market import (
    SpotStockItem,
    SpotResponseData,
    KLineBar,
    HistoryResponseData
)

class CacheEntry:
    def __init__(self, data: Any, ttl_seconds: int):
        self.data = data
        self.expires_at = time.time() + ttl_seconds
        self.created_at = datetime.datetime.utcnow().isoformat() + "Z"

    def is_valid(self) -> bool:
        return time.time() < self.expires_at

class MarketService:
    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}

    def _get_cache(self, key: str) -> Optional[Tuple[Any, str]]:
        entry = self._cache.get(key)
        if entry and entry.is_valid():
            return entry.data, entry.created_at
        if entry:
            del self._cache[key]
        return None

    def _set_cache(self, key: str, data: Any, ttl_seconds: int) -> str:
        entry = CacheEntry(data, ttl_seconds)
        self._cache[key] = entry
        return entry.created_at

    @staticmethod
    def _clean_float(val: Any) -> Optional[float]:
        if val is None or pd.isna(val):
            return None
        try:
            f = float(val)
            if math.isnan(f) or math.isinf(f):
                return None
            return round(f, 4)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _detect_exchange(symbol: str) -> str:
        clean_sym = str(symbol).strip().zfill(6)
        if clean_sym.startswith(("60", "688", "900")):
            return "SH"
        if clean_sym.startswith(("00", "30", "20")):
            return "SZ"
        if clean_sym.startswith(("8", "4", "920")):
            return "BJ"
        return "CN"

    def get_spot_data(
        self,
        symbols: Optional[List[str]] = None,
        full_market: bool = False
    ) -> SpotResponseData:
        """
        Fetch and normalize real-time A-share market data with 20s TTL caching.
        """
        # Build cache key for underlying full fetch
        cache_key = "spot:full_market_df"
        cached_res = self._get_cache(cache_key)
        
        is_cached = False
        as_of_time = datetime.datetime.utcnow().isoformat() + "Z"

        if cached_res:
            df, as_of_time = cached_res
            is_cached = True
        else:
            df = AKShareProvider.get_cn_spot()
            as_of_time = self._set_cache(cache_key, df, settings.SPOT_CACHE_TTL_SECONDS)

        # Filter by symbols if provided
        filtered_df = df.copy()
        if symbols and len(symbols) > 0:
            target_symbols = [str(s).strip().zfill(6) for s in symbols]
            filtered_df = filtered_df[filtered_df["代码"].isin(target_symbols)]
        elif not full_market:
            # Default to top 100 liquid stocks if full_market is False
            filtered_df = filtered_df.head(100)

        stocks: List[SpotStockItem] = []
        for _, row in filtered_df.iterrows():
            sym = str(row.get("代码", "")).strip().zfill(6)
            name = str(row.get("名称", "")).strip()
            if not sym:
                continue

            item = SpotStockItem(
                symbol=sym,
                name=name,
                market="CN",
                exchange=self._detect_exchange(sym),
                last=self._clean_float(row.get("最新价")),
                open=self._clean_float(row.get("今开")),
                high=self._clean_float(row.get("最高")),
                low=self._clean_float(row.get("最低")),
                prev_close=self._clean_float(row.get("昨收")),
                change=self._clean_float(row.get("涨跌额")),
                change_pct=self._clean_float(row.get("涨跌幅")),
                volume=self._clean_float(row.get("成交量")),
                turnover=self._clean_float(row.get("成交额")),
                turnover_rate=self._clean_float(row.get("换手率")),
                amplitude=self._clean_float(row.get("振幅")),
                pe_dynamic=self._clean_float(row.get("市盈率-动态")),
                pb=self._clean_float(row.get("市净率")),
                total_market_cap=self._clean_float(row.get("总市值")),
                float_market_cap=self._clean_float(row.get("流通市值")),
                source="akshare",
                provider="eastmoney",
                as_of=as_of_time
            )
            stocks.append(item)

        return SpotResponseData(
            count=len(stocks),
            as_of=as_of_time,
            source="akshare",
            provider="eastmoney",
            cached=is_cached,
            stocks=stocks
        )

    def get_stock_history(
        self,
        symbol: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjust: str = "none"
    ) -> HistoryResponseData:
        """
        Fetch and normalize daily historical K-line bars with 30-min TTL caching.
        """
        clean_symbol = str(symbol).strip().zfill(6)
        
        # Calculate default start/end dates if omitted (default: last 60 days)
        today_str = datetime.date.today().strftime("%Y%m%d")
        if not end_date:
            end_date = today_str
        if not start_date:
            start_date = (datetime.date.today() - datetime.timedelta(days=90)).strftime("%Y%m%d")

        # Map adjust parameter: "none" -> "", "qfq" -> "qfq", "hfq" -> "hfq"
        adjust_map = {
            "none": "",
            "qfq": "qfq",
            "hfq": "hfq"
        }
        ak_adjust = adjust_map.get(adjust, "")

        cache_key = f"hist:{clean_symbol}:{start_date}:{end_date}:{adjust}"
        cached_res = self._get_cache(cache_key)

        is_cached = False
        as_of_time = datetime.datetime.utcnow().isoformat() + "Z"

        if cached_res:
            df, as_of_time = cached_res
            is_cached = True
        else:
            df = AKShareProvider.get_cn_stock_history(
                symbol=clean_symbol,
                start_date=start_date,
                end_date=end_date,
                adjust=ak_adjust
            )
            as_of_time = self._set_cache(cache_key, df, settings.HISTORY_CACHE_TTL_SECONDS)

        bars: List[KLineBar] = []
        for _, row in df.iterrows():
            raw_date = row.get("日期", "")
            if pd.isna(raw_date):
                continue
            date_str = str(raw_date).strip()[:10]

            bar = KLineBar(
                date=date_str,
                open=self._clean_float(row.get("开盘")),
                high=self._clean_float(row.get("最高")),
                low=self._clean_float(row.get("最低")),
                close=self._clean_float(row.get("收盘")),
                volume=self._clean_float(row.get("成交量")),
                turnover=self._clean_float(row.get("成交额")),
                amplitude=self._clean_float(row.get("振幅")),
                change_pct=self._clean_float(row.get("涨跌幅")),
                change=self._clean_float(row.get("涨跌额")),
                turnover_rate=self._clean_float(row.get("换手率"))
            )
            bars.append(bar)

        return HistoryResponseData(
            symbol=clean_symbol,
            count=len(bars),
            adjust=adjust,
            start_date=start_date,
            end_date=end_date,
            as_of=as_of_time,
            source="akshare",
            provider="eastmoney",
            cached=is_cached,
            bars=bars
        )

# Global Singleton instance
market_service = MarketService()
