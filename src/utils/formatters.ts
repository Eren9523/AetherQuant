import { MarketColorMode } from '../types';

export function formatErrorMessage(err: any, fallback = '未知异常'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    if (typeof err.message === 'string' && err.message) return err.message;
    if (typeof err.error === 'string' && err.error) return err.error;
    if (err.error && typeof err.error === 'object') {
      if (typeof err.error.message === 'string' && err.error.message) return err.error.message;
      if (typeof err.error.code === 'string' && err.error.code) return err.error.code;
    }
    if (typeof err.code === 'string' && err.code) return err.code;
    try {
      return JSON.stringify(err);
    } catch {
      return fallback;
    }
  }
  return String(err);
}

export function formatCurrency(
  value: number,
  currency: 'CNY' | 'USD' = 'CNY',
  decimals: number = 2
): string {
  const symbol = currency === 'CNY' ? '¥' : '$';
  return `${symbol}${value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatPercent(value: number, includeSign: boolean = true): string {
  const sign = includeSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Get color class for price changes based on market color settings.
 * CN mode: Positive is Red, Negative is Green.
 * US mode: Positive is Green, Negative is Red.
 */
export function getTrendColor(
  value: number,
  colorMode: MarketColorMode = 'CN'
): { text: string; bg: string; border: string; rawHex: string } {
  if (value === 0) {
    return {
      text: 'text-neutral-500',
      bg: 'bg-neutral-100',
      border: 'border-neutral-200',
      rawHex: '#6b7280',
    };
  }

  const isPositive = value > 0;
  
  if (colorMode === 'CN') {
    // CN: Red up, Green down
    if (isPositive) {
      return {
        text: 'text-rose-600',
        bg: 'bg-rose-50/80',
        border: 'border-rose-200/60',
        rawHex: '#e11d48',
      };
    } else {
      return {
        text: 'text-emerald-600',
        bg: 'bg-emerald-50/80',
        border: 'border-emerald-200/60',
        rawHex: '#059669',
      };
    }
  } else {
    // US: Green up, Red down
    if (isPositive) {
      return {
        text: 'text-emerald-600',
        bg: 'bg-emerald-50/80',
        border: 'border-emerald-200/60',
        rawHex: '#059669',
      };
    } else {
      return {
        text: 'text-rose-600',
        bg: 'bg-rose-50/80',
        border: 'border-rose-200/60',
        rawHex: '#e11d48',
      };
    }
  }
}
