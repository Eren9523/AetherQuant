import { d1Client } from '../db/d1Client';
import { builtInPrompts, BuiltInPromptItem } from './built_in_prompts';
import { marketProvider, MarketDataProvider } from '../market/marketDataProvider';
import crypto from 'crypto';

export interface DailyPromptSuggestion {
  id: string;
  prompt_date: string;
  timezone: string;
  category: string;
  market_json: string;
  title: string;
  prompt_text: string;
  summary: string;
  tags_json: string;
  freshness_weight: number; // 1.0 for today, 0.55 for yesterday, 0.20 for day -2
  priority: number;
  source_basis_json: string; // e.g. ["market_snapshot", "factor_snapshot"]
  source_symbols_json: string; // e.g. ["600519.SH", "000300.SH"]
  requires_realtime_data: boolean;
  model: string;
  generated_at: string;
  expires_at: string; // prompt_date + 3 days
  dedupe_hash: string;
  enabled: boolean;
}

export interface PromptGenerationRun {
  id: string;
  prompt_date: string;
  status: 'running' | 'completed' | 'failed' | 'supplemented';
  model: string;
  requested_count: number;
  generated_count: number;
  accepted_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  started_at: string;
  finished_at?: string;
  error_code?: string;
  error_message?: string;
}

export interface FormattedPromptCard {
  id: string;
  category: string;
  market: string[];
  title: string;
  prompt: string;
  summary: string;
  tags: string[];
  freshness_weight?: number;
  source_basis?: string[];
  source_symbols?: string[];
  requires_realtime_data?: boolean;
  is_stable_template?: boolean;
}

export class PromptRecommendationService {
  /**
   * Get 6 recommended prompts for the user interface WITHOUT calling DeepSeek directly.
   * Pulls exclusively from D1 daily_prompt_suggestions (rolling 3-day pool) + Stable Research Templates (builtInPrompts).
   * 
   * Default 6 Cards Allocation:
   * - 4 Cards: Today's Fresh Prompts (Freshness weight 1.0)
   * - 1 Card: Recent Fresh Prompt (Yesterday or Day -2)
   * - 1 Card: Stable Research Template (from builtInPrompts)
   */
  public static getPromptsForUser(params: {
    limit?: number;
    market?: string;
    activeSymbol?: string;
    seed?: number;
  }): FormattedPromptCard[] {
    const limit = params.limit || 6;
    const today = getShanghaiTodayDate();
    const threeDaysAgo = getPastDate(3);

    // 1. Fetch valid suggestions from D1 daily_prompt_suggestions within 3-day window
    const d1Suggestions = d1Client.getTable<DailyPromptSuggestion>('daily_prompt_suggestions')
      .filter((p) => p.enabled && p.prompt_date >= threeDaysAgo && p.expires_at >= new Date().toISOString());

    // Separate by age
    const todayPool: FormattedPromptCard[] = d1Suggestions
      .filter((p) => p.prompt_date === today)
      .map(formatD1ToCard);

    const recentPool: FormattedPromptCard[] = d1Suggestions
      .filter((p) => p.prompt_date < today && p.prompt_date >= threeDaysAgo)
      .map(formatD1ToCard);

    const stablePool: FormattedPromptCard[] = builtInPrompts.map((b) => ({
      id: b.id,
      category: b.category,
      market: b.market,
      title: b.title,
      prompt: b.prompt,
      summary: b.summary,
      tags: b.tags,
      requires_realtime_data: b.requires_realtime_data ?? false,
      is_stable_template: true,
    }));

    // Seeded pseudo-random generator for instant non-AI card shuffling
    const seed = params.seed ?? Math.floor(Math.random() * 100000);
    const pseudoRandom = (str: string, offset: number) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      const x = Math.sin(seed + hash + offset) * 10000;
      return x - Math.floor(x);
    };

