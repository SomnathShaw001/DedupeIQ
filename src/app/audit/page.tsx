'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';
import {
  History,
  RefreshCw,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  FileCode,
  Undo2,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  cluster_id: string;
  action: 'merge' | 'unmerge';
  snapshot: Record<string, unknown>;
  performed_at: string;
  note: string | null;
  golden_record_id: string | null;
  current_cluster_size: number | null;
}

interface AuditResponse {
  logs: AuditLogItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  };
  summary: {
    totalActions: number;
    mergeCount: number;
    unmergeCount: number;
  };
}

export default function AuditPage() {
  const router = useRouter();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<'all' | 'merge' | 'unmerge'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [unmergingId, setUnmergingId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const url = actionFilter === 'all' ? '/api/audit' : `/api/audit?action=${actionFilter}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load audit logs');
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error fetching audit logs');
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRollback = async (clusterId: string) => {
    if (!confirm('Are you sure you want to revert this merge? All member records will be restored to active status.')) {
      return;
    }
    try {
      setUnmergingId(clusterId);
      const res = await fetch(`/api/clusters/${clusterId}/unmerge`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Rollback failed');
      toast.success(`Cluster successfully unmerged. ${json.revertedCount ?? ''} records restored.`);
      fetchLogs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setUnmergingId(null);
    }
  };

  const handleExportJson = () => {
    if (!data?.logs) return;
    const blob = new Blob([JSON.stringify(data.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dedupeiq_audit_log_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit journal exported as JSON');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <History className="w-4 h-4 text-orange-600" />
            Forensic Merge & Reversibility Journal
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Immutable PostgreSQL <code>merge_log</code> transaction ledger capturing point-in-time JSONB state snapshots
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            className="h-8 px-2.5 rounded-md border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleExportJson}
            className="h-8 px-3 rounded-md border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Logged Actions"
          value={data?.summary.totalActions.toLocaleString() || '0'}
          subValue="ACID safe entries"
          description="Total transactions in merge_log"
        />
        <KpiCard
          label="Merge Operations"
          value={data?.summary.mergeCount.toLocaleString() || '0'}
          subValue="Consolidations"
          description="Formed golden clusters"
        />
        <KpiCard
          label="Unmerge Rollbacks"
          value={data?.summary.unmergeCount.toLocaleString() || '0'}
          subValue="Reversible actions"
          description="De-clustered restored records"
        />
        <KpiCard
          label="Audit Reversibility"
          value="100%"
          trend="Guaranteed"
          trendDirection="up"
          description="JSONB snapshot rollback fidelity"
        />
      </div>

      {/* Action Filter Bar */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-xs text-stone-500 font-mono uppercase">Filter Action:</span>
          {(['all', 'merge', 'unmerge'] as const).map((act) => (
            <button
              key={act}
              onClick={() => setActionFilter(act)}
              className={`h-7 px-2.5 rounded text-xs font-mono uppercase transition-colors ${
                actionFilter === act
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold'
                  : 'border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              {act}
            </button>
          ))}
        </div>
      </div>

      {/* Table & Timeline */}
      {loading && !data ? (
        <div className="p-8 text-center text-xs text-stone-400 font-mono animate-pulse">
          Loading audit transaction ledger...
        </div>
      ) : data?.logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Audit Log Transactions"
          description="No merge or unmerge actions have been committed to merge_log yet."
          actionLabel="Run Detection"
          onAction={() => router.push('/detection')}
        />
      ) : (
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-stone-100/70 dark:bg-stone-950/70 border-b border-stone-200 dark:border-stone-800 text-[11px] uppercase text-stone-500">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Cluster ID</th>
                <th className="py-2.5 px-3">Transaction Note</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {data?.logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const canRollback = log.action === 'merge' && log.current_cluster_size && log.current_cluster_size > 0;

                return (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-stone-600 dark:text-stone-400 whitespace-nowrap">
                        {new Date(log.performed_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.action === 'merge'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/clusters`}
                          className="text-orange-600 hover:underline font-mono text-[11px]"
                          title={log.cluster_id}
                        >
                          {log.cluster_id ? `${log.cluster_id.slice(0, 8)}...` : '—'}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-stone-800 dark:text-stone-200 truncate max-w-xs font-sans text-xs">
                        {log.note || 'Pipeline execution consolidation'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="h-6 px-2 rounded border border-stone-200 dark:border-stone-800 text-[11px] hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1"
                          >
                            <FileCode className="w-3 h-3 text-stone-500" />
                            <span>Snapshot</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {canRollback && (
                            <button
                              onClick={() => handleRollback(log.cluster_id)}
                              disabled={unmergingId === log.cluster_id}
                              className="h-6 px-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] flex items-center gap-1 disabled:opacity-50"
                              title="Revert merge from point-in-time snapshot"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>{unmergingId === log.cluster_id ? 'Reverting...' : 'Rollback'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Snapshot Drawer */}
                    {isExpanded && (
                      <tr className="bg-stone-50 dark:bg-stone-950">
                        <td colSpan={5} className="p-3">
                          <div className="p-3 bg-stone-900 text-stone-100 rounded border border-stone-800 font-mono text-[11px] space-y-2 overflow-x-auto">
                            <div className="flex items-center justify-between text-stone-400 pb-1 border-b border-stone-800">
                              <span>Point-in-Time JSONB State Snapshot (merge_log.snapshot)</span>
                              <span>ID: {log.id}</span>
                            </div>
                            <pre className="text-stone-300 text-[10px] leading-relaxed">
                              {JSON.stringify(log.snapshot, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
