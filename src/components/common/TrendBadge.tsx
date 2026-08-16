import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatPercent, getTrendColor } from '../../utils/formatters';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../utils/cn';

interface TrendBadgeProps {
  value: number;
  className?: string;
  showIcon?: boolean;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({
  value,
  className,
  showIcon = true,
}) => {
  const { marketColorMode } = useApp();
  const colors = getTrendColor(value, marketColorMode);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border transition-colors',
        colors.text,
        colors.bg,
        colors.border,
        className
      )}
    >
      {showIcon && (
        <>
          {value > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : value < 0 ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
        </>
      )}
      {formatPercent(value)}
    </span>
  );
};
