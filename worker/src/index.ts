/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ApiErrorResponse, ApiSuccessResponse } from './types/api';

export type Bindings = {
  DB: D1Database;
  DATA_BUCKET: R2Bucket;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  QUANT_SERVICE_URL?: string;
  QUANT_SERVICE_TOKEN?: string;
  ASSETS?: Fetcher;
};

export type Variables = {
  requestId: string;
  authenticatedUserId?: string;
  userRole?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 1. Global Request ID Middleware
app.use('*', async (c, next) => {
  const reqId = c.req.header('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  c.set('requestId', reqId);
  c.header('X-Request-Id', reqId);
  await next();
});

// 2. Global CORS Middleware
app.use('*', cors({
  origin: (origin) => {
    // Allow local development and same-origin / cloudflare deployed origins
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('.run.app') || origin.includes('.workers.dev') || origin.includes('.pages.dev')) {
      return origin || '*';
    }
    return origin;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'Sec-Fetch-Site'],
  credentials: true,
}));

// 3. Strict CSRF Middleware for state-mutating requests (POST, PUT, PATCH, DELETE)
app.use('*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const secFetchSite = c.req.header('sec-fetch-site');
    // Block direct untrusted cross-site state mutations if Sec-Fetch-Site is cross-site
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

// System Status Endpoint (Detects D1, R2, DeepSeek & Quant Service health without leaking secrets)
app.get('/api/v1/system/status', async (c) => {
  const reqId = c.get('requestId');
  const d1Configured = Boolean(c.env.DB);
  const r2Configured = Boolean(c.env.DATA_BUCKET);
  const deepseekConfigured = Boolean(c.env.DEEPSEEK_API_KEY);
  const quantConfigured = Boolean(c.env.QUANT_SERVICE_URL);

  let d1Status = d1Configured ? 'connected' : 'unconfigured';
  if (d1Configured) {
    try {
      await c.env.DB.prepare('SELECT 1').first();
    } catch {
      d1Status = 'error';
    }
  }

  const resData: ApiSuccessResponse = {
    success: true,
    data: {
      gateway: 'healthy',
      d1: d1Status,
      r2: r2Configured ? 'connected' : 'unconfigured',
      deepseek: deepseekConfigured ? 'configured' : 'unconfigured',
      quant_service: quantConfigured ? 'configured' : 'unconfigured',
      timestamp: new Date().toISOString(),
    },
    request_id: reqId,
  };
  return c.json(resData);
});

// Real DeepSeek Chat (Strict Production Pipeline - Zero Silent Mock Fallback)
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
        message: 'DeepSeek API key is not configured in server environment (DEEPSEEK_API_KEY missing).',
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
      const errText = await upstreamRes.text().catch(() => '');
      let errCode = 'AI_PROVIDER_ERROR';
      if (upstreamRes.status === 401) errCode = 'AI_PROVIDER_AUTH_ERROR';
      else if (upstreamRes.status === 402) errCode = 'AI_PROVIDER_BALANCE_ERROR';
      else if (upstreamRes.status === 429) errCode = 'AI_PROVIDER_RATE_LIMIT';

      const errResp: ApiErrorResponse = {
        success: false,
        error: {
          code: errCode,
          message: `DeepSeek API returned HTTP ${upstreamRes.status}: ${errText || 'Upstream request failed'}`,
        },
        request_id: reqId,
      };
      return c.json(errResp, upstreamRes.status as any);
    }

    if (isStream && upstreamRes.body) {
      // Forward ReadableStream directly to browser with SSE headers
      return new Response(upstreamRes.body, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Request-Id': reqId,
        },
      });
    }

    const data: any = await upstreamRes.json();
    return c.json({
      success: true,
      data: {
        text: data.choices?.[0]?.message?.content || '',
        usage: data.usage || null,
        model,
      },
      request_id: reqId,
    });
  } catch (err: any) {
    const errResp: ApiErrorResponse = {
      success: false,
      error: {
        code: 'AI_PROVIDER_NETWORK_ERROR',
        message: `Failed to connect to DeepSeek API: ${err?.message || 'Network error'}`,
      },
      request_id: reqId,
    };
    return c.json(errResp, 502);
  }
});

export default app;
