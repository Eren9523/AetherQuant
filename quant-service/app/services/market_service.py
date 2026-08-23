"""
Market Service Layer with Normalization, In-Memory TTL Cache,
Server-side Sorting/Paging/Search, and Data Quality Validation.
"""
import time
import math
import logging
import datetime
from typing import Optional, List, Dict, Any, Tuple
import pandas as pd

from app.core.config import settings
from app.providers.akshare_provider import AKShareProvider, AKShareProviderError
from app.schemas.market import (
    SpotStockItem,
    SpotResponseData,
    IndexQuoteItem,
    IndexResponseData,
    MarketOverviewData,
    StockBasicInfo,
    StockDetailData,
    KLineBar,
    HistoryResponseData,
    ChartResponseData
)

logger = logging.getLogger("market_service")

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

    def _get_full_spot_df(self) -> Tuple[pd.DataFrame, str, bool]:
        """
        Retrieves full A-share spot DataFrame from cache or upstream (15~20s TTL).
        """
        cache_key = "spot:full_market_df"
        cached = self._get_cache(cache_key)
        if cached:
            return cached[0], cached[1], True
        
        df = AKShareProvider.get_cn_spot()
        as_of = self._set_cache(cache_key, df, settings.SPOT_CACHE_TTL_SECONDS)
        return df, as_of, False

    def get_spot_data(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        sort_by: Optional[str] = "change_pct",
        sort_order: str = "desc",
        exchange: Optional[str] = None,
        symbols: Optional[List[str]] = None
    ) -> SpotResponseData:
        """
        Fetch and normalize real-time A-share market data with server-side filtering,
        sorting, and pagination executed over the cached full DataFrame.
        """
        df, as_of_time, is_cached = self._get_full_spot_df()
        working_df = df.copy()

        # 1. Filter by specific symbols if provided
        if symbols and len(symbols) > 0:
            target_symbols = [str(s).strip().zfill(6) for s in symbols]
            working_df = working_df[working_df["代码"].isin(target_symbols)]

        # 2. Search filtering (symbol or name)
        if search and search.strip():
            q = search.strip().lower()
            code_match = working_df["代码"].astype(str).str.lower().str.contains(q, na=False)
            name_match = working_df["名称"].astype(str).str.lower().str.contains(q, na=False)
            working_df = working_df[code_match | name_match]

        # 3. Exchange filtering
        if exchange and exchange.upper() in ("SH", "SZ", "BJ"):
            ex = exchange.upper()
            if ex == "SH":
                working_df = working_df[working_df["代码"].str.startswith(("60", "688", "900"))]
            elif ex == "SZ":
                working_df = working_df[working_df["代码"].str.startswith(("00", "30", "20"))]
            elif ex == "BJ":
                working_df = working_df[working_df["代码"].str.startswith(("8", "4", "920"))]

        # 4. Column Mapping for Sorting
        col_map = {
            "change_pct": "涨跌幅",
            "turnover": "成交额",
            "volume": "成交量",
            "turnover_rate": "换手率",
            "total_market_cap": "总市值",
            "pe_dynamic": "市盈率-动态",
            "pb": "市净率",
            "last": "最新价",
            "symbol": "代码",
            "name": "名称"
        }
        sort_col = col_map.get(sort_by or "change_pct", "涨跌幅")
        if sort_col in working_df.columns:
            ascending = (sort_order.lower() == "asc")
            # Convert numeric column for accurate sorting
            if sort_col not in ("代码", "名称"):
                working_df["_sort_key"] = pd.to_numeric(working_df[sort_col], errors="coerce")
                working_df = working_df.sort_values(by="_sort_key", ascending=ascending, na_position="last")
            else:
                working_df = working_df.sort_values(by=sort_col, ascending=ascending, na_position="last")

        total_count = len(working_df)
        
        # 5. Pagination
        page = max(1, page)
        page_size = max(1, min(200, page_size))
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_df = working_df.iloc[start_idx:end_idx]

        stocks: List[SpotStockItem] = []
        for _, row in paged_df.iterrows():
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
            total=total_count,
            page=page,
            page_size=page_size,
            as_of=as_of_time,
            source="akshare",
            provider="eastmoney",
            cached=is_cached,
            stocks=stocks
        )

    def get_indices_data(self) -> IndexResponseData:
        """
        Fetch real major A-share indices quotes (15~20s TTL).
        """
        cache_key = "indices:major"
        cached = self._get_cache(cache_key)
        if cached:
            return cached[0]

        df = AKShareProvider.get_cn_indices()
        as_of_time = datetime.datetime.utcnow().isoformat() + "Z"

        # Canonical major indices to track
        target_indices = {
            "000001": "上证指数",
            "399001": "深证成指",
            "399006": "创业板指",
            "000300": "沪深300",
            "000016": "上证50",
            "000688": "科创50",
            "000905": "中证500"
        }

        indices: List[IndexQuoteItem] = []
        
        # Check DataFrame column conventions
        code_col = "代码" if "代码" in df.columns else "symbol"
        name_col = "名称" if "名称" in df.columns else "name"
        price_col = "最新价" if "最新价" in df.columns else ("最新" if "最新" in df.columns else "last")
        change_col = "涨跌额" if "涨跌额" in df.columns else ("涨跌" if "涨跌" in df.columns else "change")
        change_pct_col = "涨跌幅" if "涨跌幅" in df.columns else "change_pct"
        open_col = "今开" if "今开" in df.columns else "open"
        high_col = "最高" if "最高" in df.columns else "high"
        low_col = "最低" if "最低" in df.columns else "low"
        prev_close_col = "昨收" if "昨收" in df.columns else "prev_close"
        volume_col = "成交量" if "成交量" in df.columns else "volume"
        turnover_col = "成交额" if "成交额" in df.columns else "turnover"

        for _, row in df.iterrows():
            raw_code = str(row.get(code_col, "")).strip().replace("sh", "").replace("sz", "")
            raw_name = str(row.get(name_col, "")).strip()

            # Match either by code or canonical name
            matched_code = None
            for t_code, t_name in target_indices.items():
                if raw_code == t_code or t_name in raw_name:
                    matched_code = t_code
                    break
            
            if matched_code:
                display_name = target_indices[matched_code]
                indices.append(
                    IndexQuoteItem(
                        symbol=matched_code,
                        name=display_name,
                        market="CN",
                        last=self._clean_float(row.get(price_col)),
                        open=self._clean_float(row.get(open_col)),
                        high=self._clean_float(row.get(high_col)),
                        low=self._clean_float(row.get(low_col)),
                        prev_close=self._clean_float(row.get(prev_close_col)),
                        change=self._clean_float(row.get(change_col)),
                        change_pct=self._clean_float(row.get(change_pct_col)),
                        volume=self._clean_float(row.get(volume_col)),
                        turnover=self._clean_float(row.get(turnover_col)),
                        as_of=as_of_time,
                        source="akshare",
                        provider="eastmoney"
                    )
                )

        resp = IndexResponseData(
            count=len(indices),
            as_of=as_of_time,
            source="akshare",
            provider="eastmoney",
            cached=False,
            indices=indices
        )
        self._set_cache(cache_key, resp, settings.SPOT_CACHE_TTL_SECONDS)
        return resp

    def get_market_overview(self) -> MarketOverviewData:
        """
        Calculate market breadth, advance/decline stats, and aggregate turnover
        from full spot DataFrame.
        """
        cache_key = "market:overview"
        cached = self._get_cache(cache_key)
        if cached:
            return cached[0]

        df, as_of_time, is_cached = self._get_full_spot_df()
        
        # Calculate statistics
        change_pct_s = pd.to_numeric(df.get("涨跌幅", []), errors="coerce").dropna()
        turnover_s = pd.to_numeric(df.get("成交额", []), errors="coerce").dropna()

        up_count = int((change_pct_s > 0).sum())
        down_count = int((change_pct_s < 0).sum())
        flat_count = int((change_pct_s == 0).sum())
        limit_up_count = int((change_pct_s >= 9.8).sum())
        limit_down_count = int((change_pct_s <= -9.8).sum())
        total_turnover = float(turnover_s.sum()) if not turnover_s.empty else 0.0
        avg_change = float(change_pct_s.mean()) if not change_pct_s.empty else 0.0

        overview = MarketOverviewData(
            up_count=up_count,
            down_count=down_count,
            flat_count=flat_count,
            limit_up_count=limit_up_count,
            limit_down_count=limit_down_count,
            total_turnover=round(total_turnover, 2),
            avg_change_pct=round(avg_change, 2),
            total_count=len(change_pct_s),
            as_of=as_of_time,
            source="akshare",
            provider="eastmoney",
            cached=is_cached
        )
        self._set_cache(cache_key, overview, settings.SPOT_CACHE_TTL_SECONDS)
        return overview

    def get_stock_detail(self, symbol: str) -> StockDetailData:
        """
        Get quote and basic company info for a single stock.
        """
        clean_symbol = str(symbol).strip().zfill(6)
        
        # 1. Fetch spot quote for symbol
        spot_res = self.get_spot_data(symbols=[clean_symbol], page_size=1)
        if not spot_res.stocks:
            raise AKShareProviderError(
                code="NOT_FOUND",
                message=f"未查询到标的 [{clean_symbol}] 的实时行情数据"
            )
        quote = spot_res.stocks[0]

        # 2. Fetch basic info (cached 24h)
        cache_key = f"basic_info:{clean_symbol}"
        cached = self._get_cache(cache_key)
        if cached:
            basic_info_dict = cached[0]
        else:
            basic_info_dict = AKShareProvider.get_cn_stock_info(clean_symbol)
            self._set_cache(cache_key, basic_info_dict, 86400)

        basic_info = StockBasicInfo(
            symbol=clean_symbol,
            name=basic_info_dict.get("name") or quote.name,
            industry=basic_info_dict.get("industry") or None,
            listing_date=basic_info_dict.get("listing_date"),
            total_market_cap=self._clean_float(basic_info_dict.get("total_market_cap")) or quote.total_market_cap,
            float_market_cap=self._clean_float(basic_info_dict.get("float_market_cap")) or quote.float_market_cap
        )

        return StockDetailData(
            quote=quote,
            basic_info=basic_info
        )

    def get_stock_history(
        self,
        symbol: str,
        period: str = "daily",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjust: str = "none"
    ) -> HistoryResponseData:
        """
        Fetch daily/weekly/monthly history bars with quality validation.
        """
        clean_symbol = str(symbol).strip().zfill(6)
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        today_str = datetime.date.today().strftime("%Y%m%d")
        if not end_date:
            end_date = today_str
        if not start_date:
            # Default windows: daily 365d, weekly 5y, monthly 10y
            days = 365 if period == "daily" else (1825 if period == "weekly" else 3650)
            start_date = (datetime.date.today() - datetime.timedelta(days=days)).strftime("%Y%m%d")

        adjust_map = {"none": "", "qfq": "qfq", "hfq": "hfq"}
        ak_adjust = adjust_map.get(adjust, "")

        ttl = settings.HISTORY_CACHE_TTL_SECONDS if period == "daily" else 21600
        cache_key = f"hist:{clean_symbol}:{period}:{start_date}:{end_date}:{adjust}"
        cached_res = self._get_cache(cache_key)

        is_cached = False
        as_of_time = datetime.datetime.utcnow().isoformat() + "Z"

        if cached_res:
            df, as_of_time = cached_res
            is_cached = True
        else:
            df = AKShareProvider.get_cn_stock_history(
                symbol=clean_symbol,
                period=period,
                start_date=start_date,
                end_date=end_date,
                adjust=ak_adjust
            )
            as_of_time = self._set_cache(cache_key, df, ttl)

        bars: List[KLineBar] = []
        quality_warnings = 0

        for _, row in df.iterrows():
            raw_date = row.get("日期", "")
            if pd.isna(raw_date):
                continue
            date_str = str(raw_date).strip()[:10]

            open_p = self._clean_float(row.get("开盘"))
            high_p = self._clean_float(row.get("最高"))
            low_p = self._clean_float(row.get("最低"))
            close_p = self._clean_float(row.get("收盘"))
            vol = self._clean_float(row.get("成交量"))
            turn = self._clean_float(row.get("成交额"))

            # Quality Check: OHLC relationship
            if open_p is not None and close_p is not None and high_p is not None and low_p is not None:
                max_oc = max(open_p, close_p)
                min_oc = min(open_p, close_p)
                if high_p < max_oc or low_p > min_oc:
                    quality_warnings += 1
                    high_p = max(high_p, max_oc)
                    low_p = min(low_p, min_oc)

            bar = KLineBar(
                time=date_str,
                open=open_p,
                high=high_p,
                low=low_p,
                close=close_p,
                volume=vol,
                turnover=turn,
                amplitude=self._clean_float(row.get("振幅")),
                change_pct=self._clean_float(row.get("涨跌幅")),
                change=self._clean_float(row.get("涨跌额")),
                turnover_rate=self._clean_float(row.get("换手率"))
            )
            bars.append(bar)

        return HistoryResponseData(
            symbol=clean_symbol,
            count=len(bars),
            period=period,
            adjust=adjust,
            start_date=start_date,
            end_date=end_date,
            as_of=as_of_time,
            source="akshare",
            provider="eastmoney",
            cached=is_cached,
            quality_warnings_count=quality_warnings,
            bars=bars
        )

    def get_stock_minute(
        self,
        symbol: str,
        period: str = "5",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        adjust: str = "none"
    ) -> HistoryResponseData:
        """
        Fetch minute-level bars with quality validation (20~60s TTL).
        """
        clean_symbol = str(symbol).strip().zfill(6)
        period_str = str(period)
        adjust_map = {"none": "", "qfq": "qfq", "hfq": "hfq"}
        ak_adjust = adjust_map.get(adjust, "")

        ttl = 30 if period_str == "1" else 60
        cache_key = f"min:{clean_symbol}:{period_str}:{start_date}:{end_date}:{adjust}"
        cached_res = self._get_cache(cache_key)

        is_cached = False
        as_of_time = datetime.datetime.utcnow().isoformat() + "Z"

        if cached_res:
            df, as_of_time = cached_res
            is_cached = True
        else:
            df = AKShareProvider.get_cn_stock_minute(
                symbol=clean_symbol,
                period=period_str,
                adjust=ak_adjust,
                start_date=start_date or "",
                end_date=end_date or ""
            )
            as_of_time = self._set_cache(cache_key, df, ttl)

        bars: List[KLineBar] = []
        quality_warnings = 0

        # Minute bar date column detection
        time_col = "时间" if "时间" in df.columns else ("日期" if "日期" in df.columns else "datetime")

        for _, row in df.iterrows():
            raw_time = row.get(time_col, "")
            if pd.isna(raw_time):
                continue
            time_str = str(raw_time).strip()

            open_p = self._clean_float(row.get("开盘"))
            high_p = self._clean_float(row.get("最高"))
            low_p = self._clean_float(row.get("最低"))
            close_p = self._clean_float(row.get("收盘"))
            vol = self._clean_float(row.get("成交量") or row.get("volume"))
            turn = self._clean_float(row.get("成交额") or row.get("turnover"))

            if open_p is not None and close_p is not None and high_p is not None and low_p is not None:
                max_oc = max(open_p, close_p)
                min_oc = min(open_p, close_p)
                if high_p < max_oc or low_p > min_oc:
                    quality_warnings += 1
                    high_p = max(high_p, max_oc)
                    low_p = min(low_p, min_oc)

            bar = KLineBar(
                time=time_str,
                open=open_p,
                high=high_p,
                low=low_p,
                close=close_p,
                volume=vol,
                turnover=turn,
                amplitude=self._clean_float(row.get("振幅")),
                change_pct=self._clean_float(row.get("涨跌幅")),
                change=self._clean_float(row.get("涨跌额")),
                turnover_rate=self._clean_float(row.get("换手率"))
            )
            bars.append(bar)

        return HistoryResponseData(
            symbol=clean_symbol,
            count=len(bars),
            period=f"{period_str}m",
            adjust=adjust,
            start_date=start_date,
            end_date=end_date,
            as_of=as_of_time,
            source="akshare",
            provider="eastmoney",
            cached=is_cached,
            quality_warnings_count=quality_warnings,
            bars=bars
        )

    def get_stock_chart(
        self,
        symbol: str,
        interval: str = "1d",
        adjust: str = "qfq"
    ) -> ChartResponseData:
        """
        Unified chart query router for frontend optimization.
        interval: 1m, 5m, 15m, 30m, 60m, 1d, 1w, 1M
        """
        clean_symbol = str(symbol).strip().zfill(6)
        interval_clean = interval.strip()

        if interval_clean in ("1m", "5m", "15m", "30m", "60m"):
            minute_period = interval_clean.replace("m", "")
            res = self.get_stock_minute(symbol=clean_symbol, period=minute_period, adjust=adjust)
            return ChartResponseData(
                symbol=clean_symbol,
                interval=interval_clean,
                adjust=adjust,
                count=res.count,
                as_of=res.as_of,
                source=res.source,
                provider=res.provider,
                cached=res.cached,
                quality_warnings_count=res.quality_warnings_count,
                bars=res.bars
            )
        else:
            # Map daily / weekly / monthly
            period_map = {
                "1d": "daily",
                "1w": "weekly",
                "1M": "monthly",
                "daily": "daily",
                "weekly": "weekly",
                "monthly": "monthly"
            }
            mapped_period = period_map.get(interval_clean, "daily")
            res = self.get_stock_history(symbol=clean_symbol, period=mapped_period, adjust=adjust)
            return ChartResponseData(
                symbol=clean_symbol,
                interval=interval_clean,
                adjust=adjust,
                count=res.count,
                as_of=res.as_of,
                source=res.source,
                provider=res.provider,
                cached=res.cached,
                quality_warnings_count=res.quality_warnings_count,
                bars=res.bars
            )

# Global Singleton instance
market_service = MarketService()
