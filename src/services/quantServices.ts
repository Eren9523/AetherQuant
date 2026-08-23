import { ApiClient, ApiError } from './apiClient';
import { RUNTIME_CONFIG } from '../config/runtimeConfig';
import {
  StockQuote,
  KLinePoint,
  FactorItem,
  DataSourceStatus,
  MLModelExperiment,
  PaperAccount,
  AutomationTask,
  BacktestResult,
} from '../types';
import { mockIndices, mockCNStocks, mockUSStocks } from '../mocks/mockStocks';
import { mockFactors } from '../mocks/mockFactors';
import { mockBacktestResults } from '../mocks/mockBacktests';
import { mockDataSources, mockDataQualityStats, mockUploadedDataset } from '../mocks/mockDataSources';
import { mockPaperAccount } from '../mocks/mockPortfolio';
import { mockAutomationTasks } from '../mocks/mockTasks';
import { mockMLModels } from '../mocks/mockMLModels';

// ==========================================
// 1. Market Service
// ==========================================
export const MarketService = {
  async getIndices(): Promise<StockQuote[]> {
    try {
      const res = await ApiClient.get<any>('/market/cn/spot', { symbols: '000001,399001,399006,000300' });
      if (res && res.stocks && Array.isArray(res.stocks) && res.stocks.length > 0) {
        return res.stocks.map((s: any) => ({
          symbol: s.symbol,
          name: s.name,
          price: s.last ?? 0,
          change: s.change ?? 0,
          changePercent: s.change_pct ?? 0,
          volume: s.volume ? (s.volume >= 10000 ? `${(s.volume / 10000).toFixed(1)}万` : s.volume.toString()) : '0',
          turnover: s.turnover ? (s.turnover >= 100000000 ? `${(s.turnover / 100000000).toFixed(2)}亿` : `${(s.turnover / 10000).toFixed(1)}万`) : '0',
          high: s.high ?? 0,
          low: s.low ?? 0,
          open: s.open ?? 0,
          prevClose: s.prev_close ?? 0,
          pe: s.pe_dynamic ?? 0,
          pb: s.pb ?? 0,
          marketCap: s.total_market_cap ? `${(s.total_market_cap / 100000000).toFixed(1)}亿` : '0',
          industry: s.exchange === 'SH' ? '上海主板' : (s.exchange === 'SZ' ? '深圳主板' : '北交所'),
          updatedAt: s.as_of ? new Date(s.as_of).toLocaleTimeString() : '实时行情',
          market: 'CN',
          currency: 'CNY',
        }));
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', '无法获取实时大盘指数行情，行情服务未就绪。');
      }
      console.warn('[DEMO MODE] Loading mock indices:', e);
    }
    return mockIndices;
  },

  async getStocks(market: 'CN' | 'US' | 'ALL' = 'ALL'): Promise<StockQuote[]> {
    try {
      if (market === 'CN' || market === 'ALL') {
        const res = await ApiClient.get<any>('/market/cn/spot');
        if (res && res.stocks && Array.isArray(res.stocks) && res.stocks.length > 0) {
          const cnStocks: StockQuote[] = res.stocks.map((s: any) => ({
            symbol: s.symbol,
            name: s.name,
            price: s.last ?? 0,
            change: s.change ?? 0,
            changePercent: s.change_pct ?? 0,
            volume: s.volume ? (s.volume >= 10000 ? `${(s.volume / 10000).toFixed(1)}万` : s.volume.toString()) : '0',
            turnover: s.turnover ? (s.turnover >= 100000000 ? `${(s.turnover / 100000000).toFixed(2)}亿` : `${(s.turnover / 10000).toFixed(1)}万`) : '0',
            high: s.high ?? 0,
            low: s.low ?? 0,
            open: s.open ?? 0,
            prevClose: s.prev_close ?? 0,
            pe: s.pe_dynamic ?? 0,
            pb: s.pb ?? 0,
            marketCap: s.total_market_cap ? `${(s.total_market_cap / 100000000).toFixed(1)}亿` : '0',
            industry: s.exchange === 'SH' ? '沪市主板' : (s.exchange === 'SZ' ? '深市主板' : '北交所'),
            updatedAt: s.as_of ? new Date(s.as_of).toLocaleTimeString() : '实时行情',
            market: 'CN' as const,
            currency: 'CNY' as const,
          }));

          if (market === 'CN') return cnStocks;
          return [...cnStocks, ...mockUSStocks];
        }
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', '无法连接到量化行情服务 (MARKET_SERVICE_UNAVAILABLE)。');
      }
      console.warn('[DEMO MODE] Loading mock stocks:', e);
    }

    if (market === 'CN') return mockCNStocks;
    if (market === 'US') return mockUSStocks;
    return [...mockCNStocks, ...mockUSStocks];
  },

  async getStockDetail(symbol: string): Promise<StockQuote | undefined> {
    const cleanSym = symbol.replace(/[^0-9]/g, '').slice(0, 6);
    if (cleanSym.length === 6) {
      try {
        const res = await ApiClient.get<any>('/market/cn/spot', { symbols: cleanSym });
        if (res && res.stocks && Array.isArray(res.stocks) && res.stocks.length > 0) {
          const s = res.stocks[0];
          return {
            symbol: s.symbol,
            name: s.name,
            price: s.last ?? 0,
            change: s.change ?? 0,
            changePercent: s.change_pct ?? 0,
            volume: s.volume ? (s.volume >= 10000 ? `${(s.volume / 10000).toFixed(1)}万` : s.volume.toString()) : '0',
            turnover: s.turnover ? (s.turnover >= 100000000 ? `${(s.turnover / 100000000).toFixed(2)}亿` : `${(s.turnover / 10000).toFixed(1)}万`) : '0',
            high: s.high ?? 0,
            low: s.low ?? 0,
            open: s.open ?? 0,
            prevClose: s.prev_close ?? 0,
            pe: s.pe_dynamic ?? 0,
            pb: s.pb ?? 0,
            marketCap: s.total_market_cap ? `${(s.total_market_cap / 100000000).toFixed(1)}亿` : '0',
            industry: s.exchange === 'SH' ? '沪市主板' : (s.exchange === 'SZ' ? '深市主板' : '北交所'),
            updatedAt: s.as_of ? new Date(s.as_of).toLocaleTimeString() : '实时行情',
            market: 'CN',
            currency: 'CNY',
          };
        }
      } catch (e) {
        if (RUNTIME_CONFIG.isRealMode) {
          throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取标的 ${symbol} 的实时行情详情。`);
        }
        console.warn('[DEMO MODE] Loading mock stock detail:', e);
      }
    }

    const all = [...mockIndices, ...mockCNStocks, ...mockUSStocks];
    return all.find((s) => s.symbol === symbol || s.symbol.startsWith(cleanSym)) || mockCNStocks[0];
  },

  async getKLines(symbol: string, _period: string = '1M'): Promise<KLinePoint[]> {
    const cleanSym = symbol.replace(/[^0-9]/g, '').slice(0, 6) || '600519';
    try {
      const res = await ApiClient.get<any>(`/market/cn/stocks/${cleanSym}/history`, { adjust: 'qfq' });
      if (res && res.bars && Array.isArray(res.bars) && res.bars.length > 0) {
        return res.bars.map((b: any, idx: number, arr: any[]) => {
          const close = b.close ?? 0;
          // Calculate moving averages if enough historical bars
          const getMA = (periodCount: number) => {
            if (idx < periodCount - 1) return close;
            const slice = arr.slice(idx - periodCount + 1, idx + 1);
            const sum = slice.reduce((acc, curr) => acc + (curr.close ?? 0), 0);
            return +(sum / periodCount).toFixed(2);
          };

          return {
            time: b.date,
            open: b.open ?? close,
            close: close,
            high: b.high ?? close,
            low: b.low ?? close,
            volume: b.volume ?? 0,
            ma5: getMA(5),
            ma10: getMA(10),
            ma20: getMA(20),
          };
        });
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取 ${symbol} 的 K 线数据，行情上游无响应。`);
      }
      console.warn('[DEMO MODE] Loading mock KLines:', e);
    }
    return [];
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
        throw new ApiError('SERVICE_NOT_IMPLEMENTED', '数据源管理将在 P6 阶段全面接入真 R2 存储。');
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
      throw new ApiError('SERVICE_NOT_IMPLEMENTED', '文档与数据集解析服务将在 P6 (真 R2 存储) 阶段上线。');
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
// 7. Research & DeepSeek AI Service
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
    return await ApiClient.delete<any>(`/research/threads/${threadId}`);
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
      steps: ['连通行情图谱与特征工程', 'DeepSeek 深度量化推理'],
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
      // Note: ApiClient.postStream has already called onError once. Do not call it again here.
      throw err;
    }
  },
};
