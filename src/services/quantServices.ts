import { ApiClient, ApiError } from './apiClient';
import { RUNTIME_CONFIG } from '../config/runtimeConfig';
import {
  StockQuote,
  KLinePoint,
  MarketOverviewStats,
  FactorItem,
  DataSourceStatus,
  MLModelExperiment,
  PaperAccount,
  AutomationTask,
  BacktestResult,
} from '../types';
import { calculateIndicators } from '../utils/indicators';
import { mockIndices, mockCNStocks, mockUSStocks } from '../mocks/mockStocks';
import { mockFactors } from '../mocks/mockFactors';
import { mockBacktestResults } from '../mocks/mockBacktests';
import { mockDataSources, mockDataQualityStats, mockUploadedDataset } from '../mocks/mockDataSources';
import { mockPaperAccount } from '../mocks/mockPortfolio';
import { mockAutomationTasks } from '../mocks/mockTasks';
import { mockMLModels } from '../mocks/mockMLModels';

// ==========================================
// 1. Market Service (AetherQuant Real Market Engine)
// ==========================================
export interface GetStocksParams {
  market?: 'CN' | 'US' | 'ALL';
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  exchange?: 'SH' | 'SZ' | 'BJ' | string;
  symbols?: string;
}

export interface GetStocksResult {
  stocks: StockQuote[];
  total: number;
  page: number;
  pageSize: number;
  asOf: string;
  cached?: boolean;
}

