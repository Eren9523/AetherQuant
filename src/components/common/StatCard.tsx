import React from 'react';
import { cn } from '../../utils/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  badge,
  icon,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-5 rounded-2xl bg-white/90 backdrop-blur-sm border border-neutral-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-neutral-500 tracking-wide">
          {title}
        </span>
        {icon && <div className="text-neutral-400">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl font-semibold text-neutral-900 tracking-tight font-mono">
          {value}
        </div>
        {badge}
      </div>

      {subtitle && (
        <div className="mt-1.5 text-xs text-neutral-400 font-normal">
          {subtitle}
        </div>
      )}
    </div>
  );
};
