'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';
import Papa from 'papaparse';
import {
  Search,
  Plus,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  FileSpreadsheet,
  Edit2,
  Trash2,
} from 'lucide-react';

interface RecordItem {
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
}

export default function DataPage() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [status, setStatus] = useState('');
  const [sourceSystem, setSourceSystem] = useState('');
  const [availableSources, setAvailableSources] = useState<{ name: string; count: number }[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    entity_type: 'customer',
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    dob: '',
    source_system: 'ManualEntry',
  });

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    dob: '',
    entity_type: '',
    source_system: '',
  });
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{
    insertedCount: number;
    errorCount: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      });
      if (search) params.set('search', search);
      if (entityType) params.set('entity_type', entityType);
      if (status) params.set('status', status);
      if (sourceSystem) params.set('source_system', sourceSystem);

      const res = await fetch(`/api/records?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch records');
      const json = await res.json();
      setRecords(json.data || []);
      setAvailableSources(json.sources || []);
      setTotalPages(json.pagination?.totalPages || 1);
      setTotalRecords(json.pagination?.total || 0);
    } catch {
      toast.error('Error loading records');
    } finally {
      setLoading(false);
    }
  }, [page, search, entityType, status, sourceSystem]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEdit = Boolean(editingRecord);
      const url = '/api/records';
      const method = isEdit ? 'PUT' : 'POST';
      const payload = isEdit ? { ...formData, id: editingRecord?.id } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save record');

      toast.success(isEdit ? 'Record updated successfully' : 'Record created successfully');
      setShowAddModal(false);
      setEditingRecord(null);
      setFormData({
        entity_type: 'customer',
        full_name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        dob: '',
        source_system: 'ManualEntry',
      });
      fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving record');
    }
  };

  const handleArchiveRecord = async (id: string) => {
    if (!confirm('Are you sure you want to archive this record?')) return;
    try {
      const res = await fetch(`/api/records?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to archive record');
      toast.success('Record archived');
      fetchRecords();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error archiving');
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      preview: 50,
      complete: (results) => {
        if (results.meta.fields) {
          setCsvHeaders(results.meta.fields);
          setCsvData(results.data);

          // Auto-detect mappings
          const autoMap: Record<string, string> = { ...columnMapping };
          for (const field of results.meta.fields) {
            const fLow = field.toLowerCase().replace(/[^a-z]/g, '');
            if (fLow.includes('name') && !autoMap.full_name) autoMap.full_name = field;
            if (fLow.includes('mail') && !autoMap.email) autoMap.email = field;
            if (fLow.includes('phone') && !autoMap.phone) autoMap.phone = field;
            if (fLow.includes('addr') && !autoMap.address) autoMap.address = field;
            if (fLow.includes('city') && !autoMap.city) autoMap.city = field;
            if ((fLow.includes('dob') || fLow.includes('birth')) && !autoMap.dob) autoMap.dob = field;
          }
          setColumnMapping(autoMap);
        }
      },
    });
  };

  const handleProcessImport = async () => {
    if (!csvFile || !columnMapping.full_name) {
      toast.error('Full Name column must be mapped');
      return;
    }

    setImporting(true);
    // Parse complete file
    Papa.parse<Record<string, string>>(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const mappedRecords = results.data.map((row) => ({
          full_name: row[columnMapping.full_name] || '',
          email: columnMapping.email ? row[columnMapping.email] || null : null,
          phone: columnMapping.phone ? row[columnMapping.phone] || null : null,
          address: columnMapping.address ? row[columnMapping.address] || null : null,
          city: columnMapping.city ? row[columnMapping.city] || null : null,
          dob: columnMapping.dob ? row[columnMapping.dob] || null : null,
          entity_type: columnMapping.entity_type ? (row[columnMapping.entity_type] as 'customer') || 'customer' : 'customer',
          source_system: columnMapping.source_system ? row[columnMapping.source_system] || 'CSV-Import' : 'CSV-Import',
        }));

        try {
          const res = await fetch('/api/records/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: mappedRecords }),
          });

          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Import failed');

          setImportReport({
            insertedCount: json.insertedCount,
            errorCount: json.errorCount,
            errors: json.errors || [],
          });
          toast.success(`Imported ${json.insertedCount} records successfully`);
          fetchRecords();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Import failed');
        } finally {
          setImporting(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Master Data Catalog
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Normalized 3NF entity records with phonetic index generation and cluster pointers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/api/records/export"
            download
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-medium border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>
          <button
            onClick={() => {
              setImportReport(null);
              setCsvFile(null);
              setShowImportModal(true);
            }}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-medium border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button
            onClick={() => {
              setEditingRecord(null);
              setFormData({
                entity_type: 'customer',
                full_name: '',
                email: '',
                phone: '',
                address: '',
                city: '',
                dob: '',
                source_system: 'ManualEntry',
              });
              setShowAddModal(true);
            }}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md text-xs font-medium bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Record
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-3 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by name, email, phone, city..."
            className="h-8 w-full pl-9 pr-3 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="h-8 px-2.5 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs text-stone-700 dark:text-stone-300 focus:outline-hidden"
        >
          <option value="">All Entity Domains</option>
          <option value="customer">Customers</option>
          <option value="student">Students</option>
          <option value="product">Products</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-8 px-2.5 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs text-stone-700 dark:text-stone-300 focus:outline-hidden"
        >
          <option value="">All Statuses</option>
          <option value="active">Active Standalone</option>
          <option value="merged">Merged Redundant</option>
          <option value="archived">Archived</option>
        </select>

        <button
          onClick={fetchRecords}
          title="Refresh query"
          className="h-8 w-8 flex items-center justify-center rounded-md border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Source Ingestion Pills */}
      {availableSources.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          <span className="text-[10px] uppercase font-mono text-stone-400 whitespace-nowrap">Sources:</span>
          <button
            onClick={() => {
              setSourceSystem('');
              setPage(1);
            }}
            className={`h-6 px-2 rounded-full font-mono text-[11px] transition-colors whitespace-nowrap ${
              !sourceSystem
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 font-semibold'
                : 'border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            All ({totalRecords})
          </button>
          {availableSources.map((s) => {
            const isSelected = sourceSystem === s.name;
            return (
              <button
                key={s.name}
                onClick={() => {
                  setSourceSystem(isSelected ? '' : s.name);
                  setPage(1);
                }}
                className={`h-6 px-2 rounded-full font-mono text-[11px] transition-colors whitespace-nowrap flex items-center gap-1 ${
                  isSelected
                    ? 'bg-orange-600 text-white font-semibold'
                    : 'border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <span>{s.name}</span>
                <span className={`text-[10px] ${isSelected ? 'text-orange-200' : 'text-stone-400'}`}>({s.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Records Table */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 uppercase tracking-wider font-mono border-b border-stone-200 dark:border-stone-800">
              <tr>
                <th className="px-4 py-2.5">ID</th>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5">City / DOB</th>
                <th className="px-4 py-2.5">Entity / Source</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Cluster</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-sans">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12">
                    <EmptyState
                      title="No records found"
                      description="No records match your query filters or database is empty."
                      actionLabel="Clear Filters"
                      onAction={() => {
                        setSearch('');
                        setEntityType('');
                        setStatus('');
                        setSourceSystem('');
                      }}
                    />
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50 dark:hover:bg-stone-950/50">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-stone-400">
                      {r.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-stone-900 dark:text-stone-100">
                        {r.full_name}
                      </div>
                      {r.normalized_name && r.normalized_name !== r.full_name.toLowerCase() && (
                        <div className="text-[10px] font-mono text-stone-400 truncate max-w-[180px]">
                          norm: {r.normalized_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600 dark:text-stone-300 font-mono text-[11px]">
                      {r.email || <span className="text-stone-400 italic">None</span>}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600 dark:text-stone-300 font-mono text-[11px]">
                      {r.phone || <span className="text-stone-400 italic">None</span>}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600 dark:text-stone-400">
                      <div>{r.city || '—'}</div>
                      {r.dob && <div className="text-[10px] font-mono">{r.dob.slice(0, 10)}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="capitalize text-stone-900 dark:text-stone-200 text-xs">
                        {r.entity_type}
                      </div>
                      <div className="text-[10px] font-mono text-stone-400">
                        {r.source_system}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px]">
                      {r.cluster_id ? (
                        <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
                          {r.cluster_id.slice(0, 6)}…
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-1">
                      <button
                        onClick={() => {
                          setEditingRecord(r);
                          setFormData({
                            entity_type: r.entity_type,
                            full_name: r.full_name,
                            email: r.email || '',
                            phone: r.phone || '',
                            address: r.address || '',
                            city: r.city || '',
                            dob: r.dob ? r.dob.slice(0, 10) : '',
                            source_system: r.source_system,
                          });
                          setShowAddModal(true);
                        }}
                        className="p-1 rounded text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                        title="Edit record"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchiveRecord(r.id)}
                        className="p-1 rounded text-stone-400 hover:text-red-600"
                        title="Archive record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500 font-mono">
          <div>
            Showing {(page - 1) * 25 + 1} to {Math.min(page * 25, totalRecords)} of {totalRecords.toLocaleString()} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded border border-stone-200 dark:border-stone-800 disabled:opacity-40 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
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

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg max-w-md w-full p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                {editingRecord ? 'Edit Master Record' : 'Add New Master Record'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Rahul Sharma or Jane Doe"
                  className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@domain.com"
                    className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Bengaluru"
                    className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">
                    DOB (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 104 MG Road, Suite 4B"
                  className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">
                    Entity Type
                  </label>
                  <select
                    value={formData.entity_type}
                    onChange={(e) => setFormData({ ...formData, entity_type: e.target.value })}
                    className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  >
                    <option value="customer">Customer</option>
                    <option value="student">Student</option>
                    <option value="product">Product</option>
                  </select>
                </div>
                <div>
                  <label className="block text-stone-600 dark:text-stone-400 font-medium mb-1">
                    Source System
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.source_system}
                    onChange={(e) => setFormData({ ...formData, source_system: e.target.value })}
                    className="w-full px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 font-medium"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg max-w-xl w-full p-5 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  CSV Master Data Ingestion Pipeline
                </h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {importReport ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                    Import Succeeded
                  </div>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    Inserted {importReport.insertedCount} master records into PostgreSQL.
                  </p>
                </div>

                {importReport.errorCount > 0 && (
                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800">
                    <div className="font-medium text-orange-800 dark:text-orange-300 mb-1">
                      {importReport.errorCount} Rows Skipped due to Validation:
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-stone-600 dark:text-stone-400">
                      {importReport.errors.map((e, idx) => (
                        <li key={idx}>
                          Row {e.row}: {e.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-1.5 rounded bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Step 1: File selection */}
                <div>
                  <label className="block text-stone-700 dark:text-stone-300 font-medium mb-1.5">
                    1. Select CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileUpload}
                    className="block w-full text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-stone-200 dark:file:border-stone-800 file:text-xs file:font-medium file:bg-stone-100 dark:file:bg-stone-800 file:text-stone-700 dark:file:text-stone-300 hover:file:bg-stone-200"
                  />
                </div>

                {/* Step 2: Column Mapping */}
                {csvHeaders.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                    <div className="font-medium text-stone-900 dark:text-stone-100">
                      2. Column Mapping Specification
                    </div>
                    <p className="text-stone-500 dark:text-stone-400">
                      Map CSV source headers to DedupeIQ relational 3NF columns:
                    </p>

                    <div className="grid grid-cols-2 gap-2 font-mono">
                      {Object.keys(columnMapping).map((targetField) => (
                        <div key={targetField} className="flex items-center justify-between gap-2 p-1.5 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                          <span className="text-stone-700 dark:text-stone-300">
                            {targetField} {targetField === 'full_name' && '*'}
                          </span>
                          <select
                            value={columnMapping[targetField] || ''}
                            onChange={(e) =>
                              setColumnMapping({ ...columnMapping, [targetField]: e.target.value })
                            }
                            className="text-xs px-2 py-1 rounded border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 font-sans"
                          >
                            <option value="">(Ignore)</option>
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Step 3: Preview */}
                    <div className="pt-2">
                      <div className="font-medium text-stone-900 dark:text-stone-100 mb-1">
                        3. Preview ({csvData.length} preview rows loaded)
                      </div>
                      <div className="border border-stone-200 dark:border-stone-800 rounded p-2 bg-stone-50 dark:bg-stone-950 overflow-x-auto max-h-32 text-[11px] font-mono">
                        {csvData.slice(0, 3).map((row, i) => (
                          <div key={i} className="text-stone-600 dark:text-stone-400 truncate">
                            {JSON.stringify(row)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-3 py-1.5 rounded border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!csvFile || importing || !columnMapping.full_name}
                    onClick={handleProcessImport}
                    className="px-4 py-1.5 rounded bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white font-medium"
                  >
                    {importing ? 'Importing...' : 'Execute Ingestion'}
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
