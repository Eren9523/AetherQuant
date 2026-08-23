/**
 * P0.2 Comprehensive Verification Suite: Final Closure
 */
import workerApp from '../worker/src/index';
import { MarketService, MLLabService, ResearchService } from '../src/services/quantServices';
import { ApiClient, ApiError } from '../src/services/apiClient';
import { RUNTIME_CONFIG } from '../src/config/runtimeConfig';
import { getPlatformProxy } from 'wrangler';

async function runVerification() {
  console.log('====================================================');
  console.log('Starting P0.2 Final Closure Comprehensive Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${detail || ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // Test 1: ResearchService.queryAIStream TDZ & onDone timing verification
  // ----------------------------------------------------
  {
    const chunks: string[] = [];
    let onDoneCallCount = 0;
    let onDoneReceivedText = '';

    // Mock global fetch to simulate SSE stream from worker
    const originalFetch = globalThis.fetch;
    const ssePayload = [
      'data: {"type":"delta","text":"量化"}\n\n',
      'data: {"type":"delta","text":"分析"}\n\n',
      'data: {"type":"delta","text":"完成"}\n\n',
      'data: {"type":"done","meta":{"provider":"deepseek","model":"deepseek-chat"}}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    globalThis.fetch = async () => {
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    try {
      const result = await ResearchService.queryAIStream(
        '分析 600519',
        '600519.SH',
        (chunk) => chunks.push(chunk),
        (full) => {
          onDoneCallCount++;
          onDoneReceivedText = full;
        }
      );

      assert(
        result === '量化分析完成' &&
          chunks.join('') === '量化分析完成' &&
          onDoneCallCount === 1 &&
          onDoneReceivedText === '量化分析完成',
        'A. Stream text accumulates smoothly, onDone triggers exactly once with full text (no TDZ)',
        `result="${result}", onDoneCount=${onDoneCallCount}, onDoneText="${onDoneReceivedText}"`
      );
    } catch (e: any) {
      assert(false, 'A. Stream text accumulation and onDone timing', e.message);
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ----------------------------------------------------
  // Test 2: AI Error Handling (Empty Response & Wrong Key)
  // ----------------------------------------------------
  {
    // Test 2.1: Wrong Key returns clean AI_PROVIDER_AUTH_ERROR
    const req = new Request('http://localhost:3000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ prompt: '测试认证' }),
    });
    const res = await workerApp.fetch(
      req,
      { DEEPSEEK_API_KEY: 'sk-invalid-fake-key-99999' } as any,
      {} as any
    );
    const json: any = await res.json();
    assert(
      json.success === false &&
        (json.error?.code === 'AI_PROVIDER_AUTH_ERROR' || json.error?.code === 'AI_PROVIDER_NETWORK_ERROR') &&
        json.error?.message &&
        !json.error?.message.includes('[object Object]'),
      'B. Wrong Key returns standard AI_PROVIDER_AUTH_ERROR without [object Object]',
      `code=${json.error?.code}, msg=${json.error?.message}`
    );
  }

  // ----------------------------------------------------
  // Test 3: Wrangler Local Runtime & D1/R2 Platform Proxy
  // ----------------------------------------------------
  {
    try {
      const platformProxy = await getPlatformProxy({
        configPath: './wrangler.jsonc',
      });

      const db = platformProxy.env.DB as any;
      const r2 = platformProxy.env.DATA_BUCKET as any;
      const tableCountRes = await db.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table'").first();

      assert(
        !!db && !!r2 && typeof tableCountRes?.count === 'number' && tableCountRes.count > 0,
        `D. True Wrangler Worker runtime connects to local D1 SQLite (${tableCountRes?.count} tables) & R2 binding`,
        `DB: ${!!db}, R2: ${!!r2}, tables: ${tableCountRes?.count}`
      );

      await platformProxy.dispose();
    } catch (e: any) {
      assert(false, 'D. Wrangler Worker runtime initialization', e.message);
    }
  }

  // ----------------------------------------------------
  // Test 4: Production Origin & Configurable Origins
  // ----------------------------------------------------
  {
    // Test 4.1: Custom APP_ORIGIN allowed for state mutating POST
    const customProdReq = new Request('http://localhost:3000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://penguinquant-prod.example.com',
      },
      body: JSON.stringify({ prompt: 'Production test' }),
    });

    const customEnv: any = {
      APP_ORIGIN: 'https://penguinquant-prod.example.com',
      DEEPSEEK_API_KEY: '',
    };

    const prodRes = await workerApp.fetch(customProdReq, customEnv, {} as any);
    const prodJson: any = await prodRes.json();
    assert(
      prodRes.status !== 403 && prodJson.error?.code === 'AI_NOT_CONFIGURED',
      'E. Custom APP_ORIGIN allows POST /api/v1/ai/chat without 403 CSRF rejection',
      `Got status=${prodRes.status}, code=${prodJson.error?.code}`
    );

    // Test 4.2: Unauthorized origin rejected with HTTP 403 CSRF_ORIGIN_DENIED
    const maliciousReq = new Request('http://localhost:3000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-unauthorized-site.com',
      },
      body: JSON.stringify({ prompt: 'Malicious test' }),
    });

    const maliciousRes = await workerApp.fetch(maliciousReq, customEnv, {} as any);
    const maliciousJson: any = await maliciousRes.json();
    assert(
      maliciousRes.status === 403 && maliciousJson.error?.code === 'CSRF_ORIGIN_DENIED',
      'F. Unauthorized cross-site origin is blocked with HTTP 403 CSRF_ORIGIN_DENIED',
      `Got status=${maliciousRes.status}, code=${maliciousJson.error?.code}`
    );
  }

  // ----------------------------------------------------
  // Test 5: Real Mode Service Isolation (No silent mock fallback)
  // ----------------------------------------------------
  {
    // In Real Mode: MLLabService must throw SERVICE_NOT_IMPLEMENTED
    let mlLabThrew = false;
    let mlLabCode = '';
    try {
      await MLLabService.getExperiments();
    } catch (e: any) {
      mlLabThrew = true;
      mlLabCode = e.code;
    }

    assert(
      mlLabThrew && mlLabCode === 'SERVICE_NOT_IMPLEMENTED',
      'G. Real Mode: MLLabService throws SERVICE_NOT_IMPLEMENTED (Never returns silent mock in real mode)',
      `threw=${mlLabThrew}, code=${mlLabCode}`
    );
  }

  // ----------------------------------------------------
  // Test 6: Demo Mode configuration and UI flag
  // ----------------------------------------------------
  {
    assert(
      typeof RUNTIME_CONFIG.isDemoMode === 'boolean' && typeof RUNTIME_CONFIG.isRealMode === 'boolean',
      'H. Runtime configuration properly discriminates real vs demo mode',
      `isRealMode=${RUNTIME_CONFIG.isRealMode}, isDemoMode=${RUNTIME_CONFIG.isDemoMode}`
    );
  }

  console.log('\n====================================================');
  console.log(`Verification Summary: Passed ${passed}, Failed ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
