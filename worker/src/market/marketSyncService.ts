import { MarketRepository } from './marketRepository';
import { InternalSnapshotData, KlineBar } from './marketTypes';

export interface EnvWithMarket {
  DB: D1Database;
  DATA_BUCKET?: R2Bucket;
  /** @deprecated Legacy alias; DATA_BUCKET is the Wrangler binding. */
  BUCKET?: R2Bucket;
  QUANT_SERVICE_URL?: string;
  QUANT_SERVICE_TOKEN?: string;
  MARKET_SYNC_TOKEN?: string;
  MARKET_SYNC_ENABLED?: string;
  MARKET_MIN_STOCK_COUNT?: string;
}

export class MarketSyncService {
  private repo: MarketRepository;

  constructor(private env: EnvWithMarket) {
    this.repo = new MarketRepository(env.DB);
  }

  /**
   * Evaluates if current time is within CN A-share regular trading & EOD snapshot window
   * Monday - Friday: 09:20 - 11:35 and 12:55 - 15:15 (Asia/Shanghai)
   */
  isWithinTradingHours(): { inWindow: boolean; isEod: boolean; nowShanghaiStr: string } {
    // Current UTC time formatted in Asia/Shanghai
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

    const weekday = getPart('weekday'); // Mon, Tue, Wed, Thu, Fri, Sat, Sun
    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);
    const totalMinutes = hour * 60 + minute;

    const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
    if (!isWeekday) {
      return { inWindow: false, isEod: false, nowShanghaiStr: `${weekday} ${hour}:${minute}` };
    }

    // 09:20 = 560 mins, 11:35 = 695 mins
    const morningSession = totalMinutes >= 560 && totalMinutes <= 695;
    // 12:55 = 775 mins, 15:15 = 915 mins
    const afternoonSession = totalMinutes >= 775 && totalMinutes <= 915;

    const inWindow = morningSession || afternoonSession;
    // EOD is defined as the final snapshot after market close (15:00 - 15:15)
    const isEod = totalMinutes >= 900 && totalMinutes <= 915;

