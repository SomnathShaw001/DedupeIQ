'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { DiffPart } from '@/lib/pipeline/golden-record';
import { EmptyState } from '@/components/EmptyState';
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ReviewCandidate {
  id: string;
  recordA: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    dob: string | null;
    source_system: string;
    status: string;
  };
  recordB: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    dob: string | null;
    source_system: string;
    status: string;
  };
  scores: {
    finalScore: number;
    nameSim: number;
    emailSim: number;
    phoneSim: number;
    addressSim: number;
    dobMatch: boolean;
  };
  diffs: {
    name: { diffA: DiffPart[]; diffB: DiffPart[] };
    email: { diffA: DiffPart[]; diffB: DiffPart[] };
    phone: { diffA: DiffPart[]; diffB: DiffPart[] };
    address: { diffA: DiffPart[]; diffB: DiffPart[] };
  };
}

export default function ReviewQueuePage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const fetchCandidates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/review?limit=30');
      if (!res.ok) throw new Error('Failed to load review candidates');
      const json = await res.json();
      setCandidates(json.items || []);
      setPendingTotal(json.pendingTotal || 0);
      setCurrentIndex(0);
    } catch {
      toast.error('Error loading review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleDecision = useCallback(
    async (action: 'merge' | 'non_match' | 'skip') => {
      const activeCandidate = candidates[currentIndex];
      if (!activeCandidate || resolving) return;

      if (action === 'skip') {
        if (currentIndex < candidates.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          toast.info('Reached end of local queue');
        }
        return;
      }

      setResolving(true);
      try {
        const res = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidateId: activeCandidate.id,
            action,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to submit decision');

        toast.success(action === 'merge' ? 'Records merged into cluster' : 'Marked as non-match');

        // Remove from local list
        const updated = candidates.filter((_, idx) => idx !== currentIndex);
        setCandidates(updated);
        setPendingTotal((prev) => Math.max(0, prev - 1));

        if (currentIndex >= updated.length && updated.length > 0) {
          setCurrentIndex(updated.length - 1);
        }

        // Refill if queue drops low
        if (updated.length === 0) {
          fetchCandidates();
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setResolving(false);
      }
    },
    [candidates, currentIndex, resolving, fetchCandidates]
  );

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'm') {
        e.preventDefault();
        handleDecision('merge');
      } else if (key === 'n') {
        e.preventDefault();
        handleDecision('non_match');
      } else if (key === 's') {
        e.preventDefault();
        handleDecision('skip');
      } else if (key === 'j') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(candidates.length - 1, prev + 1));
      } else if (key === 'k') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDecision, candidates.length]);

  const active = candidates[currentIndex];

  const renderDiffText = (parts: DiffPart[]) => {
    return parts.map((p, i) => {
      if (p.type === 'removed') {
        return (
          <span
            key={i}
            className="bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-400 px-1 py-0.5 rounded text-xs font-mono line-through decoration-red-500/70"
            title="Character in Record A only"
          >
            {p.value}
          </span>
        );
      }
      if (p.type === 'added') {
        return (
          <span
            key={i}
            className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-1 py-0.5 rounded text-xs font-mono font-semibold underline decoration-emerald-500/70"
            title="Character in Record B only"
          >
            {p.value}
          </span>
        );
      }
      return <span key={i}>{p.value}</span>;
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              Human Review Queue
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
              Score: 0.75 – 0.92
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Side-by-side reconciliation of borderline master record pairs with character-level difference highlighting
          </p>
        </div>

        {/* Keyboard shortcut legend */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 font-mono">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 text-[10px]">M</kbd> Merge
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 text-[10px]">N</kbd> Non-match
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 text-[10px]">S</kbd> Skip
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700 text-[10px]">J/K</kbd> Nav
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-stone-400 animate-pulse">
          Loading candidate pairs for review...
        </div>
      ) : candidates.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={CheckCircle2}
            title="Review Queue Cleared"
            description="All candidate pairs have been resolved or classified as auto-merged."
            actionLabel="Run Detection Again"
            onAction={() => router.push('/detection')}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress and Candidate Counter */}
          <div className="flex items-center justify-between text-xs font-mono text-stone-500 dark:text-stone-400 px-1">
            <div className="flex items-center gap-2">
              <span>Candidate Pair</span>
              <span className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
                {currentIndex + 1} / {candidates.length}
              </span>
              <span className="text-[11px] text-stone-400">
                ({pendingTotal} total pending resolution)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                disabled={currentIndex === 0}
                title="Previous candidate (K)"
                className="h-7 w-7 flex items-center justify-center rounded border border-stone-200 dark:border-stone-800 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentIndex((p) => Math.min(candidates.length - 1, p + 1))}
                disabled={currentIndex === candidates.length - 1}
                title="Next candidate (J)"
                className="h-7 w-7 flex items-center justify-center rounded border border-stone-200 dark:border-stone-800 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Comparison Container */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 shadow-xs space-y-5">
            {/* Confidence & Score Telemetry Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-md bg-stone-50 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800">
              <div>
                <span className="text-[11px] font-mono text-stone-500 uppercase tracking-wider block">
                  Ensemble Match Confidence
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-mono font-bold text-orange-600 dark:text-orange-500 tabular-nums">
                    {(active.scores.finalScore * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-stone-500 font-mono">
                    (Threshold cutoff: ≥ 0.92 auto-merge)
                  </span>
                </div>
              </div>

              {/* Per-field score bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>Name</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200 tabular-nums">
                      {Math.round(active.scores.nameSim * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="bg-orange-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.round(active.scores.nameSim * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-stone-400 mt-1">Jaro-Winkler+TSR</div>
                </div>

                <div className="p-2 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>Email</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200 tabular-nums">
                      {Math.round(active.scores.emailSim * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="bg-orange-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.round(active.scores.emailSim * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-stone-400 mt-1">Gmail dot/plus strip</div>
                </div>

                <div className="p-2 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>Phone</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200 tabular-nums">
                      {Math.round(active.scores.phoneSim * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="bg-orange-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.round(active.scores.phoneSim * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-stone-400 mt-1">E.164 Suffix match</div>
                </div>

                <div className="p-2 rounded bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>Address</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200 tabular-nums">
                      {Math.round(active.scores.addressSim * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="bg-orange-600 h-full rounded-full transition-all"
                      style={{ width: `${Math.round(active.scores.addressSim * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-stone-400 mt-1">Abbrev expansion</div>
                </div>
              </div>
            </div>

            {/* Field-by-Field Comparator Table */}
            <div className="border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 font-mono uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="px-4 py-2.5 w-36">Field Attribute</th>
                      <th className="px-4 py-2.5 w-[38%]">
                        <div className="flex items-center justify-between">
                          <span>Record A (Left)</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-sans normal-case">
                            {active.recordA.source_system}
                          </span>
                        </div>
                      </th>
                      <th className="px-2 py-2.5 text-center w-12">Match</th>
                      <th className="px-4 py-2.5 w-[38%]">
                        <div className="flex items-center justify-between">
                          <span>Record B (Right)</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-sans normal-case">
                            {active.recordB.source_system}
                          </span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-sans">
                    {/* Full Name */}
                    <tr className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40">
                      <td className="px-4 py-3 font-mono text-[11px] font-medium text-stone-500">
                        Full Name
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">
                        {renderDiffText(active.diffs.name.diffA)}
                      </td>
                      <td className="px-2 py-3 text-center font-mono text-[11px] text-stone-400">
                        {Math.round(active.scores.nameSim * 100)}%
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">
                        {renderDiffText(active.diffs.name.diffB)}
                      </td>
                    </tr>

                    {/* Email */}
                    <tr className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40 font-mono text-xs">
                      <td className="px-4 py-3 font-mono text-[11px] font-medium text-stone-500">
                        Email Address
                      </td>
                      <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                        {active.recordA.email ? (
                          renderDiffText(active.diffs.email.diffA)
                        ) : (
                          <span className="italic text-stone-400 font-sans text-xs">None</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center font-mono text-[11px] text-stone-400">
                        {Math.round(active.scores.emailSim * 100)}%
                      </td>
                      <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                        {active.recordB.email ? (
                          renderDiffText(active.diffs.email.diffB)
                        ) : (
                          <span className="italic text-stone-400 font-sans text-xs">None</span>
                        )}
                      </td>
                    </tr>

                    {/* Phone */}
                    <tr className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40 font-mono text-xs">
                      <td className="px-4 py-3 font-mono text-[11px] font-medium text-stone-500">
                        Phone Number
                      </td>
                      <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                        {active.recordA.phone ? (
                          renderDiffText(active.diffs.phone.diffA)
                        ) : (
                          <span className="italic text-stone-400 font-sans text-xs">None</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center font-mono text-[11px] text-stone-400">
                        {Math.round(active.scores.phoneSim * 100)}%
                      </td>
                      <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                        {active.recordB.phone ? (
                          renderDiffText(active.diffs.phone.diffB)
                        ) : (
                          <span className="italic text-stone-400 font-sans text-xs">None</span>
                        )}
                      </td>
                    </tr>

                    {/* Street Address & City */}
                    <tr className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40 text-xs">
                      <td className="px-4 py-3 font-mono text-[11px] font-medium text-stone-500">
                        Address & City
                      </td>
                      <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                        {renderDiffText(active.diffs.address.diffA)}
                      </td>
                      <td className="px-2 py-3 text-center font-mono text-[11px] text-stone-400">
                        {Math.round(active.scores.addressSim * 100)}%
                      </td>
                      <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                        {renderDiffText(active.diffs.address.diffB)}
                      </td>
                    </tr>

                    {/* Date of Birth */}
                    {(active.recordA.dob || active.recordB.dob) && (
                      <tr className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40 font-mono text-xs">
                        <td className="px-4 py-3 font-mono text-[11px] font-medium text-stone-500">
                          Date of Birth
                        </td>
                        <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                          {active.recordA.dob ? active.recordA.dob.slice(0, 10) : <span className="italic text-stone-400 font-sans text-xs">None</span>}
                        </td>
                        <td className="px-2 py-3 text-center font-mono text-[11px] text-stone-400">
                          {active.scores.dobMatch ? '100%' : '≠'}
                        </td>
                        <td className="px-4 py-3 text-stone-700 dark:text-stone-300">
                          {active.recordB.dob ? active.recordB.dob.slice(0, 10) : <span className="italic text-stone-400 font-sans text-xs">None</span>}
                        </td>
                      </tr>
                    )}

                    {/* Record Metadata / IDs */}
                    <tr className="hover:bg-stone-50/50 dark:hover:bg-stone-950/40 font-mono text-[11px] text-stone-500 bg-stone-50/30 dark:bg-stone-950/20">
                      <td className="px-4 py-2 font-medium text-stone-400">
                        Internal UUID
                      </td>
                      <td className="px-4 py-2">
                        {active.recordA.id}
                      </td>
                      <td className="px-2 py-2 text-center">ID</td>
                      <td className="px-4 py-2">
                        {active.recordB.id}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Decision Action Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => handleDecision('merge')}
                  disabled={resolving}
                  className="flex-1 sm:flex-initial h-9 inline-flex items-center justify-center gap-2 px-4 rounded-md bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white disabled:opacity-50 font-medium text-xs shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Merge Records [M]
                </button>
                <button
                  onClick={() => handleDecision('non_match')}
                  disabled={resolving}
                  className="flex-1 sm:flex-initial h-9 inline-flex items-center justify-center gap-2 px-4 rounded-md border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 text-stone-700 dark:text-stone-300 font-medium text-xs transition-colors"
                >
                  <XCircle className="w-4 h-4 text-red-500" />
                  Not a Duplicate [N]
                </button>
              </div>

              <button
                onClick={() => handleDecision('skip')}
                disabled={resolving}
                className="h-9 inline-flex items-center gap-1.5 px-3 rounded-md text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 text-xs font-mono transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip Candidate [S]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
