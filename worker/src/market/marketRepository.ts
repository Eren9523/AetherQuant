import { 
  MarketSnapshotRecord, 
  MarketSnapshotPointerRecord, 
  StockQuoteSnapshotRecord, 
  IndexSnapshotRecord,
  MarketSyncJobRecord,
  MarketKlineManifestRecord 
} from './marketTypes';

export class MarketRepository {
  private static schemaInitialized = false;

  constructor(private db: D1Database) {}

  async ensureSchema(): Promise<void> {
    if (MarketRepository.schemaInitialized) return;
    try {
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS market_snapshots (
          id TEXT PRIMARY KEY,
          market TEXT NOT NULL,
          status TEXT NOT NULL,
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

        CREATE TABLE IF NOT EXISTS market_snapshot_pointer (
          market TEXT PRIMARY KEY,
          active_snapshot_id TEXT,
          previous_snapshot_id TEXT,
          updated_at TEXT NOT NULL
        );

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

        CREATE TABLE IF NOT EXISTS market_sync_jobs (
          id TEXT PRIMARY KEY,
          job_type TEXT,
          market TEXT,
          status TEXT,
          provider TEXT,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          snapshot_id TEXT,
          rows_received INTEGER DEFAULT 0,
          rows_written INTEGER DEFAULT 0,
          quality_warnings_count INTEGER DEFAULT 0,
          error_code TEXT,
          error_message TEXT,
          trigger_source TEXT,
          snapshot_success INTEGER DEFAULT 0,
          archive_success INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_msj_status_started ON market_sync_jobs(status, started_at);

        CREATE TABLE IF NOT EXISTS market_sync_lock (
          lock_name TEXT PRIMARY KEY,
          owner_id TEXT,
          locked_until TEXT,
          updated_at TEXT
        );
      `);
      MarketRepository.schemaInitialized = true;
    } catch (e: any) {
      console.warn('[MarketRepository] ensureSchema note:', e?.message || e);
    }
  }

  async getPointer(market: string = 'CN'): Promise<MarketSnapshotPointerRecord | null> {
    try {
      const result = await this.db
        .prepare('SELECT * FROM market_snapshot_pointer WHERE market = ?')
        .bind(market)
        .first<MarketSnapshotPointerRecord>();
      return result || null;
    } catch (err: any) {
      if (err.message?.includes('no such table')) {
        await this.ensureSchema();
        const result = await this.db
          .prepare('SELECT * FROM market_snapshot_pointer WHERE market = ?')
          .bind(market)
          .first<MarketSnapshotPointerRecord>();
        return result || null;
      }
      throw err;
    }
  }

  async setPointer(market: string, activeId: string, previousId: string | null): Promise<void> {
    await this.ensureSchema();
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO market_snapshot_pointer (market, active_snapshot_id, previous_snapshot_id, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(market) DO UPDATE SET
          active_snapshot_id = excluded.active_snapshot_id,
          previous_snapshot_id = excluded.previous_snapshot_id,
          updated_at = excluded.updated_at
      `)
      .bind(market, activeId, previousId, now)
      .run();
  }

  async createSnapshot(snapshot: Partial<MarketSnapshotRecord>): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO market_snapshots (
          id, market, status, provider, source, as_of,
          stock_count, up_count, down_count, flat_count,
          limit_up_count, limit_down_count, total_turnover, avg_change_pct,
          quality_warnings_count, is_eod, created_at, activated_at, error_code, error_message
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `)
      .bind(
        snapshot.id,
        snapshot.market || 'CN',
        snapshot.status || 'building',
        snapshot.provider || null,
        snapshot.source || 'akshare',
        snapshot.as_of || null,
        snapshot.stock_count || 0,
        snapshot.up_count || 0,
        snapshot.down_count || 0,
        snapshot.flat_count || 0,
        snapshot.limit_up_count || 0,
        snapshot.limit_down_count || 0,
        snapshot.total_turnover || null,
        snapshot.avg_change_pct || null,
        snapshot.quality_warnings_count || 0,
        snapshot.is_eod || 0,
        snapshot.created_at || new Date().toISOString(),
        snapshot.activated_at || null,
        snapshot.error_code || null,
        snapshot.error_message || null
      )
      .run();
  }

  async updateSnapshotStatus(id: string, status: string, activatedAt: string | null = null, errorCode: string | null = null, errorMsg: string | null = null): Promise<void> {
    await this.db
      .prepare(`
        UPDATE market_snapshots
        SET status = ?, activated_at = COALESCE(?, activated_at), error_code = ?, error_message = ?
        WHERE id = ?
      `)
      .bind(status, activatedAt, errorCode, errorMsg, id)
      .run();
  }

  async getSnapshot(id: string): Promise<MarketSnapshotRecord | null> {
    const result = await this.db
      .prepare('SELECT * FROM market_snapshots WHERE id = ?')
      .bind(id)
      .first<MarketSnapshotRecord>();
    return result || null;
  }

  async getActiveSnapshot(market: string = 'CN'): Promise<MarketSnapshotRecord | null> {
    const pointer = await this.getPointer(market);
    if (!pointer || !pointer.active_snapshot_id) return null;
    return this.getSnapshot(pointer.active_snapshot_id);
  }

  async batchInsertQuotes(snapshotId: string, quotes: Partial<StockQuoteSnapshotRecord>[]): Promise<number> {
    if (!quotes || quotes.length === 0) return 0;

    const BATCH_SIZE = 100;
    let written = 0;

    for (let i = 0; i < quotes.length; i += BATCH_SIZE) {
      const chunk = quotes.slice(i, i + BATCH_SIZE);
      const stmts = chunk.map(q => {
        return this.db.prepare(`
          INSERT INTO market_quotes_snapshot (
            snapshot_id, symbol, name, market, exchange,
            last, open, high, low, prev_close,
            change, change_pct, volume, turnover, turnover_rate,
            amplitude, pe_dynamic, pb, total_market_cap, float_market_cap,
            provider, source, as_of
          ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?
          )
        `).bind(
          snapshotId,
          q.symbol,
          q.name,
          q.market || 'CN',
          q.exchange || null,
          q.last ?? null,
          q.open ?? null,
          q.high ?? null,
          q.low ?? null,
          q.prev_close ?? null,
          q.change ?? null,
          q.change_pct ?? null,
          q.volume ?? null,
          q.turnover ?? null,
          q.turnover_rate ?? null,
          q.amplitude ?? null,
          q.pe_dynamic ?? null,
          q.pb ?? null,
          q.total_market_cap ?? null,
          q.float_market_cap ?? null,
          q.provider || null,
          q.source || 'akshare',
          q.as_of || null
        );
      });

      await this.db.batch(stmts);
      written += chunk.length;
    }

    return written;
  }

  async batchInsertIndices(snapshotId: string, indices: Partial<IndexSnapshotRecord>[]): Promise<void> {
    if (!indices || indices.length === 0) return;

    const stmts = indices.map(idx => {
      return this.db.prepare(`
        INSERT INTO market_indices_snapshot (
          snapshot_id, symbol, name,
          last, open, high, low, prev_close,
          change, change_pct, volume, turnover,
          provider, source, as_of
        ) VALUES (
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?
        )
      `).bind(
        snapshotId,
        idx.symbol,
        idx.name,
        idx.last ?? null,
        idx.open ?? null,
        idx.high ?? null,
        idx.low ?? null,
        idx.prev_close ?? null,
        idx.change ?? null,
        idx.change_pct ?? null,
        idx.volume ?? null,
        idx.turnover ?? null,
        idx.provider || null,
        idx.source || 'akshare',
        idx.as_of || null
      );
    });

    await this.db.batch(stmts);
  }

  async upsertInstrumentsFromQuotes(quotes: Partial<StockQuoteSnapshotRecord>[]): Promise<void> {
    if (!quotes || quotes.length === 0) return;
    const now = new Date().toISOString();
    const BATCH_SIZE = 100;

    for (let i = 0; i < quotes.length; i += BATCH_SIZE) {
      const chunk = quotes.slice(i, i + BATCH_SIZE);
      const stmts = chunk.map(q => {
        return this.db.prepare(`
          INSERT INTO instruments (symbol, name, market, exchange, provider, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(symbol) DO UPDATE SET
            name = excluded.name,
            exchange = excluded.exchange,
            provider = excluded.provider,
            updated_at = excluded.updated_at
        `).bind(
          q.symbol,
          q.name,
          q.market || 'CN',
          q.exchange || 'SH',
          q.provider || 'eastmoney',
          now,
          now
        );
      });
      await this.db.batch(stmts);
    }
  }

  async pruneOldQuotes(keepSnapshotIds: string[]): Promise<void> {
    if (keepSnapshotIds.length === 0) return;
    const placeholders = keepSnapshotIds.map(() => '?').join(',');
    await this.db
      .prepare(`DELETE FROM market_quotes_snapshot WHERE snapshot_id NOT IN (${placeholders})`)
      .bind(...keepSnapshotIds)
      .run();

    await this.db
      .prepare(`DELETE FROM market_indices_snapshot WHERE snapshot_id NOT IN (${placeholders})`)
      .bind(...keepSnapshotIds)
      .run();
  }

  async acquireSyncLock(lockName: string, ownerId: string, leaseSeconds: number = 180): Promise<boolean> {
    const nowIso = new Date().toISOString();
    const lockUntilIso = new Date(Date.now() + leaseSeconds * 1000).toISOString();

    const existing = await this.db
      .prepare('SELECT * FROM market_sync_lock WHERE lock_name = ?')
      .bind(lockName)
      .first<{ lock_name: string; owner_id: string; locked_until: string }>();

    if (!existing) {
      try {
        await this.db
          .prepare('INSERT INTO market_sync_lock (lock_name, owner_id, locked_until, updated_at) VALUES (?, ?, ?, ?)')
          .bind(lockName, ownerId, lockUntilIso, nowIso)
          .run();
        return true;
      } catch {
        return false;
      }
    }

    if (existing.locked_until && new Date(existing.locked_until).getTime() > Date.now()) {
      return false; // Still locked
    }

    // Lock expired or free, acquire
    await this.db
      .prepare('UPDATE market_sync_lock SET owner_id = ?, locked_until = ?, updated_at = ? WHERE lock_name = ?')
      .bind(ownerId, lockUntilIso, nowIso, lockName)
      .run();
    return true;
  }

  async releaseSyncLock(lockName: string, ownerId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM market_sync_lock WHERE lock_name = ? AND owner_id = ?')
      .bind(lockName, ownerId)
      .run();
  }

  async recordSyncJob(job: Partial<MarketSyncJobRecord>): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO market_sync_jobs (
          id, job_type, market, status, provider, started_at, finished_at,
          snapshot_id, rows_received, rows_written, quality_warnings_count,
          error_code, error_message, trigger_source, snapshot_success, archive_success
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        job.id,
        job.job_type || 'scheduled',
        job.market || 'CN',
        job.status || 'running',
        job.provider || null,
        job.started_at || new Date().toISOString(),
        job.finished_at || null,
        job.snapshot_id || null,
        job.rows_received || 0,
        job.rows_written || 0,
        job.quality_warnings_count || 0,
        job.error_code || null,
        job.error_message || null,
        job.trigger_source || 'cron',
        job.snapshot_success || 0,
        job.archive_success || 0
      )
      .run();
  }

  async updateSyncJob(id: string, updates: Partial<MarketSyncJobRecord>): Promise<void> {
    await this.db
      .prepare(`
        UPDATE market_sync_jobs
        SET
          status = COALESCE(?, status),
          finished_at = COALESCE(?, finished_at),
          snapshot_id = COALESCE(?, snapshot_id),
          rows_received = COALESCE(?, rows_received),
          rows_written = COALESCE(?, rows_written),
          quality_warnings_count = COALESCE(?, quality_warnings_count),
          error_code = COALESCE(?, error_code),
          error_message = COALESCE(?, error_message),
          snapshot_success = COALESCE(?, snapshot_success),
          archive_success = COALESCE(?, archive_success)
        WHERE id = ?
      `)
      .bind(
        updates.status ?? null,
        updates.finished_at ?? null,
        updates.snapshot_id ?? null,
        updates.rows_received ?? null,
        updates.rows_written ?? null,
        updates.quality_warnings_count ?? null,
        updates.error_code ?? null,
        updates.error_message ?? null,
        updates.snapshot_success ?? null,
        updates.archive_success ?? null,
        id
      )
      .run();
  }

  async getLastSyncJob(market: string = 'CN'): Promise<MarketSyncJobRecord | null> {
    const res = await this.db
      .prepare('SELECT * FROM market_sync_jobs WHERE market = ? ORDER BY started_at DESC LIMIT 1')
      .bind(market)
      .first<MarketSyncJobRecord>();
    return res || null;
  }
}
