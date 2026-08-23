"""
AKShare Upstream Provider Layer
Centralizes and standardizes all external calls to AKShare interfaces.
Supports dynamic compatibility checking and clean error handling.
"""
import sys
import logging
import inspect
from typing import Optional, List, Dict, Any
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
        Fetch real-time A-share full market quotes from EastMoney via AKShare.
        Interface: ak.stock_zh_a_spot_em()
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

        if not hasattr(ak, "stock_zh_a_spot_em"):
            raise AKShareProviderError(
                code="AKSHARE_INTERFACE_UNAVAILABLE",
                message="当前 AKShare 版本不支持 stock_zh_a_spot_em 接口"
            )

        try:
            df = ak.stock_zh_a_spot_em()
            if df is None or df.empty:
                raise AKShareProviderError(
                    code="AKSHARE_EMPTY_RESPONSE",
                    message="AKShare 返回空数据集 (stock_zh_a_spot_em)"
                )
            
            # Ensure stock code is string with leading zeros
            if "代码" in df.columns:
                df["代码"] = df["代码"].astype(str).str.zfill(6)
            
            return df
        except AKShareProviderError:
            raise
        except Exception as e:
            logger.error("AKShare stock_zh_a_spot_em failed: %s", str(e), exc_info=True)
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message="上游金融数据源(EastMoney/AKShare)实时行情请求失败，请稍后重试"
            )

    @classmethod
    def get_cn_indices(cls) -> pd.DataFrame:
        """
        Fetch real-time major A-share indices quotes from EastMoney via AKShare.
        Interface: ak.stock_zh_index_spot_em() or fallback to ak.index_zh_a_hist()
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

        # Primary interface: stock_zh_index_spot_em
        if hasattr(ak, "stock_zh_index_spot_em"):
            try:
                df = ak.stock_zh_index_spot_em(symbol="主要指数")
                if df is not None and not df.empty:
                    if "代码" in df.columns:
                        df["代码"] = df["代码"].astype(str).str.strip()
                    return df
            except Exception as e:
                logger.warning("ak.stock_zh_index_spot_em(symbol='主要指数') failed, trying default: %s", str(e))
                try:
                    df = ak.stock_zh_index_spot_em()
                    if df is not None and not df.empty:
                        if "代码" in df.columns:
                            df["代码"] = df["代码"].astype(str).str.strip()
                        return df
                except Exception as inner_e:
                    logger.error("ak.stock_zh_index_spot_em failed: %s", str(inner_e))

        # Secondary fallback: stock_zh_index_spot_sina
        if hasattr(ak, "stock_zh_index_spot_sina"):
            try:
                df = ak.stock_zh_index_spot_sina()
                if df is not None and not df.empty:
                    return df
            except Exception as e:
                logger.error("ak.stock_zh_index_spot_sina failed: %s", str(e))

        raise AKShareProviderError(
            code="AKSHARE_UPSTREAM_ERROR",
            message="无法从上游数据源获取大盘指数实时行情"
        )

    @classmethod
    def get_cn_stock_info(cls, symbol: str) -> Dict[str, Any]:
        """
        Fetch basic company/stock info from EastMoney via AKShare.
        Interface: ak.stock_individual_info_em(symbol=clean_symbol)
        """
        cls._log_runtime_info()
        clean_symbol = str(symbol).strip().zfill(6)

        try:
            import akshare as ak
        except ImportError as e:
            logger.error("AKShare module is not installed: %s", str(e))
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message="AKShare 运行环境未就绪，缺少核心依赖库"
            )

        if not hasattr(ak, "stock_individual_info_em"):
            return {
                "symbol": clean_symbol,
                "name": None,
                "industry": None,
                "listing_date": None,
                "total_market_cap": None,
                "float_market_cap": None
            }

        try:
            df = ak.stock_individual_info_em(symbol=clean_symbol)
            if df is None or df.empty:
                return {
                    "symbol": clean_symbol,
                    "name": None,
                    "industry": None,
                    "listing_date": None,
                    "total_market_cap": None,
                    "float_market_cap": None
                }

            info_dict = {}
            if "item" in df.columns and "value" in df.columns:
                for _, row in df.iterrows():
                    key = str(row["item"]).strip()
                    val = row["value"]
                    info_dict[key] = val
            
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
        Fetch A-share historical daily/weekly/monthly bars from EastMoney via AKShare.
        Interface: ak.stock_zh_a_hist(symbol, period, start_date, end_date, adjust)
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
        if period not in ("daily", "weekly", "monthly"):
            period = "daily"

        try:
            df = ak.stock_zh_a_hist(
                symbol=clean_symbol,
                period=period,
                start_date=start_date,
                end_date=end_date,
                adjust=adjust
            )
            
            if df is None or df.empty:
                raise AKShareProviderError(
                    code="AKSHARE_EMPTY_RESPONSE",
                    message=f"AKShare 股票代码 [{clean_symbol}] 未查询到历史K线数据 ({period})"
                )
            
            return df
        except AKShareProviderError:
            raise
        except Exception as e:
            logger.error("AKShare stock_zh_a_hist failed for %s (%s): %s", clean_symbol, period, str(e), exc_info=True)
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
        Fetch A-share minute-level bars from EastMoney via AKShare.
        Interface: ak.stock_zh_a_hist_min_em(symbol, period, adjust, start_date, end_date)
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

        if not hasattr(ak, "stock_zh_a_hist_min_em"):
            raise AKShareProviderError(
                code="PERIOD_NOT_SUPPORTED",
                message="当前 AKShare 版本不支持 stock_zh_a_hist_min_em 分钟行情接口"
            )

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
            if df is None or df.empty:
                raise AKShareProviderError(
                    code="AKSHARE_EMPTY_RESPONSE",
                    message=f"AKShare 股票代码 [{clean_symbol}] 未查询到 {period} 分钟级别行情数据"
                )

            return df
        except AKShareProviderError:
            raise
        except Exception as e:
            logger.error("AKShare stock_zh_a_hist_min_em failed for %s (%s min): %s", clean_symbol, period, str(e), exc_info=True)
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message=f"上游金融数据源分钟K线请求异常 ({clean_symbol})"
            )