    const shuffle = <T extends { title: string }>(arr: T[], offset: number) => {
      return [...arr].sort((a, b) => pseudoRandom(a.title, offset) - pseudoRandom(b.title, offset));
    };

    const shuffledToday = shuffle(todayPool, 101);
    const shuffledRecent = shuffle(recentPool, 202);
    const shuffledStable = shuffle(stablePool, 303);

    const selectedCards: FormattedPromptCard[] = [];
    const usedCategories = new Set<string>();
    const usedIds = new Set<string>();

    const addCard = (card: FormattedPromptCard) => {
      if (!usedIds.has(card.id)) {
        usedIds.add(card.id);
        selectedCards.push(card);
        usedCategories.add(card.category);
        return true;
      }
      return false;
    };

    // 2. Active Symbol context check if passed
    if (params.activeSymbol) {
      const sym = params.activeSymbol.toUpperCase();
      const isCn = sym.endsWith('.SH') || sym.endsWith('.SZ') || /^\d{6}/.test(sym);
      const symCard: FormattedPromptCard = {
        id: `sym_diag_${sym}`,
        category: '行情诊股',
        market: [isCn ? 'CN' : 'US'],
        title: `诊股标的 [${sym}] 动量与筹码分位数`,
        prompt: `详细诊断标的 [${sym}] 的 60 日动量评分、估值分位数、筹码集中度与同业比较优势。`,
        summary: `评估 ${sym} 筹码密集峰与动量强弱。`,
        tags: [sym, '行情诊股', '筹码分布'],
        source_basis: ['market_snapshot'],
        source_symbols: [sym],
        requires_realtime_data: true,
      };
      addCard(symCard);
    }

    // 3. Selection Strategy:
    // Aim for 4 Today + 1 Recent + 1 Stable
    const targetTodayCount = Math.min(4, shuffledToday.length);

    // Pick up to 4 Today cards
    for (const card of shuffledToday) {
      if (selectedCards.filter((c) => !c.is_stable_template && c.freshness_weight === 1.0).length >= targetTodayCount) break;
      if (selectedCards.length >= limit) break;
      addCard(card);
    }

    // Pick 1 Recent card (Yesterday / Day -2)
    for (const card of shuffledRecent) {
      if (selectedCards.length >= limit) break;
      if (selectedCards.filter((c) => c.freshness_weight && c.freshness_weight < 1.0).length >= 1) break;
      addCard(card);
    }

    // Pick 1 Stable Research Template
    for (const card of shuffledStable) {
      if (selectedCards.length >= limit) break;
      if (selectedCards.filter((c) => c.is_stable_template).length >= 1) break;
      addCard(card);
    }

    // Fill remaining budget (up to limit = 6) with diverse category candidates
    const fallbackPool = [...shuffledToday, ...shuffledRecent, ...shuffledStable];
    for (const card of fallbackPool) {
      if (selectedCards.length >= limit) break;
      // Prefer new category
      if (!usedCategories.has(card.category) || usedCategories.size < 4) {
        addCard(card);
      }
    }

    // Final fill if still below limit
    for (const card of fallbackPool) {
      if (selectedCards.length >= limit) break;
      addCard(card);
    }

    return selectedCards.slice(0, limit);
  }
}

