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
    const requiredTables = [
      'market_snapshots',
      'market_snapshot_pointer',
      'market_quotes_snapshot',
      'market_indices_snapshot',
      'market_kline_manifest',
      'market_sync_jobs',
      'market_sync_lock'
    ];

    const placeholders = requiredTables.map(() => '?').join(', ');
    try {
      const result = await this.db
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`)
        .bind(...requiredTables)
        .all<{ name: string }>();
      const existing = new Set((result.results || []).map(row => row.name));
      const missing = requiredTables.filter(table => !existing.has(table));

      if (missing.length > 0) {
        throw new Error(`missing tables: ${missing.join(', ')}`);
      }

      MarketRepository.schemaInitialized = true;
    } catch (e: any) {
      throw new Error(
        `MARKET_SCHEMA_NOT_MIGRATED: ${e?.message || String(e)}. ` +
        'Run the checked-in D1 migrations before starting the application.'
      );
    }
  }

  async getPointer(market: string = 'CN'): Promise<MarketSnapshotPointerRecord | null> {
    await this.ensureSchema();
    const result = await this.db
      .prepare('SELECT * FROM market_snapshot_pointer WHERE market = ?')
      .bind(market)
      .first<MarketSnapshotPointerRecord>();
    return result || null;
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

    // One JSON1 INSERT writes many rows with one D1 binding call. This keeps a
    // 5,500-stock snapshot inside the Worker free-tier subrequest budget and
    // is substantially faster than executing thousands of INSERT statements.
    const BATCH_SIZE = 200;
    let written = 0;

    for (let i = 0; i < quotes.length; i += BATCH_SIZE) {
      const chunk = quotes.slice(i, i + BATCH_SIZE);
      const payload = JSON.stringify(chunk.map(q => ({
        symbol: q.symbol,
        name: q.name,
        market: q.market || 'CN',
        exchange: q.exchange || null,
        last: q.last ?? null,
        open: q.open ?? null,
        high: q.high ?? null,
        low: q.low ?? null,
        prev_close: q.prev_close ?? null,
        change: q.change ?? null,
        change_pct: q.change_pct ?? null,
        volume: q.volume ?? null,
        turnover: q.turnover ?? null,
        turnover_rate: q.turnover_rate ?? null,
        amplitude: q.amplitude ?? null,
        pe_dynamic: q.pe_dynamic ?? null,
        pb: q.pb ?? null,
        total_market_cap: q.total_market_cap ?? null,
        float_market_cap: q.float_market_cap ?? null,
        provider: q.provider || null,
        source: q.source || 'akshare',
        as_of: q.as_of || null
      })));

      await this.db.prepare(`
        INSERT INTO market_quotes_snapshot (
          snapshot_id, symbol, name, market, exchange,
          last, open, high, low, prev_close,
          change, change_pct, volume, turnover, turnover_rate,
          amplitude, pe_dynamic, pb, total_market_cap, float_market_cap,
          provider, source, as_of
        )
        SELECT
          ?,
          json_extract(value, '$.symbol'),
          json_extract(value, '$.name'),
          json_extract(value, '$.market'),
          json_extract(value, '$.exchange'),
          json_extract(value, '$.last'),
          json_extract(value, '$.open'),
          json_extract(value, '$.high'),
          json_extract(value, '$.low'),
          json_extract(value, '$.prev_close'),
          json_extract(value, '$.change'),
          json_extract(value, '$.change_pct'),
          json_extract(value, '$.volume'),
          json_extract(value, '$.turnover'),
          json_extract(value, '$.turnover_rate'),
          json_extract(value, '$.amplitude'),
          json_extract(value, '$.pe_dynamic'),
          json_extract(value, '$.pb'),
          json_extract(value, '$.total_market_cap'),
          json_extract(value, '$.float_market_cap'),
          json_extract(value, '$.provider'),
          json_extract(value, '$.source'),
          json_extract(value, '$.as_of')
        FROM json_each(?)
      `).bind(snapshotId, payload).run();
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
          INSERT INTO instruments (symbol, name, market, exchange, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?)
          ON CONFLICT(symbol) DO UPDATE SET
            name = excluded.name,
            exchange = excluded.exchange,
            updated_at = excluded.updated_at
        `).bind(
          q.symbol,
          q.name,
          q.market || 'CN',
          q.exchange || 'SH',
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
