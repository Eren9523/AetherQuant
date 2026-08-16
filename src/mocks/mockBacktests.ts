import { BacktestResult } from '../types';

export const mockBacktestResults: BacktestResult[] = [
  {
    id: 'bt_mom_60_v1',
    strategyName: '沪深300-60日趋势动量增强策略',
    universe: '沪深300 (000300.SH)',
    startDate: '2021-01-01',
    endDate: '2026-01-01',
    totalReturn: 148.3,
    annualizedReturn: 19.8,
    sharpeRatio: 1.34,
    maxDrawdown: -14.2,
    calmarRatio: 1.39,
    winRate: 64.5,
    turnoverRate: 18.2,
    benchmarkReturn: 28.4,
    alpha: 0.145,
    beta: 0.72,
    navHistory: generateNavCurve(148.3, 28.4, -14.2),
    trades: [
      { date: '2025-12-15', symbol: '600519.SH', name: '贵州茅台', action: 'BUY', price: 1420.50, amount: 200 },
      { date: '2025-12-15', symbol: '300750.SZ', name: '宁德时代', action: 'BUY', price: 232.10, amount: 1500 },
      { date: '2025-12-01', symbol: '600036.SH', name: '招商银行', action: 'SELL', price: 32.80, amount: 8000 },
      { date: '2025-11-20', symbol: '002594.SZ', name: '比亚迪', action: 'BUY', price: 254.00, amount: 1000 },
      { date: '2025-11-15', symbol: '002230.SZ', name: '科大讯飞', action: 'SELL', price: 42.50, amount: 3000 },
    ],
  },
  {
    id: 'bt_low_vol_v2',
    strategyName: '低波动稳健红利配置组合',
    universe: '中证500 + 红利指数',
    startDate: '2021-01-01',
    endDate: '2026-01-01',
    totalReturn: 92.4,
    annualizedReturn: 13.9,
    sharpeRatio: 1.58,
    maxDrawdown: -8.8,
    calmarRatio: 1.57,
    winRate: 71.2,
    turnoverRate: 8.5,
    benchmarkReturn: 28.4,
    alpha: 0.112,
    beta: 0.54,
    navHistory: generateNavCurve(92.4, 28.4, -8.8),
    trades: [
      { date: '2025-12-10', symbol: '600036.SH', name: '招商银行', action: 'BUY', price: 33.10, amount: 10000 },
      { date: '2025-12-10', symbol: '600900.SH', name: '长江电力', action: 'BUY', price: 28.40, amount: 12000 },
      { date: '2025-11-01', symbol: '601318.SH', name: '中国平安', action: 'BUY', price: 44.50, amount: 5000 },
    ],
  },
  {
    id: 'bt_ai_multi_v3',
    strategyName: 'AI 深度学习多因子选股 alpha1',
    universe: '全 A 股 (剔除 ST)',
    startDate: '2021-01-01',
    endDate: '2026-01-01',
    totalReturn: 212.6,
    annualizedReturn: 25.6,
    sharpeRatio: 1.72,
    maxDrawdown: -16.5,
    calmarRatio: 1.55,
    winRate: 68.9,
    turnoverRate: 32.4,
    benchmarkReturn: 28.4,
    alpha: 0.208,
    beta: 0.81,
    navHistory: generateNavCurve(212.6, 28.4, -16.5),
    trades: [
      { date: '2025-12-18', symbol: 'NVDA', name: 'NVIDIA', action: 'BUY', price: 122.40, amount: 500 },
      { date: '2025-12-18', symbol: '300059.SZ', name: '东方财富', action: 'BUY', price: 17.10, amount: 20000 },
      { date: '2025-12-05', symbol: 'AAPL', name: 'Apple Inc.', action: 'BUY', price: 218.00, amount: 300 },
    ],
  },
];

function generateNavCurve(
  targetStratGain: number,
  targetBenchGain: number,
  maxDd: number
) {
  const points = 60; // 60 months or periods
  const result = [];
  let strat = 1.0;
  let bench = 1.0;
  let peak = 1.0;

  const stratStep = Math.pow(1 + targetStratGain / 100, 1 / points);
  const benchStep = Math.pow(1 + targetBenchGain / 100, 1 / points);

  const startDate = new Date('2021-01-01');

  for (let i = 0; i <= points; i++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + i);
    const dateStr = d.toISOString().split('T')[0].substring(0, 7);

    // add random noise
    const noiseS = (Math.random() - 0.46) * 0.04;
    const noiseB = (Math.random() - 0.48) * 0.03;

    if (i > 0) {
      strat *= stratStep + noiseS;
      bench *= benchStep + noiseB;
    }

    if (strat > peak) peak = strat;
    const drawdown = ((strat - peak) / peak) * 100;

    result.push({
      date: dateStr,
      strategy: Number(strat.toFixed(3)),
      benchmark: Number(bench.toFixed(3)),
      drawdown: Number(Math.max(drawdown, maxDd).toFixed(2)),
    });
  }

  return result;
}
