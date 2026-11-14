'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { KpiCard } from '@/components/KpiCard';
import {
  ArrowRight,
  ScanSearch,
  CheckCheck,
  RefreshCw,
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

  useEffect(() => {
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
    <div className="space-y-8">
      {/* Top Header & Fast Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            System Overview
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Real-time master data deduplication and relational cluster statistics
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            title="Refresh database metrics"
            className="p-1.5 rounded border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <Link
            href="/detection"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors shadow-xs"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            Run Detection
          </Link>
          <Link
            href="/review"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-colors shadow-xs"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Review Queue ({summary.pending_review_count})
          </Link>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Records"
          value={Number(summary.total_records).toLocaleString()}
          subValue={`${summary.active_records} active`}
          description="Total master records across sources"
        />
        <KpiCard
          label="Duplicate Clusters"
          value={Number(summary.duplicate_clusters_count).toLocaleString()}
          subValue={`Avg size: ${summary.avg_cluster_size}`}
          description="Equivalence sets with >1 record"
        />
        <KpiCard
          label="Estimated Duplicate %"
          value={`${summary.duplicate_reduction_pct}%`}
          trend={Number(summary.duplicate_reduction_pct) > 0 ? "Identified" : "Clean"}
          trendDirection="neutral"
          description="Percentage of redundant master records"
        />
        <KpiCard
          label="Records Saved"
          value={Number(summary.merged_records).toLocaleString()}
          subValue={`${summary.auto_merged_count} auto`}
          description="Redundant records deduplicated"
        />
        <KpiCard
          label="Last Run"
          value={summary.last_run_at ? new Date(summary.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
          subValue={summary.last_run_clusters ? `${summary.last_run_clusters} clusters` : undefined}
          description={summary.last_run_at ? new Date(summary.last_run_at).toLocaleDateString() : 'Awaiting first run'}
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Run Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Detection Run History
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Clusters discovered across historical execution runs
              </p>
            </div>
            <Link
              href="/detection"
              className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-mono"
            >
              History <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-56 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="clustersGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ea580c" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ea580c" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#78716c" fontSize={11} tickLine={false} />
                  <YAxis stroke="#78716c" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      borderColor: '#292524',
                      fontSize: '12px',
                      color: '#f5f5f4',
                      borderRadius: '6px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="clusters"
                    stroke="#ea580c"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#clustersGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-400 font-mono">
                No detection runs executed yet
              </div>
            )}
          </div>
        </div>

        {/* Source System Breakdown */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Top Ingestion Sources
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Duplicate rate by source system
              </p>
            </div>
            <Link
              href="/data"
              className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-mono"
            >
              Browse <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-56 w-full">
            {sourceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceChartData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                  <XAxis type="number" stroke="#78716c" fontSize={10} unit="%" />
                  <YAxis dataKey="name" type="category" stroke="#78716c" fontSize={10} width={90} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1917',
                      borderColor: '#292524',
                      fontSize: '12px',
                      color: '#f5f5f4',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="rate" fill="#57534e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-stone-400 font-mono">
                No source system data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Source Systems Table & Quick Navigation */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Source System Telemetry
          </h2>
          <span className="text-xs font-mono text-stone-500">
            {sources.length} active pipelines
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="px-5 py-2.5">Source System</th>
                <th className="px-5 py-2.5">Total Records</th>
                <th className="px-5 py-2.5">Merged Duplicates</th>
                <th className="px-5 py-2.5">Clustered</th>
                <th className="px-5 py-2.5">Duplicate Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
              {sources.map((s) => (
                <tr key={s.source_system} className="hover:bg-stone-50 dark:hover:bg-stone-950/50">
                  <td className="px-5 py-3 font-medium text-stone-900 dark:text-stone-100 font-sans">
                    {s.source_system}
                  </td>
                  <td className="px-5 py-3 text-stone-600 dark:text-stone-300">
                    {Number(s.total_records).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-orange-600 dark:text-orange-400">
                    {Number(s.merged_records).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-stone-600 dark:text-stone-400">
                    {Number(s.clustered_records).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-block px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-[11px]">
                      {s.duplicate_rate_pct}%
                    </span>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-stone-400">
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
