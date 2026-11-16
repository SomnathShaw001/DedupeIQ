'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled runtime error caught by boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-sm text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Application Exception Encountered
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            An unexpected error occurred while rendering this view. Your database state remains protected.
          </p>
        </div>

        {error.message && (
          <div className="p-3 bg-stone-100 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded text-left">
            <div className="text-[10px] font-mono uppercase tracking-wider text-stone-400 mb-1">
              Diagnostic Detail
            </div>
            <div className="text-xs font-mono text-red-600 dark:text-red-400 break-words">
              {error.message}
            </div>
            {error.digest && (
              <div className="text-[10px] font-mono text-stone-500 mt-1">
                Digest: {error.digest}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="h-8 px-4 rounded-md text-xs font-medium bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
          <Link
            href="/"
            className="h-8 px-4 rounded-md border border-stone-200 dark:border-stone-800 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
