DROP TABLE IF EXISTS strategy_versions;
DROP TABLE IF EXISTS strategy_definitions;

CREATE TABLE IF NOT EXISTS strategy_definitions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  market TEXT NOT NULL,
  universe TEXT NOT NULL,
  dsl_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_versions (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  dsl_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (strategy_id) REFERENCES strategy_definitions(id) ON DELETE CASCADE
);