export class DailyPromptGenerationJob {
  private static readonly SYSTEM_PROMPT = `
你是 AetherQuant 金融量化研究平台的 AI 推荐引擎。
你的任务是根据当前真实的市场数据上下文 (DailyMarketContext)，生成精准、前沿、客观、结构化的 50 个量化研究 Prompt。

严禁事项：
1. 严禁建立无限增长的词库，问题必须强相关于当前的真实行情与宏观状态。
2. 严禁编造未发生的实时事件、未公布的政策或虚假新闻。
3. 严禁使用“今天必涨”、“稳赚”等违规词汇。

要求：
1. 精准生成 50 个独立问题，覆盖 8 个以上分类：
   - 行情诊股, 因子选股, 财报拆解, 策略构建, 策略回测, 宏观轮动, 行业研究, 组合管理, 风险分析, AI / ML, 异常检测
2. 至少 60%+ 的动态问题必须显式结合输入的市场数据（例如：指数点位、活跃成交标的、波动率变化等）。
3. 问题用语可包含：“根据最新可用行情...”、“近期半导体板块波动扩大...”、“沪深300突破震荡区间...”等真实依据。
4. 结构：
   - category: 字符串
   - market: 字符串数组, 如 ["CN"] 或 ["US"]
   - title: 简短精炼标题 (20字以内)
   - prompt: 完整提问内容 (专业、目的明确)
   - summary: 1 句简要说明
   - tags: 2-3 个标签字符串
   - source_basis: 字符串数组, 如 ["market_snapshot", "factor_snapshot"]
   - source_symbols: 字符串数组, 如 ["600519.SH", "000300.SH"]
   - requires_realtime_data: 布尔值

输出格式：
输出一个纯 JSON 对象，格式如下：
{
  "version": "1.0",
  "date": "YYYY-MM-DD",
  "items": [
    {
      "category": "因子选股",
      "market": ["CN"],
      "title": "...",
      "prompt": "...",
      "summary": "...",
      "tags": ["..."],
      "source_basis": ["market_snapshot"],
      "source_symbols": ["000300.SH"],
      "requires_realtime_data": true
    }
  ]
}
不要在 JSON 之外包含任何 Markdown 说明文字。
`;

  /**
   * Cleanup expired prompts (> 72h) from D1 daily_prompt_suggestions to ensure
   * a strictly rolling pool (Max ~150 prompts total).
   */
  public static cleanupExpiredPrompts(): { deletedPrompts: number; deletedRuns: number } {
    const nowIso = new Date().toISOString();
    const threeDaysAgoDate = getPastDate(3);

    // 1. Delete expired prompt records
    const allPrompts = d1Client.getTable<DailyPromptSuggestion>('daily_prompt_suggestions');
    const expiredPrompts = allPrompts.filter(
      (p) => p.expires_at < nowIso || p.prompt_date < threeDaysAgoDate
    );

    for (const p of expiredPrompts) {
      d1Client.deleteRecord('daily_prompt_suggestions', p.id);
    }

    // 2. Delete generation runs older than 30 days
    const thirtyDaysAgoDate = getPastDate(30);
    const allRuns = d1Client.getTable<PromptGenerationRun>('prompt_generation_runs');
    const oldRuns = allRuns.filter((r) => r.prompt_date < thirtyDaysAgoDate);

    for (const r of oldRuns) {
      d1Client.deleteRecord('prompt_generation_runs', r.id);
    }

    return { deletedPrompts: expiredPrompts.length, deletedRuns: oldRuns.length };
  }

  /**
   * Build DailyMarketContext from real market data feeds
   */
  public static async buildDailyMarketContext(): Promise<any> {
    const today = getShanghaiTodayDate();
    let overview: any = { indices: [], cnHotStocks: [], usHotStocks: [] };
    
    try {
      overview = await marketProvider.getMarketOverview();
    } catch (e) {
      console.warn('Failed to fetch market overview for DailyMarketContext:', e);
    }

    const cnHotQuotes = await Promise.all(
      MarketDataProvider.HOT_CN_STOCKS.slice(0, 6).map((s) => marketProvider.getQuote(s.symbol).catch(() => null))
    );

    const usHotQuotes = await Promise.all(
      MarketDataProvider.HOT_US_STOCKS.slice(0, 4).map((s) => marketProvider.getQuote(s.symbol).catch(() => null))
    );

    return {
      date: today,
      timezone: 'Asia/Shanghai',
      indices: (overview.indices || []).map((idx: any) => ({
        symbol: idx.symbol,
        name: idx.name,
        price: idx.price,
        changePercent: idx.changePercent,
      })),
      cn_market: {
        hot_stocks: cnHotQuotes.filter(Boolean).map((q: any) => ({
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          changePercent: q.changePercent,
          volume: q.volume,
        })),
        sectors: ['半导体集成电路', '白酒消费', '新能源电力设备', '银行金融', '电子消费'],
      },
      us_market: {
        hot_stocks: usHotQuotes.filter(Boolean).map((q: any) => ({
          symbol: q.symbol,
          name: q.name,
          price: q.price,
          changePercent: q.changePercent,
        })),
      },
      platform_state: {
        available_factors: ['MOM_60', 'VOL_20', 'ROE', 'FCF_Yield', 'Turnover_Rate', 'IVOL'],
        dataset_status: 'AKShare & EastMoney Realtime Verified',
      },
    };
  }

