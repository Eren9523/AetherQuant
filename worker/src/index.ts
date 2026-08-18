/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import type { ApiErrorResponse, ApiSuccessResponse } from './types/api';

export type Bindings = {
  DB: D1Database;
  DATA_BUCKET: R2Bucket;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  QUANT_SERVICE_URL?: string;
  QUANT_SERVICE_TOKEN?: string;
  APP_ORIGIN?: string;
  ALLOWED_ORIGINS?: string;
  ASSETS?: Fetcher;
};

export type Variables = {
  requestId: string;
  authenticatedUserId?: string;
  userRole?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Unified Origin Resolution Service for CORS & CSRF
 */
export function isAllowedOrigin(origin: string | undefined | null, env: Bindings): boolean {
  if (!origin) return false;

  const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  // 1. Configured exact APP_ORIGIN (e.g. production site)
  if (env.APP_ORIGIN && origin === env.APP_ORIGIN.trim()) {
    return true;
  }

  // 2. Configured ALLOWED_ORIGINS comma-separated list
  if (env.ALLOWED_ORIGINS) {
    const list = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
    if (list.includes(origin)) {
      return true;
    }
  }

  // 3. Local development origins
  if (defaultAllowedOrigins.includes(origin)) {
    return true;
  }

  // 4. Recognized Cloud Run Preview and Cloudflare Pages/Workers domains
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    if (
      host.endsWith('.run.app') ||
      host.endsWith('.workers.dev') ||
      host.endsWith('.pages.dev') ||
      host === 'localhost' ||
      host === '127.0.0.1'
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

// 1. Global Request ID Middleware
app.use('*', async (c, next) => {
  const reqId = c.req.header('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  c.set('requestId', reqId);
  c.header('X-Request-Id', reqId);
  await next();
});

// 2. Strict CORS Middleware
app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  
  if (origin && isAllowedOrigin(origin, c.env)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-Id, Sec-Fetch-Site');
  }

  if (c.req.method.toUpperCase() === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  await next();
});

// 3. Strict CSRF Middleware for state-mutating requests (POST, PUT, PATCH, DELETE)
app.use('*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const secFetchSite = c.req.header('sec-fetch-site');
    // Layer 1: Block explicit cross-site fetch
    if (secFetchSite === 'cross-site') {
      const errorResp: ApiErrorResponse = {
        success: false,
        error: {
          code: 'CSRF_BLOCKED',
          message: 'Cross-site request blocked by CSRF policy',
        },
        request_id: c.get('requestId'),
      };
      return c.json(errorResp, 403);
    }

    // Layer 2: Validate Origin against strict whitelist if Origin header is present
    const origin = c.req.header('origin');
    if (origin && !isAllowedOrigin(origin, c.env)) {
      const errorResp: ApiErrorResponse = {
        success: false,
        error: {
          code: 'CSRF_ORIGIN_DENIED',
          message: 'Request origin not allowed by security policy',
        },
        request_id: c.get('requestId'),
      };
      return c.json(errorResp, 403);
    }
  }
  await next();
});

// 4. Global Unified Error Handler
app.onError((err, c) => {
  const reqId = c.get('requestId') || 'unknown';
  console.error(`[Worker Error][${reqId}]`, err);
  const errorResp: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected internal error occurred',
    },
    request_id: reqId,
  };
  return c.json(errorResp, 500);
});

