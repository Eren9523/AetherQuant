# Penguin Quant 数据模型与存储字典 (Data Model)

## 1. Cloudflare D1 核心数据表结构

### 1.1 `instruments` (交易标的元数据表)
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `symbol` | TEXT PRIMARY KEY | 股票代码 (例: `600519.SH`, `NVDA`) |
| `name` | TEXT NOT NULL | 证券名称 (例: `贵州茅台`) |
| `market` | TEXT NOT NULL | 市场分类 (`CN` / `US`) |
| `exchange` | TEXT NOT NULL | 交易所 (`SSE`, `SZSE`, `NASDAQ`) |
| `sector` | TEXT | 行业分类 (申万/GICS) |
| `is_active`| INTEGER | 是否在市交易 (1: 是, 0: 停牌/退市) |

### 1.2 `factor_definitions` (因子定义表)
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | TEXT PRIMARY KEY | 因子标识 (例: `MOM_60`, `VOL_20`) |
| `name` | TEXT NOT NULL | 因子中文名称 |
| `category` | TEXT NOT NULL | 因子类别 (`momentum`, `volatility`, `volume`, `quality`) |
| `expression` | TEXT NOT NULL | 数学计算公式表达式 |
| `direction` | TEXT NOT NULL | 因子有效方向 (`positive` / `negative`) |

### 1.3 `backtests` (回测实验与指标表)
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | TEXT PRIMARY KEY | 回测唯一 ID (`bt_...`) |
| `user_id` | TEXT NOT NULL | 所属用户 ID |
| `strategy_name`| TEXT NOT NULL | 策略名称 |
| `total_return` | REAL NOT NULL | 累计收益率 (%) |
| `annualized_return` | REAL NOT NULL | 年化收益率 (%) |
| `sharpe_ratio` | REAL NOT NULL | 夏普比率 (无风险利率 2.0%) |
| `max_drawdown` | REAL NOT NULL | 最大回撤 (%) |
| `calmar_ratio` | REAL NOT NULL | 卡玛比率 |
| `win_rate` | REAL NOT NULL | 胜率 (%) |
| `config_json` | TEXT NOT NULL | 完整的 Strategy DSL 描述 |

### 1.4 `storage_objects` (R2 对象存储索引与生命周期表)
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | TEXT PRIMARY KEY | 存储对象 ID |
| `object_key` | TEXT UNIQUE NOT NULL | R2 路径 (例: `backtests/usr_1/bt_1.json`) |
| `owner_id` | TEXT NOT NULL | 上传所有者 |
| `size_bytes` | INTEGER NOT NULL | 文件大小字节数 |
| `is_permanent` | INTEGER NOT NULL | 是否永久保存 (0: 遵循生命周期, 1: 永久) |
| `expires_at` | TEXT | 到期时间戳 (自动清理巡检目标) |
