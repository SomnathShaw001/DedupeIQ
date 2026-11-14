'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Network,
  Crown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  X,
  History,
  RefreshCw,
} from 'lucide-react';

interface ClusterItem {
  id: string;
  golden_record_id: string;
  size: number;
  created_at: string;
  golden_name: string;
  golden_email: string | null;
  golden_phone: string | null;
  golden_city: string | null;
  entity_type: string;
  members: {
    id: string;
    cluster_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    status: string;
    source_system: string;
  }[];
}

interface ClusterDetailData {
  cluster: {
    id: string;
    golden_record_id: string;
    size: number;
    created_at: string;
  };
  members: {
    id: string;
    entity_type: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    dob: string | null;
    source_system: string;
    normalized_name: string | null;
    normalized_email: string | null;
    normalized_phone: string | null;
    status: string;
    cluster_id: string | null;
    created_at: string;
  }[];
  auditLogs: {
    id: string;
    action: string;
    snapshot: Record<string, unknown>;
    performed_at: string;
    note: string | null;
  }[];
}

export default function ClustersPage() {
  const router = useRouter();
  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClusters, setTotalClusters] = useState(0);

  // Detail Modal
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [clusterDetail, setClusterDetail] = useState<ClusterDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [unmerging, setUnmerging] = useState(false);

  const fetchClusters = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/clusters?page=${page}&limit=12`);
      if (!res.ok) throw new Error('Failed to load clusters');
      const json = await res.json();
      setClusters(json.clusters || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalClusters(json.pagination?.total || 0);
    } catch {
      toast.error('Error fetching clusters');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  const openClusterDetail = async (id: string) => {
    setSelectedClusterId(id);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/clusters/${id}`);
      if (!res.ok) throw new Error('Failed to load cluster details');
      const json = await res.json();
      setClusterDetail(json);
    } catch {
      toast.error('Error loading cluster');
      setSelectedClusterId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUnmergeCluster = async (id: string) => {
    if (!confirm('Are you sure you want to unmerge this cluster? All member records will be restored to active standalone records via transactional snapshot.')) {
      return;
    }

    setUnmerging(true);
    try {
      const res = await fetch(`/api/clusters/${id}/unmerge`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unmerge failed');

      toast.success('Cluster unmerged and reverted successfully');
      setSelectedClusterId(null);
      setClusterDetail(null);
      fetchClusters();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unmerge failed');
    } finally {
      setUnmerging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Duplicate Entity Clusters
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Disjoint-set equivalence groups with elected Golden Records and transactional unmerge
          </p>
        </div>

        <button
          onClick={fetchClusters}
          title="Refresh clusters"
          className="p-1.5 rounded border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Clusters Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 bg-stone-200 dark:bg-stone-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : clusters.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={Network}
            title="No Duplicate Clusters"
            description="No clusters currently found. Run the detection pipeline to identify duplicate groups."
            actionLabel="Run Detection"
            onAction={() => router.push('/detection')}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clusters.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-5 shadow-xs flex flex-col justify-between hover:border-orange-500/50 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-100 dark:border-stone-800 mb-3">
                    <span className="text-[11px] font-mono text-stone-400">
                      ID: {c.id.slice(0, 8)}…
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                      {c.size} Records
                    </span>
                  </div>

                  {/* Golden Record Snapshot */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900 dark:text-stone-100">
                      <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span>{c.golden_name || 'Golden Master'}</span>
                    </div>

                    <div className="text-xs font-mono text-stone-500 space-y-0.5">
                      {c.golden_email && <div className="truncate">{c.golden_email}</div>}
                      {c.golden_phone && <div>{c.golden_phone}</div>}
                      {c.golden_city && <div>City: {c.golden_city}</div>}
                    </div>
                  </div>

                  {/* Member previews */}
                  <div className="border-t border-stone-100 dark:border-stone-800 pt-2 space-y-1">
                    <span className="text-[10px] uppercase font-mono text-stone-400 block">
                      Member Records:
                    </span>
                    {c.members.slice(0, 3).map((m) => (
                      <div key={m.id} className="text-[11px] flex items-center justify-between text-stone-600 dark:text-stone-400">
                        <span className="truncate max-w-[160px]">{m.full_name}</span>
                        <span className="text-[10px] font-mono text-stone-400">{m.source_system}</span>
                      </div>
                    ))}
                    {c.members.length > 3 && (
                      <div className="text-[10px] font-mono text-stone-400">
                        +{c.members.length - 3} more members
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-4 border-t border-stone-100 dark:border-stone-800 mt-4">
                  <button
                    onClick={() => openClusterDetail(c.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Inspect Details
                  </button>

                  <button
                    onClick={() => handleUnmergeCluster(c.id)}
                    className="inline-flex items-center gap-1 text-xs font-mono text-stone-500 hover:text-red-600 transition-colors"
                    title="Revert merge snapshot"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Unmerge
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 font-mono">
            <div>
              Showing page {page} of {totalPages} ({totalClusters} clusters total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-stone-200 dark:border-stone-800 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-stone-200 dark:border-stone-800 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cluster Inspect & Survivorship Drawer / Modal */}
      {selectedClusterId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg max-w-3xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-orange-600" />
                <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Cluster Deep-Dive & Survivorship Analysis
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedClusterId(null);
                  setClusterDetail(null);
                }}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDetail || !clusterDetail ? (
              <div className="py-12 text-center text-xs font-mono text-stone-400 animate-pulse">
                Fetching cluster relational members and audit logs...
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Cluster Metadata Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 font-mono">
                  <div>
                    <span className="text-stone-500">Cluster ID: </span>
                    <span className="text-stone-900 dark:text-stone-100">{clusterDetail.cluster.id}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Size: </span>
                    <span className="text-orange-600 font-semibold">{clusterDetail.cluster.size} records</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Created: </span>
                    <span>{new Date(clusterDetail.cluster.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Member Records List */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    Member Records in Equivalence Set ({clusterDetail.members.length})
                  </h3>

                  <div className="border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 font-mono border-b border-stone-200 dark:border-stone-800">
                        <tr>
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Full Name</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Source</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono text-[11px]">
                        {clusterDetail.members.map((m) => {
                          const isGolden = m.id === clusterDetail.cluster.golden_record_id;
                          return (
                            <tr
                              key={m.id}
                              className={isGolden ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'hover:bg-stone-50 dark:hover:bg-stone-950/50'}
                            >
                              <td className="px-3 py-2">
                                {isGolden ? (
                                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold font-sans">
                                    <Crown className="w-3 h-3 fill-amber-500 text-amber-500" />
                                    Golden
                                  </span>
                                ) : (
                                  <span className="text-stone-400 font-sans">Member</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-medium font-sans text-stone-900 dark:text-stone-100">
                                {m.full_name}
                              </td>
                              <td className="px-3 py-2 text-stone-600 dark:text-stone-300">
                                {m.email || '—'}
                              </td>
                              <td className="px-3 py-2 text-stone-600 dark:text-stone-300">
                                {m.phone || '—'}
                              </td>
                              <td className="px-3 py-2 text-stone-500 font-sans">
                                {m.source_system}
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={m.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Trail from merge_log */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-stone-500" />
                    Transactional Audit Journal (`merge_log`)
                  </h3>

                  <div className="border border-stone-200 dark:border-stone-800 rounded-lg p-3 bg-stone-50 dark:bg-stone-950 space-y-2 font-mono text-[11px]">
                    {clusterDetail.auditLogs.map((log) => (
                      <div key={log.id} className="pb-2 border-b border-stone-200 dark:border-stone-800 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between text-stone-700 dark:text-stone-300">
                          <span className="uppercase font-semibold text-orange-600">ACTION: {log.action}</span>
                          <span className="text-stone-400">{new Date(log.performed_at).toLocaleString()}</span>
                        </div>
                        <p className="text-stone-500 mt-0.5">{log.note || 'No notes attached'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unmerge Action Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-stone-200 dark:border-stone-800">
                  <button
                    onClick={() => handleUnmergeCluster(clusterDetail.cluster.id)}
                    disabled={unmerging}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {unmerging ? 'Rolling back...' : 'Transactional Unmerge & Revert Records'}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedClusterId(null);
                      setClusterDetail(null);
                    }}
                    className="px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
