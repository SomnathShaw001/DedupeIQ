'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ScanSearch,
  Sliders,
  CheckCircle2,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

interface DetectionRunItem {
  id: string;
  started_at: string;
  finished_at: string;
  records_scanned: number;
  pairs_compared: number;
  clusters_found: number;
  threshold_auto: string | number;
  threshold_review: string | number;
  config: {
    useBlocking?: boolean;
    pairsAvoidedPct?: number;
    autoMergedCount?: number;
    reviewCount?: number;
    nonMatchCount?: number;
    weights?: {
      nameWeight: number;
      emailWeight: number;
      phoneWeight: number;
      addressWeight: number;
    };
  };
}

interface RunResultData {
  runId: string;
  recordsScanned: number;
  totalTheoreticalPairs: number;
  pairsCompared: number;
  pairsAvoidedPct: number;
  clustersFound: number;
  autoMergedPairs: number;
  reviewPairs: number;
  nonMatchPairs: number;
  durationMs: number;
}

export default function DetectionPage() {
  const [runs, setRuns] = useState<DetectionRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<RunResultData | null>(null);

  // Run Config Form State
  const [entityType, setEntityType] = useState<string>('');
  const [useBlocking, setUseBlocking] = useState<boolean>(true);
  const [thresholdAuto, setThresholdAuto] = useState<number>(0.92);
  const [thresholdReview, setThresholdReview] = useState<number>(0.75);

  // Weights
  const [nameWeight, setNameWeight] = useState<number>(0.45);
  const [emailWeight, setEmailWeight] = useState<number>(0.25);
  const [phoneWeight, setPhoneWeight] = useState<number>(0.20);
  const [addressWeight, setAddressWeight] = useState<number>(0.10);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/detection');
      if (!res.ok) throw new Error('Failed to load detection runs');
      const json = await res.json();
      setRuns(json.runs || []);
    } catch {
      toast.error('Error fetching detection history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  const handleRunDetection = async () => {
    setExecuting(true);
    setLastResult(null);

    try {
      const payload = {
        entityType: entityType || null,
        thresholdAuto,
        thresholdReview,
        useBlocking,
        weights: {
          nameWeight,
          emailWeight,
          phoneWeight,
          addressWeight,
        },
      };

      const res = await fetch('/api/detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Detection failed');

      setLastResult(json.result);
      toast.success(`Detection complete: ${json.result.clustersFound} duplicate clusters identified`);
      fetchRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Detection run failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Duplicate Detection Pipeline
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Stage 1-7 multi-pass blocking, ensemble similarity evaluation, and transitive union-find clustering
          </p>
        </div>

        <button
          onClick={fetchRuns}
          title="Refresh run history"
          className="p-1.5 rounded border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Pipeline Configuration & Trigger Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-200 dark:border-stone-800">
            <Sliders className="w-4 h-4 text-orange-600" />
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Pipeline Hyperparameters & Blocking Strategy
            </h2>
          </div>

          <div className="space-y-5 text-xs">
            {/* Entity and Blocking toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-medium mb-1">
                  Target Entity Domain
                </label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                >
                  <option value="">All Entities (Cross-Domain)</option>
                  <option value="customer">Customers Only</option>
                  <option value="student">Students Only</option>
                  <option value="product">Products Only</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 dark:text-stone-300 font-medium mb-1">
                  Multi-Key Blocking Engine
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBlocking}
                      onChange={(e) => setUseBlocking(e.target.checked)}
                      className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                    />
                    <span className="font-mono text-xs text-stone-800 dark:text-stone-200">
                      Enable Multi-Key Blocking (Avoids O(N²))
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Threshold Sliders */}
            <div className="p-4 rounded-lg bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 space-y-4">
              <div className="font-medium text-stone-900 dark:text-stone-100 flex items-center justify-between">
                <span>Decision Cutoff Thresholds</span>
                <span className="text-[11px] font-mono text-stone-500">
                  Auto ≥ {thresholdAuto.toFixed(2)} • Review [{thresholdReview.toFixed(2)}, {thresholdAuto.toFixed(2)}) • Non-match &lt; {thresholdReview.toFixed(2)}
                </span>
              </div>

              {/* Visual Decision Zone Partition Bar */}
              <div className="space-y-1">
                <div className="w-full h-4 rounded overflow-hidden flex text-[10px] font-mono select-none border border-stone-300 dark:border-stone-700">
                  <div
                    style={{ width: `${thresholdReview * 100}%` }}
                    className="bg-stone-200 dark:bg-stone-800 h-full flex items-center justify-center text-stone-600 dark:text-stone-400 font-sans text-[10px] truncate px-1"
                    title={`Non-Match: score < ${thresholdReview}`}
                  >
                    Non-Match (&lt; {thresholdReview.toFixed(2)})
                  </div>
                  <div
                    style={{ width: `${(thresholdAuto - thresholdReview) * 100}%` }}
                    className="bg-amber-500/80 dark:bg-amber-600/80 text-stone-950 font-semibold h-full flex items-center justify-center text-[10px] truncate px-1"
                    title={`Review: ${thresholdReview} ≤ score < ${thresholdAuto}`}
                  >
                    Human Review
                  </div>
                  <div
                    style={{ width: `${(1.0 - thresholdAuto) * 100}%` }}
                    className="bg-orange-600 text-white font-semibold h-full flex items-center justify-center text-[10px] truncate px-1"
                    title={`Auto-Merge: score ≥ ${thresholdAuto}`}
                  >
                    Auto-Merge
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-stone-600 dark:text-stone-400 mb-1">
                    <span>Auto-Merge Threshold (θ_auto)</span>
                    <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {thresholdAuto.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="0.99"
                    step="0.01"
                    value={thresholdAuto}
                    onChange={(e) => setThresholdAuto(parseFloat(e.target.value))}
                    className="w-full accent-orange-600"
                  />
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    Pairs with composite similarity ≥ {thresholdAuto.toFixed(2)} merge automatically without manual review.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-stone-600 dark:text-stone-400 mb-1">
                    <span>Human Review Threshold (θ_rev)</span>
                    <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                      {thresholdReview.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.50"
                    max="0.90"
                    step="0.01"
                    value={thresholdReview}
                    onChange={(e) => setThresholdReview(parseFloat(e.target.value))}
                    className="w-full accent-orange-600"
                  />
                  <p className="text-[10px] text-stone-400 mt-0.5">
                    Borderline pairs [{thresholdReview.toFixed(2)}, {thresholdAuto.toFixed(2)}) queue for side-by-side reconciliation.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature Weights */}
            <div className="space-y-2">
              <label className="block text-stone-700 dark:text-stone-300 font-medium">
                Feature Similarity Weights
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div>
                  <span className="text-[11px] text-stone-500">Name (Jaro-Winkler+TSR)</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={nameWeight}
                    onChange={(e) => setNameWeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500">Email (Gmail Alias Norm)</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={emailWeight}
                    onChange={(e) => setEmailWeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500">Phone (E.164 Digits)</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={phoneWeight}
                    onChange={(e) => setPhoneWeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500">Address (Trigram Abbr)</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={addressWeight}
                    onChange={(e) => setAddressWeight(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                onClick={handleRunDetection}
                disabled={executing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-colors"
              >
                <ScanSearch className="w-4 h-4" />
                {executing ? 'Executing Detection Engine...' : 'Run Detection Pipeline'}
              </button>
            </div>
          </div>
        </div>

        {/* Live Execution Feedback / Latest Run Card */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <Zap className="w-4 h-4 text-orange-600" />
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Execution Telemetry
              </h2>
            </div>

            {executing ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
                <div className="text-xs font-mono text-stone-600 dark:text-stone-300">
                  Scanning records & building blocking keys...
                </div>
              </div>
            ) : lastResult ? (
              <div className="space-y-4 text-xs font-mono">
                <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-semibold mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Detection Completed ({lastResult.durationMs}ms)
                  </div>
                  <p className="text-emerald-700 dark:text-emerald-400 font-sans text-[11px]">
                    Identified {lastResult.clustersFound} duplicate clusters and queued {lastResult.reviewPairs} pairs for human review.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1">
                    <span className="text-stone-500 font-sans">Records Scanned:</span>
                    <span className="font-semibold text-stone-900 dark:text-stone-100">
                      {lastResult.recordsScanned.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1">
                    <span className="text-stone-500 font-sans">Pairs Avoided:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {lastResult.pairsAvoidedPct}%
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1">
                    <span className="text-stone-500 font-sans">Pairs Compared:</span>
                    <span>{lastResult.pairsCompared.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1">
                    <span className="text-stone-500 font-sans">Auto-Merged Pairs:</span>
                    <span className="text-orange-600">{lastResult.autoMergedPairs}</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span className="text-stone-500 font-sans">Pending Review:</span>
                    <span className="text-orange-600 font-semibold">{lastResult.reviewPairs}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-stone-400 font-mono">
                No active job running. Configure parameters and trigger pipeline to inspect live metrics.
              </div>
            )}
          </div>

          {lastResult && (
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
              <Link
                href="/review"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-white transition-colors"
              >
                Go to Review Queue ({lastResult.reviewPairs})
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Historical Detection Runs Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
              Pipeline Execution Ledger
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Audited historical deduplication runs and blocking prune ratios
            </p>
          </div>
          <span className="text-xs font-mono text-stone-500">
            {runs.length} runs recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="px-4 py-2 text-left">Run ID</th>
                <th className="px-4 py-2 text-left">Timestamp</th>
                <th className="px-4 py-2 text-right">Records Scanned</th>
                <th className="px-4 py-2 text-right">Pairs Compared</th>
                <th className="px-4 py-2 text-right">Pairs Avoided</th>
                <th className="px-4 py-2 text-right">Clusters Found</th>
                <th className="px-4 py-2 text-right">Cutoff Thresholds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-stone-400 font-sans">
                    Loading run history...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-stone-400 font-sans">
                    No runs recorded yet. Execute your first detection job above.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50 dark:hover:bg-stone-950/50 transition-colors">
                    <td className="px-4 py-2 text-stone-400 font-mono text-[11px]">
                      {r.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2 text-stone-600 dark:text-stone-300 font-sans">
                      {new Date(r.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {new Date(r.started_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-900 dark:text-stone-100 font-semibold tabular-nums">
                      {Number(r.records_scanned).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-stone-600 dark:text-stone-300 tabular-nums">
                      {Number(r.pairs_compared).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                      {r.config?.pairsAvoidedPct ? `${r.config.pairsAvoidedPct}%` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-orange-600 dark:text-orange-400 font-semibold tabular-nums">
                      {r.clusters_found}
                    </td>
                    <td className="px-4 py-2 text-right text-[11px] text-stone-500 tabular-nums">
                      Auto: {r.threshold_auto} • Rev: {r.threshold_review}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
