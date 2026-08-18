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
      const res = await ApiClient.get<any[]>('/market/indices');
      if (res && Array.isArray(res) && res.length > 0) {
        return res;
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
      const res = await ApiClient.get<any[]>('/market/stocks', { market });
      if (res && Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', '无法连接到行情服务 (MARKET_SERVICE_UNAVAILABLE)。');
      }
      console.warn('[DEMO MODE] Loading mock stocks:', e);
    }

    if (market === 'CN') return mockCNStocks;
    if (market === 'US') return mockUSStocks;
    return [...mockCNStocks, ...mockUSStocks];
  },

  async getStockDetail(symbol: string): Promise<StockQuote | undefined> {
    try {
      const q = await ApiClient.get<any>(`/quotes/${symbol}`);
      if (q && q.symbol) {
        return {
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          volume: q.volume || '0',
          turnover: q.turnover || '0',
          high: q.high,
          low: q.low,
          open: q.open,
          prevClose: q.prevClose,
          pe: q.pe || 0,
          pb: q.pb || 0,
          marketCap: q.marketCap || '0',
          industry: q.industry || '综合',
          updatedAt: '实时行情',
          market: (q.market || 'CN') as 'CN' | 'US',
          currency: (q.currency || 'CNY') as 'CNY' | 'USD',
        };
      }
    } catch (e) {
      if (RUNTIME_CONFIG.isRealMode) {
        throw new ApiError('MARKET_SERVICE_UNAVAILABLE', `无法获取标的 ${symbol} 的实时行情详情。`);
      }
      console.warn('[DEMO MODE] Loading mock stock detail:', e);
    }
    const all = [...mockIndices, ...mockCNStocks, ...mockUSStocks];
    return all.find((s) => s.symbol === symbol) || mockCNStocks[0];
  },

  async getKLines(symbol: string, period: string = '1M'): Promise<KLinePoint[]> {
    try {
      const res = await ApiClient.get<{ data: any[] }>(`/bars/${symbol}`, { period, adjust: 'qfq' });
      if (res && res.data && res.data.length > 0) {
        return res.data.map((b: any) => ({
          time: b.date,
          open: b.open,
          close: b.close,
          high: b.high,
          low: b.low,
          volume: b.volume,
          ma5: b.close * 0.995,
          ma10: b.close * 0.99,
          ma20: b.close * 0.98,
        }));
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
