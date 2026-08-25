"""
Data Source Manager Layer
Handles multi-provider failover, retry with backoff, circuit breaker,
single-flight coordination, and quote normalization for Penguin Quant.
"""
import time
import math
import logging
import datetime
import threading
from typing import Optional, List, Dict, Any, Tuple
import pandas as pd

from app.core.config import settings

logger = logging.getLogger("data_source_manager")

class CircuitBreakerState:
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"

class CircuitBreaker:
    def __init__(self, name: str, failure_threshold: int = 3, cooldown_seconds: float = 60.0):
        self.name = name
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.state = CircuitBreakerState.CLOSED
        self.consecutive_failures = 0
        self.last_failure_time: float = 0.0
        self.next_retry_time: float = 0.0
        self._lock = threading.Lock()

    def can_execute(self) -> bool:
        with self._lock:
            now = time.time()
            if self.state == CircuitBreakerState.CLOSED:
                return True
            elif self.state == CircuitBreakerState.OPEN:
                if now >= self.next_retry_time:
                    logger.info("CircuitBreaker [%s]: Cooldown elapsed. Transitioning OPEN -> HALF_OPEN", self.name)
                    self.state = CircuitBreakerState.HALF_OPEN
                    return True
                return False
            elif self.state == CircuitBreakerState.HALF_OPEN:
                return True
            return True

    def record_success(self):
        with self._lock:
            if self.state != CircuitBreakerState.CLOSED:
                logger.info("CircuitBreaker [%s]: Success in %s state. Transitioning to CLOSED.", self.name, self.state)
            self.state = CircuitBreakerState.CLOSED
            self.consecutive_failures = 0
            self.last_failure_time = 0.0
            self.next_retry_time = 0.0

    def record_failure(self, error: Optional[Exception] = None):
        with self._lock:
            self.consecutive_failures += 1
            now = time.time()
            self.last_failure_time = now
            if self.consecutive_failures >= self.failure_threshold or self.state == CircuitBreakerState.HALF_OPEN:
                self.state = CircuitBreakerState.OPEN
                self.next_retry_time = now + self.cooldown_seconds
                logger.warning(
                    "CircuitBreaker [%s]: Tripped to OPEN state! Consecutive failures=%d, Cooldown=%.1fs, Error=%s",
                    self.name, self.consecutive_failures, self.cooldown_seconds, str(error)
                )

