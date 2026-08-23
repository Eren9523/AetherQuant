/**
 * P7.0.1 Verification Suite: AKShare Pre-Deploy Hardening & Security Guards
 */
import workerApp, { isAllowedOrigin } from '../worker/src/index';
import { MarketService } from '../src/services/quantServices';
import { ApiError } from '../src/services/apiClient';
import { RUNTIME_CONFIG } from '../src/config/runtimeConfig';

async function runP7HardeningVerification() {
  console.log('====================================================');
  console.log('Starting P7.0.1 AKShare Pre-Deploy Hardening Verification');
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
  // Test J: Strict Origin Resolution (No Platform Wildcards)
  // ----------------------------------------------------
  {
    const mockEnv: any = {
      APP_ORIGIN: 'https://penguinquant.com',
      ALLOWED_ORIGINS: 'https://preview.penguinquant.com,https://ais-preview-exact.run.app',
    };

    const evilWorkers = isAllowedOrigin('https://evil.workers.dev', mockEnv);
    const evilPages = isAllowedOrigin('https://evil.pages.dev', mockEnv);
    const evilRunApp = isAllowedOrigin('https://evil-subdomain.run.app', mockEnv);
    const evilGoogle = isAllowedOrigin('https://evil.google.com', mockEnv);
    const evilGoogleUser = isAllowedOrigin('https://evil.googleusercontent.com', mockEnv);

    const validAppOrigin = isAllowedOrigin('https://penguinquant.com', mockEnv);
    const validAllowedOrigin = isAllowedOrigin('https://preview.penguinquant.com', mockEnv);
    const validExactRunApp = isAllowedOrigin('https://ais-preview-exact.run.app', mockEnv);
    const validLocalhost = isAllowedOrigin('http://localhost:3000', mockEnv);

    assert(
      !evilWorkers && !evilPages && !evilRunApp && !evilGoogle && !evilGoogleUser,
      'Test J1: Strict isAllowedOrigin blocks platform wildcards (*.workers.dev, *.pages.dev, *.run.app, *.google.com)',
      `evilWorkers=${evilWorkers}, evilPages=${evilPages}, evilRunApp=${evilRunApp}`
    );

    assert(
      validAppOrigin && validAllowedOrigin && validExactRunApp && validLocalhost,
      'Test J2: Strict isAllowedOrigin permits exact APP_ORIGIN, ALLOWED_ORIGINS, and localhost',
      `appOrigin=${validAppOrigin}, allowedOrigin=${validAllowedOrigin}, exactRunApp=${validExactRunApp}, localhost=${validLocalhost}`
    );
  }

  // ----------------------------------------------------
  // Test I: Worker Quant Service Secret & URL Guard
  // ----------------------------------------------------
  {
    // 1. Missing QUANT_SERVICE_TOKEN
    const mockEnvMissingToken: any = {
      QUANT_SERVICE_URL: 'http://127.0.0.1:8000',
      QUANT_SERVICE_TOKEN: '', // Missing
    };

    const reqSpot = new Request('http://localhost/api/v1/market/cn/spot', { method: 'GET' });
    const resSpot = await workerApp.fetch(reqSpot, mockEnvMissingToken);
    const dataSpot: any = await resSpot.json();

    assert(
      resSpot.status === 503 && dataSpot.error?.code === 'QUANT_SERVICE_NOT_CONFIGURED',
      'Test I1: Worker /api/v1/market/cn/spot returns 503 QUANT_SERVICE_NOT_CONFIGURED when QUANT_SERVICE_TOKEN is missing',
      `status=${resSpot.status}, code=${dataSpot.error?.code}`
    );

    // 2. Missing QUANT_SERVICE_URL
    const mockEnvMissingUrl: any = {
      QUANT_SERVICE_URL: '',
      QUANT_SERVICE_TOKEN: 'secret_token',
    };

    const reqHist = new Request('http://localhost/api/v1/market/cn/stocks/600519/history', { method: 'GET' });
    const resHist = await workerApp.fetch(reqHist, mockEnvMissingUrl);
    const dataHist: any = await resHist.json();

    assert(
      resHist.status === 503 && dataHist.error?.code === 'QUANT_SERVICE_NOT_CONFIGURED',
      'Test I2: Worker /api/v1/market/cn/stocks/:symbol/history returns 503 QUANT_SERVICE_NOT_CONFIGURED when QUANT_SERVICE_URL is missing',
      `status=${resHist.status}, code=${dataHist.error?.code}`
    );
  }

  // ----------------------------------------------------
  // Test D: Real Mode getStocks('ALL') & getStocks('US') -> No Mock US Leakage
  // ----------------------------------------------------
  {
    // Verify in Real Mode
    const originalMode = RUNTIME_CONFIG.isRealMode;
    (RUNTIME_CONFIG as any).isRealMode = true;

    let allThrewNotImplemented = false;
    let allErrorCode = '';
    try {
      await MarketService.getStocks('ALL');
    } catch (e: any) {
      allThrewNotImplemented = true;
      allErrorCode = e.code;
    }

    let usThrewNotImplemented = false;
    let usErrorCode = '';
    try {
      await MarketService.getStocks('US');
    } catch (e: any) {
      usThrewNotImplemented = true;
      usErrorCode = e.code;
    }

    assert(
      allThrewNotImplemented && allErrorCode === 'MARKET_NOT_IMPLEMENTED',
      'Test D1: Real Mode MarketService.getStocks("ALL") throws MARKET_NOT_IMPLEMENTED without leaking mock US stocks',
      `threw=${allThrewNotImplemented}, code=${allErrorCode}`
    );

    assert(
      usThrewNotImplemented && usErrorCode === 'MARKET_NOT_IMPLEMENTED',
      'Test D2: Real Mode MarketService.getStocks("US") throws MARKET_NOT_IMPLEMENTED',
      `threw=${usThrewNotImplemented}, code=${usErrorCode}`
    );

    (RUNTIME_CONFIG as any).isRealMode = originalMode;
  }

  // ----------------------------------------------------
  // Test E: Real Mode Invalid Symbol -> INVALID_SYMBOL (No 600519 Fallback)
  // ----------------------------------------------------
  {
    const originalMode = RUNTIME_CONFIG.isRealMode;
    (RUNTIME_CONFIG as any).isRealMode = true;

    let detailThrewInvalid = false;
    let detailCode = '';
    try {
      await MarketService.getStockDetail('INVALID_NON_6_DIGIT');
    } catch (e: any) {
      detailThrewInvalid = true;
      detailCode = e.code;
    }

    let klineThrewInvalid = false;
    let klineCode = '';
    try {
      await MarketService.getKLines('INVALID_NON_6_DIGIT');
    } catch (e: any) {
      klineThrewInvalid = true;
      klineCode = e.code;
    }

    assert(
      detailThrewInvalid && detailCode === 'INVALID_SYMBOL',
      'Test E1: Real Mode MarketService.getStockDetail with invalid symbol throws INVALID_SYMBOL (Never fallback to 600519)',
      `threw=${detailThrewInvalid}, code=${detailCode}`
    );

    assert(
      klineThrewInvalid && klineCode === 'INVALID_SYMBOL',
      'Test E2: Real Mode MarketService.getKLines with invalid symbol throws INVALID_SYMBOL (Never fallback to 600519)',
      `threw=${klineThrewInvalid}, code=${klineCode}`
    );

    (RUNTIME_CONFIG as any).isRealMode = originalMode;
  }

  // ----------------------------------------------------
  // Test F: Real Mode getIndices -> MARKET_INDEX_NOT_IMPLEMENTED (No 000001 Stock Misuse)
  // ----------------------------------------------------
  {
    const originalMode = RUNTIME_CONFIG.isRealMode;
    (RUNTIME_CONFIG as any).isRealMode = true;

    let indexThrewNotImplemented = false;
    let indexCode = '';
    try {
      await MarketService.getIndices();
    } catch (e: any) {
      indexThrewNotImplemented = true;
      indexCode = e.code;
    }

    assert(
      indexThrewNotImplemented && indexCode === 'MARKET_INDEX_NOT_IMPLEMENTED',
      'Test F: Real Mode MarketService.getIndices throws MARKET_INDEX_NOT_IMPLEMENTED without misusing 000001 stock spot data',
      `threw=${indexThrewNotImplemented}, code=${indexCode}`
    );

    (RUNTIME_CONFIG as any).isRealMode = originalMode;
  }

  console.log('\n====================================================');
  console.log(`P7.0.1 Verification Results: Passed: ${passed}, Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runP7HardeningVerification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