export const MarketService = {
  /**
   * Fetches real major market indices (上证指数, 深证成指, 创业板指, 沪深300).
   */
  async getIndices(): Promise<StockQuote[]> {
    if (RUNTIME_CONFIG.isRealMode) {
      try {
        const res = await ApiClient.get<any>('/market/cn/indices');
        const rawList = res?.indices || res?.data?.indices || (Array.isArray(res) ? res : res?.data);
        if (rawList && Array.isArray(rawList) && rawList.length > 0) {
          return rawList.map((idx: any) => ({
            symbol: idx.symbol,
            name: idx.name,
            price: idx.last ?? idx.price ?? 0,
            change: idx.change ?? 0,
            changePercent: idx.change_pct ?? idx.changePercent ?? 0,
            volume: idx.volume ? (idx.volume >= 10000 ? `${(idx.volume / 10000).toFixed(1)}万` : idx.volume.toString()) : '0',
            turnover: idx.turnover ? (idx.turnover >= 100000000 ? `${(idx.turnover / 100000000).toFixed(2)}亿` : `${(idx.turnover / 10000).toFixed(1)}万`) : '0',
            rawVolume: idx.volume ?? 0,
            rawTurnover: idx.turnover ?? 0,
            high: idx.high ?? idx.last ?? 0,
            low: idx.low ?? idx.last ?? 0,
            open: idx.open ?? idx.last ?? 0,
            prevClose: idx.prev_close ?? idx.prevClose ?? idx.last ?? 0,
            pe: 0,
            pb: 0,
            marketCap: idx.turnover ? `成交 ${idx.turnover >= 100000000 ? (idx.turnover / 100000000).toFixed(1) + '亿' : (idx.turnover / 10000).toFixed(1) + '万'}` : '0',
            industry: '市场核心指数',
            updatedAt: idx.as_of ? new Date(idx.as_of).toLocaleTimeString() : '实时指数',
            market: 'CN' as const,
            currency: 'CNY' as const,
            source: 'AKShare (EastMoney)',
          }));
        }
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', '主要指数服务暂无实时数据');
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法连接大盘指数服务: ${e.message || '网络连接失败'}`);
      }
    }
    return mockIndices;
  },

  /**
   * Fetches real market breadth overview (up/down count, total turnover, limit up/down).
   */
  async getMarketOverview(): Promise<MarketOverviewStats> {
    if (RUNTIME_CONFIG.isRealMode) {
      try {
        const res = await ApiClient.get<any>('/market/cn/overview');
        const ov = res?.data || res;
        if (ov) {
          return {
            upCount: ov.up_count ?? ov.upCount ?? 0,
            downCount: ov.down_count ?? ov.downCount ?? 0,
            flatCount: ov.flat_count ?? ov.flatCount ?? 0,
            limitUpCount: ov.limit_up_count ?? ov.limitUpCount ?? 0,
            limitDownCount: ov.limit_down_count ?? ov.limitDownCount ?? 0,
            totalTurnover: ov.total_turnover ?? ov.totalTurnover ?? 0,
            avgChangePct: ov.avg_change_pct ?? ov.avgChangePct ?? 0,
            totalCount: ov.total_count ?? ov.totalCount ?? 0,
            asOf: ov.as_of || ov.asOf || new Date().toISOString(),
          };
        }
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', '全市场统计指标暂未就绪');
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取全市场统计数据: ${e.message || '网络错误'}`);
      }
    }

    // Mock Overview fallback
    return {
      upCount: 3420,
      downCount: 1580,
      flatCount: 210,
      limitUpCount: 48,
      limitDownCount: 12,
      totalTurnover: 980000000000,
      avgChangePct: 0.85,
      totalCount: 5210,
      asOf: new Date().toISOString(),
    };
  },

  /**
   * Fetches paginated, searchable, sortable list of real A-share stocks.
   */
  async getStocks(params: GetStocksParams | string = {}): Promise<GetStocksResult> {
    const opts: GetStocksParams = typeof params === 'string' ? { market: params as any } : params;
    const {
      market = 'CN',
      page = 1,
      pageSize = 50,
      search,
      sortBy = 'change_pct',
      sortOrder = 'desc',
      exchange,
      symbols,
    } = opts;

    if (RUNTIME_CONFIG.isRealMode) {
      if (market === 'US' || market === 'ALL') {
        throw new ApiError('MARKET_NOT_IMPLEMENTED', '美股或跨市场行情接口暂未接入 (MARKET_NOT_IMPLEMENTED)，当前量化通道仅支持 A股(CN) 真实市场。');
      }

      try {
        const query: Record<string, any> = {
          page,
          page_size: pageSize,
          sort_by: sortBy,
          sort_order: sortOrder,
        };
        if (search && search.trim()) query.search = search.trim();
        if (exchange && exchange !== 'ALL') query.exchange = exchange;
        if (symbols && symbols.trim()) query.symbols = symbols.trim();

        const res = await ApiClient.get<any>('/market/cn/spot', query);
        const rawStocks = res?.stocks ?? res?.data?.stocks ?? res?.items ?? res?.results ?? (Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : undefined));

        if (Array.isArray(rawStocks)) {
          const stocks: StockQuote[] = rawStocks.map((s: any) => ({
            symbol: s.symbol,
            name: s.name || s.symbol,
            price: s.last ?? s.price ?? 0,
            change: s.change ?? 0,
            changePercent: s.change_pct ?? s.changePercent ?? 0,
            volume: s.volume ? (s.volume >= 10000 ? `${(s.volume / 10000).toFixed(1)}万` : s.volume.toString()) : '0',
            turnover: s.turnover ? (s.turnover >= 100000000 ? `${(s.turnover / 100000000).toFixed(2)}亿` : `${(s.turnover / 10000).toFixed(1)}万`) : '0',
            rawVolume: s.volume ?? 0,
            rawTurnover: s.turnover ?? 0,
            high: s.high ?? s.last ?? s.price ?? 0,
            low: s.low ?? s.last ?? s.price ?? 0,
            open: s.open ?? s.last ?? s.price ?? 0,
            prevClose: s.prev_close ?? s.prevClose ?? s.last ?? s.price ?? 0,
            pe: s.pe_dynamic ?? s.pe ?? 0,
            pb: s.pb ?? 0,
            turnoverRate: s.turnover_rate ?? s.turnoverRate ?? 0,
            amplitude: s.amplitude ?? 0,
            marketCap: s.total_market_cap ? `${(s.total_market_cap / 100000000).toFixed(1)}亿` : (s.marketCap || '0'),
            floatMarketCap: s.float_market_cap ? `${(s.float_market_cap / 100000000).toFixed(1)}亿` : undefined,
            exchange: s.exchange || (s.symbol?.startsWith('6') ? 'SH' : (s.symbol?.startsWith('8') ? 'BJ' : 'SZ')),
            industry: s.exchange === 'SH' ? '沪市主板' : (s.exchange === 'SZ' ? '深市主板' : (s.exchange === 'BJ' ? '北交所' : 'A股')),
            updatedAt: s.as_of ? new Date(s.as_of).toLocaleTimeString() : '实时行情',
            market: 'CN' as const,
            currency: 'CNY' as const,
            source: 'AKShare (EastMoney)',
          }));

          return {
            stocks,
            total: res?.total ?? res?.data?.total ?? stocks.length,
            page: res?.page ?? res?.data?.page ?? page,
            pageSize: res?.page_size ?? res?.data?.page_size ?? pageSize,
            asOf: res?.as_of || res?.data?.as_of || new Date().toISOString(),
            cached: res?.cached ?? res?.data?.cached,
          };
        }
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', '量化行情服务返回格式异常');
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法连接量化行情服务: ${e.message || '网络连接失败'}`);
      }
    }

    // Demo Mode fallback
    let all = market === 'US' ? mockUSStocks : (market === 'CN' ? mockCNStocks : [...mockCNStocks, ...mockUSStocks]);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      all = all.filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.industry.toLowerCase().includes(q));
    }
    const startIdx = (page - 1) * pageSize;
    const paged = all.slice(startIdx, startIdx + pageSize);

    return {
      stocks: paged,
      total: all.length,
      page,
      pageSize,
      asOf: new Date().toISOString(),
      cached: false,
    };
  },

  /**
   * Fetches real quote + basic company info for a single stock.
   */
  async getStockDetail(symbol: string): Promise<StockQuote | undefined> {
    const cleanSym = (symbol || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (RUNTIME_CONFIG.isRealMode) {
      if (cleanSym.length !== 6) {
        throw new ApiError('INVALID_SYMBOL', `股票代码格式错误 [${symbol}]，必须为 6 位数字代码`);
      }
      try {
        const res = await ApiClient.get<any>(`/market/cn/stocks/${cleanSym}`);
        const s = res?.quote || res?.data?.quote || res;
        const basic = res?.basic_info || res?.data?.basic_info || {};

        if (s && (s.symbol || s.last !== undefined || s.price !== undefined)) {
          return {
            symbol: s.symbol || cleanSym,
            name: s.name || basic.name || cleanSym,
            price: s.last ?? s.price ?? 0,
            change: s.change ?? 0,
            changePercent: s.change_pct ?? s.changePercent ?? 0,
            volume: s.volume ? (s.volume >= 10000 ? `${(s.volume / 10000).toFixed(1)}万` : s.volume.toString()) : '0',
            turnover: s.turnover ? (s.turnover >= 100000000 ? `${(s.turnover / 100000000).toFixed(2)}亿` : `${(s.turnover / 10000).toFixed(1)}万`) : '0',
            rawVolume: s.volume ?? 0,
            rawTurnover: s.turnover ?? 0,
            high: s.high ?? s.last ?? 0,
            low: s.low ?? s.last ?? 0,
            open: s.open ?? s.last ?? 0,
            prevClose: s.prev_close ?? s.prevClose ?? s.last ?? 0,
            pe: s.pe_dynamic ?? s.pe ?? 0,
            pb: s.pb ?? 0,
            turnoverRate: s.turnover_rate ?? s.turnoverRate ?? 0,
            amplitude: s.amplitude ?? 0,
            marketCap: (s.total_market_cap || basic.total_market_cap) ? `${((s.total_market_cap || basic.total_market_cap) / 100000000).toFixed(1)}亿` : '0',
            floatMarketCap: (s.float_market_cap || basic.float_market_cap) ? `${((s.float_market_cap || basic.float_market_cap) / 100000000).toFixed(1)}亿` : undefined,
            exchange: s.exchange,
            industry: basic.industry || (s.exchange === 'SH' ? '沪市主板' : (s.exchange === 'SZ' ? '深市主板' : (s.exchange === 'BJ' ? '北交所' : 'A股'))),
            updatedAt: s.as_of ? new Date(s.as_of).toLocaleTimeString() : '实时行情',
            market: 'CN' as const,
            currency: 'CNY' as const,
            source: 'AKShare (EastMoney)',
          };
        }
        throw new ApiError('NOT_FOUND', `未查询到标的 [${cleanSym}] 的实时行情详情`);
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取标的 ${symbol} 的行情详情: ${e.message || '上游服务无响应'}`);
      }
    }

    // Demo Mode fallback
    const all = [...mockIndices, ...mockCNStocks, ...mockUSStocks];
    return all.find((s) => s.symbol === symbol || (cleanSym && s.symbol.startsWith(cleanSym))) || mockCNStocks[0];
  },

  /**
   * Fetches real K-line bars for specified interval & adjustment mode,
   * calculates all technical indicators (MA, EMA, BOLL, MACD, RSI, KDJ) client-side.
   */
  async getChartData(
    symbol: string,
    interval: string = '1d',
    adjust: 'none' | 'qfq' | 'hfq' = 'qfq'
  ): Promise<{ bars: KLinePoint[]; count: number; asOf: string; qualityWarnings: number }> {
    const cleanSym = (symbol || '').replace(/[^0-9]/g, '').slice(0, 6);
    if (RUNTIME_CONFIG.isRealMode) {
      if (cleanSym.length !== 6) {
        throw new ApiError('INVALID_SYMBOL', `股票代码格式错误 [${symbol}]，必须为 6 位数字代码`);
      }

      try {
        const res = await ApiClient.get<any>(`/market/cn/stocks/${cleanSym}/chart`, {
          interval,
          adjust,
        });

        const rawList = res?.bars || res?.data?.bars || (Array.isArray(res) ? res : res?.data);

        if (rawList && Array.isArray(rawList)) {
          const rawBars = rawList.map((b: any) => ({
            time: b.time || b.date,
            open: b.open ?? 0,
            high: b.high ?? 0,
            low: b.low ?? 0,
            close: b.close ?? 0,
            volume: b.volume ?? 0,
            turnover: b.turnover ?? b.amount ?? 0,
            changePct: b.change_pct ?? b.changePct ?? 0,
            turnoverRate: b.turnover_rate ?? b.turnoverRate ?? 0,
          }));

          const enrichedBars = calculateIndicators(rawBars);

          return {
            bars: enrichedBars,
            count: res.count ?? res.data?.count ?? enrichedBars.length,
            asOf: res.as_of || res.data?.as_of || new Date().toISOString(),
            qualityWarnings: res.quality_warnings_count ?? res.data?.quality_warnings_count ?? 0,
          };
        }
        return { bars: [], count: 0, asOf: new Date().toISOString(), qualityWarnings: 0 };
      } catch (e: any) {
        if (e instanceof ApiError) throw e;
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取 ${symbol} 的 K 线走势: ${e.message || '服务异常'}`);
      }
    }

    // Demo Mode fallback
    return { bars: [], count: 0, asOf: new Date().toISOString(), qualityWarnings: 0 };
  },

  /**
   * Compatibility wrapper for existing getKLines calls
   */
  async getKLines(symbol: string, period: string = '1d'): Promise<KLinePoint[]> {
    const res = await this.getChartData(symbol, period, 'qfq');
    return res.bars;
  },

  async getOrderBook(symbol: string) {
    try {
      const res = await ApiClient.get<any>(`/quotes/${symbol}/depth`);
      if (res && res.bids) return res;
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取 ${symbol} 的五档盘口。`);
      }
    }
    return null;
  },

  async getFundFlow(symbol: string) {
    try {
      const res = await ApiClient.get<any>(`/quotes/${symbol}/fund-flow`);
      if (res && res.mainNetInflow) return res;
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取 ${symbol} 的资金流向。`);
      }
    }
    return null;
  },

  async getTechnicalSignals(symbol: string) {
    try {
      const res = await ApiClient.get<any>(`/quotes/${symbol}/signals`);
      if (res && res.rsi) return res;
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取 ${symbol} 的技术指标。`);
      }
    }
    return null;
  },

  async getMacroIndicators() {
    try {
      const res = await ApiClient.get<any[]>('/macro/indicators');
      if (res && Array.isArray(res) && res.length > 0) return res;
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', '无法获取宏观流动性指标。');
      }
    }
    return [];
  },
};

