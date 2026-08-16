/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
  DB: D1Database;
  DATA_BUCKET: R2Bucket;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  ASSETS?: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// Global CORS Middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// 1. Health Check Endpoint
app.get('/api/v1/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'aetherquant',
    frontend: 'static-assets',
    worker: 'online',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// Root API Health fallback
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'aetherquant',
    frontend: 'static-assets',
    worker: 'online',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// 2. D1 Database Verification Endpoint
// TODO: Secure before production Beta (e.g. restrict to Admin or remove)
app.get('/api/v1/test/d1', async (c) => {
  try {
    const db = c.env.DB;
    if (!db) {
      return c.json(
        {
          status: 'error',
          database: 'disconnected',
          message: 'D1 binding (DB) is not configured',
        },
        500
      );
    }

    const row = await db
      .prepare('SELECT value FROM system_settings WHERE key = ?')
      .bind('system_name')
      .first<{ value: string }>();

    if (!row) {
      return c.json(
        {
          status: 'ok',
          database: 'connected',
          value: null,
          message: 'system_settings record not found, please apply migrations',
        },
        200
      );
    }

    return c.json({
      status: 'ok',
      database: 'connected',
      value: row.value,
    });
  } catch (err: any) {
    return c.json(
      {
        status: 'error',
        database: 'failed',
        message: err?.message || 'Failed to query D1 database',
      },
      500
    );
  }
});

// 3. R2 Storage Verification Endpoint
// Fixed test object: system/infrastructure-test.txt to avoid unbounded object creations
// TODO: Secure before production Beta (e.g. restrict to Admin or remove)
app.get('/api/v1/test/r2', async (c) => {
  try {
    const bucket = c.env.DATA_BUCKET;
    if (!bucket) {
      return c.json(
        {
          status: 'error',
          bucket: 'disconnected',
          message: 'R2 binding (DATA_BUCKET) is not configured',
        },
        500
      );
    }

    const testKey = 'system/infrastructure-test.txt';
    const existing = await bucket.head(testKey);

    if (!existing) {
      await bucket.put(testKey, 'Hello from AetherQuant', {
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: { createdBy: 'infrastructure-test' },
      });
    }

    const object = await bucket.get(testKey);
    if (!object) {
      return c.json(
        {
          status: 'error',
          bucket: 'failed',
          message: 'Unable to retrieve test object from R2',
        },
        500
      );
    }

    return c.json({
      status: 'ok',
      bucket: 'connected',
      test_object: testKey,
    });
  } catch (err: any) {
    return c.json(
      {
        status: 'error',
        bucket: 'failed',
        message: err?.message || 'Failed to access R2 bucket',
      },
      500
    );
  }
});

export default app;
