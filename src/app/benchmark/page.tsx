'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';
import {
  TestTube,
  RefreshCw,
  Target,
  Play,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface BenchmarkMetricsData {
  totalGroundTruthDuplicates: number;
  evaluatedCandidates: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix: {
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    trueNegatives: number;
  };
  thresholdCurve: {
    threshold: number;
    precision: number;
    recall: number;
    f1: number;
  }[];
}

export default function BenchmarkPage() {
  const [metrics, setMetrics] = useState<BenchmarkMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/benchmark');
      if (!res.ok) throw new Error('Failed to load benchmark evaluation');
      const json = await res.json();
      setMetrics(json.metrics || null);
    } catch {
      toast.error('Error fetching benchmark metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchMetrics();
  }, []);

  const handleSeed = async () => {
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
        `Seeded ${json.result.totalRecords} records with ${json.result.injectedDuplicates} injected duplicates (${json.result.duplicatePercentage}%)`
      );

      // Trigger detection to generate candidate scores against the new seed
      const detRes = await fetch('/api/detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useBlocking: true, thresholdAuto: 0.92, thresholdReview: 0.75 }),
      });
      if (detRes.ok) {
        toast.success('Detection pipeline evaluated against ground truth');
      }

      fetchMetrics();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Scientific Benchmark & Ground-Truth Evaluation
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Empirical validation against labeled synthetic master records with controlled typographic and phonetic noise
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMetrics}
            title="Refresh metrics"
            className="p-1.5 rounded border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white transition-colors shadow-xs"
          >
            <Play className="w-3.5 h-3.5" />
            {seeding ? 'Generating 2,000 Records...' : 'Generate 2,000 Benchmark Records'}
          </button>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-stone-200 dark:bg-stone-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : metrics ? (
        <div className="space-y-8">
          {/* Top Score Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Precision (PPV)"
              value={`${(metrics.precision * 100).toFixed(1)}%`}
              subValue={`${metrics.confusionMatrix.truePositives} TP / ${metrics.confusionMatrix.truePositives + metrics.confusionMatrix.falsePositives} Predicted`}
              description="Proportion of predicted duplicates that are true duplicates"
            />
            <KpiCard
              label="Recall (Sensitivity)"
              value={`${(metrics.recall * 100).toFixed(1)}%`}
              subValue={`${metrics.confusionMatrix.truePositives} / ${metrics.totalGroundTruthDuplicates} Injected`}
              description="Proportion of true duplicates successfully detected"
            />
            <KpiCard
              label="F1 Score (Harmonic Mean)"
              value={(metrics.f1 * 100).toFixed(1)}
              subValue={`Score: ${metrics.f1}`}
              description="Harmonic mean of precision and recall balance"
            />
            <KpiCard
              label="Ground Truth Universe"
              value={metrics.totalGroundTruthDuplicates}
              subValue={`${metrics.evaluatedCandidates} pairs evaluated`}
              description="Total injected duplicate pairs in benchmark ground truth"
            />
          </div>

          {/* Confusion Matrix and Methodology */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* 2x2 Contingency Matrix */}
            <div className="lg:col-span-5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-stone-200 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-orange-600" />
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                      Binary Contingency Matrix (2×2)
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400">
                    N = {metrics.evaluatedCandidates.toLocaleString()} pairs
                  </span>
                </div>

                <div className="border border-stone-200 dark:border-stone-800 rounded-md overflow-hidden text-xs font-mono">
                  <table className="w-full text-center">
                    <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 border-b border-stone-200 dark:border-stone-800 text-[10px] uppercase tracking-wider">
                      <tr>
                        <th className="px-2 py-2 text-left font-sans text-stone-400">Pred \ Truth</th>
                        <th className="px-2 py-2 text-emerald-700 dark:text-emerald-400 font-semibold">Actual Dup (+)</th>
                        <th className="px-2 py-2 text-stone-600 dark:text-stone-400 font-semibold">Actual Distinct (−)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {/* Row 1: Predicted Positive */}
                      <tr>
                        <td className="px-2.5 py-2.5 text-left font-sans text-stone-600 dark:text-stone-400 font-medium text-[11px] bg-stone-50/50 dark:bg-stone-950/30">
                          Pred. Duplicate
                        </td>
                        <td className="px-2.5 py-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border-r border-stone-100 dark:border-stone-800">
                          <span className="text-base font-bold text-emerald-800 dark:text-emerald-300 block tabular-nums">
                            {metrics.confusionMatrix.truePositives}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans block">
                            TP (Hit)
                          </span>
                        </td>
                        <td className="px-2.5 py-2.5 bg-red-50/50 dark:bg-red-950/30">
                          <span className="text-base font-bold text-red-700 dark:text-red-400 block tabular-nums">
                            {metrics.confusionMatrix.falsePositives}
                          </span>
                          <span className="text-[10px] text-red-500 font-sans block">
                            FP (Type I Error)
                          </span>
                        </td>
                      </tr>

                      {/* Row 2: Predicted Negative */}
                      <tr>
                        <td className="px-2.5 py-2.5 text-left font-sans text-stone-600 dark:text-stone-400 font-medium text-[11px] bg-stone-50/50 dark:bg-stone-950/30">
                          Pred. Distinct
                        </td>
                        <td className="px-2.5 py-2.5 bg-amber-50/50 dark:bg-amber-950/30 border-r border-stone-100 dark:border-stone-800">
                          <span className="text-base font-bold text-amber-700 dark:text-amber-400 block tabular-nums">
                            {metrics.confusionMatrix.falseNegatives}
                          </span>
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans block">
                            FN (Type II Error)
                          </span>
                        </td>
                        <td className="px-2.5 py-2.5 bg-stone-50/70 dark:bg-stone-950/60">
                          <span className="text-base font-bold text-stone-700 dark:text-stone-300 block tabular-nums">
                            {metrics.confusionMatrix.trueNegatives.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-stone-500 font-sans block">
                            TN (Filtered)
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-stone-100 dark:border-stone-800 text-[11px] font-sans text-stone-500 space-y-1">
                <div className="flex justify-between font-mono">
                  <span>Precision (PPV = TP / (TP+FP)):</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {(metrics.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>Recall (TPR = TP / (TP+FN)):</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {(metrics.recall * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Threshold vs F1 Optimization Curve */}
            <div className="lg:col-span-7 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4 shadow-xs">
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-stone-200 dark:border-stone-800">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Threshold Sensitivity Curve (PR / F1 Trade-off)
                  </h2>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Continuous evaluation of F1 harmonic mean across similarity cutoff threshold θ
                  </p>
                </div>
              </div>

              <div className="h-64 w-full pt-2">
                {mounted && metrics.thresholdCurve && metrics.thresholdCurve.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={metrics.thresholdCurve}
                      margin={{ top: 10, right: 25, left: 10, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#292524" opacity={0.2} />
                      <XAxis
                        dataKey="threshold"
                        stroke="#78716c"
                        fontSize={10}
                        tickLine={false}
                        domain={[0.5, 1.0]}
                        tickFormatter={(v) => Number(v).toFixed(2)}
                        label={{
                          value: 'Similarity Cutoff Threshold (θ)',
                          position: 'insideBottom',
                          offset: -14,
                          fill: '#78716c',
                          fontSize: 10,
                        }}
                      />
                      <YAxis
                        stroke="#78716c"
                        fontSize={10}
                        tickLine={false}
                        domain={[0, 1]}
                        tickFormatter={(v) => `${Math.round(v * 100)}%`}
                        label={{
                          value: 'Metric Rate (%)',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 0,
                          fill: '#78716c',
                          fontSize: 10,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1c1917',
                          borderColor: '#292524',
                          fontSize: '11px',
                          color: '#f5f5f4',
                          borderRadius: '4px',
                          padding: '6px 10px',
                        }}
                        formatter={(val, name) => [
                          `${(Number(val) * 100).toFixed(1)}%`,
                          name === 'f1' ? 'F1 Harmonic Mean' : name === 'precision' ? 'Precision' : 'Recall',
                        ]}
                        labelFormatter={(label) => `Threshold θ = ${Number(label).toFixed(2)}`}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{ fontSize: '10px', paddingBottom: '8px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="f1"
                        name="F1 Score"
                        stroke="#ea580c"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="precision"
                        name="Precision"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="recall"
                        name="Recall"
                        stroke="#78716c"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-stone-400 font-mono">
                    {mounted ? 'No threshold curve data' : 'Loading sensitivity curve...'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Synthetic Corruption Taxonomy */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Injected Corruption Taxonomy in Synthetic Generator
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Simulates real-world master data noise introduced by distributed heterogeneous ingestion systems
              </p>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-3 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
                <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
                  1. Nickname Mappings
                </div>
                <div className="text-stone-500 font-sans">
                  Swaps formal names with nicknames (Robert &rarr; Bob, William &rarr; Bill, Alexander &rarr; Alex). Resolved by stage-1 dictionary normalizer.
                </div>
              </div>

              <div className="p-3 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
                <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
                  2. Token Order Transpositions
                </div>
                <div className="text-stone-500 font-sans">
                  Swaps surname and given name (e.g. &quot;Sharma Rahul&quot; vs &quot;Rahul Sharma&quot;). Handled by stage-3 Token-Set Ratio algorithm.
                </div>
              </div>

              <div className="p-3 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
                <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
                  3. Typographic Letter Swaps
                </div>
                <div className="text-stone-500 font-sans">
                  Transposes adjacent letters (e.g. &quot;Sharma&quot; &rarr; &quot;Shahrma&quot;). Scored via Jaro-Winkler with prefix scaling factor.
                </div>
              </div>

              <div className="p-3 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
                <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
                  4. Gmail Sub-Addressing Aliases
                </div>
                <div className="text-stone-500 font-sans">
                  Injects dot variations and +tags (e.g. &quot;john.doe+work@gmail.com&quot;). Normalized to canonical form via database trigger.
                </div>
              </div>

              <div className="p-3 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
                <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
                  5. Phone Country Code Variants
                </div>
                <div className="text-stone-500 font-sans">
                  Formats numbers with +91, +1, or leading trunk zeros. Canonicalized to uniform digit string for exact/suffix matching.
                </div>
              </div>

              <div className="p-3 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950">
                <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
                  6. Address Abbreviation Expansions
                </div>
                <div className="text-stone-500 font-sans">
                  Replaces St &rarr; Street, Rd &rarr; Road, Ste &rarr; Suite, Apt &rarr; Apartment. Evaluated via fuzzy token set similarity.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-12">
          <EmptyState
            icon={TestTube}
            title="Benchmark Dataset Uninitialized"
            description="Generate a synthetic dataset of 2,000 records with 15% ground truth duplicates to view evaluation metrics."
            actionLabel="Generate 2,000 Records"
            onAction={handleSeed}
          />
        </div>
      )}
    </div>
  );
}
