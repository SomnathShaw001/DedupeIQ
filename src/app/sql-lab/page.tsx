'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Play,
  Copy,
  Check,
  Zap,
  Info,
} from 'lucide-react';

interface SqlStage {
  id: string;
  name: string;
  category: string;
  description: string;
  sql: string;
  explanation: string;
}

export default function SqlLabPage() {
  const [stages, setStages] = useState<SqlStage[]>([]);
  const [selectedStageId, setSelectedStageId] = useState<string>('stage_1_schema');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // EXPLAIN ANALYZE Comparison State
  const [explaining, setExplaining] = useState(false);
  const [explainResult, setExplainResult] = useState<{
    queryType: string;
    plan: string[];
    executedSql: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/sql-lab')
      .then((res) => res.json())
      .then((data) => {
        setStages(data.stages || []);
        if (data.stages?.length > 0) {
          setSelectedStageId(data.stages[0].id);
        }
      })
      .catch(() => toast.error('Failed to load SQL stages'))
      .finally(() => setLoading(false));
  }, []);

  const activeStage = stages.find((s) => s.id === selectedStageId) || stages[0];

  const handleCopySql = () => {
    if (!activeStage) return;
    navigator.clipboard.writeText(activeStage.sql);
    setCopied(true);
    toast.success('SQL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunExplain = async (queryType: 'blocking_with_index' | 'cartesian_without_index') => {
    setExplaining(true);
    try {
      const res = await fetch('/api/sql-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Explain failed');
      setExplainResult(json);
      toast.success('EXPLAIN ANALYZE executed successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'EXPLAIN execution failed');
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            PostgreSQL DBMS Lab & Query Inspection
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Transparent inspection of raw parameterized SQL, relational schema constraints, triggers, and query plans
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-stone-500 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 px-2.5 py-1 rounded">
            Zero ORM • Parameterized SQL Only
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-stone-200 dark:bg-stone-800 rounded-lg animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Stages List Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            <span className="text-xs font-mono font-medium text-stone-500 uppercase tracking-wider block mb-2">
              Pipeline Stages
            </span>
            <div className="space-y-1">
              {stages.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStageId(st.id)}
                  className={`w-full text-left p-3 rounded-lg border text-xs transition-colors ${
                    selectedStageId === st.id
                      ? 'bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 border-stone-900 dark:border-stone-100 shadow-xs'
                      : 'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  <div className="font-semibold">{st.name}</div>
                  <div className="text-[10px] opacity-70 font-mono mt-0.5 truncate">
                    {st.category}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active SQL Viewer */}
          <div className="lg:col-span-3 space-y-4">
            {activeStage && (
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
                {/* Header */}
                <div className="px-5 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-950/50">
                  <div>
                    <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {activeStage.name}
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {activeStage.description}
                    </p>
                  </div>
                  <button
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                    <span>{copied ? 'Copied' : 'Copy SQL'}</span>
                  </button>
                </div>

                {/* SQL Code Block */}
                <div className="p-4 bg-stone-950 text-stone-100 font-mono text-xs overflow-x-auto max-h-[380px] leading-relaxed select-all">
                  <pre>
                    <code>{activeStage.sql}</code>
                  </pre>
                </div>

                {/* Plain-English Explanation */}
                <div className="p-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-950/80 flex items-start gap-3">
                  <Info className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 mb-0.5">
                      DBMS Architecture Note:
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed font-sans">
                      {activeStage.explanation}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXPLAIN ANALYZE Playground Section */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-600" />
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                PostgreSQL Query Execution Planner (EXPLAIN ANALYZE)
              </h2>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Empirical cost comparison: Query plan with B-Tree & Soundex blocking vs Cartesian cross join
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunExplain('blocking_with_index')}
              disabled={explaining}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5" />
              {explaining ? 'Analyzing...' : 'Run with Blocking & Index'}
            </button>
            <button
              onClick={() => handleRunExplain('cartesian_without_index')}
              disabled={explaining}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-50 text-stone-700 dark:text-stone-300 font-medium text-xs transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Run Cartesian (No Blocking)
            </button>
          </div>
        </div>

        {explainResult ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-stone-500">
                PLAN MODE: <strong className="text-stone-900 dark:text-stone-100 uppercase">{explainResult.queryType.replace(/_/g, ' ')}</strong>
              </span>
              <span className="text-stone-400">Database Engine Plan Tree</span>
            </div>

            <div className="p-4 rounded-lg bg-stone-950 text-stone-200 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
              {explainResult.plan.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.includes('Index Scan') || line.includes('Bitmap Index')
                      ? 'text-emerald-400 font-semibold'
                      : line.includes('Nested Loop')
                      ? 'text-amber-400'
                      : 'text-stone-300'
                  }
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs font-mono text-stone-400 border border-dashed border-stone-200 dark:border-stone-800 rounded-lg">
            Click one of the buttons above to execute PostgreSQL EXPLAIN ANALYZE on live records.
          </div>
        )}
      </div>
    </div>
  );
}