    return { inWindow, isEod, nowShanghaiStr: `${weekday} ${hour}:${minute}` };
  }

  /**
   * Executes complete Snapshot Pipeline:
   * Fetch from Quant -> Validate -> Building Snapshot -> Batch Write D1 -> Switch Pointer -> EOD R2 Archive -> Prune Old
   */
  async runSync(triggerSource: 'cron' | 'manual_api' | 'startup' = 'cron'): Promise<{ success: boolean; snapshotId?: string; error?: string }> {
    const isSyncEnabled = this.env.MARKET_SYNC_ENABLED !== 'false';
    if (!isSyncEnabled && triggerSource === 'cron') {
      return { success: false, error: 'MARKET_SYNC_DISABLED' };
    }

    const { inWindow, isEod } = this.isWithinTradingHours();
    if (!inWindow && triggerSource === 'cron') {
      // Outside trading hours, do not perform unrequested scrapes
      return { success: false, error: 'OUTSIDE_TRADING_HOURS' };
    }

    const lockName = 'market_cn_snapshot';
    const ownerId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const acquired = await this.repo.acquireSyncLock(lockName, ownerId, 180);
    if (!acquired) {
      return { success: false, error: 'SYNC_ALREADY_RUNNING' };
    }

    const jobId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    await this.repo.recordSyncJob({
      id: jobId,
      job_type: triggerSource === 'manual_api' ? 'manual' : 'scheduled',
      market: 'CN',
      status: 'running',
      started_at: startedAt,
      trigger_source: triggerSource
    });

    try {
      const quantUrl = this.env.QUANT_SERVICE_URL;
      const quantToken = this.env.QUANT_SERVICE_TOKEN;

      if (!quantUrl) {
        throw new Error('QUANT_SERVICE_NOT_CONFIGURED: QUANT_SERVICE_URL is missing in Worker bindings');
      }

      // Fetch internal full market snapshot from Quant Service
      const targetEndpoint = `${quantUrl.replace(/\/$/, '')}/v1/internal/market/cn/snapshot`;
      const resp = await fetch(targetEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${quantToken || ''}`,
          'Accept': 'application/json'
        },
        // Tencent's full-market AKShare endpoint is paginated and a verified
        // 5,500-stock fetch can exceed 50 seconds before Render cold start.
        signal: AbortSignal.timeout(180000)
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Quant service HTTP ${resp.status}: ${errText.substring(0, 150)}`);
      }

      const json = await resp.json() as { success: boolean; data: InternalSnapshotData; error?: any };
      if (!json.success || !json.data) {
        throw new Error(`Quant snapshot failed: ${json.error?.message || 'Empty data payload'}`);
      }

      const snapshotData = json.data;
      const stocks = snapshotData.stocks || [];
      const indices = snapshotData.indices || [];
      const overview = snapshotData.overview || ({} as InternalSnapshotData['overview']);
      const minStockCount = parseInt(this.env.MARKET_MIN_STOCK_COUNT || '4000', 10);

      if (stocks.length < minStockCount) {
        throw new Error(`SNAPSHOT_INCOMPLETE: Received ${stocks.length} stocks, required >= ${minStockCount}`);
      }

      // Generate unique Snapshot ID
      const dateStr = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
      const snapshotId = `cn_${dateStr}_${Math.random().toString(36).substring(2, 6)}`;
      const nowIso = new Date().toISOString();

      // 1. Create Building Snapshot
      await this.repo.createSnapshot({
        id: snapshotId,
        market: 'CN',
        status: 'building',
        provider: snapshotData.provider || 'eastmoney',
        source: snapshotData.source || 'akshare',
        as_of: snapshotData.as_of || nowIso,
        stock_count: stocks.length,
        up_count: overview.up_count || 0,
        down_count: overview.down_count || 0,
        flat_count: overview.flat_count || 0,
        limit_up_count: overview.limit_up_count || 0,
        limit_down_count: overview.limit_down_count || 0,
        total_turnover: overview.total_turnover || null,
        avg_change_pct: overview.avg_change_pct || null,
        quality_warnings_count: snapshotData.quality?.warnings_count || 0,
        is_eod: isEod ? 1 : 0,
        created_at: nowIso
      });

      // 2. Batch insert quotes
      const rowsWritten = await this.repo.batchInsertQuotes(snapshotId, stocks);

      // 3. Batch insert indices
      await this.repo.batchInsertIndices(snapshotId, indices);

      // 4. Do not rewrite the entire instruments table on every snapshot.
      // Quotes already carry symbol/name/exchange; a separate low-frequency
      // metadata job can enrich industry and listing date without exhausting
      // the D1 free-tier write allowance.

      // 5. Atomic pointer switch: previous -> active, building -> active
      const currentPointer = await this.repo.getPointer('CN');
      const prevActiveId = currentPointer?.active_snapshot_id || null;

      if (prevActiveId) {
        await this.repo.updateSnapshotStatus(prevActiveId, 'previous');
      }
      await this.repo.updateSnapshotStatus(snapshotId, 'active', nowIso);
      await this.repo.setPointer('CN', snapshotId, prevActiveId);

      // 6. Prune old quotes beyond active and previous
      const keepIds = [snapshotId];
      if (prevActiveId) keepIds.push(prevActiveId);
      await this.repo.pruneOldQuotes(keepIds);

      // 7. R2 EOD Archive (if closing snapshot)
      let archiveSuccess = 0;
      const dataBucket = this.env.DATA_BUCKET || this.env.BUCKET;
      if (isEod && dataBucket) {
        try {
          const yyyy = nowIso.substring(0, 4);
          const mm = nowIso.substring(5, 7);
          const yyyymmdd = nowIso.substring(0, 10);
          const r2Key = `market/cn/eod/${yyyy}/${mm}/${yyyymmdd}.json`;
          const archivePayload = JSON.stringify({
            metadata: {
              snapshot_id: snapshotId,
              as_of: snapshotData.as_of,
              provider: snapshotData.provider,
              source: snapshotData.source,
              stock_count: stocks.length
            },
            indices,
            overview,
            stocks
          });
          await dataBucket.put(r2Key, archivePayload, {
            httpMetadata: { contentType: 'application/json' }
          });
          archiveSuccess = 1;
        } catch (r2Err) {
          console.error('R2 EOD Archive error:', r2Err);
          archiveSuccess = 0;
        }
      }

      // 8. Update sync job record as success
      await this.repo.updateSyncJob(jobId, {
        status: 'success',
        finished_at: new Date().toISOString(),
        snapshot_id: snapshotId,
        rows_received: stocks.length,
        rows_written: rowsWritten,
        quality_warnings_count: snapshotData.quality?.warnings_count || 0,
        snapshot_success: 1,
        archive_success: archiveSuccess
      });

      return { success: true, snapshotId };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('Market Sync Job failed:', errMsg);

      await this.repo.updateSyncJob(jobId, {
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_code: 'SYNC_ERROR',
        error_message: errMsg,
        snapshot_success: 0
      });

      return { success: false, error: errMsg };
    } finally {
      await this.repo.releaseSyncLock(lockName, ownerId);
    }
  }
}
