export interface MarketSnapshotRecord {
  id: string;
  market: string;
  status: 'building' | 'active' | 'previous' | 'failed' | 'archived';
  provider: string | null;
  source: string | null;
  as_of: string | null;
  stock_count: number;
  up_count: number;
  down_count: number;
  flat_count: number;
  limit_up_count: number;
  limit_down_count: number;
  total_turnover: number | null;
  avg_change_pct: number | null;
  quality_warnings_count: number;
  is_eod: number;
  created_at: string;
  activated_at: string | null;
  error_code: string | null;
  error_message: string | null;
}

export interface MarketSnapshotPointerRecord {
  market: string;
  active_snapshot_id: string | null;
  previous_snapshot_id: string | null;
  updated_at: string;
}

export interface StockQuoteSnapshotRecord {
  snapshot_id: string;
  symbol: string;
  name: string;
  market: string;
  exchange: string | null;
  last: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  turnover_rate: number | null;
  amplitude: number | null;
  pe_dynamic: number | null;
  pb: number | null;
  total_market_cap: number | null;
  float_market_cap: number | null;
  provider: string | null;
  source: string | null;
  as_of: string | null;
}

export interface IndexSnapshotRecord {
  snapshot_id: string;
  symbol: string;
  name: string;
  last: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  provider: string | null;
  source: string | null;
  as_of: string | null;
}

export interface MarketSyncJobRecord {
  id: string;
  job_type: 'scheduled' | 'manual';
  market: string;
  status: 'running' | 'success' | 'failed';
  provider: string | null;
  started_at: string;
  finished_at: string | null;
  snapshot_id: string | null;
  rows_received: number;
  rows_written: number;
  quality_warnings_count: number;
  error_code: string | null;
  error_message: string | null;
  trigger_source: string;
  snapshot_success: number;
  archive_success: number;
}

export interface MarketKlineManifestRecord {
  symbol: string;
  interval: string;
  adjust: string;
  r2_key: string;
  bars_count: number;
  start_time: string | null;
  end_time: string | null;
  provider: string | null;
  source: string | null;
  as_of: string | null;
  stale: number;
  updated_at: string;
}

export interface InternalSnapshotData {
  provider: string;
  source: string;
  as_of: string;
  stocks: Array<{
    symbol: string;
    name: string;
    market: string;
    exchange?: string;
    last: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    prev_close: number | null;
    change: number | null;
    change_pct: number | null;
    volume: number | null;
    turnover: number | null;
    turnover_rate: number | null;
    amplitude: number | null;
    pe_dynamic: number | null;
    pb: number | null;
    total_market_cap: number | null;
    float_market_cap: number | null;
    provider?: string;
    source?: string;
    as_of?: string;
  }>;
  indices: Array<{
    symbol: string;
    name: string;
    market?: string;
    last: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    prev_close: number | null;
    change: number | null;
    change_pct: number | null;
    volume: number | null;
    turnover: number | null;
    provider?: string;
    source?: string;
    as_of?: string;
  }>;
  overview: {
    up_count: number;
    down_count: number;
    flat_count: number;
    limit_up_count: number;
    limit_down_count: number;
    total_turnover: number;
    avg_change_pct: number;
    total_count: number;
    as_of: string;
    source?: string;
    provider?: string;
  };
  quality?: {
    warnings_count: number;
    total_stocks_count: number;
  };
}

export interface KlineBar {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
}
