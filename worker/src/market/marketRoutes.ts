import { Hono } from 'hono';
import { EnvWithMarket, MarketSyncService } from './marketSyncService';
import { MarketRepository } from './marketRepository';
import { MarketKlineStore } from './marketKlineStore';

export function createMarketRouter() {
  const router = new Hono<{ Bindings: EnvWithMarket }>();

  // Allowed sort whitelist
  const SORT_FIELDS_MAP: Record<string, string> = {
    change_pct: 'change_pct',
    turnover: 'turnover',
    volume: 'volume',
    turnover_rate: 'turnover_rate',
    last: 'last',
    total_market_cap: 'total_market_cap',
    float_market_cap: 'float_market_cap',
    pe_dynamic: 'pe_dynamic',
    pb: 'pb',
    symbol: 'symbol',
    name: 'name'
  };

  function scheduleStartupSync(c: any): void {
    const task = new MarketSyncService(c.env).runSync('startup').then(result => {
      if (!result.success && result.error !== 'SYNC_ALREADY_RUNNING') {
        console.error('[Market Startup Sync] failed:', result.error);
      }
    });
    try {
      c.executionCtx.waitUntil(task);
    } catch {
      // The Node convenience server has no real ExecutionContext. Its process
      // remains alive, so the referenced promise can complete normally.
      task.catch(() => {});
    }
  }

  /**
   * Helper: Determine if a snapshot is stale based on trading hours
   */
  function isSnapshotStale(asOf: string | null): boolean {
    if (!asOf) return true;
    const snapshotTime = new Date(asOf).getTime();
    if (isNaN(snapshotTime)) return true;

    // Check if within trading hours
    const syncService = new MarketSyncService({} as any);
    const { inWindow } = syncService.isWithinTradingHours();

    const diffMinutes = (Date.now() - snapshotTime) / (60 * 1000);
    // In trading hours, stale if older than 10 mins; outside trading hours, valid if within 24h
    if (inWindow) {
      return diffMinutes > 10;
    }
    return diffMinutes > 24 * 60;
  }

  /**
   * GET /api/v1/market/health
   * Reads pipeline health from D1 without pinging AKShare
   */
  router.get('/health', async (c) => {
    const repo = new MarketRepository(c.env.DB);
    const active = await repo.getActiveSnapshot('CN');
    const lastJob = await repo.getLastSyncJob('CN');

    if (!active) {
      return c.json({
        success: true,
        data: {
          status: 'empty',
          active_snapshot_id: null,
          active_snapshot_as_of: null,
          stock_count: 0,
          provider: null,
          source: 'akshare',
          stale: true,
          last_sync_status: lastJob?.status || null,
          last_sync_at: lastJob?.started_at || null,
          last_sync_error: lastJob?.error_message || null
        },
        request_id: crypto.randomUUID()
      });
    }

    const stale = isSnapshotStale(active.as_of);
    let status: 'healthy' | 'stale' | 'degraded' | 'empty' = 'healthy';
    if (stale) status = 'stale';
    if (lastJob && lastJob.status === 'failed') status = 'degraded';

    return c.json({
      success: true,
      data: {
        status,
        active_snapshot_id: active.id,
        active_snapshot_as_of: active.as_of,
        stock_count: active.stock_count,
        provider: active.provider,
        source: active.source || 'akshare',
        stale,
        last_sync_status: lastJob?.status || 'success',
        last_sync_at: lastJob?.started_at || active.activated_at,
        last_sync_error: lastJob?.error_message || null
      },
      request_id: crypto.randomUUID()
    });
  });

  /**
   * GET /api/v1/market/cn/spot
   * Pure D1 SQL Paginated Spot Quotes
   */
  router.get('/cn/spot', async (c) => {
    const repo = new MarketRepository(c.env.DB);
    const pointer = await repo.getPointer('CN');
    const activeId = pointer?.active_snapshot_id;

    if (!activeId) {
      scheduleStartupSync(c);

      return c.json({
        success: true,
        data: {
          snapshot_id: null,
          count: 0,
          total: 0,
          page: 1,
          page_size: 50,
          as_of: new Date().toISOString(),
          provider: 'akshare',
          source: 'akshare',
          stale: true,
          initializing: true,
          stocks: []
        },
        request_id: crypto.randomUUID()
      });
    }

    const snapshot = await repo.getSnapshot(activeId);
    if (!snapshot) {
      return c.json({
        success: true,
        data: {
          snapshot_id: null,
          count: 0,
          total: 0,
          page: 1,
          page_size: 50,
          as_of: new Date().toISOString(),
          provider: 'akshare',
          source: 'akshare',
          stale: true,
          initializing: true,
          stocks: []
        },
        request_id: crypto.randomUUID()
      });
    }

    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(c.req.query('page_size') || '50', 10)));
    const search = c.req.query('search')?.trim();
    const sortByParam = c.req.query('sort_by') || 'change_pct';
    const sortOrderParam = (c.req.query('sort_order') || 'desc').toLowerCase();
    const exchange = c.req.query('exchange')?.trim().toUpperCase();
    const symbolsParam = c.req.query('symbols')?.trim();

    const sortColumn = SORT_FIELDS_MAP[sortByParam] || 'change_pct';
    const sortDirection = sortOrderParam === 'asc' ? 'ASC' : 'DESC';

    // Build dynamic SQL query
    let whereClauses: string[] = ['snapshot_id = ?'];
    let params: any[] = [activeId];

    if (search) {
      whereClauses.push('(symbol LIKE ? OR name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (exchange && ['SH', 'SZ', 'BJ'].includes(exchange)) {
      whereClauses.push('exchange = ?');
      params.push(exchange);
    }

    if (symbolsParam) {
      const syms = symbolsParam.split(',').map(s => s.trim().padStart(6, '0')).filter(s => /^\d{6}$/.test(s));
      if (syms.length > 0) {
        const placeHolders = syms.map(() => '?').join(',');
        whereClauses.push(`symbol IN (${placeHolders})`);
        params.push(...syms);
      }
    }

    const whereSql = whereClauses.join(' AND ');

    // Avoid scanning the active snapshot for every unfiltered page request.
    const hasFilters = Boolean(search || exchange || symbolsParam);
    let total = snapshot.stock_count || 0;
    if (hasFilters) {
      const countSql = `SELECT COUNT(*) as total FROM market_quotes_snapshot WHERE ${whereSql}`;
      const countRes = await c.env.DB.prepare(countSql).bind(...params).first<{ total: number }>();
      total = countRes?.total || 0;
    }

    // 2. Data rows query. Keep ORDER BY index-friendly for the D1 free tier.
    const offset = (page - 1) * pageSize;
    const querySql = `
      SELECT
        symbol, name, market, exchange,
        last, open, high, low, prev_close,
        change, change_pct, volume, turnover, turnover_rate,
        amplitude, pe_dynamic, pb, total_market_cap, float_market_cap,
        provider, source, as_of
      FROM market_quotes_snapshot
      WHERE ${whereSql}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, pageSize, offset];
    const { results } = await c.env.DB.prepare(querySql).bind(...queryParams).all();

    const stale = isSnapshotStale(snapshot.as_of);

    return c.json({
      success: true,
      data: {
        snapshot_id: activeId,
        count: results?.length || 0,
        total,
        page,
        page_size: pageSize,
        as_of: snapshot.as_of,
        provider: snapshot.provider,
        source: snapshot.source || 'akshare',
        stale,
        stocks: results || []
      },
      request_id: crypto.randomUUID()
    });
  });

  /**
   * GET /api/v1/market/cn/overview
   * Reads aggregate metadata directly from active snapshot
   */
  router.get('/cn/overview', async (c) => {
    const repo = new MarketRepository(c.env.DB);
    const active = await repo.getActiveSnapshot('CN');

    if (!active) {
      scheduleStartupSync(c);

      return c.json({
        success: true,
        data: {
          up_count: 0,
          down_count: 0,
          flat_count: 0,
          limit_up_count: 0,
          limit_down_count: 0,
          total_turnover: 0,
          avg_change_pct: 0,
          stock_count: 0,
          as_of: new Date().toISOString(),
          provider: 'akshare',
          source: 'akshare',
          stale: true,
          initializing: true
        },
        request_id: crypto.randomUUID()
      });
    }

    const stale = isSnapshotStale(active.as_of);

    return c.json({
      success: true,
      data: {
        up_count: active.up_count,
        down_count: active.down_count,
        flat_count: active.flat_count,
        limit_up_count: active.limit_up_count,
        limit_down_count: active.limit_down_count,
        total_turnover: active.total_turnover,
        avg_change_pct: active.avg_change_pct,
        stock_count: active.stock_count,
        as_of: active.as_of,
        provider: active.provider,
        source: active.source || 'akshare',
        stale
      },
      request_id: crypto.randomUUID()
    });
  });

  /**
   * GET /api/v1/market/cn/indices
   * Reads major indices from active market_indices_snapshot
   */
  router.get('/cn/indices', async (c) => {
    const repo = new MarketRepository(c.env.DB);
    const pointer = await repo.getPointer('CN');
    const activeId = pointer?.active_snapshot_id;

    if (!activeId) {
      scheduleStartupSync(c);

      return c.json({
        success: true,
        data: {
          count: 0,
          as_of: new Date().toISOString(),
          provider: 'eastmoney',
          source: 'akshare',
          stale: true,
          indices: [],
          initializing: true
        },
        request_id: crypto.randomUUID()
      });
    }

    const snapshot = await repo.getSnapshot(activeId);
    const { results } = await c.env.DB
      .prepare(`
        SELECT symbol, name, last, open, high, low, prev_close, change, change_pct, volume, turnover, provider, source, as_of
        FROM market_indices_snapshot
        WHERE snapshot_id = ?
      `)
      .bind(activeId)
      .all();

    const stale = isSnapshotStale(snapshot?.as_of || null);

    return c.json({
      success: true,
      data: {
        count: results?.length || 0,
        as_of: snapshot?.as_of || new Date().toISOString(),
        provider: snapshot?.provider || 'eastmoney',
        source: snapshot?.source || 'akshare',
        stale,
        indices: results || []
      },
      request_id: crypto.randomUUID()
    });
  });

  /**
   * GET /api/v1/market/cn/stocks/:symbol
   * Stock detail with LEFT JOIN instruments for basic company profile
   */
  router.get('/cn/stocks/:symbol', async (c) => {
    const symbol = c.req.param('symbol').trim().padStart(6, '0');
    if (!/^\d{6}$/.test(symbol)) {
      return c.json({
        success: false,
        error: { code: 'INVALID_SYMBOL', message: '股票代码必须为 6 位数字' },
        request_id: crypto.randomUUID()
      }, 400);
    }

    const repo = new MarketRepository(c.env.DB);
    const pointer = await repo.getPointer('CN');
    const activeId = pointer?.active_snapshot_id;

    if (activeId) {
      const quoteSql = `
        SELECT
          q.symbol, q.name, q.market, q.exchange,
          q.last, q.open, q.high, q.low, q.prev_close,
          q.change, q.change_pct, q.volume, q.turnover, q.turnover_rate,
          q.amplitude, q.pe_dynamic, q.pb, q.total_market_cap, q.float_market_cap,
          q.provider, q.source, q.as_of,
          i.industry
        FROM market_quotes_snapshot q
        LEFT JOIN instruments i ON q.symbol = i.symbol
        WHERE q.snapshot_id = ? AND (q.symbol = ? OR q.symbol LIKE ?)
      `;

      const row = await c.env.DB.prepare(quoteSql).bind(activeId, symbol, `${symbol}.%`).first<any>();

      if (row) {
        const stale = isSnapshotStale(row.as_of);
        return c.json({
          success: true,
          data: {
            symbol: row.symbol,
            name: row.name,
            market: row.market,
            exchange: row.exchange,
            price: row.last,
            last: row.last,
            open: row.open,
            high: row.high,
            low: row.low,
            prev_close: row.prev_close,
            change: row.change,
            change_pct: row.change_pct,
            volume: row.volume,
            turnover: row.turnover,
            turnover_rate: row.turnover_rate,
            amplitude: row.amplitude,
            pe_dynamic: row.pe_dynamic,
            pb: row.pb,
            total_market_cap: row.total_market_cap,
            float_market_cap: row.float_market_cap,
            industry: row.industry || (row.exchange === 'SH' ? '沪市主板' : (row.exchange === 'SZ' ? '深市主板' : '北交所')),
            listing_date: null,
            as_of: row.as_of,
            provider: row.provider,
            source: row.source || 'akshare',
            stale,
            snapshot_id: activeId
          },
          request_id: crypto.randomUUID()
        });
      }
    }

    // Direct Quant Service Fallback if not found in active snapshot
    const quantUrl = c.env.QUANT_SERVICE_URL || 'http://127.0.0.1:8001';
    const quantToken = c.env.QUANT_SERVICE_TOKEN || 'local-dev-quant-token-2026';
    try {
      const resp = await fetch(`${quantUrl.replace(/\/$/, '')}/v1/market/cn/stocks/${symbol}`, {
        headers: {
          ...(quantToken ? { Authorization: `Bearer ${quantToken}` } : {}),
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });
      if (resp.ok) {
        const fallbackJson: any = await resp.json();
        return c.json({
          ...fallbackJson,
          request_id: crypto.randomUUID()
        });
      }
    } catch {}

    return c.json({
      success: false,
      error: { code: 'STOCK_NOT_FOUND', message: `未找到股票代码 [${symbol}]` },
      request_id: crypto.randomUUID()
    }, 404);
  });

  /**
   * GET /api/v1/market/cn/stocks/:symbol/chart
   * R2 K-Line Cache with Quant Fallback
   */
  router.get('/cn/stocks/:symbol/chart', async (c) => {
    const symbol = c.req.param('symbol').trim().padStart(6, '0');
    const interval = c.req.query('interval') || '1d';
    const adjust = c.req.query('adjust') || 'qfq';

    if (!/^\d{6}$/.test(symbol)) {
      return c.json({
        success: false,
        error: { code: 'INVALID_SYMBOL', message: '股票代码必须为 6 位数字' },
        request_id: crypto.randomUUID()
      }, 400);
    }

    const klineStore = new MarketKlineStore(c.env);
    try {
      const result = await klineStore.getKlineBars(symbol, interval, adjust);
      return c.json({
        success: true,
        data: {
          symbol,
          interval,
          adjust,
          count: result.bars.length,
          provider: result.provider,
          source: result.source,
          as_of: result.as_of,
          cached: result.cached,
          stale: result.stale,
          bars: result.bars
        },
        request_id: crypto.randomUUID()
      });
    } catch (err: any) {
      return c.json({
        success: false,
        error: {
          code: 'MARKET_KLINE_UNAVAILABLE',
          message: err?.message || '无法获取 K 线数据'
        },
        request_id: crypto.randomUUID()
      }, 502);
    }
  });

  /**
   * POST /api/v1/internal/market/sync
   * Manual Sync trigger for development, testing, and initial bootstrap.
   * Requires MARKET_SYNC_TOKEN Authorization header.
   */
  router.post('/internal/sync', async (c) => {
    const expectedToken = c.env.MARKET_SYNC_TOKEN;
    const authHeader = c.req.header('Authorization');

    if (!expectedToken || !expectedToken.trim()) {
      return c.json({
        success: false,
        error: { code: 'MARKET_SYNC_NOT_CONFIGURED', message: 'MARKET_SYNC_TOKEN 未在服务端配置' },
        request_id: crypto.randomUUID()
      }, 503);
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '必须提供 Bearer <MARKET_SYNC_TOKEN>' },
        request_id: crypto.randomUUID()
      }, 401);
    }

    const token = authHeader.substring(7).trim();
    if (token !== expectedToken.trim()) {
      return c.json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'MARKET_SYNC_TOKEN 鉴权校验失败' },
        request_id: crypto.randomUUID()
      }, 401);
    }

    const syncService = new MarketSyncService(c.env);
    const result = await syncService.runSync('manual_api');

    if (!result.success) {
      return c.json({
        success: false,
        error: { code: result.error || 'SYNC_FAILED', message: `快照同步失败: ${result.error}` },
        request_id: crypto.randomUUID()
      }, 500);
    }

    return c.json({
      success: true,
      data: {
        message: '市场快照同步已成功执行',
        snapshot_id: result.snapshotId
      },
      request_id: crypto.randomUUID()
    });
  });

  return router;
}
