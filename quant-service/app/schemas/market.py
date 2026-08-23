"""
Market Data Schemas & Contracts
Unified data definitions for AetherQuant market system.
"""
from typing import Optional, List, Generic, TypeVar, Any
from pydantic import BaseModel, Field

T = TypeVar("T")

class ApiErrorDetail(BaseModel):
    code: str
    message: str

class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: Optional[T] = None
    error: Optional[ApiErrorDetail] = None

class SpotStockItem(BaseModel):
    symbol: str = Field(..., description="6位A股股票代码，保留前导零")
    name: str = Field(..., description="股票名称")
    market: str = Field("CN", description="所属市场")
    exchange: str = Field("SH", description="交易所代码 (SH/SZ/BJ)")
    last: Optional[float] = Field(None, description="最新价")
    open: Optional[float] = Field(None, description="今开价")
    high: Optional[float] = Field(None, description="最高价")
    low: Optional[float] = Field(None, description="最低价")
    prev_close: Optional[float] = Field(None, description="昨收价")
    change: Optional[float] = Field(None, description="涨跌额")
    change_pct: Optional[float] = Field(None, description="涨跌幅 (%)")
    volume: Optional[float] = Field(None, description="成交量 (手/股)")
    turnover: Optional[float] = Field(None, description="成交额 (元)")
    turnover_rate: Optional[float] = Field(None, description="换手率 (%)")
    amplitude: Optional[float] = Field(None, description="振幅 (%)")
    pe_dynamic: Optional[float] = Field(None, description="市盈率(动)")
    pb: Optional[float] = Field(None, description="市净率")
    total_market_cap: Optional[float] = Field(None, description="总市值 (元)")
    float_market_cap: Optional[float] = Field(None, description="流通市值 (元)")
    source: str = Field("akshare", description="数据来源")
    provider: str = Field("eastmoney", description="底层提供商")
    as_of: str = Field(..., description="行情时间 (ISO 8601)")

class SpotResponseData(BaseModel):
    count: int = Field(..., description="当前页条数")
    total: int = Field(..., description="筛选后的全市场总条数")
    page: int = Field(1, description="当前页码")
    page_size: int = Field(50, description="每页条数")
    as_of: str
    source: str = "akshare"
    provider: str = "eastmoney"
    cached: bool = False
    stocks: List[SpotStockItem]

class IndexQuoteItem(BaseModel):
    symbol: str = Field(..., description="指数代码")
    name: str = Field(..., description="指数名称")
    market: str = Field("CN", description="所属市场")
    last: Optional[float] = Field(None, description="最新点位")
    open: Optional[float] = Field(None, description="今开点位")
    high: Optional[float] = Field(None, description="最高点位")
    low: Optional[float] = Field(None, description="最低点位")
    prev_close: Optional[float] = Field(None, description="昨收点位")
    change: Optional[float] = Field(None, description="涨跌点数")
    change_pct: Optional[float] = Field(None, description="涨跌幅 (%)")
    volume: Optional[float] = Field(None, description="成交量 (手)")
    turnover: Optional[float] = Field(None, description="成交额 (元)")
    as_of: str
    source: str = "akshare"
    provider: str = "eastmoney"

class IndexResponseData(BaseModel):
    count: int
    as_of: str
    source: str = "akshare"
    provider: str = "eastmoney"
    cached: bool = False
    indices: List[IndexQuoteItem]

class MarketOverviewData(BaseModel):
    up_count: int = Field(..., description="全市场上涨家数")
    down_count: int = Field(..., description="全市场下跌家数")
    flat_count: int = Field(..., description="全市场平盘家数")
    limit_up_count: int = Field(..., description="涨停数量 (涨幅>=9.8%)")
    limit_down_count: int = Field(..., description="跌停数量 (跌幅<=-9.8%)")
    total_turnover: float = Field(..., description="全市场总成交额 (元)")
    avg_change_pct: float = Field(..., description="全市场平均涨跌幅 (%)")
    total_count: int = Field(..., description="统计总样本股票数")
    as_of: str
    source: str = "akshare"
    provider: str = "eastmoney"
    cached: bool = False

class StockBasicInfo(BaseModel):
    symbol: str
    name: Optional[str] = None
    industry: Optional[str] = None
    listing_date: Optional[str] = None
    total_market_cap: Optional[float] = None
    float_market_cap: Optional[float] = None

class StockDetailData(BaseModel):
    quote: SpotStockItem
    basic_info: StockBasicInfo

class KLineBar(BaseModel):
    time: str = Field(..., description="K线时间戳 (日/周/月为 YYYY-MM-DD，分钟为 YYYY-MM-DD HH:mm:ss)")
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[float] = None
    turnover: Optional[float] = None
    amplitude: Optional[float] = None
    change_pct: Optional[float] = None
    change: Optional[float] = None
    turnover_rate: Optional[float] = None

class HistoryResponseData(BaseModel):
    symbol: str
    count: int
    period: str
    adjust: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    as_of: str
    source: str = "akshare"
    provider: str = "eastmoney"
    cached: bool = False
    quality_warnings_count: int = 0
    bars: List[KLineBar]

class ChartResponseData(BaseModel):
    symbol: str
    interval: str
    adjust: str
    count: int
    as_of: str
    source: str = "akshare"
    provider: str = "eastmoney"
    cached: bool = False
    quality_warnings_count: int = 0
    bars: List[KLineBar]

class HealthResponseData(BaseModel):
    service: str
    status: str
    akshare_version: str
    timestamp: str
