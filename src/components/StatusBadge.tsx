import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const norm = status?.toLowerCase() || '';

  if (norm === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        active
      </span>
    );
  }

  if (norm === 'merged' || norm === 'auto_merge') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
        merged
      </span>
    );
  }

  if (norm === 'review') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        review
      </span>
    );
  }

  if (norm === 'archived' || norm === 'non_match') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-stone-100 text-stone-500 dark:bg-stone-900 dark:text-stone-400 border border-stone-200 dark:border-stone-800">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
        {norm}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
      {status}
    </span>
  );
}