class DataSourceManager:
    """
    Centralized coordinator for AKShare financial data sources.
    """
    _instance: Optional['DataSourceManager'] = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(DataSourceManager, cls).__new__(cls)
                cls._instance._init_manager()
            return cls._instance

    def _init_manager(self):
        self.circuit_breakers: Dict[str, CircuitBreaker] = {
            "em": CircuitBreaker("eastmoney", failure_threshold=3, cooldown_seconds=60.0),
            "tx": CircuitBreaker("tencent", failure_threshold=3, cooldown_seconds=60.0),
            "sina": CircuitBreaker("sina", failure_threshold=3, cooldown_seconds=60.0),
        }
        self._single_flight_lock = threading.Lock()
        self._cached_snapshot: Optional[Dict[str, Any]] = None
        self._cached_snapshot_time: float = 0.0

    def _safe_float(self, val: Any) -> Optional[float]:
        if val is None or pd.isna(val):
            return None
        try:
            f = float(val)
            if math.isnan(f) or math.isinf(f):
                return None
            return f
        except (ValueError, TypeError):
            return None

    def _normalize_exchange(self, symbol: str) -> str:
        s = str(symbol).strip()
        if s.startswith(("60", "68", "90")):
            return "SH"
        elif s.startswith(("00", "30", "20")):
            return "SZ"
        elif s.startswith(("8", "4", "92")):
            return "BJ"
        return "SH"

    def _fetch_from_eastmoney(self) -> Tuple[List[Dict[str, Any]], int]:
        """
        Fetch full market A-share spot from EastMoney via AKShare
        """
        import akshare as ak
        if not hasattr(ak, "stock_zh_a_spot_em"):
            raise RuntimeError("AKShare interface stock_zh_a_spot_em is unavailable")

        df = ak.stock_zh_a_spot_em()
        if df is None or df.empty:
            raise ValueError("EastMoney returned empty DataFrame")

        # Column mapping
        # 序号, 代码, 名称, 最新价, 涨跌幅, 涨跌额, 成交量, 成交额, 振幅, 最高, 最低, 今开, 昨收, 量比, 换手率, 市盈率-动态, 市净率, 总市值, 流通市值
        stocks = []
        quality_warnings = 0
        as_of = datetime.datetime.utcnow().isoformat() + "Z"

        for _, row in df.iterrows():
            raw_code = str(row.get("代码", "")).strip()
            if not raw_code or len(raw_code) < 1:
                quality_warnings += 1
                continue
            symbol = raw_code.zfill(6)
            name = str(row.get("名称", "")).strip()

            last = self._safe_float(row.get("最新价"))
            open_val = self._safe_float(row.get("今开"))
            high = self._safe_float(row.get("最高"))
            low = self._safe_float(row.get("最低"))
            prev_close = self._safe_float(row.get("昨收"))
            change = self._safe_float(row.get("涨跌额"))
            change_pct = self._safe_float(row.get("涨跌幅"))
            volume = self._safe_float(row.get("成交量"))
            turnover = self._safe_float(row.get("成交额"))
            turnover_rate = self._safe_float(row.get("换手率"))
            amplitude = self._safe_float(row.get("振幅"))
            pe_dynamic = self._safe_float(row.get("市盈率-动态"))
            pb = self._safe_float(row.get("市净率"))
            total_market_cap = self._safe_float(row.get("总市值"))
            float_market_cap = self._safe_float(row.get("流通市值"))

            # OHLC consistency sanity check
            if high is not None and open_val is not None and last is not None:
                if high < max(open_val, last) or (low is not None and low > min(open_val, last)):
                    quality_warnings += 1

            exchange = self._normalize_exchange(symbol)
            stocks.append({
                "symbol": symbol,
                "name": name,
                "market": "CN",
                "exchange": exchange,
                "last": last,
                "open": open_val,
                "high": high,
                "low": low,
                "prev_close": prev_close,
                "change": change,
                "change_pct": change_pct,
                "volume": volume,
                "turnover": turnover,
                "turnover_rate": turnover_rate,
                "amplitude": amplitude,
                "pe_dynamic": pe_dynamic,
                "pb": pb,
                "total_market_cap": total_market_cap,
                "float_market_cap": float_market_cap,
                "provider": "eastmoney",
                "source": "akshare",
                "as_of": as_of
            })

        return stocks, quality_warnings

    def _fetch_from_tencent(self) -> Tuple[List[Dict[str, Any]], int]:
        """
        Fetch full market A-share spot from Tencent via AKShare or high-concurrency board API
        """
        import akshare as ak
        stocks = []
        quality_warnings = 0
        as_of = datetime.datetime.utcnow().isoformat() + "Z"

        # Try ak.stock_zh_a_spot_tx() first
        if hasattr(ak, "stock_zh_a_spot_tx"):
            try:
                df = ak.stock_zh_a_spot_tx()
                if df is not None and not df.empty:
                    for _, row in df.iterrows():
                        raw_code = str(row.get("code", "")).replace("sh", "").replace("sz", "").replace("bj", "").strip()
                        if not raw_code:
                            quality_warnings += 1
                            continue
                        symbol = raw_code.zfill(6)
                        name = str(row.get("name", "")).strip()

                        last = self._safe_float(row.get("zxj"))
                        change_pct = self._safe_float(row.get("zdf"))
                        change = self._safe_float(row.get("zd"))
                        volume = self._safe_float(row.get("volume"))
                        turnover = self._safe_float(row.get("turnover"))
                        turnover_rate = self._safe_float(row.get("hsl"))
                        amplitude = self._safe_float(row.get("zf"))
                        pe_dynamic = self._safe_float(row.get("pe_ttm"))
                        zsz = self._safe_float(row.get("zsz"))
                        ltsz = self._safe_float(row.get("ltsz"))
                        total_market_cap = zsz * 100000000.0 if zsz is not None else None
                        float_market_cap = ltsz * 100000000.0 if ltsz is not None else None

                        prev_close = (last - change) if (last is not None and change is not None) else last

                        exchange = self._normalize_exchange(symbol)
                        stocks.append({
                            "symbol": symbol,
                            "name": name,
                            "market": "CN",
                            "exchange": exchange,
                            "last": last,
                            "open": last,
                            "high": last,
                            "low": last,
                            "prev_close": prev_close,
                            "change": change,
                            "change_pct": change_pct,
                            "volume": volume,
                            "turnover": turnover,
                            "turnover_rate": turnover_rate,
                            "amplitude": amplitude,
                            "pe_dynamic": pe_dynamic,
                            "pb": None,
                            "total_market_cap": total_market_cap,
                            "float_market_cap": float_market_cap,
                            "provider": "tencent",
                            "source": "akshare",
                            "as_of": as_of
                        })
                    if len(stocks) >= 100:
                        return stocks, quality_warnings
            except Exception as e:
                logger.warning("ak.stock_zh_a_spot_tx exception: %s", str(e))

        raise RuntimeError("Tencent market data stream returned insufficient data")

    def _fetch_from_sina(self) -> Tuple[List[Dict[str, Any]], int]:
        """
        Fetch full market A-share spot from Sina via AKShare
        """
        import akshare as ak
        if not hasattr(ak, "stock_zh_a_spot"):
            raise RuntimeError("AKShare interface stock_zh_a_spot is unavailable")

        df = ak.stock_zh_a_spot()
        if df is None or df.empty:
            raise ValueError("Sina returned empty DataFrame")

        stocks = []
        quality_warnings = 0
        as_of = datetime.datetime.utcnow().isoformat() + "Z"

        for _, row in df.iterrows():
            raw_code = str(row.get("code", row.get("代码", ""))).replace("sh", "").replace("sz", "").replace("bj", "").strip()
            if not raw_code:
                quality_warnings += 1
                continue
            symbol = raw_code.zfill(6)
            name = str(row.get("name", row.get("名称", ""))).strip()

            last = self._safe_float(row.get("trade", row.get("最新价")))
            open_val = self._safe_float(row.get("open", row.get("今开")))
            high = self._safe_float(row.get("high", row.get("最高")))
            low = self._safe_float(row.get("low", row.get("最低")))
            prev_close = self._safe_float(row.get("settlement", row.get("昨收")))
            change_pct = self._safe_float(row.get("changepercent", row.get("涨跌幅")))
            change = self._safe_float(row.get("pricechange", row.get("涨跌额")))
            volume = self._safe_float(row.get("volume", row.get("成交量")))
            turnover = self._safe_float(row.get("amount", row.get("成交额")))
            turnover_rate = self._safe_float(row.get("turnoverrate", row.get("换手率")))
            pe_dynamic = self._safe_float(row.get("per", row.get("市盈率-动态")))
            pb = self._safe_float(row.get("pb", row.get("市净率")))
            mktcap = self._safe_float(row.get("mktcap", row.get("总市值")))
            nmc = self._safe_float(row.get("nmc", row.get("流通市值")))
            total_market_cap = mktcap * 10000.0 if (mktcap is not None and mktcap < 1000000000.0) else mktcap
            float_market_cap = nmc * 10000.0 if (nmc is not None and nmc < 1000000000.0) else nmc

            exchange = self._normalize_exchange(symbol)
            stocks.append({
                "symbol": symbol,
                "name": name,
                "market": "CN",
                "exchange": exchange,
                "last": last,
                "open": open_val,
                "high": high,
                "low": low,
                "prev_close": prev_close,
                "change": change,
                "change_pct": change_pct,
                "volume": volume,
                "turnover": turnover,
                "turnover_rate": turnover_rate,
                "amplitude": None,
                "pe_dynamic": pe_dynamic,
                "pb": pb,
                "total_market_cap": total_market_cap,
                "float_market_cap": float_market_cap,
                "provider": "sina",
                "source": "akshare",
                "as_of": as_of
            })

        return stocks, quality_warnings

    def fetch_full_spot_snapshot(self) -> Dict[str, Any]:
        """
        Executes single-flight, multi-source failover fetch for full CN market quotes.
        Returns complete normalized dictionary with stocks, indices, overview and quality stats.
        """
        now = time.time()
        # 1. Memory Cache check
        if self._cached_snapshot is not None:
            if (now - self._cached_snapshot_time) < settings.SPOT_CACHE_TTL_SECONDS:
                logger.info("Serving full market snapshot from in-memory Quant Service cache (age=%.1fs)", now - self._cached_snapshot_time)
                return self._cached_snapshot

        # 2. Single Flight Lock
        with self._single_flight_lock:
            # Double-check after acquiring lock
            now = time.time()
            if self._cached_snapshot is not None and (now - self._cached_snapshot_time) < settings.SPOT_CACHE_TTL_SECONDS:
                return self._cached_snapshot

            provider_order = settings.provider_order
            logger.info("Executing Single Flight full market fetch with provider order: %s", provider_order)

            last_error: Optional[Exception] = None
            successful_provider = ""
            stocks_data: List[Dict[str, Any]] = []
            quality_warnings = 0

            for p_key in provider_order:
                cb = self.circuit_breakers.get(p_key)
                if cb and not cb.can_execute():
                    logger.warning("Provider [%s] CircuitBreaker is OPEN. Skipping.", p_key)
                    continue

                # Retry loop (up to 3 attempts with progressive delay)
                max_attempts = 2 if p_key != "em" else 3
                for attempt in range(1, max_attempts + 1):
                    start_t = time.time()
                    try:
                        logger.info("Attempting provider [%s] (attempt %d/%d)...", p_key, attempt, max_attempts)
                        if p_key == "em":
                            stocks_data, quality_warnings = self._fetch_from_eastmoney()
                            successful_provider = "eastmoney"
                        elif p_key == "tx":
                            stocks_data, quality_warnings = self._fetch_from_tencent()
                            successful_provider = "tencent"
                        elif p_key == "sina":
                            stocks_data, quality_warnings = self._fetch_from_sina()
                            successful_provider = "sina"
                        else:
                            raise ValueError(f"Unknown provider: {p_key}")

                        duration_ms = int((time.time() - start_t) * 1000)
                        logger.info(
                            "Provider [%s] succeeded: %d stocks fetched, quality_warnings=%d, duration=%dms",
                            successful_provider, len(stocks_data), quality_warnings, duration_ms
                        )

                        if cb:
                            cb.record_success()
                        break
                    except Exception as e:
                        duration_ms = int((time.time() - start_t) * 1000)
                        last_error = e
                        logger.warning("Provider [%s] attempt %d failed (%dms): %s", p_key, attempt, duration_ms, str(e))
                        if attempt < max_attempts:
                            time.sleep(attempt * 1.0)
                        else:
                            if cb:
                                cb.record_failure(e)

                if successful_provider and len(stocks_data) > 0:
                    break

            if not successful_provider or len(stocks_data) == 0:
                logger.error("All providers in order %s failed! Last error: %s", provider_order, str(last_error))
                raise RuntimeError(f"ALL_PROVIDERS_FAILED: {str(last_error)}")

            # Fetch Indices
            indices_data = self.fetch_indices(provider_preference=successful_provider)

            # Compute Overview
            overview_data = self._compute_overview(stocks_data)

            as_of_iso = datetime.datetime.utcnow().isoformat() + "Z"
            snapshot = {
                "provider": successful_provider,
                "source": "akshare",
                "as_of": as_of_iso,
                "stocks": stocks_data,
                "indices": indices_data,
                "overview": overview_data,
                "quality": {
                    "warnings_count": quality_warnings,
                    "total_stocks_count": len(stocks_data)
                }
            }

            self._cached_snapshot = snapshot
            self._cached_snapshot_time = time.time()
            return snapshot

    def fetch_indices(self, provider_preference: str = "eastmoney") -> List[Dict[str, Any]]:
        """
        Fetch real-time major CN market indices: 上证指数, 深证成指, 创业板指, 沪深300, 科创50, 北证50
        Ensures index 000001 (上证指数) is strictly distinct from stock 000001 (平安银行).
        """
        import akshare as ak
        as_of = datetime.datetime.utcnow().isoformat() + "Z"
        indices = []

        # Try EastMoney index spot
        if hasattr(ak, "stock_zh_index_spot_em"):
            try:
                df = ak.stock_zh_index_spot_em()
                if df is not None and not df.empty:
                    # Filter for major market indices
                    target_names = {
                        "上证指数": "000001",
                        "深证成指": "399001",
                        "创业板指": "399006",
                        "沪深300": "000300",
                        "科创50": "000688",
                        "上证50": "000016",
                        "中证500": "000905",
                        "北证50": "899050",
                    }
                    for _, row in df.iterrows():
                        name = str(row.get("名称", "")).strip()
                        code = str(row.get("代码", "")).strip()
                        if name in target_names or code in target_names.values():
                            symbol = target_names.get(name, code).zfill(6)
                            last = self._safe_float(row.get("最新价"))
                            open_v = self._safe_float(row.get("今开"))
                            high = self._safe_float(row.get("最高"))
                            low = self._safe_float(row.get("最低"))
                            prev_close = self._safe_float(row.get("昨收"))
                            change = self._safe_float(row.get("涨跌额"))
                            change_pct = self._safe_float(row.get("涨跌幅"))
                            volume = self._safe_float(row.get("成交量"))
                            turnover = self._safe_float(row.get("成交额"))

                            indices.append({
                                "symbol": symbol,
                                "name": name,
                                "market": "CN",
                                "last": last,
                                "open": open_v,
                                "high": high,
                                "low": low,
                                "prev_close": prev_close,
                                "change": change,
                                "change_pct": change_pct,
                                "volume": volume,
                                "turnover": turnover,
                                "provider": "eastmoney",
                                "source": "akshare",
                                "as_of": as_of
                            })
                    if len(indices) >= 3:
                        return indices
            except Exception as e:
                logger.warning("stock_zh_index_spot_em failed: %s", str(e))

        # Fallback to Sina index spot
        if hasattr(ak, "stock_zh_index_spot_sina"):
            try:
                df = ak.stock_zh_index_spot_sina()
                if df is not None and not df.empty:
                    for _, row in df.iterrows():
                        name = str(row.get("name", row.get("名称", ""))).strip()
                        code = str(row.get("code", row.get("代码", ""))).replace("sh", "").replace("sz", "").replace("bj", "").strip()
                        if name in ["上证指数", "深证成指", "创业板指", "沪深300", "科创50", "上证50", "中证500"]:
                            symbol = code.zfill(6)
                            last = self._safe_float(row.get("trade", row.get("最新价")))
                            open_v = self._safe_float(row.get("open", row.get("今开")))
                            high = self._safe_float(row.get("high", row.get("最高")))
                            low = self._safe_float(row.get("low", row.get("最低")))
                            prev_close = self._safe_float(row.get("settlement", row.get("昨收")))
                            change = self._safe_float(row.get("pricechange", row.get("涨跌额")))
                            change_pct = self._safe_float(row.get("changepercent", row.get("涨跌幅")))
                            volume = self._safe_float(row.get("volume", row.get("成交量")))
                            turnover = self._safe_float(row.get("amount", row.get("成交额")))

                            indices.append({
                                "symbol": symbol,
                                "name": name,
                                "market": "CN",
                                "last": last,
                                "open": open_v,
                                "high": high,
                                "low": low,
                                "prev_close": prev_close,
                                "change": change,
                                "change_pct": change_pct,
                                "volume": volume,
                                "turnover": turnover,
                                "provider": "sina",
                                "source": "akshare",
                                "as_of": as_of
                            })
                    if len(indices) >= 3:
                        return indices
            except Exception as e:
                logger.warning("stock_zh_index_spot_sina failed: %s", str(e))

        return indices

    def _compute_overview(self, stocks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Computes accurate market breadth metrics across the entire universe without sampling multipliers.
        """
        up_count = 0
        down_count = 0
        flat_count = 0
        limit_up_count = 0
        limit_down_count = 0
        total_turnover = 0.0
        total_change_pct = 0.0
        valid_change_count = 0

        for s in stocks:
            chg_pct = s.get("change_pct")
            turnover = s.get("turnover")
            if turnover is not None and turnover > 0:
                total_turnover += turnover

            if chg_pct is not None:
                valid_change_count += 1
                total_change_pct += chg_pct
                if chg_pct > 0.0001:
                    up_count += 1
                    if chg_pct >= 9.8:
                        limit_up_count += 1
                elif chg_pct < -0.0001:
                    down_count += 1
                    if chg_pct <= -9.8:
                        limit_down_count += 1
                else:
                    flat_count += 1
            else:
                flat_count += 1

        avg_change_pct = (total_change_pct / valid_change_count) if valid_change_count > 0 else 0.0

        return {
            "up_count": up_count,
            "down_count": down_count,
            "flat_count": flat_count,
            "limit_up_count": limit_up_count,
            "limit_down_count": limit_down_count,
            "total_turnover": round(total_turnover, 2),
            "avg_change_pct": round(avg_change_pct, 2),
            "total_count": len(stocks),
            "as_of": datetime.datetime.utcnow().isoformat() + "Z",
            "source": "akshare",
            "provider": stocks[0]["provider"] if stocks else "eastmoney"
        }

data_source_manager = DataSourceManager()
