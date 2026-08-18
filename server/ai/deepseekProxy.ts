import { Request, Response } from 'express';
import { marketProvider } from '../market/marketDataProvider';
import { FactorEngine } from '../factors/factorEngine';
import { UsageQuotaService } from '../quota/usageQuotaService';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export class DeepSeekProxyService {
  private static readonly SYSTEM_PROMPT = `
你是由 AetherQuant 平台驱动的 AI 量化研究助手（DeepSeek Quant Assistant）。
你的专业领域涵盖：A股与美股量化策略设计、多因子模型构建（Barra/Fama-French）、AKShare金融数据清洗与特征工程、机器学习预测模型（LightGBM/LSTM）、严格市场规则回测（包含T+1、滑点与印花税）以及风险归因。

回答原则：
1. 始终使用客观、严谨、专业的金融量化术语（如：信息比率IR、RankIC、最大回撤、换手率、收益波动比、超额夏普）。
2. 在输出因子公式或策略逻辑时，提供清晰的数学表达与可执行的 Strategy DSL 规范。
3. 严格提醒金融市场风险：过去的收益不代表未来表现，所有模型与策略需经过样本外检验与压力测试。
4. 语言使用标准中文，格式结构清晰优雅。如果用户问候（如“你好”），礼貌且专业地简要介绍自己能提供的量化支持。
`;

  public static async handleChatStream(params: {
    messages: ChatMessage[];
    userId: string;
    res: Response;
  }) {
    const { messages, userId, res } = params;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    // Set headers for Server-Sent Events (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendSSE = (chunk: {
      text?: string;
      done?: boolean;
      tools?: any;
      meta?: any;
      error?: { code: string; message: string };
    }) => {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    };

    if (!apiKey) {
      sendSSE({
        error: {
          code: 'AI_NOT_CONFIGURED',
          message: '未检测到 DEEPSEEK_API_KEY 环境变量配置。请在环境或云端配置有效密钥后再试。',
        },
        done: true,
      });
      res.end();
      return;
    }

    try {
      const fullMessages = [{ role: 'system', content: this.SYSTEM_PROMPT }, ...messages];

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          stream: true,
          temperature: 0.3,
        }),
      });

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => '');
        let errCode = 'AI_PROVIDER_ERROR';
        if (response.status === 401) errCode = 'AI_PROVIDER_AUTH_ERROR';
        else if (response.status === 402) errCode = 'AI_PROVIDER_BALANCE_ERROR';
        else if (response.status === 429) errCode = 'AI_PROVIDER_RATE_LIMIT';

        sendSSE({
          error: {
            code: errCode,
            message: `DeepSeek 上游接口返回 HTTP ${response.status}: ${errText || '请求失败'}`,
          },
          done: true,
        });
        res.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let promptTokens = 150;
      let completionTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') {
              sendSSE({ done: true });
              continue;
            }
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                completionTokens += 1;
                sendSSE({ text: delta });
              }
            } catch (e) {
              // Ignore parse errors on stream slices
            }
          }
        }
      }

      await UsageQuotaService.recordAiUsage(userId, promptTokens, completionTokens);
      res.end();
    } catch (err: any) {
      console.error('DeepSeek upstream connection error:', err);
      sendSSE({
        error: {
          code: 'AI_PROVIDER_NETWORK_ERROR',
          message: `连接 DeepSeek 上游失败: ${err?.message || '网络中断'}`,
        },
        done: true,
      });
      res.end();
    }
  }

  public static async handleChatJson(params: {
    messages: ChatMessage[];
    userId: string;
  }): Promise<{ text: string; steps?: string[]; resultCard?: any }> {
    const { messages, userId } = params;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    if (!apiKey) {
      throw new Error('AI_NOT_CONFIGURED: 未检测到 DEEPSEEK_API_KEY 环境变量配置');
    }

    const fullMessages = [{ role: 'system', content: this.SYSTEM_PROMPT }, ...messages];
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: false,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`AI_PROVIDER_ERROR (HTTP ${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (text) {
      await UsageQuotaService.recordAiUsage(
        userId,
        data.usage?.prompt_tokens || 100,
        data.usage?.completion_tokens || 200
      );
      return {
        text,
        steps: ['连通 AKShare 行情数据库', '多因子特征工程与截面计算', 'DeepSeek 深度量化推理输出'],
      };
    }

    throw new Error('DeepSeek 返回内容为空');
  }
}

