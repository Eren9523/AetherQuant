-- Migration 0004: reduce write amplification in the market pipeline.
-- These two indexes duplicate the left-most columns of the composite primary
-- key and only increase D1 free-tier write usage.
DROP INDEX IF EXISTS idx_mqs_snapshot_id;
DROP INDEX IF EXISTS idx_mqs_snapshot_symbol;