// 5. Global Unified 404 Handler
app.notFound((c) => {
  const reqId = c.get('requestId') || 'unknown';
  const errorResp: ApiErrorResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${c.req.method} ${c.req.path} was not found on this Worker gateway.`,
    },
    request_id: reqId,
  };
  return c.json(errorResp, 404);
});

// ===================================================================
// Standard V1 Endpoints
// ===================================================================

// Health Check Endpoint
app.get('/api/v1/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      service: 'aetherquant-worker',
      gateway: 'Cloudflare Worker (Hono)',
      timestamp: new Date().toISOString(),
    },
    request_id: c.get('requestId'),
  });
});

app.get('/api/health', (c) => {
  return c.json({
    success: true,
    data: {
      status: 'ok',
      service: 'aetherquant-worker',
      gateway: 'Cloudflare Worker (Hono)',
      timestamp: new Date().toISOString(),
    },
    request_id: c.get('requestId'),
  });
});

// System Status Endpoint (Strict truthfulness - no pseudo-healthy labels)
app.get('/api/v1/system/status', async (c) => {
  const reqId = c.get('requestId');
  const d1Configured = Boolean(c.env.DB);
  const r2Configured = Boolean(c.env.DATA_BUCKET);
  const deepseekConfigured = Boolean(c.env.DEEPSEEK_API_KEY);
  const quantConfigured = Boolean(c.env.QUANT_SERVICE_URL);

  let d1Status: 'healthy' | 'error' | 'unconfigured' = 'unconfigured';
  if (d1Configured) {
    try {
      await c.env.DB.prepare('SELECT 1').first();
      d1Status = 'healthy';
    } catch {
      d1Status = 'error';
    }
  }

  const resData: ApiSuccessResponse = {
    success: true,
    data: {
      gateway: 'healthy',
      d1: d1Status,
      r2: r2Configured ? 'configured' : 'unconfigured',
      deepseek: deepseekConfigured ? 'configured' : 'unconfigured',
      quant: quantConfigured ? 'configured' : 'unconfigured',
      timestamp: new Date().toISOString(),
    },
    request_id: reqId,
  };
  return c.json(resData);
});

// Real DeepSeek Chat with Standard AetherQuant SSE Transformation
app.post('/api/v1/ai/chat', async (c) => {
  const reqId = c.get('requestId');
  const apiKey = c.env.DEEPSEEK_API_KEY;
  const baseUrl = c.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = c.env.DEEPSEEK_MODEL || 'deepseek-chat';

  if (!apiKey) {
    const errResp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'AI_NOT_CONFIGURED',
        message: '未检测到 DEEPSEEK_API_KEY 配置，请在系统设置或环境变量中配置有效密钥。',
      },
      request_id: reqId,
    };
    return c.json(errResp, 400);
  }

  const body = await c.req.json<{
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    stream?: boolean;
  }>().catch(() => ({ prompt: '', messages: [], stream: false }));

  const messages = body.messages && body.messages.length > 0
    ? body.messages
    : [{ role: 'user', content: body.prompt || '' }];

  const isStream = body.stream !== false;

  try {
    const upstreamRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: isStream,
        temperature: 0.3,
      }),
    });

    if (!upstreamRes.ok) {
      const errRaw = await upstreamRes.text().catch(() => '');
      console.error(`[DeepSeek Upstream Error][${reqId}] status=${upstreamRes.status} raw=${errRaw}`);

      let errCode = 'AI_PROVIDER_ERROR';
      let safeMessage = 'DeepSeek 上游服务响应异常';

      if (upstreamRes.status === 401) {
        errCode = 'AI_PROVIDER_AUTH_ERROR';
        safeMessage = 'DeepSeek API Key 无效或未授权，请检查密钥配置';
      } else if (upstreamRes.status === 402) {
        errCode = 'AI_PROVIDER_BALANCE_ERROR';
        safeMessage = 'DeepSeek 账户余额不足，请充值后重试';
      } else if (upstreamRes.status === 429) {
        errCode = 'AI_PROVIDER_RATE_LIMIT';
        safeMessage = 'DeepSeek 调用频率超限，请稍后重试';
      }

      const errResp: ApiErrorResponse = {
        success: false,
        error: {
          code: errCode,
          message: safeMessage,
        },
        request_id: reqId,
      };
      return c.json(errResp, upstreamRes.status as any);
    }

    // Stream Mode: Transform Provider SSE into AetherQuant Event Contract
    if (isStream && upstreamRes.body) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Background stream transformer
      (async () => {
        const reader = upstreamRes.body!.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let hasEmittedChunk = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;

              const dataStr = trimmed.slice(6).trim();
              if (dataStr === '[DONE]') continue;

              try {
                const parsed = JSON.parse(dataStr);
                const deltaContent = parsed.choices?.[0]?.delta?.content;
                if (deltaContent) {
                  hasEmittedChunk = true;
                  const payload = JSON.stringify({ type: 'delta', text: deltaContent });
                  await writer.write(encoder.encode(`data: ${payload}\n\n`));
                }
              } catch {
                // Ignore malformed partial chunks from upstream
              }
            }
          }

          // Emit AetherQuant Done Event
          const donePayload = JSON.stringify({
            type: 'done',
            meta: {
              provider: 'deepseek',
              model,
              request_id: reqId,
              has_content: hasEmittedChunk,
            },
          });
          await writer.write(encoder.encode(`data: ${donePayload}\n\n`));
        } catch (streamErr: any) {
          console.error(`[Stream Transform Error][${reqId}]`, streamErr);
          const errorPayload = JSON.stringify({
            type: 'error',
            error: {
              code: 'AI_STREAM_INTERRUPTED',
              message: 'DeepSeek 数据流传输异常中断',
            },
          });
          await writer.write(encoder.encode(`data: ${errorPayload}\n\n`));
        } finally {
          await writer.close().catch(() => {});
        }
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Request-Id': reqId,
        },
      });
    }

    // Non-Stream Mode
    const data: any = await upstreamRes.json();
    const textContent = data.choices?.[0]?.message?.content || '';

    return c.json({
      success: true,
      data: {
        text: textContent,
        usage: data.usage || null,
        model,
      },
      request_id: reqId,
    });
  } catch (err: any) {
    console.error(`[DeepSeek Connection Error][${reqId}]`, err);
    const errResp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'AI_PROVIDER_NETWORK_ERROR',
        message: '无法连接到 DeepSeek 远程服务，请检查服务器网络与出站连接。',
      },
      request_id: reqId,
    };
    return c.json(errResp, 502);
  }
});

export default app;
