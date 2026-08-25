import { EnvWithMarket } from './marketSyncService';
import { MarketKlineManifestRecord, KlineBar } from './marketTypes';

export class MarketKlineStore {
  constructor(private env: EnvWithMarket) {}

  /**
   * Retrieves K-line series with Lazy R2 Cache & Quant fallback.
   */
  async getKlineBars(
    symbol: string,
    interval: string = '1d',
    adjust: string = 'qfq'
  ): Promise<{
    bars: KlineBar[];
    cached: boolean;
    stale: boolean;
    provider: string;
    source: string;
    as_of: string;
  }> {
    const cleanInterval = interval.trim();
    const cleanAdjust = adjust.trim().toLowerCase();
    const cleanSymbol = symbol.trim().padStart(6, '0');
    const r2Key = `market/cn/kline/${cleanSymbol}/${cleanInterval}/${cleanAdjust}.json`;

    const now = Date.now();
    const ttlMs = this.getTtlMs(cleanInterval);
    const dataBucket = this.env.DATA_BUCKET || this.env.BUCKET;

    // 1. Check Manifest in D1
    const manifest = await this.env.DB
      .prepare('SELECT * FROM market_kline_manifest WHERE symbol = ? AND interval = ? AND adjust = ?')
      .bind(cleanSymbol, cleanInterval, cleanAdjust)
      .first<MarketKlineManifestRecord>();

    let cachedBars: KlineBar[] | null = null;
    let isFresh = false;

    if (manifest && dataBucket) {
      const updatedAtMs = new Date(manifest.updated_at).getTime();
      isFresh = (now - updatedAtMs) < ttlMs;

      // Try reading from R2
      try {
        const obj = await dataBucket.get(manifest.r2_key || r2Key);
        if (obj) {
          const content = await obj.text();
          cachedBars = JSON.parse(content) as KlineBar[];
        }
      } catch (e) {
        console.warn(`R2 fetch failed for ${r2Key}:`, e);
      }
    }

    // Return fresh cache immediately
    if (cachedBars && isFresh && cachedBars.length > 0) {
      return {
        bars: cachedBars,
        cached: true,
        stale: false,
        provider: manifest?.provider || 'eastmoney',
        source: manifest?.source || 'akshare',
        as_of: manifest?.as_of || manifest?.updated_at || new Date().toISOString()
      };
    }

    // 2. Cache Miss or Expired -> Fetch from Quant Service
    try {
      const quantUrl = this.env.QUANT_SERVICE_URL;
      const quantToken = this.env.QUANT_SERVICE_TOKEN;

      if (!quantUrl) {
        throw new Error('QUANT_SERVICE_NOT_CONFIGURED');
      }

      const targetEndpoint = `${quantUrl.replace(/\/$/, '')}/v1/market/cn/stocks/${cleanSymbol}/chart?interval=${cleanInterval}&adjust=${cleanAdjust}`;
      const resp = await fetch(targetEndpoint, {
        headers: {
          'Authorization': `Bearer ${quantToken || ''}`,
          'Accept': 'application/json'
        },
        // AKShare may spend tens of seconds failing over between upstream
        // providers. Keep the Worker request alive long enough for a real
        // result instead of turning a recoverable provider delay into a 502.
        signal: AbortSignal.timeout(60000)
      });

      if (!resp.ok) {
        throw new Error(`Quant returned HTTP ${resp.status}`);
      }

      const json = await resp.json() as any;
      if (!json.success || !json.data || !json.data.bars) {
        throw new Error(json.error?.message || 'Empty bars data');
      }

      const freshBars: KlineBar[] = json.data.bars;
      const asOfStr = json.data.as_of || new Date().toISOString();
      const provider = json.data.provider || 'eastmoney';
      const source = json.data.source || 'akshare';

      // Save to R2 asynchronously if bucket configured
      if (dataBucket && freshBars.length > 0) {
        try {
          await dataBucket.put(r2Key, JSON.stringify(freshBars), {
            httpMetadata: { contentType: 'application/json' }
          });

          const startTime = freshBars[0]?.time || null;
          const endTime = freshBars[freshBars.length - 1]?.time || null;
          const nowIso = new Date().toISOString();

          await this.env.DB
            .prepare(`
              INSERT INTO market_kline_manifest (
                symbol, interval, adjust, r2_key, bars_count,
                start_time, end_time, provider, source, as_of, stale, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
              ON CONFLICT(symbol, interval, adjust) DO UPDATE SET
                r2_key = excluded.r2_key,
                bars_count = excluded.bars_count,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                provider = excluded.provider,
                source = excluded.source,
                as_of = excluded.as_of,
                stale = 0,
                updated_at = excluded.updated_at
            `)
            .bind(
              cleanSymbol,
              cleanInterval,
              cleanAdjust,
              r2Key,
              freshBars.length,
              startTime,
              endTime,
              provider,
              source,
              asOfStr,
              nowIso
            )
            .run();
        } catch (r2PutErr) {
          console.warn('Failed to update R2/Manifest for KLine:', r2PutErr);
        }
      }

      return {
        bars: freshBars,
        cached: false,
        stale: false,
        provider,
        source,
        as_of: asOfStr
      };
    } catch (fetchErr) {
      // 3. Fallback to Last Known Good from R2 if present
      if (cachedBars && cachedBars.length > 0) {
        console.warn(`Quant refresh failed for ${cleanSymbol}, serving Last Known Good cache (stale=true):`, fetchErr);
        return {
          bars: cachedBars,
          cached: true,
          stale: true,
          provider: manifest?.provider || 'eastmoney',
          source: manifest?.source || 'akshare',
          as_of: manifest?.as_of || manifest?.updated_at || new Date().toISOString()
        };
      }

      // No cache available and upstream failed
      throw new Error(`MARKET_KLINE_UNAVAILABLE: 无法获取股票 [${cleanSymbol}] K线数据: ${fetchErr}`);
    }
  }

  private getTtlMs(interval: string): number {
    switch (interval) {
      case '1m':
        return 30 * 1000;
      case '5m':
      case '15m':
      case '30m':
      case '60m':
        return 60 * 1000;
      case '1d':
      case 'daily':
        return 30 * 60 * 1000; // 30 mins
      case '1w':
      case 'weekly':
        return 6 * 3600 * 1000; // 6 hours
      case '1M':
      case 'monthly':
        return 24 * 3600 * 1000; // 24 hours
      default:
        return 5 * 60 * 1000;
    }
  }
}
