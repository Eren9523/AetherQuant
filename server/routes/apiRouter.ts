import { Router, Request, Response } from 'express';
import multer from 'multer';
import { d1Client } from '../db/d1Client';
import { r2Client } from '../storage/r2Client';
import { UsageQuotaService } from '../quota/usageQuotaService';
import { marketProvider, MarketDataProvider } from '../market/marketDataProvider';
import { DataQualityEngine } from '../market/dataQuality';
import { FactorEngine } from '../factors/factorEngine';
import { StrategyValidator, StrategyDSL } from '../strategy/strategyValidator';
import { BacktestEngine } from '../backtest/backtestEngine';
import { DeepSeekProxyService } from '../ai/deepseekProxy';
import { DocumentParserEngine } from '../documents/documentParser';
import { PaperTradingService } from '../paper/paperTradingService';
import { JobOrchestrator } from '../automation/jobOrchestrator';

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
export const apiRouter = Router();

// Middleware to extract user context (defaulting to standard user)
const getUserContext = (req: Request) => {
  return {
    userId: (req.headers['x-user-id'] as string) || 'usr_default_trader',
    role: (req.headers['x-user-role'] as string) || 'free',
  };
};

// 1. Health & Status
apiRouter.get('/health', async (req: Request, res: Response) => {
  const overview = await UsageQuotaService.getSystemOverview();
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    engine: 'Node.js Express + Cloudflare D1 & R2 + AKShare Quant Pipeline',
    system: overview,
  });
});

// 2. System Usage & Cost Quota
apiRouter.get('/usage', async (req: Request, res: Response) => {
  const { userId, role } = getUserContext(req);
  const userUsage = await UsageQuotaService.getUserUsage(userId);
  const systemOverview = await UsageQuotaService.getSystemOverview();

  res.json({
    user: {
      userId,
      role,
      today: userUsage,
      limits: UsageQuotaService.FREE_LIMITS,
    },
    system: systemOverview,
  });
});

// 3. Markets & Instruments
apiRouter.get('/markets/overview', async (req: Request, res: Response) => {
  const overview = await marketProvider.getMarketOverview();
  res.json(overview);
});

apiRouter.get('/instruments/search', async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').toLowerCase();
  const all = [...MarketDataProvider.HOT_CN_STOCKS, ...MarketDataProvider.HOT_US_STOCKS];
  const matched = all.filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  res.json({ count: matched.length, results: matched });
});

apiRouter.get('/quotes/:symbol', async (req: Request, res: Response) => {
  const symbol = req.params.symbol;
  const quote = await marketProvider.getQuote(symbol);
  res.json(quote);
});

apiRouter.get('/bars/:symbol', async (req: Request, res: Response) => {
  const symbol = req.params.symbol;
  const period = (req.query.period as string) || '1M';
  const adjust = (req.query.adjust as string) || 'qfq';
  const bars = await marketProvider.getBars(symbol, period, adjust);
  res.json({ symbol, period, count: bars.length, data: bars });
});

// 4. Data Quality Check
apiRouter.post('/data-quality/validate', async (req: Request, res: Response) => {
  const symbol = req.body.symbol || '600519.SH';
  const bars = await marketProvider.getBars(symbol, '1Y');
  const report = DataQualityEngine.validateBars(bars, `kline_${symbol}`);
  res.json(report);
});

// 5. Factor Laboratory & Endpoints
apiRouter.get('/factors', async (req: Request, res: Response) => {
  const defaultFactors = [
    { id: 'MOM_20', name: '20日价格动量 (MOM_20)', category: 'momentum', icMean: 0.048, rankIc: 0.052, ir: 0.68, turnover: 0.22 },
    { id: 'MOM_60', name: '60日中周期动量 (MOM_60)', category: 'momentum', icMean: 0.062, rankIc: 0.071, ir: 0.84, turnover: 0.15 },
    { id: 'VOL_20', name: '20日已实现低波动 (VOL_20)', category: 'volatility', icMean: -0.054, rankIc: -0.061, ir: 0.72, turnover: 0.18 },
    { id: 'TURN_5', name: '5日流动性突变因子 (TURN_5)', category: 'volume', icMean: -0.038, rankIc: -0.042, ir: 0.55, turnover: 0.35 },
    { id: 'RSI_14', name: '14日相对强弱指标 (RSI_14)', category: 'technical', icMean: 0.032, rankIc: 0.038, ir: 0.49, turnover: 0.40 },
    { id: 'MA_DIST_20', name: '20日均线距离比率 (MA_DIST_20)', category: 'technical', icMean: 0.041, rankIc: 0.045, ir: 0.58, turnover: 0.25 },
  ];
  const groupReturns = FactorEngine.calculateQuantileReturns(0.058);

  res.json({
    factors: defaultFactors,
    quantileReturns: groupReturns,
  });
});

