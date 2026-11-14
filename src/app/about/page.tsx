import React from 'react';
import { Layers, Cpu, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* Title */}
      <div className="pb-3 border-b border-stone-200 dark:border-stone-800">
        <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          DedupeIQ Methodology & Algorithmic Foundations
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Theoretical specifications, mathematical formulations, and step-by-step worked examples
        </p>
      </div>

      {/* 7-Stage Pipeline Pipeline Architecture */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-orange-600" />
          The 7-Stage Deduplication Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
              Stage 1: Deterministic Normalization
            </div>
            <p className="text-stone-600 dark:text-stone-400 font-sans">
              Autonomous database triggers strip honorific titles (Dr, Mr, Shri), expand street abbreviations (St &rarr; Street), canonicalize Gmail dots/tags, and map colloquial nicknames (Bob &rarr; Robert).
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
              Stage 2: Multi-Key Blocking
            </div>
            <p className="text-stone-600 dark:text-stone-400 font-sans">
              Avoids quadratic O(N&sup2;) cartesian explosion by generating candidates that share phonetic Soundex, Metaphone, phone suffixes, or trigram similarity &gt; 0.40, avoiding &gt;98% unnecessary comparisons.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
              Stage 3: Pairwise Scoring Ensemble
            </div>
            <p className="text-stone-600 dark:text-stone-400 font-sans">
              Ensemble of Jaro-Winkler, Levenshtein edit ratio, PostgreSQL GIN trigram similarity, and Token-Set Ratio (word order swaps) combined into a calibrated composite score.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
              Stage 4: Decision Classification
            </div>
            <p className="text-stone-600 dark:text-stone-400 font-sans">
              Partitioned into Auto-Merge (&ge; 0.92), Human Review (0.75 &ndash; 0.92), and Non-Match (&lt; 0.75), configurable via interactive UI sliders.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
              Stage 5: Transitive Union-Find Clustering
            </div>
            <p className="text-stone-600 dark:text-stone-400 font-sans">
              Disjoint-Set forest with path compression and union by rank guarantees transitive closure: if A ~ B and B ~ C, then &#123;A, B, C&#125; coalesce into a unified equivalence cluster in O(&alpha;(N)) time.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <div className="font-semibold text-stone-900 dark:text-stone-100 mb-1">
              Stage 6 & 7: Survivorship & Reversible Merge
            </div>
            <p className="text-stone-600 dark:text-stone-400 font-sans">
              Elected Golden Master Record synthesizes longest valid strings and recent contact info. Pre-merge states are stored in <code className="text-stone-700 dark:text-stone-300">merge_log</code> JSONB for 100% reversible unmerge.
            </p>
          </div>
        </div>
      </section>

      {/* Worked Algorithm Examples */}
      <section className="space-y-6">
        <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-orange-600" />
          Worked Algorithmic Calculations
        </h2>

        {/* Jaro-Winkler */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-100 font-mono">
              1. Jaro-Winkler Similarity
            </h3>
            <span className="text-[11px] font-mono text-orange-600">Metric: 0.0000 - 1.0000</span>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400">
            Measures matching characters within search window floor(max(|s1|, |s2|) / 2) - 1 and adjusts for shared prefixes:
          </p>

          <div className="p-3 rounded bg-stone-50 dark:bg-stone-950 font-mono text-xs space-y-1 border border-stone-200 dark:border-stone-800">
            <div>Input: <span className="text-orange-600 font-semibold">&quot;MARTHA&quot;</span> vs <span className="text-orange-600 font-semibold">&quot;MARHTA&quot;</span></div>
            <div>Lengths: |s1| = 6, |s2| = 6, Matching Window = floor(6/2) - 1 = 2</div>
            <div>Matches: 6 characters matched (M, A, R, T, H, A)</div>
            <div>Transpositions: &apos;T&apos; and &apos;H&apos; swapped &rarr; 2 transposed characters &rarr; t = 1</div>
            <div>Jaro = (6/6 + 6/6 + (6 - 1)/6) / 3 = (1 + 1 + 0.833) / 3 = 0.944</div>
            <div>Common Prefix length L = 3 (&quot;MAR&quot;). Prefix scale p = 0.1</div>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
              Jaro-Winkler = 0.944 + (3 * 0.1 * (1 - 0.944)) = 0.961 (96.1% match)
            </div>
          </div>
        </div>

        {/* Token-Set Ratio */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-100 font-mono">
              2. Token-Set Ratio (Word Transposition Invariance)
            </h3>
            <span className="text-[11px] font-mono text-orange-600">Metric: Invariant to Word Swaps</span>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400">
            Standard Levenshtein fails on transposed words like &quot;Sharma Rahul&quot; vs &quot;Rahul Sharma&quot; (yielding low similarity). Token-Set Ratio resolves this by computing sorted set intersections:
          </p>

          <div className="p-3 rounded bg-stone-50 dark:bg-stone-950 font-mono text-xs space-y-1 border border-stone-200 dark:border-stone-800">
            <div>Input: <span className="text-orange-600 font-semibold">&quot;Sharma Rahul&quot;</span> vs <span className="text-orange-600 font-semibold">&quot;Rahul Sharma&quot;</span></div>
            <div>Tokens A: [&apos;rahul&apos;, &apos;sharma&apos;] (alphabetically sorted)</div>
            <div>Tokens B: [&apos;rahul&apos;, &apos;sharma&apos;] (alphabetically sorted)</div>
            <div>Intersection I: &quot;rahul sharma&quot;</div>
            <div>Diff A: [], Diff B: []</div>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
              Token-Set Ratio = JaroWinkler(I, I) = 1.0000 (100.0% exact match)
            </div>
          </div>
        </div>

        {/* Levenshtein Edit Matrix */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-100 font-mono">
              3. Normalized Levenshtein Edit Ratio
            </h3>
            <span className="text-[11px] font-mono text-orange-600">Matrix Dynamic Programming</span>
          </div>

          <p className="text-xs text-stone-600 dark:text-stone-400">
            Dynamic programming matrix calculating minimum insertions, deletions, and substitutions:
          </p>

          <div className="p-3 rounded bg-stone-50 dark:bg-stone-950 font-mono text-xs space-y-1 border border-stone-200 dark:border-stone-800">
            <div>Input: <span className="text-orange-600 font-semibold">&quot;kitten&quot;</span> vs <span className="text-orange-600 font-semibold">&quot;sitting&quot;</span></div>
            <div>Step 1: Replace &apos;k&apos; with &apos;s&apos; (&quot;sitten&quot;) [cost 1]</div>
            <div>Step 2: Replace &apos;e&apos; with &apos;i&apos; (&quot;sittin&quot;) [cost 1]</div>
            <div>Step 3: Insert &apos;g&apos; at end (&quot;sitting&quot;) [cost 1]</div>
            <div>Total Edit Distance = 3. Max String Length = max(6, 7) = 7</div>
            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
              Levenshtein Ratio = 1 - (3 / 7) = 0.5714 (57.1% match)
            </div>
          </div>
        </div>
      </section>

      {/* Relational 3NF Schema Documentation Link */}
      <section className="bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Relational Schema & Formal Normalization Proof
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            View the formal functional dependency analysis and mathematical proof verifying 3NF compliance.
          </p>
        </div>

        <Link
          href="/sql-lab"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 text-xs font-medium hover:bg-stone-800 dark:hover:bg-white transition-colors shrink-0"
        >
          Open SQL Lab
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    </div>
  );
}
