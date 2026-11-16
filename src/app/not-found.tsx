import React from 'react';
import Link from 'next/link';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-sm text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
          <FileQuestion className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Page Not Found (404)
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            The requested route does not exist in the DedupeIQ master console.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-md text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors"
          >
            <Home className="w-3.5 h-3.5" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