// ==========================================
// 2. Factor Service
// ==========================================
export const FactorService = {
  async getFactors(): Promise<FactorItem[]> {
    try {
      const res = await ApiClient.get<FactorItem[]>('/factors');
      if (res && Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('QUANT_SERVICE_UNAVAILABLE', '因子库服务暂未就绪 (QUANT_SERVICE_UNAVAILABLE)。');
      }
    }
    return mockFactors;
  },

  async calculateFactorIC(factorId: string) {
    try {
      const res = await ApiClient.post<any>('/factors/evaluate', { factorId });
      if (res && res.icMean !== undefined) {
        return res;
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('QUANT_SERVICE_UNAVAILABLE', `计算因子 ${factorId} 的 IC 均值失败。`);
      }
    }
    const f = mockFactors.find((item) => item.id === factorId);
    return {
      icMean: f?.ic || 0.052,
      icStd: 0.082,
      ir: 0.63,
      rankIcMean: f?.rankIc || 0.061,
      tStat: 3.42,
    };
  },
};

// ==========================================
// 3. Backtest Service
// ==========================================
export const BacktestService = {
  async runBacktest(strategyConfig: any): Promise<BacktestResult> {
    try {
      const res = await ApiClient.post<BacktestResult>('/backtests/run', strategyConfig);
      if (res && res.annualizedReturn !== undefined) {
        return res;
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('QUANT_SERVICE_UNAVAILABLE', '回测引擎计算失败 (QUANT_SERVICE_UNAVAILABLE)。');
      }
    }
    return mockBacktestResults[0];
  },

  async getBacktestHistory(): Promise<BacktestResult[]> {
    try {
      const res = await ApiClient.get<BacktestResult[]>('/backtests/history');
      if (res && Array.isArray(res)) {
        return res;
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('QUANT_SERVICE_UNAVAILABLE', '无法获取历史回测记录。');
      }
    }
    return mockBacktestResults;
  },
};

