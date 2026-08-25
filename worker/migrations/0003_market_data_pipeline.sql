-- Migration 0003: Market Data Pipeline V2
-- Establishes snapshot storage, pointers, indices, manifests, and sync coordination

-- 1. Market Snapshots Metadata Table
CREATE TABLE IF NOT EXISTS market_snapshots (
  id TEXT PRIMARY KEY,
  market TEXT NOT NULL,
  status TEXT NOT NULL, -- building | active | previous | failed | archived
  provider TEXT,
  source TEXT,
  as_of TEXT,
  stock_count INTEGER DEFAULT 0,
  up_count INTEGER DEFAULT 0,
  down_count INTEGER DEFAULT 0,
  flat_count INTEGER DEFAULT 0,
  limit_up_count INTEGER DEFAULT 0,
  limit_down_count INTEGER DEFAULT 0,
  total_turnover REAL,
  avg_change_pct REAL,
  quality_warnings_count INTEGER DEFAULT 0,
  is_eod INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  error_code TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_market_status ON market_snapshots(market, status, created_at);

-- 2. Market Snapshot Pointer (Single-point atomic pointer for current active snapshot)
CREATE TABLE IF NOT EXISTS market_snapshot_pointer (
  market TEXT PRIMARY KEY,
  active_snapshot_id TEXT,
  previous_snapshot_id TEXT,
  updated_at TEXT NOT NULL
);

-- 3. Market Quotes Snapshot (Full market stock rows scoped by snapshot_id)
CREATE TABLE IF NOT EXISTS market_quotes_snapshot (
  snapshot_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  exchange TEXT,
  last REAL,
  open REAL,
  high REAL,
  low REAL,
  prev_close REAL,
  change REAL,
  change_pct REAL,
  volume REAL,
  turnover REAL,
  turnover_rate REAL,
  amplitude REAL,
  pe_dynamic REAL,
  pb REAL,
  total_market_cap REAL,
  float_market_cap REAL,
  provider TEXT,
  source TEXT,
  as_of TEXT,
  PRIMARY KEY(snapshot_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_mqs_snapshot_id ON market_quotes_snapshot(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_mqs_snapshot_symbol ON market_quotes_snapshot(snapshot_id, symbol);
CREATE INDEX IF NOT EXISTS idx_mqs_snapshot_exchange ON market_quotes_snapshot(snapshot_id, exchange);
CREATE INDEX IF NOT EXISTS idx_mqs_snapshot_change_pct ON market_quotes_snapshot(snapshot_id, change_pct);
CREATE INDEX IF NOT EXISTS idx_mqs_snapshot_turnover ON market_quotes_snapshot(snapshot_id, turnover);
CREATE INDEX IF NOT EXISTS idx_mqs_snapshot_total_market_cap ON market_quotes_snapshot(snapshot_id, total_market_cap);

-- 4. Market Indices Snapshot
CREATE TABLE IF NOT EXISTS market_indices_snapshot (
  snapshot_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  last REAL,
  open REAL,
  high REAL,
  low REAL,
  prev_close REAL,
  change REAL,
  change_pct REAL,
  volume REAL,
  turnover REAL,
  provider TEXT,
  source TEXT,
  as_of TEXT,
  PRIMARY KEY(snapshot_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_mis_snapshot_id ON market_indices_snapshot(snapshot_id);

-- 5. Instruments (Ensure table exists and is indexed)
CREATE TABLE IF NOT EXISTS instruments (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market TEXT NOT NULL,
  exchange TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  asset_type TEXT NOT NULL DEFAULT 'stock',
  sector TEXT,
  industry TEXT,
  listing_date TEXT,
  provider TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instruments_market_exchange ON instruments(market, exchange);

-- 6. Market K-Line Manifest (Metadata for R2-cached candlestick series)
CREATE TABLE IF NOT EXISTS market_kline_manifest (
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  adjust TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  bars_count INTEGER DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  provider TEXT,
  source TEXT,
  as_of TEXT,
  stale INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(symbol, interval, adjust)
);

CREATE INDEX IF NOT EXISTS idx_mkm_symbol ON market_kline_manifest(symbol);

-- 7. Market Sync Jobs (Audit and observability of scheduled & manual sync runs)
CREATE TABLE IF NOT EXISTS market_sync_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT, -- scheduled | manual
  market TEXT,
  status TEXT, -- running | success | failed
  provider TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  snapshot_id TEXT,
  rows_received INTEGER DEFAULT 0,
  rows_written INTEGER DEFAULT 0,
  quality_warnings_count INTEGER DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  trigger_source TEXT, -- cron | manual_api | startup
  snapshot_success INTEGER DEFAULT 0,
  archive_success INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_msj_status_started ON market_sync_jobs(status, started_at);

-- 8. Market Sync Lock (Distributed lease lock to prevent overlapping sync tasks)
CREATE TABLE IF NOT EXISTS market_sync_lock (
  lock_name TEXT PRIMARY KEY,
  owner_id TEXT,
  locked_until TEXT,
  updated_at TEXT
);
