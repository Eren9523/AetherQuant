import { d1Client } from '../db/d1Client';
import { NormalizedBar } from './marketDataProvider';

export interface DataQualityReport {
  id: string;
  datasetId?: string;
  category: string;
  recordsChecked: number;
  missingCount: number;
  duplicateCount: number;
  invalidCount: number;
  qualityScore: number;
  warnings: string[];
  createdAt: string;
}

export class DataQualityEngine {
  public static validateBars(bars: NormalizedBar[], category: string = 'market_kline'): DataQualityReport {
    let missingCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    const warnings: string[] = [];
    const seenDates = new Set<string>();

    for (let i = 0; i < bars.length; i++) {
      const b = bars[i];

      // Missing check
      if (!b.date || isNaN(b.open) || isNaN(b.close) || isNaN(b.high) || isNaN(b.low) || isNaN(b.volume)) {
        missingCount++;
        warnings.push(`Record #${i} contains null or NaN values`);
        continue;
      }

      // Duplicate date check
      if (seenDates.has(b.date)) {
        duplicateCount++;
        warnings.push(`Duplicate timestamp detected: ${b.date}`);
      }
      seenDates.add(b.date);

      // Financial validity logic (Rule 53)
      // high >= max(open, close)
      // low <= min(open, close)
      const maxPrice = Math.max(b.open, b.close);
      const minPrice = Math.min(b.open, b.close);

      if (b.high < maxPrice - 0.0001) {
        invalidCount++;
        warnings.push(`High price ${b.high} lower than max(open, close) ${maxPrice} on ${b.date}`);
      }

      if (b.low > minPrice + 0.0001) {
        invalidCount++;
        warnings.push(`Low price ${b.low} higher than min(open, close) ${minPrice} on ${b.date}`);
      }

      if (b.volume < 0 || (b.amount !== undefined && b.amount < 0)) {
        invalidCount++;
        warnings.push(`Negative volume or amount on ${b.date}`);
      }
    }

    const totalProblems = missingCount + duplicateCount + invalidCount;
    const score = bars.length > 0 ? Math.max(0, Number((100 - (totalProblems / bars.length) * 100).toFixed(1))) : 100;

    const report: DataQualityReport = {
      id: `dqr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      category,
      recordsChecked: bars.length,
      missingCount,
      duplicateCount,
      invalidCount,
      qualityScore: score,
      warnings: warnings.slice(0, 10), // keep top 10
      createdAt: new Date().toISOString(),
    };

    d1Client.insertRecord('data_quality_reports', report);
    return report;
  }
}
