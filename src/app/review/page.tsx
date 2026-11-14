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
          <span key={i} className="bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-semibold px-0.5 rounded">
            {p.value}
          </span>
        );
      }
      if (p.type === 'added') {
        return (
          <span key={i} className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold px-0.5 rounded">
            {p.value}
          </span>
        );
      }
      return <span key={i}>{p.value}</span>;
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Human Review Queue
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Borderline candidate pairs (score 0.75 – 0.92) with character-level difference highlighting
          </p>
        </div>

        {/* Keyboard shortcut legend */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400 font-mono">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700">M</kbd> Merge
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700">N</kbd> Non-match
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700">S</kbd> Skip
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-300 dark:border-stone-700">J/K</kbd> Nav
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
        <div className="space-y-6">
          {/* Progress and Candidate Counter */}
          <div className="flex items-center justify-between text-xs font-mono text-stone-500">
            <div>
              Candidate <span className="font-semibold text-stone-900 dark:text-stone-100">{currentIndex + 1}</span> of {candidates.length} (Total pending: {pendingTotal})
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
                disabled={currentIndex === 0}
                className="p-1 rounded border border-stone-200 dark:border-stone-800 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentIndex((p) => Math.min(candidates.length - 1, p + 1))}
                disabled={currentIndex === candidates.length - 1}
                className="p-1 rounded border border-stone-200 dark:border-stone-800 disabled:opacity-30 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Comparison Card */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 shadow-xs space-y-6">
            {/* Top Match Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-stone-50 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800">
              <div>
                <span className="text-xs font-mono text-stone-500 uppercase tracking-wider block">
                  Composite Match Confidence
                </span>
                <span className="text-2xl font-mono font-bold text-orange-600 dark:text-orange-500">
                  {Math.round(active.scores.finalScore * 100)}%
                </span>
                <span className="text-xs text-stone-500 ml-2 font-mono">
                  (raw: {active.scores.finalScore})
                </span>
              </div>

              {/* Per-field score bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <div className="text-stone-500 text-[10px]">Name Sim</div>
                  <div className="font-semibold">{Math.round(active.scores.nameSim * 100)}%</div>
                  <div className="w-20 bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="bg-orange-600 h-full rounded-full"
                      style={{ width: `${Math.round(active.scores.nameSim * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-stone-500 text-[10px]">Email Sim</div>
                  <div className="font-semibold">{Math.round(active.scores.emailSim * 100)}%</div>
                  <div className="w-20 bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="bg-orange-600 h-full rounded-full"
                      style={{ width: `${Math.round(active.scores.emailSim * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-stone-500 text-[10px]">Phone Sim</div>
                  <div className="font-semibold">{Math.round(active.scores.phoneSim * 100)}%</div>
                  <div className="w-20 bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="bg-orange-600 h-full rounded-full"
                      style={{ width: `${Math.round(active.scores.phoneSim * 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-stone-500 text-[10px]">Address Sim</div>
                  <div className="font-semibold">{Math.round(active.scores.addressSim * 100)}%</div>
                  <div className="w-20 bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="bg-orange-600 h-full rounded-full"
                      style={{ width: `${Math.round(active.scores.addressSim * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-Side Record Diff Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Record A */}
              <div className="p-4 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/30 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                  <span className="text-xs font-mono font-medium text-stone-500">
                    RECORD A • {active.recordA.id.slice(0, 8)}…
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800">
                    {active.recordA.source_system}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block">FULL NAME</span>
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {renderDiffText(active.diffs.name.diffA)}
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block">EMAIL</span>
                    <div className="font-mono text-stone-700 dark:text-stone-300">
                      {active.recordA.email ? renderDiffText(active.diffs.email.diffA) : <span className="italic text-stone-400">None</span>}
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block">PHONE</span>
                    <div className="font-mono text-stone-700 dark:text-stone-300">
                      {active.recordA.phone ? renderDiffText(active.diffs.phone.diffA) : <span className="italic text-stone-400">None</span>}
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block">STREET ADDRESS & CITY</span>
                    <div className="text-stone-700 dark:text-stone-300">
                      {renderDiffText(active.diffs.address.diffA)}
                    </div>
                  </div>

                  {active.recordA.dob && (
                    <div>
                      <span className="text-stone-500 font-mono text-[10px] block">DATE OF BIRTH</span>
                      <div className="font-mono text-stone-700 dark:text-stone-300">
                        {active.recordA.dob.slice(0, 10)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Record B */}
              <div className="p-4 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/30 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
                  <span className="text-xs font-mono font-medium text-stone-500">
                    RECORD B • {active.recordB.id.slice(0, 8)}…
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800">
                    {active.recordB.source_system}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block">FULL NAME</span>
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {renderDiffText(active.diffs.name.diffB)}
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block">EMAIL</span>
                    <div className="font-mono text-stone-700 dark:text-stone-300">
                      {active.recordB.email ? renderDiffText(active.diffs.email.diffB) : <span className="italic text-stone-400">None</span>}
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block">PHONE</span>
                    <div className="font-mono text-stone-700 dark:text-stone-300">
                      {active.recordB.phone ? renderDiffText(active.diffs.phone.diffB) : <span className="italic text-stone-400">None</span>}
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-500 font-mono text-[10px] block">STREET ADDRESS & CITY</span>
                    <div className="text-stone-700 dark:text-stone-300">
                      {renderDiffText(active.diffs.address.diffB)}
                    </div>
                  </div>

                  {active.recordB.dob && (
                    <div>
                      <span className="text-stone-500 font-mono text-[10px] block">DATE OF BIRTH</span>
                      <div className="font-mono text-stone-700 dark:text-stone-300">
                        {active.recordB.dob.slice(0, 10)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Decision Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDecision('merge')}
                  disabled={resolving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Merge Records [M]
                </button>
                <button
                  onClick={() => handleDecision('non_match')}
                  disabled={resolving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 text-stone-700 dark:text-stone-300 font-medium text-xs transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Not a Duplicate [N]
                </button>
              </div>

              <button
                onClick={() => handleDecision('skip')}
                disabled={resolving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 text-xs font-mono transition-colors"
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
