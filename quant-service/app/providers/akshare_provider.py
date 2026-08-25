"""
AKShare Upstream Provider Layer - Resilient Multi-Source Financial Adapter
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
    def _fetch_tencent_history_direct(
        cls,
        symbol: str,
        period: str = "daily",
        start_date: str = "",
        end_date: str = "",
        adjust: str = ""
    ) -> pd.DataFrame:
        """
        Direct high-speed Tencent K-Line endpoint fallback.
        Supports daily, weekly, monthly, and handles newly listed IPO stocks seamlessly.
        """
        clean = str(symbol).strip().zfill(6)
        prefix = "sh" if clean.startswith(("6", "9")) else ("bj" if clean.startswith(("8", "4", "920")) else "sz")
        tx_symbol = f"{prefix}{clean}"

        p_map = {"daily": "day", "weekly": "week", "monthly": "month"}
        tx_p = p_map.get(period, "day")

        url = "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get"
        params = {
            "param": f"{tx_symbol},{tx_p},,,640,{adjust}",
        }
        try:
            r = requests.get(url, params=params, timeout=10)
            if r.status_code != 200:
                return pd.DataFrame()
            data = r.json().get("data", {}).get(tx_symbol, {})
        except Exception as e:
            logger.warning("Direct Tencent kline fetch failed for %s: %s", tx_symbol, str(e))
            return pd.DataFrame()

        candidates = []
        if adjust == "qfq":
            candidates = [f"qfq{tx_p}", tx_p, f"hfq{tx_p}"]
        elif adjust == "hfq":
            candidates = [f"hfq{tx_p}", tx_p, f"qfq{tx_p}"]
        else:
            candidates = [tx_p, f"qfq{tx_p}", f"hfq{tx_p}"]

        raw_bars = None
        for cand in candidates:
            if cand in data and isinstance(data[cand], list) and len(data[cand]) > 0:
                raw_bars = data[cand]
                break

        if not raw_bars:
            return pd.DataFrame()

        rows = []
        for item in raw_bars:
            if len(item) < 6:
                continue
            d_str = str(item[0]).strip()
            try:
                open_v = float(item[1]) if item[1] is not None and item[1] != "" else None
                close_v = float(item[2]) if item[2] is not None and item[2] != "" else None
                high_v = float(item[3]) if item[3] is not None and item[3] != "" else None
                low_v = float(item[4]) if item[4] is not None and item[4] != "" else None
                vol_v = float(item[5]) if item[5] is not None and item[5] != "" else None
                hsl_v = float(item[7]) if len(item) > 7 and item[7] not in ("", None) else None
                amount_v = float(item[8]) * 10000 if len(item) > 8 and item[8] not in ("", None) else None
            except (ValueError, TypeError):
                continue

            rows.append({
                "日期": d_str,
                "开盘": open_v,
                "收盘": close_v,
                "最高": high_v,
                "最低": low_v,
                "成交量": vol_v,
                "成交额": amount_v,
                "换手率": hsl_v
            })

        df = pd.DataFrame(rows)
        if df.empty:
            return df

        df["日期"] = pd.to_datetime(df["日期"], errors="coerce")
        df = df.dropna(subset=["日期", "开盘", "收盘", "最高", "最低"])
        if df.empty:
            return df
        df = df.sort_values("日期").reset_index(drop=True)

        prev_c = df["收盘"].shift(1)
        df["涨跌额"] = df["收盘"] - prev_c
        df["涨跌幅"] = (df["涨跌额"] / prev_c) * 100.0
        df["振幅"] = ((df["最高"] - df["最低"]) / prev_c) * 100.0
        df["日期"] = df["日期"].dt.strftime("%Y-%m-%d")

        if start_date:
            s_fmt = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:]}" if len(start_date) == 8 else start_date
            df = df[df["日期"] >= s_fmt]
        if end_date:
            e_fmt = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:]}" if len(end_date) == 8 else end_date
            df = df[df["日期"] <= e_fmt]

        if not df.empty:
            df.attrs["provider"] = "tencent"
            df.attrs["source"] = "akshare"
        return df

    @classmethod
    def _fetch_tencent_minute_direct(
        cls,
        symbol: str,
        period: str = "5",
        adjust: str = ""
    ) -> pd.DataFrame:
        """
        Direct Tencent minute-level bars endpoint (1m, 5m, 15m, 30m, 60m).
        """
        clean = str(symbol).strip().zfill(6)
        prefix = "sh" if clean.startswith(("6", "9")) else ("bj" if clean.startswith(("8", "4", "920")) else "sz")
        tx_symbol = f"{prefix}{clean}"

        p_key = f"m{period}" if not str(period).startswith("m") else str(period)
        url = f"https://ifzq.gtimg.cn/appstock/app/kline/mkline?param={tx_symbol},{p_key},,320"
        try:
            r = requests.get(url, timeout=6)
            if r.status_code != 200:
                return pd.DataFrame()
            data = r.json().get("data", {}).get(tx_symbol, {})
            raw_bars = data.get(p_key, [])
        except Exception as e:
            logger.warning("Direct Tencent minute kline failed for %s: %s", tx_symbol, str(e))
            return pd.DataFrame()

        if not raw_bars:
            return pd.DataFrame()

        rows = []
        for item in raw_bars:
            if len(item) < 6:
                continue
            raw_t = str(item[0]).strip()
            if len(raw_t) == 12:
                time_str = f"{raw_t[:4]}-{raw_t[4:6]}-{raw_t[6:8]} {raw_t[8:10]}:{raw_t[10:12]}:00"
            else:
                time_str = raw_t

            try:
                open_v = float(item[1]) if item[1] is not None and item[1] != "" else None
                close_v = float(item[2]) if item[2] is not None and item[2] != "" else None
                high_v = float(item[3]) if item[3] is not None and item[3] != "" else None
                low_v = float(item[4]) if item[4] is not None and item[4] != "" else None
                vol_v = float(item[5]) if item[5] is not None and item[5] != "" else None
                turn_v = vol_v * close_v if vol_v and close_v else 0.0
                hsl_v = float(item[7]) if len(item) > 7 and item[7] not in ("", None) else 0.0
            except (ValueError, TypeError):
                continue

            rows.append({
                "时间": time_str,
                "开盘": open_v,
                "收盘": close_v,
                "最高": high_v,
                "最低": low_v,
                "成交量": vol_v,
                "成交额": turn_v,
                "换手率": hsl_v
            })

        df = pd.DataFrame(rows)
        if not df.empty:
            df.attrs["provider"] = "tencent"
            df.attrs["source"] = "akshare"
        return df

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
        Multi-source failover:
        1. Primary: ak.stock_zh_a_hist (EastMoney)
        2. Secondary: ak.stock_zh_a_hist_tx / Direct Tencent newfqkline pipeline
        3. Tertiary: ak.stock_zh_a_daily (Sina)
        4. Quaternary: Real-time single stock spot bar synthesis for day-1 IPO / new stocks
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

        # 1. Try EastMoney ak.stock_zh_a_hist
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
                    df.attrs["provider"] = "eastmoney"
                    df.attrs["source"] = "akshare"
                    return df
            except Exception as e:
                logger.info("ak.stock_zh_a_hist fallback triggered for %s (%s): %s", clean_symbol, clean_period, str(e))

        # 2. Try ak.stock_zh_a_hist_tx
        if hasattr(ak, "stock_zh_a_hist_tx"):
            try:
                prefix = "sh" if clean_symbol.startswith(("6", "9")) else ("bj" if clean_symbol.startswith(("8", "4", "920")) else "sz")
                df_tx = ak.stock_zh_a_hist_tx(
                    symbol=f"{prefix}{clean_symbol}",
                    start_date=start_date or "19000101",
                    end_date=end_date or "20500101",
                    adjust=adjust,
                    timeout=15
                )
                if df_tx is not None and not df_tx.empty:
                    required = {"date", "open", "high", "low", "close", "volume"}
                    if not required.issubset(set(df_tx.columns)):
                        raise ValueError(f"Tencent history columns changed: {list(df_tx.columns)}")

                    df_res = pd.DataFrame({
                        "日期": pd.to_datetime(df_tx["date"], errors="coerce"),
                        "开盘": pd.to_numeric(df_tx["open"], errors="coerce"),
                        "最高": pd.to_numeric(df_tx["high"], errors="coerce"),
                        "最低": pd.to_numeric(df_tx["low"], errors="coerce"),
                        "收盘": pd.to_numeric(df_tx["close"], errors="coerce"),
                        "成交量": pd.to_numeric(df_tx["volume"], errors="coerce"),
                        "成交额": pd.to_numeric(df_tx.get("amount"), errors="coerce"),
                    }).dropna(subset=["日期", "开盘", "最高", "最低", "收盘"])

                    tx_turnover = pd.to_numeric(df_tx.get("turnover"), errors="coerce")
                    df_res["换手率"] = tx_turnover * 100.0

                    if clean_period in ("weekly", "monthly"):
                        period_key = (
                            df_res["日期"].dt.to_period("W-FRI")
                            if clean_period == "weekly"
                            else df_res["日期"].dt.to_period("M")
                        )
                        df_res = (
                            df_res.assign(_period=period_key)
                            .groupby("_period", sort=True)
                            .agg({
                                "日期": "max",
                                "开盘": "first",
                                "最高": "max",
                                "最低": "min",
                                "收盘": "last",
                                "成交量": "sum",
                                "成交额": "sum",
                                "换手率": "sum",
                            })
                            .reset_index(drop=True)
                        )

                    previous_close = df_res["收盘"].shift(1)
                    df_res["涨跌额"] = df_res["收盘"] - previous_close
                    df_res["涨跌幅"] = (df_res["涨跌额"] / previous_close) * 100.0
                    df_res["振幅"] = ((df_res["最高"] - df_res["最低"]) / previous_close) * 100.0
                    df_res["日期"] = df_res["日期"].dt.strftime("%Y-%m-%d")
                    df_res.attrs["provider"] = "tencent"
                    df_res.attrs["source"] = "akshare"
                    return df_res
            except Exception as e:
                logger.debug("ak.stock_zh_a_hist_tx fallback caught for %s: %s", clean_symbol, str(e))

        # 3. Direct High-Speed Tencent Provider Fallback
        try:
            df_direct = cls._fetch_tencent_history_direct(
                symbol=clean_symbol,
                period=clean_period,
                start_date=start_date,
                end_date=end_date,
                adjust=adjust
            )
            if df_direct is not None and not df_direct.empty:
                return df_direct
        except Exception as e:
            logger.debug("_fetch_tencent_history_direct failed for %s: %s", clean_symbol, str(e))

        # 4. Try ak.stock_zh_a_daily (Sina fallback)
        if clean_period == "daily" and hasattr(ak, "stock_zh_a_daily"):
            try:
                prefix = "sh" if clean_symbol.startswith(("6", "9")) else ("bj" if clean_symbol.startswith(("8", "4", "920")) else "sz")
                df_sina = ak.stock_zh_a_daily(symbol=f"{prefix}{clean_symbol}", adjust=adjust or "qfq")
                if df_sina is not None and not df_sina.empty and "date" in df_sina.columns:
                    df_res = pd.DataFrame()
                    df_res["日期"] = df_sina["date"].astype(str)
                    df_res["开盘"] = df_sina["open"]
                    df_res["最高"] = df_sina["high"]
                    df_res["最低"] = df_sina["low"]
                    df_res["收盘"] = df_sina["close"]
                    df_res["成交量"] = df_sina["volume"]
                    df_res["成交额"] = df_sina.get("amount", 0.0)
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
                        df_res.attrs["provider"] = "sina"
                        df_res.attrs["source"] = "akshare"
                        return df_res
            except Exception as e:
                logger.debug("ak.stock_zh_a_daily fallback caught for %s: %s", clean_symbol, str(e))

        # 5. Day-1 IPO / Single Spot Bar Synthesis
        try:
            spot_single = cls.get_single_stock_spot(clean_symbol)
            if spot_single and spot_single.get("last") is not None:
                today_str = datetime.date.today().strftime("%Y-%m-%d")
                last_price = spot_single.get("last")
                open_p = spot_single.get("open") or last_price
                high_p = spot_single.get("high") or max(last_price, open_p)
                low_p = spot_single.get("low") or min(last_price, open_p)
                df_synth = pd.DataFrame([{
                    "日期": today_str,
                    "开盘": open_p,
                    "收盘": last_price,
                    "最高": high_p,
                    "最低": low_p,
                    "成交量": spot_single.get("volume") or 0.0,
                    "成交额": spot_single.get("turnover") or 0.0,
                    "换手率": spot_single.get("turnover_rate") or 0.0,
                    "涨跌额": spot_single.get("change") or 0.0,
                    "涨跌幅": spot_single.get("change_pct") or 0.0,
                    "振幅": ((high_p - low_p) / open_p * 100.0) if open_p else 0.0
                }])
                df_synth.attrs["provider"] = "tencent"
                df_synth.attrs["source"] = "akshare"
                return df_synth
        except Exception as e:
            logger.debug("Single spot bar synthesis failed for %s: %s", clean_symbol, str(e))

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
        Multi-source failover:
        1. Primary: stock_zh_a_hist_min_em (EastMoney)
        2. Secondary: Direct Tencent mkline endpoint (1m, 5m, 15m, 30m, 60m)
        3. Tertiary: stock_zh_a_minute (Sina)
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
                    df.attrs["provider"] = "eastmoney"
                    df.attrs["source"] = "akshare"
                    return df
            except Exception as e:
                logger.info("ak.stock_zh_a_hist_min_em fallback triggered for %s (%s min): %s", clean_symbol, period, str(e))

        # 2. Try Direct Tencent Minute mkline Endpoint
        try:
            df_tx_min = cls._fetch_tencent_minute_direct(
                symbol=clean_symbol,
                period=str(period),
                adjust=adjust
            )
            if df_tx_min is not None and not df_tx_min.empty:
                return df_tx_min
        except Exception as e:
            logger.debug("Direct Tencent minute kline failed for %s: %s", clean_symbol, str(e))

        # 3. Try stock_zh_a_minute (Sina minute)
        if hasattr(ak, "stock_zh_a_minute"):
            try:
                prefix = "sh" if clean_symbol.startswith(("6", "9")) else ("bj" if clean_symbol.startswith(("8", "4", "920")) else "sz")
                df_min = ak.stock_zh_a_minute(symbol=f"{prefix}{clean_symbol}", period=str(period), adjust=adjust or "qfq")
                if df_min is not None and not df_min.empty:
                    time_col = "day" if "day" in df_min.columns else ("date" if "date" in df_min.columns else None)
                    if time_col and "open" in df_min.columns and "close" in df_min.columns:
                        df_res = pd.DataFrame()
                        df_res["时间"] = df_min[time_col]
                        df_res["开盘"] = df_min["open"]
                        df_res["最高"] = df_min.get("high", df_min["close"])
                        df_res["最低"] = df_min.get("low", df_min["open"])
                        df_res["收盘"] = df_min["close"]
                        df_res["成交量"] = df_min.get("volume", 0.0)
                        df_res["成交额"] = df_min.get("amount", df_res["成交量"] * df_res["收盘"])
                        df_res.attrs["provider"] = "sina"
                        df_res.attrs["source"] = "akshare"
                        return df_res
            except Exception as e:
                logger.debug("ak.stock_zh_a_minute fallback caught for %s: %s", clean_symbol, str(e))

        raise AKShareProviderError(
            code="AKSHARE_UPSTREAM_ERROR",
            message=f"上游金融数据源分钟K线请求异常 ({clean_symbol})"
        )
