"""
AKShare Upstream Provider Layer
Centralizes all external calls to AKShare interfaces.
"""
import logging
from typing import Optional
import pandas as pd

logger = logging.getLogger("akshare_provider")

class AKShareProviderError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message

class AKShareProvider:
    @staticmethod
    def get_version() -> str:
        try:
            import akshare as ak
            return getattr(ak, "__version__", "unknown")
        except Exception:
            return "not_installed"

    @staticmethod
    def get_cn_spot() -> pd.DataFrame:
        """
        Fetch real-time A-share market quotes from EastMoney via AKShare.
        Interface: ak.stock_zh_a_spot_em()
        """
        try:
            import akshare as ak
        except ImportError as e:
            logger.error("AKShare module is not installed: %s", str(e))
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message="AKShare 运行环境未就绪，缺少核心依赖库"
            )

        try:
            df = ak.stock_zh_a_spot_em()
            if df is None or df.empty:
                raise AKShareProviderError(
                    code="AKSHARE_EMPTY_RESPONSE",
                    message="AKShare 返回空数据集 (stock_zh_a_spot_em)"
                )
            
            # Ensure stock code is treated as string with leading zeros
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

    @staticmethod
    def get_cn_stock_history(
        symbol: str,
        start_date: str,
        end_date: str,
        adjust: str = ""
    ) -> pd.DataFrame:
        """
        Fetch A-share historical daily bars from EastMoney via AKShare.
        Interface: ak.stock_zh_a_hist(symbol, period="daily", start_date, end_date, adjust)
        """
        try:
            import akshare as ak
        except ImportError as e:
            logger.error("AKShare module is not installed: %s", str(e))
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message="AKShare 运行环境未就绪，缺少核心依赖库"
            )

        # Validate symbol is 6-digit numeric string
        clean_symbol = str(symbol).strip().zfill(6)

        try:
            df = ak.stock_zh_a_hist(
                symbol=clean_symbol,
                period="daily",
                start_date=start_date,
                end_date=end_date,
                adjust=adjust
            )
            
            if df is None or df.empty:
                raise AKShareProviderError(
                    code="AKSHARE_EMPTY_RESPONSE",
                    message=f"AKShare 股票代码 [{clean_symbol}] 未查询到指定区间历史行情数据"
                )
            
            return df
        except AKShareProviderError:
            raise
        except Exception as e:
            logger.error("AKShare stock_zh_a_hist failed for %s: %s", clean_symbol, str(e), exc_info=True)
            raise AKShareProviderError(
                code="AKSHARE_UPSTREAM_ERROR",
                message=f"上游金融数据源历史K线请求异常 ({clean_symbol})"
            )
