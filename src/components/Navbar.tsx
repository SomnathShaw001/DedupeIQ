'use client';

import React, { useState } from 'react';
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
  Sparkles,
  History,
  Menu,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/data', label: 'Data', icon: Database },
  { href: '/detection', label: 'Detection', icon: ScanSearch },
  { href: '/review', label: 'Review Queue', icon: CheckCheck },
  { href: '/clusters', label: 'Clusters', icon: Network },
  { href: '/simulator', label: 'Simulator', icon: Sparkles },
  { href: '/benchmark', label: 'Benchmark', icon: TestTube },
  { href: '/audit', label: 'Audit Log', icon: History },
  { href: '/sql-lab', label: 'SQL Lab', icon: Terminal },
  { href: '/about', label: 'Method', icon: BookOpen },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 backdrop-blur-md transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="w-6 h-6 rounded bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 flex items-center justify-center font-mono font-bold text-xs tracking-tighter shadow-xs group-hover:scale-105 transition-transform">
                D
              </span>
              <span className="font-semibold text-sm tracking-tight text-stone-900 dark:text-stone-100">
                Dedupe<span className="text-orange-600 dark:text-orange-500">IQ</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-wider text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700 px-1.5 py-0.5 rounded bg-stone-100/60 dark:bg-stone-900/60">
                DBMS Core
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center space-x-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-stone-100 dark:bg-stone-800/90 text-stone-900 dark:text-stone-100 font-semibold shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/70 dark:hover:bg-stone-900/70'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-600 dark:text-orange-500' : 'opacity-70'}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mid-screen compact nav (lg to xl) */}
            <nav className="hidden lg:flex xl:hidden items-center space-x-0.5">
              {NAV_ITEMS.slice(0, 6).map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-semibold'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-600' : 'opacity-70'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="px-2 py-1 text-xs font-medium text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
              >
                More...
              </button>
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-900 px-2.5 py-1 rounded-md border border-stone-200 dark:border-stone-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>PostgreSQL 3NF</span>
            </div>
            <ThemeToggle />
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer / dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <div className="grid grid-cols-2 gap-1 pb-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-semibold border border-orange-200 dark:border-orange-900/50'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-orange-600' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="pt-2 border-t border-stone-100 dark:border-stone-900 flex items-center justify-between text-[11px] font-mono text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Engine: PostgreSQL 3NF
            </span>
            <span>DedupeIQ v1.0</span>
          </div>
        </div>
      )}

      {/* Sub-bar horizontal pill bar for mobile quick scrolling */}
      {!mobileMenuOpen && (
        <div className="lg:hidden flex overflow-x-auto border-t border-stone-200 dark:border-stone-800 px-3 py-1.5 space-x-1 scrollbar-none bg-stone-50/50 dark:bg-stone-950/50">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800/60'
                }`}
              >
                <Icon className="w-3 h-3 opacity-80" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
