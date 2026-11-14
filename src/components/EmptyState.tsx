import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-stone-200 dark:border-stone-800 rounded-lg bg-stone-50/50 dark:bg-stone-900/20">
      <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1">
        {title}
      </h3>
      <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mb-4">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-stone-200 dark:bg-stone-800 rounded ${className}`}
    />
  );
}
