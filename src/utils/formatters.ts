import { MarketColorMode } from '../types';

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
