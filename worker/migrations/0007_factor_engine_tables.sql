DROP TABLE IF EXISTS factor_experiments;
DROP TABLE IF EXISTS factor_definitions;

CREATE TABLE IF NOT EXISTS factor_definitions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  formula TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS factor_runs (
  id TEXT PRIMARY KEY,
  factor_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  universe TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  forward_period INTEGER NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  result_r2_key TEXT,
  summary_json TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error_code TEXT,
  error_message TEXT,
  FOREIGN KEY (factor_id) REFERENCES factor_definitions(id) ON DELETE CASCADE
);
