-- Cloudflare D1 Initial Schema for Penguin Quant
-- Conforms to Rule 11 & Rule 12

-- 1. Users & Sessions
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'free', -- guest | free | pro | admin
  department TEXT,
  account_type TEXT DEFAULT 'Standard',
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS user_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'free',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT,
  token TEXT UNIQUE,
  token_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Instruments & Market Metadata
CREATE TABLE IF NOT EXISTS instruments (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT NOT NULL, -- CN | US
  exchange TEXT NOT NULL, -- SSE | SZSE | BSE | NASDAQ | NYSE
  currency TEXT NOT NULL DEFAULT 'CNY',
  asset_type TEXT NOT NULL DEFAULT 'stock',
  sector TEXT,
  industry TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_snapshot_metadata (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL,
  trading_date TEXT NOT NULL,
  total_symbols INTEGER NOT NULL,
  up_count INTEGER NOT NULL,
  down_count INTEGER NOT NULL,
  flat_count INTEGER NOT NULL,
  total_turnover REAL NOT NULL,
  fetched_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'akshare'
);

-- 3. Watchlists
CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  notes TEXT,
  added_at TEXT NOT NULL,
  FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
  UNIQUE(watchlist_id, symbol)
);

-- 4. Datasets & Uploads
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- market | financial | custom | alt
  format TEXT NOT NULL, -- csv | parquet | xlsx
  row_count INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  quality_score REAL NOT NULL DEFAULT 100.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dataset_columns (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  nullable INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

-- 5. Documents & Document Chunks (RAG)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_type TEXT NOT NULL, -- pdf | docx | txt
  storage_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'parsed',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 6. Factor Definitions & Experiments
CREATE TABLE IF NOT EXISTS factor_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- momentum | volatility | volume | quality | value | technical
  expression TEXT NOT NULL,
  description TEXT,
  direction TEXT NOT NULL DEFAULT 'positive', -- positive | negative
  is_builtin INTEGER NOT NULL DEFAULT 0,
  author_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS factor_experiments (
  id TEXT PRIMARY KEY,
  factor_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  universe TEXT NOT NULL,
  ic_mean REAL,
  rank_ic REAL,
  ir REAL,
  turnover REAL,
  long_short_return REAL,
  details_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (factor_id) REFERENCES factor_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Strategies & Versions
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  market TEXT NOT NULL DEFAULT 'CN',
  universe TEXT NOT NULL DEFAULT 'CSI300',
  dsl_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  dsl_json TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
);

-- 8. Backtests & Artifacts
CREATE TABLE IF NOT EXISTS backtests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT,
  strategy_name TEXT NOT NULL,
  market TEXT NOT NULL,
  universe TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  initial_capital REAL NOT NULL,
  total_return REAL NOT NULL,
  annualized_return REAL NOT NULL,
  benchmark_return REAL NOT NULL,
  excess_return REAL NOT NULL,
  sharpe_ratio REAL NOT NULL,
  max_drawdown REAL NOT NULL,
  calmar_ratio REAL NOT NULL,
  win_rate REAL NOT NULL,
  turnover_rate REAL NOT NULL,
  trades_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed', -- queued | running | completed | failed
  config_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS backtest_artifacts (
  id TEXT PRIMARY KEY,
  backtest_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL, -- equity | trades | positions | report
  storage_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (backtest_id) REFERENCES backtests(id) ON DELETE CASCADE
);

-- 9. AI Sessions & Messages
CREATE TABLE IF NOT EXISTS ai_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- system | user | assistant | tool
  content TEXT NOT NULL,
  tools_called_json TEXT,
  tokens_prompt INTEGER NOT NULL DEFAULT 0,
  tokens_completion INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE
);

-- 10. Automation & Sync Runs
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expr TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_status TEXT NOT NULL DEFAULT 'idle',
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL, -- running | success | failed
  started_at TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  logs_json TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- 11. Data Quality Reports
CREATE TABLE IF NOT EXISTS data_quality_reports (
  id TEXT PRIMARY KEY,
  dataset_id TEXT,
  category TEXT NOT NULL,
  records_checked INTEGER NOT NULL,
  missing_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0,
  quality_score REAL NOT NULL DEFAULT 100.0,
  warnings_json TEXT,
  created_at TEXT NOT NULL
);

-- 12. Paper Trading
CREATE TABLE IF NOT EXISTS paper_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  initial_balance REAL NOT NULL,
  cash_balance REAL NOT NULL,
  market_value REAL NOT NULL DEFAULT 0.0,
  total_equity REAL NOT NULL,
  daily_pnl REAL NOT NULL DEFAULT 0.0,
  total_pnl REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paper_positions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  available_quantity INTEGER NOT NULL, -- T+1 sellable constraint
  avg_cost REAL NOT NULL,
  current_price REAL NOT NULL,
  market_value REAL NOT NULL,
  unrealized_pnl REAL NOT NULL,
  unrealized_pnl_percent REAL NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES paper_accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, symbol)
);

CREATE TABLE IF NOT EXISTS paper_orders (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- buy | sell
  type TEXT NOT NULL DEFAULT 'limit', -- limit | market
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'filled', -- pending | filled | rejected | cancelled
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES paper_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paper_trades (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  commission REAL NOT NULL,
  tax REAL NOT NULL,
  slippage REAL NOT NULL,
  executed_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES paper_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES paper_accounts(id) ON DELETE CASCADE
);

-- 13. Usage & Quotas (Rules 15-18, 30-36)
CREATE TABLE IF NOT EXISTS usage_daily (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  ai_requests INTEGER NOT NULL DEFAULT 0,
  ai_input_tokens INTEGER NOT NULL DEFAULT 0,
  ai_output_tokens INTEGER NOT NULL DEFAULT 0,
  backtest_runs INTEGER NOT NULL DEFAULT 0,
  upload_bytes INTEGER NOT NULL DEFAULT 0,
  document_parses INTEGER NOT NULL DEFAULT 0,
  ml_runs INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS storage_objects (
  id TEXT PRIMARY KEY,
  object_key TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  category TEXT NOT NULL, -- market | uploads | datasets | documents | backtests | models | system
  size_bytes INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  is_permanent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS system_usage (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  total_storage_bytes INTEGER NOT NULL DEFAULT 0,
  storage_status TEXT NOT NULL DEFAULT 'NORMAL', -- NORMAL | WARNING | RESTRICTED | READ_ONLY
  total_ai_tokens_monthly INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0.0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details_json TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

-- Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_instruments_market ON instruments(market);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_wid ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_backtests_uid ON backtests(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_owner ON storage_objects(owner_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_category ON storage_objects(category);
CREATE INDEX IF NOT EXISTS idx_storage_objects_expires ON storage_objects(expires_at);
CREATE INDEX IF NOT EXISTS idx_usage_daily_uid_date ON usage_daily(user_id, date);
