/**
 * [PENGUIN QUANT WORKER DEV SERVER]
 * Convenience Dev Server / Binding Proxy
 * NOT Production Runtime Emulator
 *
 * Runs Cloudflare Worker (Hono) gateway on Port 3000 with local D1/R2 Platform Proxy.
 * For official Workerd integration, use `npm run dev:worker` (wrangler dev).
 */
import { createServer as createHttpServer } from 'http';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { getRequestListener } from '@hono/node-server';
import { getPlatformProxy } from 'wrangler';
import workerApp from './worker/src/index';

dotenv.config();

const MIME_TYPES: Record<string, string> = {
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

async function ensureQuantServiceRunning() {
  try {
    const res = await fetch('http://127.0.0.1:8001/health', { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      console.log('[DevServer] Python Quant Service is already active on 127.0.0.1:8001');
      return;
    }
  } catch {}

  console.log('[DevServer] Launching Python Quant Service on 127.0.0.1:8001...');
  const pythonProc = spawn(
    'python3',
    [
      '-c',
      "import uvicorn, sys, os; sys.path.insert(0, os.path.abspath('quant-service')); uvicorn.run('app.main:app', host='127.0.0.1', port=8001, reload=False)",
    ],
    {
      env: {
        ...process.env,
        QUANT_SERVICE_TOKEN: process.env.QUANT_SERVICE_TOKEN || 'local-dev-quant-token-2026',
      },
      stdio: 'inherit',
      detached: false,
    }
  );

  pythonProc.on('error', (err) => {
    console.error('[DevServer] Could not spawn Python Quant Service:', err);
  });
}

async function applyD1Migrations(db: any) {
  if (!db) return;
  const migrationsDir = path.join(process.cwd(), 'worker', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    try {
      if (typeof db.exec === 'function') {
        await db.exec(sql);
      } else {
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          await db.prepare(stmt).run();
        }
      }
      console.log(`[D1 Migration] Applied ${file} successfully.`);
    } catch (err: any) {
      console.warn(`[D1 Migration] Notice for ${file}:`, err?.message || err);
    }
  }
}

async function startWorkerDevServer() {
  await ensureQuantServiceRunning();
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Initialize Wrangler Platform Proxy for local D1 & R2 bindings (Convenience Binding Proxy)
  let platformProxy: any = null;
  try {
    platformProxy = await getPlatformProxy({
      configPath: './wrangler.jsonc',
    });
    console.log('[Wrangler Platform Proxy] Initialized local D1 & R2 bindings via root wrangler.jsonc.');
    if (platformProxy?.env?.DB) {
      await applyD1Migrations(platformProxy.env.DB);
    }
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
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      QUANT_SERVICE_URL: process.env.QUANT_SERVICE_URL || platformProxy?.env?.QUANT_SERVICE_URL || 'http://127.0.0.1:8001',
      QUANT_SERVICE_TOKEN: process.env.QUANT_SERVICE_TOKEN || platformProxy?.env?.QUANT_SERVICE_TOKEN || 'local-dev-quant-token-2026',
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

    // Serve public static assets (favicons, logos, icons) directly
    const cleanPath = url.split('?')[0];
    const publicFilePath = path.join(process.cwd(), 'public', cleanPath.replace(/^\//, ''));
    if (cleanPath !== '/' && fs.existsSync(publicFilePath) && fs.statSync(publicFilePath).isFile()) {
      const ext = path.extname(publicFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      });
      return fs.createReadStream(publicFilePath).pipe(res);
    }

    // Serve Frontend Assets via Vite in Dev, or Static Dist in Prod
    if (vite) {
      return vite.middlewares(req, res);
    } else {
      // Production static fallback
      const distPath = path.join(process.cwd(), 'dist');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Penguin Quant Production Build</h1>');
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Penguin Quant Primary Dev] Worker Hono Gateway listening on http://0.0.0.0:${PORT}`);
    console.log(`[Penguin Quant Primary Dev] Mode: ${process.env.VITE_APP_MODE || 'real'}`);
  });
}

startWorkerDevServer().catch((err) => {
  console.error('Failed to start Worker Dev Server:', err);
  process.exit(1);
});
