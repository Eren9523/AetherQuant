import {
  mockIndices,
  mockCNStocks,
  mockUSStocks,
  generateMockKLines,
} from '../mocks/mockStocks';
import { mockFactors, mockFactorGroupReturns } from '../mocks/mockFactors';
import { mockBacktestResults } from '../mocks/mockBacktests';
import { mockDataSources, mockDataQualityStats, mockUploadedDataset } from '../mocks/mockDataSources';
import { mockAutomationTasks } from '../mocks/mockTasks';
import { mockMLModels } from '../mocks/mockMLModels';
import { mockPaperAccount } from '../mocks/mockPortfolio';
import {
  StockQuote,
  KLinePoint,
  FactorItem,
  BacktestResult,
  DataSourceStatus,
  AutomationTask,
  PaperAccount,
  MLModelExperiment,
} from '../types';

export const MarketService = {
  async getIndices(): Promise<StockQuote[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockIndices), 100));
  },

  async getStocks(market: 'CN' | 'US' | 'ALL' = 'ALL'): Promise<StockQuote[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (market === 'CN') resolve(mockCNStocks);
        else if (market === 'US') resolve(mockUSStocks);
        else resolve([...mockCNStocks, ...mockUSStocks]);
      }, 150);
    });
  },

  async getStockDetail(symbol: string): Promise<StockQuote | undefined> {
    const all = [...mockIndices, ...mockCNStocks, ...mockUSStocks];
    return all.find((s) => s.symbol === symbol) || mockCNStocks[0];
  },

  async getKLines(symbol: string, period: string = '1M'): Promise<KLinePoint[]> {
    let points = 30;
    if (period === '1D') points = 24; // intraday hourly
    if (period === '5D') points = 40;
    if (period === '1M') points = 30;
    if (period === '3M') points = 90;
    if (period === '1Y') points = 250;
    if (period === '5Y') points = 500;

    const stock = await this.getStockDetail(symbol);
    const basePrice = stock ? stock.price : 1000;
    return generateMockKLines(basePrice, points);
  },
};

export const FactorService = {
  async getFactors(): Promise<FactorItem[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockFactors), 100));
  },

  async getFactorGroupReturns() {
    return mockFactorGroupReturns;
  },
};

export const BacktestService = {
  async getBacktestResults(): Promise<BacktestResult[]> {
    return new Promise((resolve) => setTimeout(() => resolve(mockBacktestResults), 100));
  },

  async getBacktestById(id: string): Promise<BacktestResult | undefined> {
    return mockBacktestResults.find((b) => b.id === id) || mockBacktestResults[0];
  },

  async runBacktest(config: {
    strategyName: string;
    universe: string;
    startDate: string;
    endDate: string;
    initialCapital: number;
    onProgress?: (percent: number, stepName: string) => void;
  }): Promise<BacktestResult> {
    if (config.onProgress) {
      config.onProgress(10, '正在初始化历史行情与复权引擎...');
      await new Promise((r) => setTimeout(r, 300));
      config.onProgress(35, '正在对 60+ 因子进行横截面正交化处理...');
      await new Promise((r) => setTimeout(r, 400));
      config.onProgress(65, '正在模拟逐笔撮合、印花税与滑点扣减...');
      await new Promise((r) => setTimeout(r, 400));
      config.onProgress(90, '正在计算夏普比率、最大回撤与归因矩阵...');
      await new Promise((r) => setTimeout(r, 300));
      config.onProgress(100, '回测计算成功！生成交互式绩效报告');
    }

    return mockBacktestResults[0];
  },
};

export const DataService = {
  async getDataSources(): Promise<DataSourceStatus[]> {
    return mockDataSources;
  },

  async getDataQuality() {
    return mockDataQualityStats;
  },

  async parseUploadedFile(fileName: string) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ...mockUploadedDataset,
          filename: fileName,
        });
      }, 1200);
    });
  },
};

export const PortfolioService = {
  async getPaperAccount(): Promise<PaperAccount> {
    return mockPaperAccount;
  },
};

export const AutomationService = {
  async getTasks(): Promise<AutomationTask[]> {
    return mockAutomationTasks;
  },
};

export const MLLabService = {
  async getExperiments(): Promise<MLModelExperiment[]> {
    return mockMLModels;
  },
};

export const ResearchService = {
  async queryAI(prompt: string, contextSymbol?: string) {
    return new Promise<{ text: string; steps: string[]; resultCard?: any }>((resolve) => {
      setTimeout(() => {
        if (prompt.includes('沪深300') || prompt.includes('动量')) {
          resolve({
            text: `已完成全市场多因子扫描。根据您的策略需求（沪深300指数成分股，60日趋势动量 top 10%，且20日年化波动率 < 22%），我们筛选出了具备高 Alpha 确定性的目标组合。`,
            steps: [
              '步骤 1: 锁定期 沪深300 成分股池 (300 只标的)',
              '步骤 2: 提取 60日对数收益率 并进行 MAD 截面去极值',
              '步骤 3: 结合 20日低波动率 与 5日成交量突破因子',
              '步骤 4: 执行约束条件筛选，剔除 ST 与高估值异常股',
            ],
            resultCard: {
              type: 'stockRank',
              title: ' AI 动量低吸候选 TOP 5',
              items: [
                { symbol: '300750.SZ', name: '宁德时代', score: 94.2, reason: '放量突破60日均线，电池装机量大幅超预期' },
                { symbol: '600519.SH', name: '贵州茅台', score: 91.8, reason: '动量因子排名 92 分位，回撤控制优异' },
                { symbol: '002594.SZ', name: '比亚迪', score: 89.5, reason: '海外交付放量，ROE TTM 提升 2.4%' },
                { symbol: '300059.SZ', name: '东方财富', score: 88.1, reason: '券商板块高弹性动量标的，换手率健康' },
                { symbol: '600036.SH', name: '招商银行', score: 86.4, reason: '息差企稳，低波动高股息防御性极佳' },
              ],
            },
          });
        } else if (contextSymbol) {
          resolve({
            text: `针对标的 [${contextSymbol}] 的 AI 深度研究：当前因子综合得分 88.5，位于行业同类的前 8% 分位。近 20 日主力资金呈现持续净流入，基本面 ROE TTM 与动量因子协同共振，下行风险收益比极其优秀。`,
            steps: [
              '解析 K 线筹码分布与关键支撑位',
              '计算多因子分位数与同业对比矩阵',
              '搜集近 30 天券商研报与 AI 舆情评分',
            ],
          });
        } else {
          resolve({
            text: `AetherQuant AI 研究助手已就绪。我理解当前市场宏观结构与行业因子轮动，您可以让我帮您筛选股票、解析财报文档、评估策略夏普比率或构建 ML 因子模型。`,
            steps: ['解析用户问题语义', '连接全局行情与因子知识库', '生成结构化分析报告'],
          });
        }
      }, 900);
    });
  },
};
