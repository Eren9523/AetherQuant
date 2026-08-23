-- Migration: 0001_infrastructure.sql
-- Minimal system infrastructure table for Penguin Quant D1 verification

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO system_settings (key, value)
VALUES ('system_name', 'Penguin Quant');
