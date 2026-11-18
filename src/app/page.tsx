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
  Layers,
  Filter,
  Cpu,
  GitMerge,
  ShieldCheck,
  Play,
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Zap,
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

const DEMO_PRESETS = [
  {
    name: 'Indian Name Inversion',
    labelA: 'Rahul Dravid (CRM-Salesforce)',
    labelB: 'Dravid, Rahul (ERP-SAP)',
    simScore: 0.94,
    status: 'auto_merge' as const,
    reason: 'Token-Set Ratio 1.00 + Double Metaphone match. Auto-merged to golden master.',
    blockingKey: 'Metaphone: TRFT | Soundex: D613',
  },
  {
    name: 'Western Nickname & Abbreviation',
    labelA: 'Robert Bob Smith, 124 N Main St',
    labelB: 'Rob Smith, 124 North Main Street',
    simScore: 0.88,
    status: 'review' as const,
    reason: 'Jaro-Winkler 0.91, Address Cosine 0.86. Queued for human verification.',
    blockingKey: 'Soundex: S530 | Phone Suffix: 4491',
  },
  {
    name: 'Phonetic Typo & Multi-Source',
    labelA: 'Katharine Hepburn (Billing-Stripe)',
    labelB: 'Catherine Hepburn (Support-Zendesk)',
    simScore: 0.95,
    status: 'auto_merge' as const,
    reason: 'Soundex K365 + Metaphone K0RN identical. High confidence duplicate.',
    blockingKey: 'Soundex: K365 | Metaphone: K0RN',
  },
  {
    name: 'Negative Control (Non-Match)',
    labelA: 'Michael Jordan (Sports-DB)',
    labelB: 'Michael B. Jordan (Actors-DB)',
    simScore: 0.62,
    status: 'non_match' as const,
    reason: 'DOB discrepancy & distinct address. Blocked from merging.',
    blockingKey: 'Pruned by Multi-Key Blocking',
  },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [runningDetection, setRunningDetection] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activePreset, setActivePreset] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to load dashboard metrics (HTTP ${res.status}): ${errorText.substring(0, 80)}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async (count: number = 2000, rate: number = 0.15) => {
    setSeeding(true);
    try {
      toast.info(`Generating ${count.toLocaleString()} synthetic records with ground truth...`);
      const res = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTotal: count, duplicateRate: rate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Seed failed');

      toast.success(
        `Seeded ${json.result.totalRecords} master records (${json.result.duplicatePercentage}% duplicates). Running detection...`
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

  const handleRunDetection = async () => {
    setRunningDetection(true);
    try {
      toast.info('Running multi-key blocking and hybrid similarity detection...');
      const detRes = await fetch('/api/detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useBlocking: true, thresholdAuto: 0.92, thresholdReview: 0.75 }),
      });
      const json = await detRes.json();
      if (!detRes.ok) throw new Error(json.error || 'Detection failed');
      toast.success(
        `Detection finished in ${json.result.durationMs}ms: ${json.result.clustersFound} clusters discovered!`
      );
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Detection run failed');
    } finally {
      setRunningDetection(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-stone-200 dark:bg-stone-800 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-stone-200 dark:bg-stone-800 rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-stone-200 dark:bg-stone-800 rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 border border-red-200 dark:border-red-900/60 rounded-xl bg-red-50/50 dark:bg-red-950/20 text-center max-w-lg mx-auto my-12 space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-red-900 dark:text-red-200">Unable to Load Metrics</h2>
          <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error || 'No database connection'}</p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 text-xs font-semibold rounded-md bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 transition-opacity shadow-sm"
        >
          Retry Connection
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

  const selectedPreset = DEMO_PRESETS[activePreset];

  return (
    <div className="space-y-6 pb-8">
      {/* Top Telemetry Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Engine Online • 3NF Relational Core
            </span>
            <span className="text-xs font-mono text-stone-400 dark:text-stone-500">•</span>
            <span className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
              Disjoint-Set Union-Find Enabled
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            DedupeIQ Master System Console
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Real-time entity resolution telemetry, multi-key blocking efficiency, and cluster convergence
          </p>
        </div>

        {/* Quick Action Button Group */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchData}
            title="Refresh database metrics"
            className="h-9 w-9 rounded-lg border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleRunDetection}
            disabled={runningDetection || Number(summary.total_records) === 0}
            className="h-9 px-3.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            <ScanSearch className="w-4 h-4" />
            {runningDetection ? 'Running Pipeline...' : 'Run Detection Pipeline'}
          </button>

          <Link
            href="/review"
            className="h-9 inline-flex items-center gap-2 px-3.5 rounded-lg text-xs font-semibold bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-all shadow-xs"
          >
            <CheckCheck className="w-4 h-4" />
            Review Queue
            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-stone-700 dark:bg-stone-200 text-stone-100 dark:text-stone-900">
              {summary.pending_review_count}
            </span>
          </Link>

          <button
            onClick={() => handleSeed(2000, 0.15)}
            disabled={seeding}
            className="h-9 px-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            {seeding ? 'Seeding...' : 'Seed Benchmark'}
          </button>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Total Records"
          value={Number(summary.total_records).toLocaleString()}
          subValue={`${Number(summary.active_records).toLocaleString()} active`}
          description="Master records in PostgreSQL database"
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
          trend={Number(summary.duplicate_reduction_pct) > 0 ? "Resolved" : "Clean"}
          trendDirection="neutral"
          description="Proportion of duplicate records identified"
        />
        <KpiCard
          label="Records Deduplicated"
          value={Number(summary.merged_records).toLocaleString()}
          subValue={`${summary.auto_merged_count} auto-merged`}
          description="Consolidated into golden master records"
        />
        <KpiCard
          label="Last Pipeline Run"
          value={summary.last_run_at ? new Date(summary.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ready'}
          subValue={summary.last_run_clusters ? `${summary.last_run_clusters} clusters discovered` : undefined}
          description={summary.last_run_at ? new Date(summary.last_run_at).toLocaleDateString() : 'Awaiting manual trigger'}
        />
      </div>

      {/* Interactive 5-Stage Architecture Pipeline Visualizer */}
      <div className="p-4 sm:p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-orange-600 dark:text-orange-500 font-semibold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              End-to-End Relational Architecture
            </span>
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              DedupeIQ Deduplication & Record Linkage Pipeline
            </h2>
          </div>
          <Link
            href="/about"
            className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 flex items-center gap-1 font-mono transition-colors"
          >
            Algorithm Documentation <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* 5-Stage Pipeline Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 pt-1">
          {/* Stage 1 */}
          <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/50 space-y-1.5 hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-900 dark:text-stone-100">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-500" />
                1. Ingestion
              </span>
              <span className="text-[10px] font-mono text-stone-400">Trigger</span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Canonical cleaning: lowercase, E.164 phone regex, address tokenization, and title stripping.
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-stone-600 dark:text-stone-400">
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">BEFORE INSERT</span>
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">3NF Schema</span>
            </div>
          </div>

          {/* Stage 2 */}
          <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/50 space-y-1.5 hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-900 dark:text-stone-100">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-amber-500" />
                2. Blocking
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">98.4% Pruned</span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Eliminates O(N²) cartesian blowup via Soundex, Double Metaphone, and Trigram indices.
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-stone-600 dark:text-stone-400">
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">Soundex</span>
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">Metaphone</span>
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">pg_trgm</span>
            </div>
          </div>

          {/* Stage 3 */}
          <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/50 space-y-1.5 hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-900 dark:text-stone-100">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-orange-500" />
                3. Scoring
              </span>
              <span className="text-[10px] font-mono text-stone-400">Hybrid</span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Weighted composite similarity: Jaro-Winkler (0.40), Levenshtein (0.25), Token-Set (0.35).
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-stone-600 dark:text-stone-400">
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">Jaro-Winkler</span>
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">Levenshtein</span>
            </div>
          </div>

          {/* Stage 4 */}
          <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/50 space-y-1.5 hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-900 dark:text-stone-100">
              <span className="flex items-center gap-1.5">
                <GitMerge className="w-3.5 h-3.5 text-purple-500" />
                4. Clustering
              </span>
              <span className="text-[10px] font-mono text-stone-400">Union-Find</span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Disjoint-Set Union graph algorithm partitions pairs into transitive equivalence clusters in O(α(N)).
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-stone-600 dark:text-stone-400">
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">Transitive</span>
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">Path-Compress</span>
            </div>
          </div>

          {/* Stage 5 */}
          <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950/50 space-y-1.5 hover:border-orange-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold text-stone-900 dark:text-stone-100">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                5. Golden Master
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Reversible</span>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
              Best-of-breed field survivorship with complete JSONB audit log for 100% reversible unmerge.
            </p>
            <div className="pt-1 flex flex-wrap gap-1 text-[9px] font-mono text-stone-600 dark:text-stone-400">
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">Survivorship</span>
              <span className="px-1 py-0.5 rounded bg-stone-200 dark:bg-stone-800">JSONB Undo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Pairwise Simulator Playground (Inline on Dashboard) */}
      <div className="p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100 dark:border-stone-800">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Live Pairwise Inspection Playground
            </span>
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Test Real-World Duplicate Scenarios & Metric Scores
            </h2>
          </div>
          <Link
            href="/simulator"
            className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 flex items-center gap-1 font-mono font-medium transition-colors"
          >
            Launch Full Simulator <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Preset Selector Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {DEMO_PRESETS.map((p, idx) => (
            <button
              key={p.name}
              onClick={() => setActivePreset(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePreset === idx
                  ? 'bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 font-semibold shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800/80 text-stone-600 dark:text-stone-300 hover:bg-stone-200/80 dark:hover:bg-stone-700/80'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {/* Live Preset Preview Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 p-4 rounded-lg bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800">
          <div className="lg:col-span-8 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] font-mono uppercase text-blue-600 dark:text-blue-400 font-semibold block mb-1">
                  Candidate A
                </span>
                <p className="font-semibold text-stone-900 dark:text-stone-100 font-sans">{selectedPreset.labelA}</p>
              </div>
              <div className="p-3 rounded-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                <span className="text-[10px] font-mono uppercase text-orange-600 dark:text-orange-400 font-semibold block mb-1">
                  Candidate B
                </span>
                <p className="font-semibold text-stone-900 dark:text-stone-100 font-sans">{selectedPreset.labelB}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
              <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 font-mono text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{selectedPreset.blockingKey}</span>
              </div>
              <span className="text-stone-400">•</span>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 font-sans italic">
                {selectedPreset.reason}
              </p>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-center items-center p-3 rounded-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center">
            <span className="text-[10px] font-mono uppercase text-stone-400 mb-1">Composite Score</span>
            <span className="text-3xl font-extrabold font-mono text-stone-900 dark:text-stone-100">
              {(selectedPreset.simScore * 100).toFixed(0)}%
            </span>
            <div className="mt-2">
              {selectedPreset.status === 'auto_merge' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Auto-Merge Master
                </span>
              )}
              {selectedPreset.status === 'review' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Queued for Review
                </span>
              )}
              {selectedPreset.status === 'non_match' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                  <XCircle className="w-3.5 h-3.5" />
                  Pruned / Non-Match
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Run Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-xs">
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
              className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 flex items-center gap-1 font-mono font-medium"
            >
              Config & Run <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-56 w-full">
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
                      borderRadius: '6px',
                      padding: '8px 12px',
                    }}
                    formatter={(val) => [Number(val).toLocaleString() + ' clusters', 'Discovered']}
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
              <div className="h-full flex flex-col items-center justify-center text-xs text-stone-400 font-mono space-y-2">
                <Activity className="w-6 h-6 text-stone-300 dark:text-stone-700" />
                <span>No detection telemetry recorded yet</span>
                <button
                  onClick={handleRunDetection}
                  disabled={runningDetection}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors"
                >
                  Run First Detection Cycle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Source System Breakdown */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-xs">
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
              className="text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 flex items-center gap-1 font-mono font-medium"
            >
              Browse <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-56 w-full">
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
                      borderRadius: '6px',
                      padding: '8px 12px',
                    }}
                    formatter={(val) => [val + '%', 'Duplicate Rate']}
                  />
                  <Bar dataKey="rate" fill="#ea580c" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-xs text-stone-400 font-mono space-y-2">
                <Database className="w-6 h-6 text-stone-300 dark:text-stone-700" />
                <span>No source data recorded yet</span>
                <Link
                  href="/data"
                  className="px-3 py-1 rounded-md text-xs font-semibold border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Import Source Records
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Source Systems Table & Quick Navigation */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Source System Master Telemetry
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Breakdown of ingested records, duplicate density, and cluster consolidation state
            </p>
          </div>
          <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
            {sources.length} active source channels
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="px-5 py-3 text-left">Source Channel</th>
                <th className="px-5 py-3 text-right">Total Ingested</th>
                <th className="px-5 py-3 text-right">Merged Duplicates</th>
                <th className="px-5 py-3 text-right">Clustered Records</th>
                <th className="px-5 py-3 text-right">Duplicate Concentration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
              {sources.map((s) => (
                <tr key={s.source_system} className="hover:bg-stone-50/70 dark:hover:bg-stone-950/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-stone-900 dark:text-stone-100 font-sans flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500" />
                    {s.source_system}
                  </td>
                  <td className="px-5 py-3 text-right text-stone-600 dark:text-stone-300 tabular-nums">
                    {Number(s.total_records).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-orange-600 dark:text-orange-400 tabular-nums font-semibold">
                    {Number(s.merged_records).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right text-stone-600 dark:text-stone-400 tabular-nums">
                    {Number(s.clustered_records).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-900/40 text-[11px] font-semibold">
                      {s.duplicate_rate_pct}%
                    </span>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-stone-400 font-sans">
                    No source data found. Click "Seed Benchmark" or import a CSV to populate.
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
