'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';
import {
  LayoutDashboard,
  Database,
  ScanSearch,
  CheckCheck,
  Network,
  TestTube,
  Terminal,
  BookOpen,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/data', label: 'Data', icon: Database },
  { href: '/detection', label: 'Detection', icon: ScanSearch },
  { href: '/review', label: 'Review Queue', icon: CheckCheck },
  { href: '/clusters', label: 'Clusters', icon: Network },
  { href: '/benchmark', label: 'Benchmark', icon: TestTube },
  { href: '/sql-lab', label: 'SQL Lab', icon: Terminal },
  { href: '/about', label: 'Method', icon: BookOpen },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 dark:border-stone-800 bg-stone-50/95 dark:bg-stone-950/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Identity */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-5 h-5 rounded bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 flex items-center justify-center font-mono font-bold text-xs tracking-tighter">
                D
              </span>
              <span className="font-semibold text-sm tracking-tight text-stone-900 dark:text-stone-100">
                Dedupe<span className="text-orange-600 dark:text-orange-500">IQ</span>
              </span>
              <span className="hidden sm:inline-block text-[11px] font-mono uppercase tracking-wider text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 px-1.5 py-0.5 rounded">
                DBMS Core
              </span>
            </Link>

            {/* Navigation links */}
            <nav className="hidden md:flex items-center space-x-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-900'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 opacity-80" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-900 px-2 py-1 rounded border border-stone-200 dark:border-stone-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>PostgreSQL 3NF</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Mobile sub-nav */}
      <div className="md:hidden flex overflow-x-auto border-t border-stone-200 dark:border-stone-800 px-4 py-1.5 space-x-1 scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap px-2.5 py-1 rounded text-xs font-medium ${
                isActive
                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
