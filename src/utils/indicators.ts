/**
 * Technical Indicator Calculation Utilities
 * Calculates MA, EMA, BOLL, MACD, RSI, KDJ for K-Line Series.
 */
import { KLinePoint } from '../types';

export interface BarInput {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
  changePct?: number;
  turnoverRate?: number;
}

export function calculateIndicators(bars: BarInput[]): KLinePoint[] {
  if (!bars || bars.length === 0) return [];

  const n = bars.length;
  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);

  // 1. Moving Averages (MA)
  const calcMA = (period: number): (number | undefined)[] => {
    const result: (number | undefined)[] = new Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += closes[i];
      if (i >= period) {
        sum -= closes[i - period];
      }
      if (i >= period - 1) {
        result[i] = +(sum / period).toFixed(2);
      } else {
        result[i] = undefined;
      }
    }
    return result;
  };

  const ma5 = calcMA(5);
  const ma10 = calcMA(10);
  const ma20 = calcMA(20);
  const ma60 = calcMA(60);

  // 2. Exponential Moving Average (EMA)
  const calcEMA = (period: number): number[] => {
    const result: number[] = new Array(n);
    const multiplier = 2 / (period + 1);
    let ema = closes[0];
    result[0] = ema;
    for (let i = 1; i < n; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
      result[i] = +ema.toFixed(4);
    }
    return result;
  };

  const ema12 = calcEMA(12);
  const ema26 = calcEMA(26);

  // 3. MACD (12, 26, 9)
  const macdLine: (number | undefined)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    macdLine[i] = +(ema12[i] - ema26[i]).toFixed(4);
  }

  // MACD Signal (9-day EMA of MACD Line)
  const macdSignal: (number | undefined)[] = new Array(n);
  const macdHist: (number | undefined)[] = new Array(n);
  const signalMultiplier = 2 / (9 + 1);
  let signalEma = macdLine[0] || 0;
  macdSignal[0] = signalEma;
  macdHist[0] = +((macdLine[0] || 0) - signalEma).toFixed(4);

  for (let i = 1; i < n; i++) {
    const m = macdLine[i] || 0;
    signalEma = (m - signalEma) * signalMultiplier + signalEma;
    macdSignal[i] = +signalEma.toFixed(4);
    macdHist[i] = +((m - signalEma) * 2).toFixed(4); // Typically multiplied by 2 in Chinese trading software
  }

  // 4. Bollinger Bands (BOLL: 20, 2)
  const bollUpper: (number | undefined)[] = new Array(n);
  const bollMid: (number | undefined)[] = new Array(n);
  const bollLower: (number | undefined)[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i < 19) {
      bollMid[i] = undefined;
      bollUpper[i] = undefined;
      bollLower[i] = undefined;
      continue;
    }
    const slice = closes.slice(i - 19, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / 20;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
    const std = Math.sqrt(variance);
    bollMid[i] = +mean.toFixed(2);
    bollUpper[i] = +(mean + 2 * std).toFixed(2);
    bollLower[i] = +(mean - 2 * std).toFixed(2);
  }

  // 5. RSI (6, 12)
  const calcRSI = (period: number): (number | undefined)[] => {
    const result: (number | undefined)[] = new Array(n);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < n; i++) {
      const diff = closes[i] - closes[i - 1];
      if (i <= period) {
        if (diff > 0) gains += diff;
        else losses -= diff;
        if (i === period) {
          const avgGain = gains / period;
          const avgLoss = losses / period;
          result[i] = avgLoss === 0 ? 100 : +(100 - (100 / (1 + avgGain / avgLoss))).toFixed(2);
        }
      } else {
        const prevAvgGain = ((result[i - 1] === undefined ? gains / period : (result[i - 1]! / 100) * (diff > 0 ? diff : 0.001)));
        // Wilder's smoothing
        const curGain = diff > 0 ? diff : 0;
        const curLoss = diff < 0 ? -diff : 0;
        gains = (gains * (period - 1) + curGain) / period;
        losses = (losses * (period - 1) + curLoss) / period;
        result[i] = losses === 0 ? 100 : +(100 - (100 / (1 + gains / losses))).toFixed(2);
      }
    }
    return result;
  };

  const rsi6 = calcRSI(6);
  const rsi12 = calcRSI(12);

  // 6. KDJ (9, 3, 3)
  const kdjK: (number | undefined)[] = new Array(n);
  const kdjD: (number | undefined)[] = new Array(n);
  const kdjJ: (number | undefined)[] = new Array(n);

  let prevK = 50;
  let prevD = 50;

  for (let i = 0; i < n; i++) {
    const startIdx = Math.max(0, i - 8);
    const windowHighs = highs.slice(startIdx, i + 1);
    const windowLows = lows.slice(startIdx, i + 1);
    const maxHigh = Math.max(...windowHighs);
    const minLow = Math.min(...windowLows);

    let rsv = 50;
    if (maxHigh !== minLow) {
      rsv = ((closes[i] - minLow) / (maxHigh - minLow)) * 100;
    }

    const curK = (2 / 3) * prevK + (1 / 3) * rsv;
    const curD = (2 / 3) * prevD + (1 / 3) * curK;
    const curJ = 3 * curK - 2 * curD;

    prevK = curK;
    prevD = curD;

    kdjK[i] = +curK.toFixed(2);
    kdjD[i] = +curD.toFixed(2);
    kdjJ[i] = +curJ.toFixed(2);
  }

  return bars.map((b, idx) => ({
    time: b.time,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
    turnover: b.turnover,
    changePct: b.changePct,
    turnoverRate: b.turnoverRate,
    ma5: ma5[idx],
    ma10: ma10[idx],
    ma20: ma20[idx],
    ma60: ma60[idx],
    ema12: ema12[idx],
    ema26: ema26[idx],
    bollUpper: bollUpper[idx],
    bollMid: bollMid[idx],
    bollLower: bollLower[idx],
    macd: macdLine[idx],
    macdSignal: macdSignal[idx],
    macdHist: macdHist[idx],
    rsi6: rsi6[idx],
    rsi12: rsi12[idx],
    kdjK: kdjK[idx],
    kdjD: kdjD[idx],
    kdjJ: kdjJ[idx]
  }));
}