// 6. Strategy Validation & Management
apiRouter.post('/strategies/validate', (req: Request, res: Response) => {
  const validation = StrategyValidator.validate(req.body);
  if (!validation.success) {
    res.status(400).json({ success: false, error: validation.error });
    return;
  }
  res.json({ success: true, dsl: validation.data });
});

apiRouter.get('/strategies', (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  let strategies = d1Client.getTable('strategies').filter((s: any) => s.user_id === userId);
  if (strategies.length === 0) {
    const defaultStrat = {
      id: 'strat_csi300_mom_vol',
      user_id: userId,
      name: '沪深300动量低波复合增强策略',
      description: '结合60日动量筛选与20日低波动防御权重，每周五动态调仓。',
      market: 'CN',
      universe: 'CSI300',
      dsl_json: JSON.stringify({
        name: '沪深300动量低波复合增强策略',
        universe: { type: 'index', symbol: 'CSI300' },
        factors: [
          { id: 'MOM_60', weight: 0.6, direction: 'positive' },
          { id: 'VOL_20', weight: 0.4, direction: 'negative' },
        ],
        topN: 10,
        rebalance: 'weekly',
        weighting: 'equal',
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    d1Client.insertRecord('strategies', defaultStrat);
    strategies = [defaultStrat];
  }
  res.json(strategies);
});

// 7. Backtesting Engine
apiRouter.post('/backtests', async (req: Request, res: Response) => {
  const { userId, role } = getUserContext(req);

  const quotaCheck = await UsageQuotaService.checkBacktestQuota(userId, role);
  if (!quotaCheck.allowed) {
    res.status(429).json({ error: quotaCheck.reason });
    return;
  }

  const dslValidation = StrategyValidator.validate(req.body.dsl || req.body);
  if (!dslValidation.success) {
    res.status(400).json({ error: dslValidation.error });
    return;
  }

  try {
    const result = await BacktestEngine.runSimulation({
      userId,
      strategyDsl: dslValidation.data!,
      startDate: req.body.startDate || '2024-01-01',
      endDate: req.body.endDate || '2024-12-31',
      initialCapital: req.body.initialCapital || 1000000,
    });

    await UsageQuotaService.recordBacktestUsage(userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: `回测计算失败: ${err.message}` });
  }
});

apiRouter.get('/backtests', (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const backtests = d1Client.getTable('backtests').filter((b: any) => b.user_id === userId);
  res.json(backtests);
});

// 8. DeepSeek AI Chat (SSE Stream)
apiRouter.post('/ai/chat', async (req: Request, res: Response) => {
  const { userId, role } = getUserContext(req);
  const quotaCheck = await UsageQuotaService.checkAiQuota(userId, role);

  if (!quotaCheck.allowed) {
    res.status(429).json({ error: quotaCheck.reason });
    return;
  }

  const messages = req.body.messages || [{ role: 'user', content: req.body.prompt || '' }];
  await DeepSeekProxyService.handleChatStream({
    messages,
    userId,
    res,
  });
});

// 9. Document RAG & File Upload
apiRouter.post('/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const ext = req.file.originalname.split('.').pop() || 'txt';
    const doc = await DocumentParserEngine.parseAndIndex({
      userId,
      title: req.file.originalname,
      buffer: req.file.buffer,
      fileType: ext,
    });
    res.json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Paper Trading
apiRouter.get('/paper/account', async (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const data = await PaperTradingService.getAccount(userId);
  res.json(data);
});

apiRouter.post('/paper/order', async (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const { symbol, side, quantity, price } = req.body;
  const result = await PaperTradingService.placeOrder({
    userId,
    symbol,
    side,
    quantity: Number(quantity),
    price: price ? Number(price) : undefined,
  });
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

// 11. Automation Jobs
apiRouter.get('/automation/jobs', (req: Request, res: Response) => {
  const jobs = JobOrchestrator.getJobs();
  res.json(jobs);
});

apiRouter.post('/automation/jobs/:id/run', (req: Request, res: Response) => {
  const result = JobOrchestrator.runJobNow(req.params.id);
  res.json(result);
});
