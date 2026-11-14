import React from 'react';

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  description?: string;
}

export function KpiCard({
  label,
  value,
  subValue,
  trend,
  trendDirection = 'neutral',
  description,
}: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4 shadow-xs">
      <div className="flex items-center justify-between text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-1">
        <span>{label}</span>
        {trend && (
          <span
            className={`font-mono text-[11px] ${
              trendDirection === 'down'
                ? 'text-emerald-600 dark:text-emerald-400'
                : trendDirection === 'up'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-stone-500'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-stone-500 dark:text-stone-400 font-mono">
            {subValue}
          </span>
        )}
      </div>

      {description && (
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
          {description}
        </p>
      )}
    </div>
  );
}
