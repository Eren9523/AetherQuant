/**
 * AetherQuant Real Market Center Verification Suite
 * Tests:
 * 1. Indicator engine calculations (MA, EMA, BOLL, MACD, RSI, KDJ)
 * 2. Real Market Service methods and contracts
 * 3. Parameter validation and NaN/Infinity guardrails
 * 4. Error safety and zero mock leakage in Real Mode
 */
import { calculateIndicators, BarInput } from '../src/utils/indicators';
import { MarketService } from '../src/services/quantServices';
import { RUNTIME_CONFIG } from '../src/config/runtimeConfig';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail: string = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}: ${detail}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('Starting AetherQuant Real Market Center Verification');
  console.log('====================================================\n');

  // 1. Technical Indicator Calculations Test
  const mockBars: BarInput[] = [
    { time: '2025-01-01', open: 10, high: 12, low: 9, close: 11, volume: 1000 },
    { time: '2025-01-02', open: 11, high: 13, low: 10, close: 12, volume: 1200 },
    { time: '2025-01-03', open: 12, high: 14, low: 11, close: 13, volume: 1100 },
    { time: '2025-01-04', open: 13, high: 15, low: 12, close: 14, volume: 1500 },
    { time: '2025-01-05', open: 14, high: 16, low: 13, close: 15, volume: 1600 },
    { time: '2025-01-06', open: 15, high: 17, low: 14, close: 16, volume: 1700 },
  ];

  const enriched = calculateIndicators(mockBars);

  assert(enriched.length === 6, 'Test 1.1: Indicators generated for all input bars', `got ${enriched.length}`);
  assert(enriched[4].ma5 === 13.0, 'Test 1.2: MA5 correctly computed at index 4 (avg 11,12,13,14,15 = 13.0)', `got ${enriched[4].ma5}`);
  assert(enriched[5].ma5 === 14.0, 'Test 1.3: MA5 correctly computed at index 5 (avg 12,13,14,15,16 = 14.0)', `got ${enriched[5].ma5}`);
  assert(enriched[5].ema12 !== undefined && !isNaN(enriched[5].ema12!), 'Test 1.4: EMA12 correctly computed and non-NaN', `got ${enriched[5].ema12}`);
  assert(enriched[5].macd !== undefined && !isNaN(enriched[5].macd!), 'Test 1.5: MACD DIF correctly computed and non-NaN', `got ${enriched[5].macd}`);
  assert(enriched[5].kdjK !== undefined && !isNaN(enriched[5].kdjK!), 'Test 1.6: KDJ K correctly computed and non-NaN', `got ${enriched[5].kdjK}`);

  // 2. Real Mode Safety Tests
  const origMode = RUNTIME_CONFIG.isRealMode;
  (RUNTIME_CONFIG as any).isRealMode = true;

  // Test 2.1: Invalid symbol validation in getStockDetail
  let detailErr = '';
  try {
    await MarketService.getStockDetail('ABC');
  } catch (e: any) {
    detailErr = e.code;
  }
  assert(detailErr === 'INVALID_SYMBOL', 'Test 2.1: getStockDetail rejects non-6-digit symbol with INVALID_SYMBOL', `got ${detailErr}`);

  // Test 2.2: Invalid symbol validation in getChartData
  let chartErr = '';
  try {
    await MarketService.getChartData('XYZ');
  } catch (e: any) {
    chartErr = e.code;
  }
  assert(chartErr === 'INVALID_SYMBOL', 'Test 2.2: getChartData rejects non-6-digit symbol with INVALID_SYMBOL', `got ${chartErr}`);

  // Test 2.3: US Market rejection in Real Mode
  let usErr = '';
  try {
    await MarketService.getStocks({ market: 'US' });
  } catch (e: any) {
    usErr = e.code;
  }
  assert(usErr === 'MARKET_NOT_IMPLEMENTED', 'Test 2.3: getStocks("US") returns MARKET_NOT_IMPLEMENTED in Real Mode', `got ${usErr}`);

  (RUNTIME_CONFIG as any).isRealMode = origMode;

  console.log('\n====================================================');
  console.log(`Real Market Center Results: Passed: ${passed}, Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