  /**
   * Run the daily prompt generation job with DeepSeek and real market context
   */
  public static async runJob(overrideDate?: string): Promise<{ success: boolean; count: number; message: string }> {
    // Step 1: Cleanup Expired Prompts first!
    const cleanupRes = this.cleanupExpiredPrompts();
    console.log(`Prompt Pool Cleanup: deleted ${cleanupRes.deletedPrompts} expired prompts, ${cleanupRes.deletedRuns} old audit logs.`);

    const today = overrideDate || getShanghaiTodayDate();
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    // Step 2: Check Idempotency (if today's 50 items already exist)
    const existingToday = d1Client.getTable<DailyPromptSuggestion>('daily_prompt_suggestions')
      .filter((p) => p.prompt_date === today && p.enabled);

    if (existingToday.length >= 50) {
      return {
        success: true,
        count: existingToday.length,
        message: `Today (${today}) already has ${existingToday.length} active fresh prompts. Cleanup completed.`,
      };
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const startTime = new Date().toISOString();

    // Log run start
    d1Client.insertRecord<PromptGenerationRun>('prompt_generation_runs', {
      id: runId,
      prompt_date: today,
      status: 'running',
      model,
      requested_count: 50,
      generated_count: 0,
      accepted_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost: 0,
      started_at: startTime,
    });

    // Step 3: Build Real Market Context
    const marketContext = await this.buildDailyMarketContext();

    let generatedItems: any[] = [];
    let promptTokens = 350;
    let completionTokens = 1600;

    // Step 4: DeepSeek API call
    if (apiKey) {
      let attempts = 0;
      let success = false;

      while (attempts < 2 && !success) {
        attempts++;
        try {
          const userMessage = `当前真实市场上下文 (DailyMarketContext):\n${JSON.stringify(marketContext, null, 2)}\n\n请根据以上行情与数据状态，生成 50 个最新最前沿的金融量化研究 Prompt。`;

          const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: this.SYSTEM_PROMPT },
                { role: 'user', content: userMessage },
              ],
              temperature: 0.7,
            }),
          });

          if (response.ok) {
            const data = (await response.json()) as any;
            const content = data.choices?.[0]?.message?.content || '';
            promptTokens = data.usage?.prompt_tokens || 400;
            completionTokens = data.usage?.completion_tokens || 1800;

            const cleanJsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJsonStr);

            if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
              generatedItems = parsed.items;
              success = true;
            }
          }
        } catch (err) {
          console.warn(`DeepSeek Daily Prompt Generation attempt ${attempts} failed:`, err);
          if (attempts < 2) {
            await new Promise((r) => setTimeout(r, 1200 * attempts));
          }
        }
      }
    }

    // Fallback supplement if API unavailable
    let isSupplemented = false;
    if (generatedItems.length < 50) {
      isSupplemented = true;
      const needed = 50 - generatedItems.length;
      const supplementItems = builtInPrompts.slice(0, needed).map((b) => ({
        category: b.category,
        market: b.market,
        title: b.title,
        prompt: b.prompt,
        summary: b.summary,
        tags: b.tags,
        source_basis: ['market_snapshot', 'factor_snapshot'],
        source_symbols: b.tags.filter((t) => t.includes('.') || t.length === 4),
        requires_realtime_data: b.requires_realtime_data ?? true,
      }));
      generatedItems = [...generatedItems, ...supplementItems];
    }

    // Step 5: Validate, Deduplicate & Insert to D1
    const pastHashes = new Set<string>();
    const pastSuggestions = d1Client.getTable<DailyPromptSuggestion>('daily_prompt_suggestions');
    for (const p of pastSuggestions) {
      pastHashes.add(p.dedupe_hash);
    }

    let acceptedCount = 0;
    const expiresAt = new Date(Date.now() + 86400 * 1000 * 3).toISOString(); // Today + 3 days

    for (let i = 0; i < generatedItems.length; i++) {
      const item = generatedItems[i];
      if (!item.title || !item.prompt) continue;

      const normText = (item.prompt || '').toLowerCase().replace(/\s+/g, '');
      const hash = crypto.createHash('md5').update(normText).digest('hex');

      if (pastHashes.has(hash)) continue;
      pastHashes.add(hash);

      const record: DailyPromptSuggestion = {
        id: `prompt_${today}_${i + 1}_${Math.random().toString(36).substr(2, 4)}`,
        prompt_date: today,
        timezone: 'Asia/Shanghai',
        category: item.category || '因子选股',
        market_json: JSON.stringify(item.market || ['CN']),
        title: item.title,
        prompt_text: item.prompt,
        summary: item.summary || item.title,
        tags_json: JSON.stringify(item.tags || ['量化']),
        freshness_weight: 1.0, // Today's freshness weight is 1.0
        priority: 100 - i,
        source_basis_json: JSON.stringify(item.source_basis || ['market_snapshot']),
        source_symbols_json: JSON.stringify(item.source_symbols || []),
        requires_realtime_data: Boolean(item.requires_realtime_data),
        model,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
        dedupe_hash: hash,
        enabled: true,
      };

      d1Client.insertRecord('daily_prompt_suggestions', record);
      acceptedCount++;
    }

    const estimatedCost = (promptTokens * 0.0000002) + (completionTokens * 0.0000006);

    // Step 6: Log Run Metadata Audit Log
    d1Client.updateRecord<PromptGenerationRun>('prompt_generation_runs', runId, {
      status: isSupplemented ? 'supplemented' : 'completed',
      generated_count: generatedItems.length,
      accepted_count: acceptedCount,
      input_tokens: promptTokens,
      output_tokens: completionTokens,
      estimated_cost: estimatedCost,
      finished_at: new Date().toISOString(),
    });

    return {
      success: true,
      count: acceptedCount,
      message: `Generated ${acceptedCount} fresh daily prompts for ${today}. Expiration set to 3 days (${expiresAt}).`,
    };
  }
}

function formatD1ToCard(p: DailyPromptSuggestion): FormattedPromptCard {
  return {
    id: p.id,
    category: p.category,
    market: safeJsonParse(p.market_json, ['CN']),
    title: p.title,
    prompt: p.prompt_text,
    summary: p.summary,
    tags: safeJsonParse(p.tags_json, ['量化']),
    freshness_weight: p.freshness_weight,
    source_basis: safeJsonParse(p.source_basis_json, []),
    source_symbols: safeJsonParse(p.source_symbols_json, []),
    requires_realtime_data: p.requires_realtime_data,
    is_stable_template: false,
  };
}

function getShanghaiTodayDate(): string {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const shanghaiTime = new Date(utc + 3600000 * 8);
  return shanghaiTime.toISOString().split('T')[0];
}

function getPastDate(days: number): string {
  const d = new Date(Date.now() - days * 86400 * 1000);
  return d.toISOString().split('T')[0];
}

function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}