// ==========================================
// 4. DataCenter Service
// ==========================================
export const DataCenterService = {
  async getDataSources(): Promise<DataSourceStatus[]> {
    try {
      const res = await ApiClient.get<DataSourceStatus[]>('/data/sources');
      if (res && Array.isArray(res) && res.length > 0) return res;
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('SERVICE_NOT_IMPLEMENTED', '数据源管理将在真 R2 存储阶段接入。');
      }
    }
    return mockDataSources;
  },

  async getSyncLogs() {
    try {
      const res = await ApiClient.get<any[]>('/data/sync-logs');
      if (res && Array.isArray(res) && res.length > 0) return res;
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('SERVICE_NOT_IMPLEMENTED', '同步日志服务暂未就绪。');
      }
    }
    return [];
  },

  async getQualityStats() {
    try {
      const res = await ApiClient.get<any>('/data/quality-stats');
      if (res && res.accuracy !== undefined) return res;
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('SERVICE_NOT_IMPLEMENTED', '数据质量监控服务暂未就绪。');
      }
    }
    return mockDataQualityStats;
  },

  async parseUploadedFile(fileName: string) {
    if (RUNTIME_CONFIG.isRealMode) {
      throw new ApiError('SERVICE_NOT_IMPLEMENTED', '文档与数据集解析服务将在真 R2 存储阶段上线。');
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ...mockUploadedDataset,
          filename: fileName,
        });
      }, 800);
    });
  },
};

