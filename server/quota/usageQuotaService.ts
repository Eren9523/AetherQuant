import { d1Client } from '../db/d1Client';
import { r2Client } from '../storage/r2Client';

export interface UserUsageRecord {
  id: string;
  userId: string;
  date: string;
  aiRequests: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  backtestRuns: number;
  uploadBytes: number;
  documentParses: number;
  mlRuns: number;
  createdAt: string;
}

export class UsageQuotaService {
  // Free Tier Policy (Rules 30, 35)
  public static readonly FREE_LIMITS = {
    DAILY_AI_REQUESTS: 3,
    MONTHLY_AI_INPUT_TOKENS: 20000,
    MONTHLY_AI_OUTPUT_TOKENS: 5000,
    DAILY_BACKTESTS: 3,
    MAX_CONCURRENT_BACKTESTS: 1,
    MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
    DAILY_UPLOAD_BYTES: 30 * 1024 * 1024, // 30MB
    PERMANENT_STORAGE_BYTES: 5 * 1024 * 1024, // 5MB
    MAX_STRATEGIES: 20,
    MAX_WATCHLIST_ITEMS: 100,
  };

  // Global System Guard (Rule 34, 36)
  public static readonly GLOBAL_LIMITS = {
    MONTHLY_AI_BUDGET_USD: 50.0,
    ESTIMATED_COST_PER_1K_INPUT: 0.00014, // DeepSeek standard
    ESTIMATED_COST_PER_1K_OUTPUT: 0.00028,
  };

  public static getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  public static async getUserUsage(userId: string, date: string = this.getTodayDateString()): Promise<UserUsageRecord> {
    const list = d1Client.getTable<UserUsageRecord>('usage_daily');
    let record = list.find((r) => r.userId === userId && r.date === date);

    if (!record) {
      record = {
        id: `usage_${userId}_${date}`,
        userId,
        date,
        aiRequests: 0,
        aiInputTokens: 0,
        aiOutputTokens: 0,
        backtestRuns: 0,
        uploadBytes: 0,
        documentParses: 0,
        mlRuns: 0,
        createdAt: new Date().toISOString(),
      };
      d1Client.insertRecord('usage_daily', record);
    }

    return record;
  }

  public static async checkAiQuota(userId: string, role: string = 'free'): Promise<{ allowed: boolean; reason?: string }> {
    if (role === 'guest') {
      return { allowed: false, reason: 'GUEST_RESTRICTED: 游客账号仅支持浏览行情与公开策略，请登录使用 AI 研究功能' };
    }

    if (role === 'admin') {
      return { allowed: true };
    }

    const today = this.getTodayDateString();
    const usage = await this.getUserUsage(userId, today);

    if (usage.aiRequests >= this.FREE_LIMITS.DAILY_AI_REQUESTS) {
      return {
        allowed: false,
        reason: `AI_QUOTA_EXCEEDED: 免费额度每日限 ${this.FREE_LIMITS.DAILY_AI_REQUESTS} 次 AI 研究调用（今日已用 ${usage.aiRequests} 次）`,
      };
    }

    return { allowed: true };
  }

  public static async checkBacktestQuota(userId: string, role: string = 'free'): Promise<{ allowed: boolean; reason?: string }> {
    if (role === 'guest') {
      return { allowed: false, reason: 'GUEST_RESTRICTED: 游客账号无法执行真实回测计算，请登录体验' };
    }

    if (role === 'admin') return { allowed: true };

    const today = this.getTodayDateString();
    const usage = await this.getUserUsage(userId, today);

    if (usage.backtestRuns >= this.FREE_LIMITS.DAILY_BACKTESTS) {
      return {
        allowed: false,
        reason: `BACKTEST_QUOTA_EXCEEDED: 免费用户每日限 ${this.FREE_LIMITS.DAILY_BACKTESTS} 次完整回测（今日已用 ${usage.backtestRuns} 次）`,
      };
    }

    return { allowed: true };
  }

  public static async recordAiUsage(userId: string, promptTokens: number, completionTokens: number) {
    const today = this.getTodayDateString();
    const usage = await this.getUserUsage(userId, today);

    d1Client.updateRecord<UserUsageRecord>('usage_daily', usage.id, {
      aiRequests: (usage.aiRequests || 0) + 1,
      aiInputTokens: (usage.aiInputTokens || 0) + promptTokens,
      aiOutputTokens: (usage.aiOutputTokens || 0) + completionTokens,
    });
  }

  public static async recordBacktestUsage(userId: string) {
    const today = this.getTodayDateString();
    const usage = await this.getUserUsage(userId, today);

    d1Client.updateRecord<UserUsageRecord>('usage_daily', usage.id, {
      backtestRuns: (usage.backtestRuns || 0) + 1,
    });
  }

  public static async getSystemOverview() {
    const storage = await r2Client.getStorageState();
    const today = this.getTodayDateString();
    const usages = d1Client.getTable<UserUsageRecord>('usage_daily');

    const totalAiRequests = usages.reduce((sum, u) => sum + (u.aiRequests || 0), 0);
    const totalInputTokens = usages.reduce((sum, u) => sum + (u.aiInputTokens || 0), 0);
    const totalOutputTokens = usages.reduce((sum, u) => sum + (u.aiOutputTokens || 0), 0);
    const totalBacktests = usages.reduce((sum, u) => sum + (u.backtestRuns || 0), 0);

    const estimatedCostUsd = Number(
      (
        (totalInputTokens / 1000) * this.GLOBAL_LIMITS.ESTIMATED_COST_PER_1K_INPUT +
        (totalOutputTokens / 1000) * this.GLOBAL_LIMITS.ESTIMATED_COST_PER_1K_OUTPUT
      ).toFixed(4)
    );

    return {
      storage,
      today,
      ai: {
        totalRequests: totalAiRequests,
        totalInputTokens,
        totalOutputTokens,
        estimatedCostUsd,
        monthlyBudgetUsd: this.GLOBAL_LIMITS.MONTHLY_AI_BUDGET_USD,
        budgetUsedPercent: Number(((estimatedCostUsd / this.GLOBAL_LIMITS.MONTHLY_AI_BUDGET_USD) * 100).toFixed(2)),
      },
      backtests: {
        totalRuns: totalBacktests,
      },
      rules: {
        isAiEnabled: true,
        isUploadEnabled: storage.state !== 'READ_ONLY',
        isBacktestEnabled: true,
        safeStorageLimitGB: 8,
      },
    };
  }
}
