-- Dataset Infrastructure Migration
-- Dropping existing mock-friendly tables and creating real infrastructure tables

DROP TABLE IF EXISTS dataset_columns;
DROP TABLE IF EXISTS datasets;
DROP TABLE IF EXISTS dataset_jobs;

CREATE TABLE datasets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filename TEXT,
  storage_type TEXT NOT NULL,
  format TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  row_count INTEGER,
  column_count INTEGER,
  status TEXT,
  r2_key TEXT,
  schema_json TEXT,
  preview_r2_key TEXT,
  checksum TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  parsed_at TEXT,
  error_code TEXT,
  error_message TEXT
);

CREATE TABLE dataset_columns (
  dataset_id TEXT NOT NULL,
  column_name TEXT NOT NULL,
  normalized_name TEXT,
  data_type TEXT,
  nullable INTEGER,
  semantic_type TEXT,
  mapped_field TEXT,
  ordinal INTEGER,
  PRIMARY KEY(dataset_id, column_name),
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);

CREATE TABLE dataset_jobs (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  rows_processed INTEGER,
  error_code TEXT,
  error_message TEXT,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);