export const DataService = DataCenterService;

// ==========================================
// 5. Portfolio & Paper Trading Service
// ==========================================
export const PortfolioService = {
  async getPaperAccount(): Promise<PaperAccount> {
    try {
      const res = await ApiClient.get<{ account: any; positions: any[] }>('/paper/account');
      if (res && res.account) {
        const totalAssets = res.account.totalEquity;
        return {
          totalAssets,
          cash: res.account.cashBalance,
          stockValue: res.account.marketValue,
          dailyPnL: res.account.dailyPnl,
          dailyPnLPercent: Number(((res.account.dailyPnl / totalAssets) * 100).toFixed(2)),
          cumPnLPercent: res.account.totalPnlPercent,
          positions: (res.positions || []).map((p: any) => ({
            symbol: p.symbol,
            name: p.name,
            market: 'CN',
            shares: p.quantity,
            costPrice: p.avgCost,
            currentPrice: p.currentPrice,
            marketValue: p.marketValue,
            unrealizedPnL: p.unrealizedPnl,
            unrealizedPnLPercent: p.unrealizedPnlPercent,
            weightPercent: Number(((p.marketValue / totalAssets) * 100).toFixed(1)),
          })),
        };
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('SERVICE_NOT_IMPLEMENTED', '模拟交易持仓服务未就绪。');
      }
    }
    return mockPaperAccount;
  },

  async getRiskAlerts() {
    if (RUNTIME_CONFIG.isRealMode) {
      throw new ApiError('SERVICE_NOT_IMPLEMENTED', '风险预警服务未就绪');
    }
    return [];
  },

  async getAssetAllocation() {
    if (RUNTIME_CONFIG.isRealMode) {
      throw new ApiError('SERVICE_NOT_IMPLEMENTED', '资产配置分布服务未就绪');
    }
    return [];
  },
};

