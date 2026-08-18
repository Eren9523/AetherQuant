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
import { ResearchHistoryService } from '../ai/researchHistoryService';
import { PromptRecommendationService, DailyPromptGenerationJob } from '../ai/promptService';

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

// 8. DeepSeek AI Chat (SSE Stream & JSON Mode)
apiRouter.post('/ai/chat', async (req: Request, res: Response) => {
  const { userId, role } = getUserContext(req);
  const quotaCheck = await UsageQuotaService.checkAiQuota(userId, role);

  if (!quotaCheck.allowed) {
    res.status(429).json({ error: quotaCheck.reason });
    return;
  }

  const messages = req.body.messages || [{ role: 'user', content: req.body.prompt || '' }];
  const wantsJson = req.body.stream === false || (req.headers.accept === 'application/json' && req.body.stream !== true);

  if (wantsJson) {
    try {
      const result = await DeepSeekProxyService.handleChatJson({
        messages,
        userId,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'AI request failed' });
    }
  } else {
    await DeepSeekProxyService.handleChatStream({
      messages,
      userId,
      res,
    });
  }
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

// ==========================================
// 12. V1 Research Persistent History APIs
// ==========================================

const handleGetThreads = (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const search = req.query.q as string;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const threads = ResearchHistoryService.getUserThreads({
    userId,
    search,
    limit,
  });

  res.json({ count: threads.length, threads });
};

const handlePostThreads = (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const { id, title, activeSymbol, marketContext } = req.body;

  const threadId = id || `thread_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const thread = ResearchHistoryService.createOrUpdateThread({
    threadId,
    userId,
    title,
    activeSymbol,
    marketContext,
  });

  res.json({ success: true, thread });
};

const handleGetThreadDetail = (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const threadId = req.params.id;

  const { thread, messages } = ResearchHistoryService.getThreadDetail(threadId, userId);
  if (!thread) {
    res.status(404).json({ error: 'Research thread not found' });
    return;
  }

  res.json({ thread, messages });
};

const handleGetThreadMessages = (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const threadId = req.params.id;

  const { thread, messages } = ResearchHistoryService.getThreadDetail(threadId, userId);
  if (!thread) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }

  res.json({ threadId, count: messages.length, messages });
};

const handlePatchThread = (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const threadId = req.params.id;
  const { title, pinned, archived } = req.body;

  const updates: any = {};
  if (typeof title === 'string') updates.title = title;
  if (typeof pinned === 'boolean') updates.pinned = pinned;
  if (typeof archived === 'boolean') updates.archived = archived;
  updates.updated_at = new Date().toISOString();

  const success = ResearchHistoryService.updateThread(threadId, updates);
  res.json({ success, threadId });
};

const handleDeleteThread = (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const threadId = req.params.id;

  const success = ResearchHistoryService.softDeleteThread(threadId, userId);
  res.json({ success, threadId });
};

const handlePostThreadMessages = async (req: Request, res: Response) => {
  const { userId, role } = getUserContext(req);
  const threadId = req.params.id;
  const { content, activeSymbol, role: msgRole } = req.body;

  if (!content && msgRole !== 'assistant') {
    res.status(400).json({ error: 'Message content required' });
    return;
  }

  // 1. Ensure thread exists or create it
  ResearchHistoryService.createOrUpdateThread({
    threadId,
    userId,
    activeSymbol,
  });

  // 2. Persist message to DB
  const savedMsg = ResearchHistoryService.appendMessage({
    threadId,
    userId,
    role: msgRole === 'assistant' ? 'assistant' : 'user',
    content: content || '',
    status: 'completed',
  });

  res.json({ success: true, message: savedMsg });
};

// Route registrations (support with or without /v1 prefix on router)
apiRouter.get('/v1/research/threads', handleGetThreads);
apiRouter.get('/research/threads', handleGetThreads);

apiRouter.post('/v1/research/threads', handlePostThreads);
apiRouter.post('/research/threads', handlePostThreads);

apiRouter.get('/v1/research/threads/:id', handleGetThreadDetail);
apiRouter.get('/research/threads/:id', handleGetThreadDetail);

apiRouter.get('/v1/research/threads/:id/messages', handleGetThreadMessages);
apiRouter.get('/research/threads/:id/messages', handleGetThreadMessages);

apiRouter.patch('/v1/research/threads/:id', handlePatchThread);
apiRouter.patch('/research/threads/:id', handlePatchThread);

apiRouter.delete('/v1/research/threads/:id', handleDeleteThread);
apiRouter.delete('/research/threads/:id', handleDeleteThread);

apiRouter.post('/v1/research/threads/:id/messages', handlePostThreadMessages);
apiRouter.post('/research/threads/:id/messages', handlePostThreadMessages);

// ==========================================
// 13. Dynamic Prompt Recommendation APIs
// ==========================================

// Get 6 recommended prompt cards for UI without invoking DeepSeek directly
apiRouter.get('/v1/research/prompts', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 6;
  const market = req.query.market as string;
  const activeSymbol = req.query.active_symbol as string;
  const seed = req.query.seed ? Number(req.query.seed) : undefined;

  const prompts = PromptRecommendationService.getPromptsForUser({
    limit,
    market,
    activeSymbol,
    seed,
  });

  res.json({ count: prompts.length, prompts });
});

// Admin trigger for daily DeepSeek prompt generation job
apiRouter.post('/v1/admin/research/prompts/regenerate', async (req: Request, res: Response) => {
  const overrideDate = req.body.date as string;
  const result = await DailyPromptGenerationJob.runJob(overrideDate);
  res.json(result);
});

// 12. Persistent Chat History (Cloudflare D1 + R2 Dual Engine)
apiRouter.get('/history/sessions', (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  let sessions = d1Client.getTable('ai_sessions').filter((s: any) => s.user_id === userId);

  // Default initial session if empty
  if (sessions.length === 0) {
    const defaultSession = {
      id: 'session_init_001',
      user_id: userId,
      title: '沪深300低波动动量策略筛选',
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      messages_json: JSON.stringify([
        {
          id: 'welcome-msg',
          sender: 'assistant',
          content: `你好！我是 AetherQuant AI 金融量化研究助手。你可以用自然语言发起多因子选股、行情归因诊股、财报拆解与量化策略回测。例如：“从沪深300中筛选60日动量排名前20%且波动率较低的股票”`,
          steps: ['已连通 A股/美股实时行情图谱', '挂载 AKShare / SEC EDGAR 数据源', '加载 60+ 经典 Alpha 因子表'],
        },
      ]),
    };
    d1Client.insertRecord('ai_sessions', defaultSession);
    // Backup to R2 Storage for safety
    r2Client.saveObject(`history/${userId}/${defaultSession.id}.json`, Buffer.from(defaultSession.messages_json, 'utf-8'), {
      ownerId: userId,
      category: 'documents',
      isPermanent: true,
    });
    sessions = [defaultSession];
  }

  // Sort descending by updated_at
  sessions.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  res.json(sessions);
});

apiRouter.get('/history/sessions/:id', async (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const sessionId = req.params.id;

  // 1. Try fetching from D1
  const session = d1Client.getTable('ai_sessions').find((s: any) => s.id === sessionId && s.user_id === userId);
  if (session && session.messages_json) {
    try {
      const messages = JSON.parse(session.messages_json);
      res.json({ session, messages });
      return;
    } catch (e) {}
  }

  // 2. Fallback attempt from R2 Storage
  const r2Buffer = await r2Client.getObject(`history/${userId}/${sessionId}.json`);
  if (r2Buffer) {
    try {
      const messages = JSON.parse(r2Buffer.toString());
      res.json({ session: session || { id: sessionId, title: '历史会话记录' }, messages });
      return;
    } catch (e) {}
  }

  res.status(404).json({ error: 'Session not found' });
});

apiRouter.post('/history/sessions', async (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const { id, title, messages } = req.body;

  if (!id || !Array.isArray(messages)) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const messagesJson = JSON.stringify(messages);
  const existing = d1Client.getTable('ai_sessions').find((s: any) => s.id === id);

  if (existing) {
    d1Client.updateRecord('ai_sessions', id, {
      title: title || existing.title,
      messages_json: messagesJson,
      updated_at: new Date().toISOString(),
    });
  } else {
    d1Client.insertRecord('ai_sessions', {
      id,
      user_id: userId,
      title: title || '新量化研究',
      messages_json: messagesJson,
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Save/Update backup to R2 object storage for true R2 database persistence
  try {
    await r2Client.saveObject(`history/${userId}/${id}.json`, Buffer.from(messagesJson, 'utf-8'), {
      ownerId: userId,
      category: 'documents',
      contentType: 'application/json',
    });
  } catch (e) {
    console.warn('Failed to save session backup to R2:', e);
  }

  res.json({ success: true, sessionId: id });
});

apiRouter.patch('/history/sessions/:id/pin', async (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const sessionId = req.params.id;
  const { pinned } = req.body;

  const session = d1Client.getTable('ai_sessions').find((s: any) => s.id === sessionId && s.user_id === userId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  d1Client.updateRecord('ai_sessions', sessionId, {
    pinned: Boolean(pinned),
    updated_at: new Date().toISOString(),
  });

  res.json({ success: true, sessionId, pinned: Boolean(pinned) });
});

apiRouter.patch('/history/sessions/:id/rename', async (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const sessionId = req.params.id;
  const { title } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const session = d1Client.getTable('ai_sessions').find((s: any) => s.id === sessionId && s.user_id === userId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  d1Client.updateRecord('ai_sessions', sessionId, {
    title,
    updated_at: new Date().toISOString(),
  });

  res.json({ success: true, sessionId, title });
});

apiRouter.delete('/history/sessions/:id', async (req: Request, res: Response) => {
  const { userId } = getUserContext(req);
  const sessionId = req.params.id;

  d1Client.deleteRecord('ai_sessions', sessionId);
  try {
    await r2Client.deleteObject(`history/${userId}/${sessionId}.json`);
  } catch (e) {}

  res.json({ success: true, sessionId });
});

// 13. Daily Rolling Fresh Prompts Discovery API (/api/v1/research/prompts)
apiRouter.get('/v1/research/prompts', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 6;
  const market = req.query.market as string;
  const activeSymbol = req.query.activeSymbol as string;
  const seed = req.query.seed ? parseInt(req.query.seed as string, 10) : undefined;

  // Draws purely from D1 3-Day Rolling Pool + Stable Templates (NO DEEPSEEK CALL)
  const prompts = PromptRecommendationService.getPromptsForUser({
    limit,
    market,
    activeSymbol,
    seed,
  });

  res.json({
    count: prompts.length,
    prompts,
  });
});

// Admin endpoint: Trigger daily prompt generation & 3-day expiration cleanup
apiRouter.post('/v1/admin/research/prompts/generate-daily', async (req: Request, res: Response) => {
  try {
    const result = await DailyPromptGenerationJob.runJob();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to generate daily prompts' });
  }
});

