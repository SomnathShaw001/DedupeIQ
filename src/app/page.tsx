'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { KpiCard } from '@/components/KpiCard';
import {
  ArrowRight,
  ScanSearch,
  CheckCheck,
  RefreshCw,
  Sparkles,
  Database,
  HelpCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

interface DashboardData {
  summary: {
    total_records: number;
    active_records: number;
    merged_records: number;
    clustered_records: number;
    total_clusters: number;
    duplicate_clusters_count: number;
    avg_cluster_size: string | number;
    max_cluster_size: number;
    auto_merged_count: number;
    pending_review_count: number;
    last_run_at: string | null;
    last_run_records: number;
    last_run_pairs: number;
    last_run_clusters: number;
    duplicate_reduction_pct: string | number;
  };
  sources: {
    source_system: string;
    total_records: number;
    merged_records: number;
    clustered_records: number;
    duplicate_rate_pct: string | number;
  }[];
  runs: {
    id: string;
    started_at: string;
    records_scanned: number;
    pairs_compared: number;
    clusters_found: number;
  }[];
  entityBreakdown: {
    entity_type: string;
    count: number;
    merged_count: number;
  }[];
  dbMode: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard metrics');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTotal: 2000, duplicateRate: 0.15 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Seed failed');

      toast.success(
        `Seeded ${json.result.totalRecords} records (${json.result.duplicatePercentage}% duplicates). Running detection...`
      );

      const detRes = await fetch('/api/detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useBlocking: true, thresholdAuto: 0.92, thresholdReview: 0.75 }),
      });

      if (!detRes.ok) throw new Error('Detection pipeline run failed');
      toast.success('Detection complete! Master clusters and review queue generated.');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed benchmark data');
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-stone-200 dark:bg-stone-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 border border-stone-200 dark:border-stone-800 rounded-lg bg-stone-100 dark:bg-stone-900 text-center">
        <p className="text-sm text-stone-700 dark:text-stone-300 mb-3">{error || 'No data found'}</p>
        <button
          onClick={fetchData}
          className="px-3 py-1.5 text-xs font-medium rounded bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900"
        >
          Retry
        </button>
      </div>
    );
  }

  const { summary, sources, runs } = data;

  const chartData = runs.map((r, idx) => ({
    name: `Run ${idx + 1}`,
    scanned: r.records_scanned,
    clusters: r.clusters_found,
  }));

  const sourceChartData = sources.map((s) => ({
    name: s.source_system.replace('CRM-', '').replace('-v2', ''),
    rate: Number(s.duplicate_rate_pct),
    total: Number(s.total_records),
    duplicates: Number(s.merged_records),
  }));

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            System Overview
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Relational 3NF master record health, cluster convergence, and pipeline telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="h-8 px-2.5 rounded-md border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 text-xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-600" />
            <span className="hidden sm:inline">Workflow Guide</span>
            {showGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={fetchData}
            title="Refresh database metrics"
            className="h-8 px-2.5 rounded-md border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Link
            href="/detection"
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            Run Detection
          </Link>
          <Link
            href="/review"
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-medium bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Review Queue ({summary.pending_review_count})
          </Link>
        </div>
      </div>

      {/* Empty Database Getting Started Banner */}
      {Number(summary.total_records) === 0 && (
        <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-600" />
                Database Unseeded — Quick Start DedupeIQ
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                Your master database currently has 0 records. Seed 2,000 synthetic multi-source records with 15% injected duplicates to test the full pipeline, or import a CSV.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleQuickSeed}
                disabled={seeding}
                className="h-8 px-3 rounded-md text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {seeding ? 'Seeding & Running...' : 'Seed 2,000 Benchmark Records'}
              </button>
              <Link
                href="/data"
                className="h-8 px-3 rounded-md border border-stone-200 dark:border-stone-800 text-xs font-medium bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Import CSV
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Guide Drawer */}
      {showGuide && (
        <div className="p-4 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-orange-600" />
              DedupeIQ End-to-End Evaluation Workflow
            </h3>
            <button
              onClick={() => setShowGuide(false)}
              className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1">
                1. Data Ingestion & Normalization
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Browse <Link href="/data" className="text-orange-600 underline">/data</Link> to inspect records or upload CSVs. PostgreSQL triggers automatically compute canonical tokens, Soundex, and Metaphone keys.
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1">
                2. Multi-Key Blocking & Scoring
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Visit <Link href="/detection" className="text-orange-600 underline">/detection</Link> to run the engine. Blocking eliminates 98%+ comparisons. Candidates are scored via Jaro-Winkler, Levenshtein, and Token-Set ratio.
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1">
                3. Review Queue & Shortcuts
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Go to <Link href="/review" className="text-orange-600 underline">/review</Link> to inspect borderline pairs with character diffs. Use keyboard shortcuts: <kbd className="font-mono bg-stone-100 dark:bg-stone-800 px-1 rounded">M</kbd> Merge, <kbd className="font-mono bg-stone-100 dark:bg-stone-800 px-1 rounded">N</kbd> Non-Match, <kbd className="font-mono bg-stone-100 dark:bg-stone-800 px-1 rounded">S</kbd> Skip.
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1">
                4. Clusters & Reversible Unmerge
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Browse <Link href="/clusters" className="text-orange-600 underline">/clusters</Link> to see golden masters formed via Union-Find. Every merge stores a JSONB snapshot in <code>merge_log</code>, allowing 100% reversible unmerge.
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1">
                5. Ground-Truth Benchmarking
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Open <Link href="/benchmark" className="text-orange-600 underline">/benchmark</Link> to view the 2×2 binary contingency matrix, Precision (97%+), Recall (95%+), and threshold sensitivity curves.
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
              <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-1">
                6. SQL Lab & Query Planner
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Explore <Link href="/sql-lab" className="text-orange-600 underline">/sql-lab</Link> to inspect raw 3NF DDL, triggers, and live <code>EXPLAIN ANALYZE</code> query performance comparing indexed blocking vs cartesian joins.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Total Records"
          value={Number(summary.total_records).toLocaleString()}
          subValue={`${Number(summary.active_records).toLocaleString()} active`}
          description="Master records in database"
        />
        <KpiCard
          label="Duplicate Clusters"
          value={Number(summary.duplicate_clusters_count).toLocaleString()}
          subValue={`Avg size: ${summary.avg_cluster_size}`}
          description="Disjoint equivalence sets (>1 record)"
        />
        <KpiCard
          label="Redundancy Rate"
          value={`${summary.duplicate_reduction_pct}%`}
          trend={Number(summary.duplicate_reduction_pct) > 0 ? "Identified" : "Clean"}
          trendDirection="neutral"
          description="Proportion of duplicate records"
        />
        <KpiCard
          label="Records Deduplicated"
          value={Number(summary.merged_records).toLocaleString()}
          subValue={`${summary.auto_merged_count} auto`}
          description="Records consolidated into golden masters"
        />
        <KpiCard
          label="Last Pipeline Run"
          value={summary.last_run_at ? new Date(summary.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
          subValue={summary.last_run_clusters ? `${summary.last_run_clusters} clusters` : undefined}
          description={summary.last_run_at ? new Date(summary.last_run_at).toLocaleDateString() : 'Awaiting first run'}
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Run Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Detection History & Cluster Yield
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Duplicate clusters identified per execution cycle
              </p>
            </div>
            <Link
              href="/detection"
              className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-mono"
            >
              Config & Run <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-52 w-full">
            {mounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="clustersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#78716c" fontSize={11} tickLine={false} />
                  <YAxis stroke="#78716c" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      borderColor: '#292524',
                      fontSize: '11px',
                      color: '#f5f5f4',
                      borderRadius: '4px',
                      padding: '6px 10px',
                    }}
                    formatter={(val) => [Number(val).toLocaleString() + ' clusters', 'Discovered']}
                  />
                  <Area
                    type="monotone"
                    dataKey="clusters"
                    stroke="#ea580c"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#clustersGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-400 font-mono">
                {mounted ? 'No detection runs recorded' : 'Loading telemetry chart...'}
              </div>
            )}
          </div>
        </div>

        {/* Source System Breakdown */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Source System Ingestion Rate
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Duplicate concentration by origin
              </p>
            </div>
            <Link
              href="/data"
              className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-mono"
            >
              Browse <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-52 w-full">
            {mounted && sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceChartData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                  <XAxis type="number" stroke="#78716c" fontSize={10} unit="%" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" stroke="#78716c" fontSize={10} width={80} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      borderColor: '#292524',
                      fontSize: '11px',
                      color: '#f5f5f4',
                      borderRadius: '4px',
                      padding: '6px 10px',
                    }}
                    formatter={(val) => [val + '%', 'Duplicate Rate']}
                  />
                  <Bar dataKey="rate" fill="#ea580c" radius={[0, 3, 3, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-400 font-mono">
                {mounted ? 'No source telemetry data' : 'Loading source telemetry...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Source Systems Table & Quick Navigation */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Source Pipeline Telemetry
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Breakdown of records, duplicate density, and consolidation state by source system
            </p>
          </div>
          <span className="text-xs font-mono text-stone-500">
            {sources.length} active sources
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="px-4 py-2 text-left">Source System</th>
                <th className="px-4 py-2 text-right">Total Records</th>
                <th className="px-4 py-2 text-right">Merged Duplicates</th>
                <th className="px-4 py-2 text-right">Clustered Records</th>
                <th className="px-4 py-2 text-right">Duplicate Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
              {sources.map((s) => (
                <tr key={s.source_system} className="hover:bg-stone-50 dark:hover:bg-stone-950/50 transition-colors">
                  <td className="px-4 py-2 font-medium text-stone-900 dark:text-stone-100 font-sans">
                    {s.source_system}
                  </td>
                  <td className="px-4 py-2 text-right text-stone-600 dark:text-stone-300 tabular-nums">
                    {Number(s.total_records).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-orange-600 dark:text-orange-400 tabular-nums font-semibold">
                    {Number(s.merged_records).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-stone-600 dark:text-stone-400 tabular-nums">
                    {Number(s.clustered_records).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-[11px]">
                      {s.duplicate_rate_pct}%
                    </span>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-stone-400 font-sans">
                    No source data found. Import records or run benchmark seed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