// ==========================================
// 6. Automation & ML Lab
// ==========================================
export const AutomationService = {
  async getTasks(): Promise<AutomationTask[]> {
    try {
      const res = await ApiClient.get<any[]>('/automation/jobs');
      if (res && Array.isArray(res)) {
        return res.map((j: any) => ({
          id: j.id,
          name: j.name,
          description: j.name,
          schedule: j.cronExpr,
          cron: j.cronExpr,
          status: j.isActive ? (j.lastStatus === 'success' ? 'success' : 'running') : 'idle',
          duration: '3.2s',
          lastRun: j.lastRunAt || '2025-02-24 17:00:00',
          nextRun: j.nextRunAt || '2025-02-25 17:00:00',
          logs: ['[INFO] 定时任务触发', '[SUCCESS] 执行完成'],
        }));
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('SERVICE_NOT_IMPLEMENTED', '定时自动化任务服务暂未就绪。');
      }
    }
    return mockAutomationTasks;
  },
};

export const MLLabService = {
  async getExperiments(): Promise<MLModelExperiment[]> {
    if (RUNTIME_CONFIG.isRealMode) {
      throw new ApiError('SERVICE_NOT_IMPLEMENTED', '机器学习实验中心将在后续阶段上线 (SERVICE_NOT_IMPLEMENTED)。');
    }
    return mockMLModels;
  },
};

