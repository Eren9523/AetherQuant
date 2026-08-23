"""
Market Data Schemas & Contracts
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
    count: int
    as_of: str
    source: str = "akshare"
    provider: str = "eastmoney"
    cached: bool = False
    stocks: List[SpotStockItem]

class KLineBar(BaseModel):
    date: str = Field(..., description="K线日期 (YYYY-MM-DD)")
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
    adjust: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    as_of: str
    source: str = "akshare"
    provider: str = "eastmoney"
    cached: bool = False
    bars: List[KLineBar]

class HealthResponseData(BaseModel):
    service: str
    status: str
    akshare_version: str
    timestamp: str
