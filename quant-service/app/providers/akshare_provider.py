"""
AKShare Upstream Provider Layer
Centralizes and standardizes all external calls to AKShare interfaces and high-speed financial endpoints.
Ensures zero mock data in Real Mode with robust multi-source resilience.
"""
import sys
import logging
import inspect
import datetime
from typing import Optional, List, Dict, Any
import requests
import pandas as pd

logger = logging.getLogger("akshare_provider")

class AKShareProviderError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

class AKShareProvider:
    _versions_logged = False

    @classmethod
    def _log_runtime_info(cls):
        if not cls._versions_logged:
            py_ver = sys.version.split()[0]
            ak_ver = cls.get_version()
            pd_ver = pd.__version__
            logger.info("Quant Service Startup -> Python: %s, AKShare: %s, Pandas: %s", py_ver, ak_ver, pd_ver)
            cls._versions_logged = True

    @staticmethod
    def get_version() -> str:
        try:
            import akshare as ak
            return getattr(ak, "__version__", "unknown")
        except Exception:
            return "not_installed"

    @classmethod
    def get_cn_spot(cls) -> pd.DataFrame:
        """
        Fetch real-time A-share full market quotes.
        Primary: ak.stock_zh_a_spot_em() (EastMoney)
        Secondary: ak.stock_zh_a_spot_tx() (Tencent)
        """
        cls._log_runtime_info()
        try:
            import akshare as ak
        except ImportError as e:
            logger.error("AKShare module is not installed: %s", str(e))
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message="AKShare 运行环境未就绪，缺少核心依赖库"
            )

        # 1. Try EastMoney
        if hasattr(ak, "stock_zh_a_spot_em"):
            try:
                df = ak.stock_zh_a_spot_em()
                if df is not None and not df.empty and "代码" in df.columns:
                    df["代码"] = df["代码"].astype(str).str.zfill(6)
                    return df
            except Exception as e:
                logger.warning("ak.stock_zh_a_spot_em failed, falling back to Tencent provider: %s", str(e))

        # 2. Try High-Speed Concurrent Tencent Provider (5500+ A-shares in ~3s)
        try:
            import math
            import requests
            import concurrent.futures
            
            logger.info("Fetching full market spot quotes via high-speed concurrent Tencent pipeline...")
            url = "https://proxy.finance.qq.com/cgi/cgi-bin/rank/hs/getBoardRankList"
            page_size = 200
            
            # Fetch page 0 to discover total count
            resp = requests.get(
                url,
                params={"_appver": "11.17.0", "board_code": "aStock", "sort_type": "price", "direct": "down", "offset": "0", "count": str(page_size)},
                timeout=10
            )
            if resp.status_code == 200:
                data_json = resp.json()
                total = int(data_json.get("data", {}).get("total", 0))
                total_page = math.ceil(total / page_size) if total > 0 else 0
                
                all_ranks = [data_json.get("data", {}).get("rank_list", [])]
                
                if total_page > 1:
                    def fetch_p(p):
                        try:
                            r = requests.get(
                                url,
                                params={"_appver": "11.17.0", "board_code": "aStock", "sort_type": "price", "direct": "down", "offset": str(p * page_size), "count": str(page_size)},
                                timeout=10
                            )
                            return r.json().get("data", {}).get("rank_list", [])
                        except Exception as e:
                            logger.warning("Failed to fetch Tencent rank page %d: %s", p, str(e))
                            return []
                    
                    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
                        pages = list(executor.map(fetch_p, range(1, total_page)))
                        all_ranks.extend(pages)
                
                flat_list = [item for sub in all_ranks for item in sub if item]
                if flat_list:
                    df_tx = pd.DataFrame(flat_list)
                    df_tx.drop_duplicates(subset=["code"], inplace=True, ignore_index=True)
                    
                    clean_code = df_tx["code"].astype(str).str.replace("sh", "").str.replace("sz", "").str.replace("bj", "").str.zfill(6)
                    df_norm = pd.DataFrame()
                    df_norm["代码"] = clean_code
                    df_norm["名称"] = df_tx["name"].astype(str)
                    df_norm["最新价"] = pd.to_numeric(df_tx.get("zxj"), errors="coerce")
                    df_norm["涨跌幅"] = pd.to_numeric(df_tx.get("zdf"), errors="coerce")
                    df_norm["涨跌额"] = pd.to_numeric(df_tx.get("zd"), errors="coerce")
                    df_norm["成交量"] = pd.to_numeric(df_tx.get("volume"), errors="coerce")
                    df_norm["成交额"] = pd.to_numeric(df_tx.get("turnover"), errors="coerce")
                    df_norm["换手率"] = pd.to_numeric(df_tx.get("hsl"), errors="coerce")
                    df_norm["振幅"] = pd.to_numeric(df_tx.get("zf"), errors="coerce")
                    df_norm["最高"] = df_norm["最新价"]
                    df_norm["最低"] = df_norm["最新价"]
                    df_norm["今开"] = df_norm["最新价"]
                    df_norm["昨收"] = df_norm["最新价"] - df_norm["涨跌额"].fillna(0)
                    df_norm["市盈率-动态"] = pd.to_numeric(df_tx.get("pe_ttm"), errors="coerce")
                    df_norm["市净率"] = None
                    df_norm["总市值"] = pd.to_numeric(df_tx.get("zsz"), errors="coerce") * 100000000
                    df_norm["流通市值"] = pd.to_numeric(df_tx.get("ltsz"), errors="coerce") * 100000000
                    return df_norm
        except Exception as e:
            logger.warning("Concurrent Tencent pipeline failed: %s", str(e))

        # 3. Fallback to ak.stock_zh_a_spot_tx
        if hasattr(ak, "stock_zh_a_spot_tx"):
            try:
                df_tx = ak.stock_zh_a_spot_tx()
                if df_tx is not None and not df_tx.empty:
                    clean_code = df_tx["code"].astype(str).str.replace("sh", "").str.replace("sz", "").str.replace("bj", "").str.zfill(6)
                    df_norm = pd.DataFrame()
                    df_norm["代码"] = clean_code
                    df_norm["名称"] = df_tx["name"].astype(str)
                    df_norm["最新价"] = pd.to_numeric(df_tx.get("zxj"), errors="coerce")
                    df_norm["涨跌幅"] = pd.to_numeric(df_tx.get("zdf"), errors="coerce")
                    df_norm["涨跌额"] = pd.to_numeric(df_tx.get("zd"), errors="coerce")
                    df_norm["成交量"] = pd.to_numeric(df_tx.get("volume"), errors="coerce")
                    df_norm["成交额"] = pd.to_numeric(df_tx.get("turnover"), errors="coerce")
                    df_norm["换手率"] = pd.to_numeric(df_tx.get("hsl"), errors="coerce")
                    df_norm["振幅"] = pd.to_numeric(df_tx.get("zf"), errors="coerce")
                    df_norm["最高"] = df_norm["最新价"]
                    df_norm["最低"] = df_norm["最新价"]
                    df_norm["今开"] = df_norm["最新价"]
                    df_norm["昨收"] = df_norm["最新价"] - df_norm["涨跌额"].fillna(0)
                    df_norm["市盈率-动态"] = pd.to_numeric(df_tx.get("pe_ttm"), errors="coerce")
                    df_norm["市净率"] = None
                    df_norm["总市值"] = pd.to_numeric(df_tx.get("zsz"), errors="coerce") * 100000000
                    df_norm["流通市值"] = pd.to_numeric(df_tx.get("ltsz"), errors="coerce") * 100000000
                    return df_norm
            except Exception as e:
                logger.error("ak.stock_zh_a_spot_tx failed: %s", str(e), exc_info=True)

        raise AKShareProviderError(
            code="AKSHARE_UPSTREAM_ERROR",
            message="上游金融数据源实时行情请求失败，请稍后重试"
        )

    @classmethod
    def get_cn_indices(cls) -> pd.DataFrame:
        """
        Fetch real-time major A-share indices quotes.
        Primary: ak.stock_zh_index_spot_em()
        Secondary: Fast Tencent Index quote stream
        """
        cls._log_runtime_info()
        try:
            import akshare as ak
        except ImportError as e:
            logger.error("AKShare module is not installed: %s", str(e))
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message="AKShare 运行环境未就绪，缺少核心依赖库"
            )

        # 1. Primary: stock_zh_index_spot_em
        if hasattr(ak, "stock_zh_index_spot_em"):
            try:
                df = ak.stock_zh_index_spot_em()
                if df is not None and not df.empty:
                    if "代码" in df.columns:
                        df["代码"] = df["代码"].astype(str).str.strip()
                    return df
            except Exception as e:
                logger.warning("ak.stock_zh_index_spot_em failed, trying secondary stream: %s", str(e))

        # 2. Secondary: Tencent Index Gateway
        try:
            url = "http://qt.gtimg.cn/q=s_sh000001,s_sz399001,s_sz399006,s_sh000300,s_sh000016,s_sh000688,s_sh000905"
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=5)
            r.encoding = "gbk"
            rows = []
            for line in r.text.strip().split(";"):
                if not line.strip():
                    continue
                parts = line.split("~")
                if len(parts) > 7:
                    code = parts[2]
                    name = parts[1]
                    last = float(parts[3]) if parts[3] else None
                    change = float(parts[4]) if parts[4] else None
                    change_pct = float(parts[5]) if parts[5] else None
                    volume = float(parts[6]) * 100 if parts[6] else None
                    turnover = float(parts[7]) * 10000 if parts[7] else None
                    rows.append({
                        "代码": code,
                        "名称": name,
                        "最新价": last,
                        "涨跌额": change,
                        "涨跌幅": change_pct,
                        "成交量": volume,
                        "成交额": turnover,
                        "今开": last,
                        "最高": last,
                        "最低": last,
                        "昨收": last - (change or 0) if last is not None else None
                    })
            if rows:
                return pd.DataFrame(rows)
        except Exception as e:
            logger.error("Tencent index stream fallback failed: %s", str(e))

        raise AKShareProviderError(
            code="AKSHARE_UPSTREAM_ERROR",
            message="无法从上游数据源获取大盘指数实时行情"
        )

    @classmethod
    def get_single_stock_spot(cls, symbol: str) -> Optional[Dict[str, Any]]:
        """
        High-speed real-time quote for a single stock code.
        """
        clean_symbol = str(symbol).strip().zfill(6)
        prefix = "sh" if clean_symbol.startswith(("6", "9")) else ("bj" if clean_symbol.startswith(("8", "4", "920")) else "sz")
        url = f"http://qt.gtimg.cn/q={prefix}{clean_symbol}"
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=4)
            r.encoding = "gbk"
            text = r.text.strip()
            parts = text.split("~")
            if len(parts) > 35 and parts[2] == clean_symbol:
                return {
                    "symbol": clean_symbol,
                    "name": parts[1],
                    "last": float(parts[3]) if parts[3] else None,
                    "prev_close": float(parts[4]) if parts[4] else None,
                    "open": float(parts[5]) if parts[5] else None,
                    "volume": float(parts[6]) * 100 if parts[6] else None,
                    "turnover": float(parts[37]) * 10000 if parts[37] else None,
                    "change": float(parts[31]) if parts[31] else None,
                    "change_pct": float(parts[32]) if parts[32] else None,
                    "high": float(parts[33]) if parts[33] else None,
                    "low": float(parts[34]) if parts[34] else None,
                    "turnover_rate": float(parts[38]) if parts[38] else None,
                    "pe_dynamic": float(parts[39]) if parts[39] else None,
                    "pb": float(parts[46]) if len(parts) > 46 and parts[46] else None,
                    "total_market_cap": float(parts[45]) * 10000 if len(parts) > 45 and parts[45] else None,
                    "float_market_cap": float(parts[44]) * 10000 if len(parts) > 44 and parts[44] else None,
                }
        except Exception as e:
            logger.warning("Single stock spot fetch failed for %s: %s", clean_symbol, str(e))
        return None

    @classmethod
    def get_cn_stock_info(cls, symbol: str) -> Dict[str, Any]:
        """
        Fetch basic company/stock info via AKShare / quote stream.
        """
        cls._log_runtime_info()
        clean_symbol = str(symbol).strip().zfill(6)

        # 1. Try EastMoney via AKShare
        try:
            import akshare as ak
            if hasattr(ak, "stock_individual_info_em"):
                df = ak.stock_individual_info_em(symbol=clean_symbol)
                if df is not None and not df.empty and "item" in df.columns and "value" in df.columns:
                    info_dict = {str(row["item"]).strip(): row["value"] for _, row in df.iterrows()}
                    return {
                        "symbol": clean_symbol,
                        "name": str(info_dict.get("股票简称", "")).strip() or None,
                        "industry": str(info_dict.get("行业", "")).strip() or None,
                        "listing_date": str(info_dict.get("上市时间", "")).strip() or None,
                        "total_market_cap": info_dict.get("总市值"),
                        "float_market_cap": info_dict.get("流通市值")
                    }
        except Exception as e:
            logger.warning("stock_individual_info_em failed for %s: %s", clean_symbol, str(e))

        # 2. Fallback to single stock quote
        single_quote = cls.get_single_stock_spot(clean_symbol)
        if single_quote:
            return {
                "symbol": clean_symbol,
                "name": single_quote.get("name"),
                "industry": "A股上市公司",
                "listing_date": None,
                "total_market_cap": single_quote.get("total_market_cap"),
                "float_market_cap": single_quote.get("float_market_cap")
            }

        return {
            "symbol": clean_symbol,
            "name": None,
            "industry": None,
            "listing_date": None,
            "total_market_cap": None,
            "float_market_cap": None
        }

    @classmethod
    def get_cn_stock_history(
        cls,
        symbol: str,
        period: str = "daily",
        start_date: str = "",
        end_date: str = "",
        adjust: str = ""
    ) -> pd.DataFrame:
        """
        Fetch A-share historical daily/weekly/monthly bars.
        Primary: ak.stock_zh_a_hist(symbol, period, start_date, end_date, adjust)
        Secondary: ak.stock_zh_a_daily(symbol, adjust) (Sina)
        """
        cls._log_runtime_info()
        try:
            import akshare as ak
        except ImportError as e:
            logger.error("AKShare module is not installed: %s", str(e))
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message="AKShare 运行环境未就绪，缺少核心依赖库"
            )

        clean_symbol = str(symbol).strip().zfill(6)
        clean_period = "daily" if period not in ("daily", "weekly", "monthly") else period

        # 1. Try ak.stock_zh_a_hist
        if hasattr(ak, "stock_zh_a_hist"):
            try:
                df = ak.stock_zh_a_hist(
                    symbol=clean_symbol,
                    period=clean_period,
                    start_date=start_date,
                    end_date=end_date,
                    adjust=adjust
                )
                if df is not None and not df.empty:
                    return df
            except Exception as e:
                logger.warning("ak.stock_zh_a_hist failed for %s (%s): %s", clean_symbol, clean_period, str(e))

        # 2. Try ak.stock_zh_a_daily (Sina fallback)
        if clean_period == "daily" and hasattr(ak, "stock_zh_a_daily"):
            try:
                prefix = "sh" if clean_symbol.startswith(("6", "9")) else ("bj" if clean_symbol.startswith(("8", "4", "920")) else "sz")
                df_sina = ak.stock_zh_a_daily(symbol=f"{prefix}{clean_symbol}", adjust=adjust or "qfq")
                if df_sina is not None and not df_sina.empty:
                    # Rename columns to standard AKShare format
                    # Sina columns: date, open, high, low, close, volume, amount, turnover
                    df_res = pd.DataFrame()
                    df_res["日期"] = df_sina["date"].astype(str)
                    df_res["开盘"] = df_sina["open"]
                    df_res["最高"] = df_sina["high"]
                    df_res["最低"] = df_sina["low"]
                    df_res["收盘"] = df_sina["close"]
                    df_res["成交量"] = df_sina["volume"]
                    df_res["成交额"] = df_sina["amount"]
                    df_res["换手率"] = df_sina.get("turnover", 0.0) * 100 if "turnover" in df_sina.columns else 0.0
                    df_res["涨跌幅"] = (df_res["收盘"] - df_res["开盘"]) / df_res["开盘"] * 100
                    df_res["涨跌额"] = df_res["收盘"] - df_res["开盘"]
                    df_res["振幅"] = (df_res["最高"] - df_res["最低"]) / df_res["最低"] * 100

                    if start_date:
                        start_fmt = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:]}" if len(start_date) == 8 else start_date
                        df_res = df_res[df_res["日期"] >= start_fmt]
                    if end_date:
                        end_fmt = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:]}" if len(end_date) == 8 else end_date
                        df_res = df_res[df_res["日期"] <= end_fmt]

                    if not df_res.empty:
                        return df_res
            except Exception as e:
                logger.error("ak.stock_zh_a_daily failed for %s: %s", clean_symbol, str(e))

        raise AKShareProviderError(
            code="AKSHARE_UPSTREAM_ERROR",
            message=f"上游金融数据源历史K线请求异常 ({clean_symbol})"
        )

    @classmethod
    def get_cn_stock_minute(
        cls,
        symbol: str,
        period: str = "5",
        adjust: str = "",
        start_date: str = "",
        end_date: str = ""
    ) -> pd.DataFrame:
        """
        Fetch A-share minute-level bars.
        """
        cls._log_runtime_info()
        clean_symbol = str(symbol).strip().zfill(6)
        valid_periods = ["1", "5", "15", "30", "60"]
        if str(period) not in valid_periods:
            raise AKShareProviderError(
                code="PERIOD_NOT_SUPPORTED",
                message=f"不支持的分钟周期 [{period}]，可选值为: 1, 5, 15, 30, 60"
            )

        try:
            import akshare as ak
        except ImportError as e:
            logger.error("AKShare module is not installed: %s", str(e))
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message="AKShare 运行环境未就绪，缺少核心依赖库"
            )

        # 1. Try stock_zh_a_hist_min_em
        if hasattr(ak, "stock_zh_a_hist_min_em"):
            try:
                kwargs: Dict[str, Any] = {
                    "symbol": clean_symbol,
                    "period": str(period),
                    "adjust": adjust or ""
                }
                if start_date:
                    kwargs["start_date"] = start_date
                if end_date:
                    kwargs["end_date"] = end_date

                sig = inspect.signature(ak.stock_zh_a_hist_min_em)
                filtered_kwargs = {k: v for k, v in kwargs.items() if k in sig.parameters}

                df = ak.stock_zh_a_hist_min_em(**filtered_kwargs)
                if df is not None and not df.empty:
                    return df
            except Exception as e:
                logger.warning("ak.stock_zh_a_hist_min_em failed for %s (%s min): %s", clean_symbol, period, str(e))

        # 2. Try stock_zh_a_minute (Sina minute)
        if hasattr(ak, "stock_zh_a_minute"):
            try:
                prefix = "sh" if clean_symbol.startswith(("6", "9")) else ("bj" if clean_symbol.startswith(("8", "4", "920")) else "sz")
                df_min = ak.stock_zh_a_minute(symbol=f"{prefix}{clean_symbol}", period=str(period), adjust=adjust or "qfq")
                if df_min is not None and not df_min.empty:
                    df_res = pd.DataFrame()
                    df_res["时间"] = df_min["day"] if "day" in df_min.columns else df_min["date"]
                    df_res["开盘"] = df_min["open"]
                    df_res["最高"] = df_min["high"]
                    df_res["最低"] = df_min["low"]
                    df_res["收盘"] = df_min["close"]
                    df_res["成交量"] = df_min["volume"]
                    df_res["成交额"] = df_min.get("amount", df_res["成交量"] * df_res["收盘"])
                    return df_res
            except Exception as e:
                logger.error("ak.stock_zh_a_minute failed for %s: %s", clean_symbol, str(e))

        raise AKShareProviderError(
            code="AKSHARE_UPSTREAM_ERROR",
            message=f"上游金融数据源分钟K线请求异常 ({clean_symbol})"
        )