// ==========================================
// 7. Research & AI Service
// ==========================================
export const ResearchService = {
  async getThreads(search?: string, limit: number = 20) {
    if (RUNTIME_CONFIG.isDemoMode) {
      return [];
    }
    const queryStr = search ? `?q=${encodeURIComponent(search)}&limit=${limit}` : `?limit=${limit}`;
    const res = await ApiClient.get<{ count: number; threads: any[] }>(`/research/threads${queryStr}`);
    return res?.threads || [];
  },

  async getThreadDetail(threadId: string) {
    if (RUNTIME_CONFIG.isDemoMode) {
      return null;
    }
    return await ApiClient.get<{ thread: any; messages: any[] }>(`/research/threads/${threadId}`);
  },

  async createThread(params?: { title?: string; activeSymbol?: string; marketContext?: string }) {
    if (RUNTIME_CONFIG.isDemoMode) {
      return {
        id: `demo_${Date.now()}`,
        title: params?.title || '新量化研究会话',
        active_symbol: params?.activeSymbol || null,
        created_at: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        message_count: 0,
      };
    }
    return await ApiClient.post<any>('/research/threads', params || {});
  },

  async updateThread(threadId: string, updates: { title?: string; pinned?: boolean; archived?: boolean }) {
    if (RUNTIME_CONFIG.isDemoMode) {
      return { id: threadId, ...updates };
    }
    return await ApiClient.patch<any>(`/research/threads/${threadId}`, updates);
  },

  async deleteThread(threadId: string) {
    if (RUNTIME_CONFIG.isDemoMode) {
      return { deleted: true };
    }
    try {
      return await ApiClient.delete<any>(`/research/threads/${threadId}`);
    } catch {
      return { deleted: true };
    }
  },

  async deleteEmptyThreads() {
    if (RUNTIME_CONFIG.isDemoMode) {
      return { deletedCount: 0 };
    }
    try {
      return await ApiClient.delete<any>('/research/threads/batch/empty');
    } catch {
      return { deletedCount: 0 };
    }
  },

  async appendMessage(
    threadId: string,
    message: {
      role: 'user' | 'assistant';
      content: string;
      clientMessageId?: string;
      model?: string;
      provider?: string;
    }
  ) {
    if (RUNTIME_CONFIG.isDemoMode) {
      return {
        id: `msg_${Date.now()}`,
        thread_id: threadId,
        role: message.role,
        content: message.content,
        created_at: new Date().toISOString(),
      };
    }
    return await ApiClient.post<any>(`/research/threads/${threadId}/messages`, message);
  },

  async saveHistorySession(_session: { id: string; title: string; messages: any[] }) {
    return { success: true };
  },

  async getFeaturedPrompts(params?: any) {
    try {
      const res = await ApiClient.get<{ prompts: any[] }>('/prompts/featured', params);
      if (res && res.prompts && res.prompts.length > 0) {
        return res.prompts;
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw e;
      }
      console.warn('Failed to fetch daily featured prompts:', e);
    }
    return null;
  },

  async getRecommendedPrompts(params?: any) {
    return this.getFeaturedPrompts(params);
  },

  async queryAI(prompt: string, contextSymbol?: string): Promise<{ text: string; usage?: any; model?: string; steps?: string[]; resultCard?: any }> {
    const fullPrompt = contextSymbol ? `[标的: ${contextSymbol}] ${prompt}` : prompt;
    const data = await ApiClient.post<{ text: string; usage?: any; model?: string }>('/ai/chat', {
      prompt: fullPrompt,
      stream: false,
    });
    return {
      text: data.text,
      usage: data.usage,
      model: data.model,
      steps: ['连通行情图谱与特征工程', 'AetherQuant AI 深度量化推理'],
    };
  },

  async queryAIStream(
    prompt: string,
    contextSymbol: string | undefined,
    onChunk: (chunk: string) => void,
    onDone: (fullText: string) => void,
    onError?: (err: ApiError) => void
  ): Promise<string> {
    const fullPrompt = contextSymbol ? `[标的: ${contextSymbol}] ${prompt}` : prompt;
    try {
      const fullText = await ApiClient.postStream(
        '/ai/chat',
        { prompt: fullPrompt },
        onChunk,
        undefined,
        onError
      );
      if (onDone) {
        onDone(fullText);
      }
      return fullText;
    } catch (err: any) {
      throw err;
    }
  },
};
