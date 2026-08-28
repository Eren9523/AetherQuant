CREATE TABLE IF NOT EXISTS paper_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'CNY',
  initial_cash REAL NOT NULL DEFAULT 1000000.0,
  cash_balance REAL NOT NULL,
  frozen_cash REAL NOT NULL DEFAULT 0.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  client_order_id TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  order_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  limit_price REAL,
  status TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  filled_at TEXT,
  cancelled_at TEXT,
  reject_reason TEXT
);

CREATE TABLE IF NOT EXISTS paper_trades (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  notional REAL NOT NULL,
  commission REAL NOT NULL,
  tax REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper_positions (
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  available_quantity INTEGER NOT NULL,
  avg_cost REAL NOT NULL,
  realized_pnl REAL NOT NULL DEFAULT 0.0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (account_id, symbol)
);
