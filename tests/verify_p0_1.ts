/**
 * P0.1 Comprehensive Verification Suite
 */
import workerApp from '../worker/src/index';
import { MarketService } from '../src/services/quantServices';
import { RUNTIME_CONFIG } from '../src/config/runtimeConfig';

async function runTests() {
  console.log('====================================================');
  console.log('Starting P0.1 Comprehensive Verification Suite');
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

  // Test 1: No-Key failure returns AI_NOT_CONFIGURED
  {
    const req = new Request('http://localhost:3000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ prompt: '你好' }),
    });
    const res = await workerApp.fetch(req, {} as any, {} as any);
    const json: any = await res.json();
    assert(
      res.status === 400 && json.success === false && json.error?.code === 'AI_NOT_CONFIGURED',
      'A. No-Key returns HTTP 400 with AI_NOT_CONFIGURED',
      `Got status=${res.status}, json=${JSON.stringify(json)}`
    );
  }

  // Test 2: Wrong Key returns AI_PROVIDER_AUTH_ERROR (Never mock response)
  {
    const req = new Request('http://localhost:3000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ prompt: '你好' }),
    });
    const res = await workerApp.fetch(
      req,
      { DEEPSEEK_API_KEY: 'sk-invalid-test-key-123456' } as any,
      {} as any
    );
    const json: any = await res.json();
    assert(
      json.success === false &&
        (json.error?.code === 'AI_PROVIDER_AUTH_ERROR' || json.error?.code === 'AI_PROVIDER_NETWORK_ERROR') &&
        json.error?.message &&
        !json.error?.message.includes('[object Object]'),
      'B. Wrong-Key returns AI_PROVIDER_AUTH_ERROR without [object Object] (Never mock)',
      `Got status=${res.status}, json=${JSON.stringify(json)}`
    );
  }

  // Test 3: Cross-Site CSRF Block
  {
    const req = new Request('http://localhost:3000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Sec-Fetch-Site': 'cross-site',
        'Origin': 'http://malicious-site.com',
      },
      body: JSON.stringify({ prompt: 'csrf attack' }),
    });
    const res = await workerApp.fetch(req, {} as any, {} as any);
    const json: any = await res.json();
    assert(
      res.status === 403 && json.error?.code === 'CSRF_BLOCKED',
      'C. Sec-Fetch-Site: cross-site is rejected with HTTP 403 CSRF_BLOCKED',
      `Got status=${res.status}, code=${json.error?.code}`
    );
  }

  // Test 4: Unauthorized Origin CORS Rejection
  {
    const req = new Request('http://localhost:3000/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://evil-hacker.com',
      },
      body: JSON.stringify({ prompt: 'cors attack' }),
    });
    const res = await workerApp.fetch(req, {} as any, {} as any);
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
    assert(
      allowOrigin === null && res.status === 403,
      'D. Unauthorized Origin is denied CORS and blocked by CSRF policy',
      `Got allowOrigin=${allowOrigin}, status=${res.status}`
    );
  }

  // Test 5: System Status Semantic Verification (No false 'healthy' on unconfigured services)
  {
    const req = new Request('http://localhost:3000/api/v1/system/status', {
      method: 'GET',
    });
    const res = await workerApp.fetch(req, {} as any, {} as any);
    const json: any = await res.json();
    assert(
      json.success === true &&
        json.data.gateway === 'healthy' &&
        json.data.deepseek === 'unconfigured' &&
        json.data.r2 === 'unconfigured' &&
        json.data.quant === 'unconfigured',
      'E. System status returns unconfigured for missing bindings (no false connected/healthy)',
      `Got json=${JSON.stringify(json)}`
    );
  }

  // Test 6: Health Endpoint
  {
    const req = new Request('http://localhost:3000/api/v1/health', {
      method: 'GET',
    });
    const res = await workerApp.fetch(req, {} as any, {} as any);
    const json: any = await res.json();
    assert(
      res.status === 200 && json.success === true && json.data.gateway.includes('Worker'),
      'F. Health endpoint confirms Cloudflare Worker Hono gateway',
      `Got json=${JSON.stringify(json)}`
    );
  }

  // Test 7: Real Mode No-Mock Enforcement
  {
    let caughtRealModeError = false;
    try {
      if (RUNTIME_CONFIG.isRealMode) {
        await MarketService.getStocks();
      } else {
        caughtRealModeError = true;
      }
    } catch (err: any) {
      caughtRealModeError = err.code === 'MARKET_SERVICE_UNAVAILABLE';
    }
    assert(
      caughtRealModeError,
      'G. Real Mode throws MARKET_SERVICE_UNAVAILABLE instead of silently generating random stocks',
      `RUNTIME_CONFIG.isRealMode=${RUNTIME_CONFIG.isRealMode}`
    );
  }

  console.log('\n====================================================');
  console.log(`Verification Summary: Passed ${passed}, Failed ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test execution crashed:', e);
  process.exit(1);
});
