/**
 * [AETHERQUANT WORKER DEV SERVER]
 * Official Primary Development Server
 * Runs Cloudflare Worker (Hono) gateway on Port 3000 with real Wrangler D1/R2 Platform Proxy.
 */
import { createServer as createHttpServer } from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { getRequestListener } from '@hono/node-server';
import { getPlatformProxy } from 'wrangler';
import workerApp from './worker/src/index';

dotenv.config();

async function startWorkerDevServer() {
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Initialize Wrangler Platform Proxy for true local D1 & R2 bindings
  let platformProxy: any = null;
  try {
    platformProxy = await getPlatformProxy({
      configPath: './worker/wrangler.jsonc',
      persist: { path: './worker/.wrangler/state/v3' },
    });
    console.log('[Wrangler Platform Proxy] Initialized real D1 & R2 local runtime bindings.');
  } catch (err) {
    console.warn('[Wrangler Platform Proxy] Warning: Could not initialize platform proxy, falling back:', err);
  }

  // Create Vite Server in middleware mode
  let vite: any = null;
  if (!isProd) {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
  }

  // Create worker request listener with injected env bindings
  const workerFetchHandler = (req: any, res: any) => {
    // Injected environment bindings from Wrangler runtime + local environment
    const envBindings = {
      ...(platformProxy ? platformProxy.env : {}),
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || platformProxy?.env?.DEEPSEEK_API_KEY || '',
      DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL || platformProxy?.env?.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || platformProxy?.env?.DEEPSEEK_MODEL || 'deepseek-chat',
      QUANT_SERVICE_URL: process.env.QUANT_SERVICE_URL || '',
      QUANT_SERVICE_TOKEN: process.env.QUANT_SERVICE_TOKEN || '',
      APP_ORIGIN: process.env.APP_ORIGIN || '',
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '',
    };

    const requestListener = getRequestListener(
      (request: Request) => workerApp.fetch(request, envBindings, {} as any)
    );

    return requestListener(req, res);
  };

  const server = createHttpServer((req, res) => {
    const url = req.url || '/';

    // Route /api/* exclusively to Cloudflare Worker (Hono) gateway
    if (url.startsWith('/api/') || url === '/api') {
      res.setHeader('X-Gateway-Engine', 'Cloudflare-Worker-Hono');
      return workerFetchHandler(req, res);
    }

    // Serve Frontend Assets via Vite in Dev, or Static Dist in Prod
    if (vite) {
      return vite.middlewares(req, res);
    } else {
      // Production static fallback
      const distPath = path.join(process.cwd(), 'dist');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>AetherQuant Production Build</h1>');
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[AetherQuant Primary Dev] Worker Hono Gateway listening on http://0.0.0.0:${PORT}`);
    console.log(`[AetherQuant Primary Dev] Mode: ${process.env.VITE_APP_MODE || 'real'}`);
  });
}

startWorkerDevServer().catch((err) => {
  console.error('Failed to start Worker Dev Server:', err);
  process.exit(1);
});
