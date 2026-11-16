'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Play,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Layers,
  Code2,
  Sliders,
} from 'lucide-react';

interface SimulationResult {
  success: boolean;
  normalization: {
    recordA: {
      full_name: string;
      normalized_name: string;
      email: string;
      normalized_email: string;
      phone: string;
      normalized_phone: string;
      address: string;
      normalized_address: string;
      soundex: string;
      metaphone: string;
      city: string;
      dob: string;
      source_system: string;
    };
    recordB: {
      full_name: string;
      normalized_name: string;
      email: string;
      normalized_email: string;
      phone: string;
      normalized_phone: string;
      address: string;
      normalized_address: string;
      soundex: string;
      metaphone: string;
      city: string;
      dob: string;
      source_system: string;
    };
  };
  blocking: {
    passed: boolean;
    keys: {
      soundex: { matched: boolean; keyA: string; keyB: string };
      metaphone: { matched: boolean; keyA: string; keyB: string };
      name3gramPrefix: { matched: boolean; keyA: string; keyB: string };
      phoneLast6: { matched: boolean; keyA: string; keyB: string };
      emailPrefix: { matched: boolean; keyA: string; keyB: string };
      trigramSimOver40: { matched: boolean; similarity: number };
    };
  };
  metrics: {
    nameDecomposition: {
      jaroWinkler: number;
      levenshteinRatio: number;
      tokenSetRatio: number;
      trigramSimilarity: number;
      compositeNameScore: number;
    };
    pairScores: {
      nameSim: number;
      emailSim: number;
      phoneSim: number;
      addressSim: number;
      dobMatch: boolean;
      finalScore: number;
    };
  };
  decision: {
    classification: 'auto_merge' | 'review' | 'non_match';
    thresholdAuto: number;
    thresholdReview: number;
    scorePercentage: string;
    explanation: string;
  };
  goldenRecord: {
    survivingRecord: {
      full_name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      dob: string | null;
      source_system: string;
    };
    fieldProvenance: Record<string, string>;
  };
}

const PRESETS = [
  {
    name: 'Indian Name Inversion & Nicknames',
    desc: 'Sharma Rahul vs Rahul Sharma, Gmail + alias, phone format variant',
    recordA: {
      full_name: 'Mr. Rahul Sharma',
      email: 'rahul.sharma+work@gmail.com',
      phone: '98123-45678',
      address: '45 MG Road, Suite 10',
      city: 'Bengaluru',
      dob: '1992-05-14',
      source_system: 'CRM-Salesforce',
    },
    recordB: {
      full_name: 'Sharma Rahul',
      email: 'rahulsharma@gmail.com',
      phone: '9812345678',
      address: '45 M.G. Rd., Ste 10',
      city: 'Bengaluru',
      dob: '1992-05-14',
      source_system: 'MobileApp-Android',
    },
  },
  {
    name: 'Western Nickname & Address Abbreviation',
    desc: 'Robert vs Bob, St. vs Street, Ave. vs Avenue',
    recordA: {
      full_name: 'Dr. Robert Smith',
      email: 'robert.smith@outlook.com',
      phone: '9845210987',
      address: '104 Oxford Street, Suite 4',
      city: 'London',
      dob: '1985-11-20',
      source_system: 'OnlineRegistration',
    },
    recordB: {
      full_name: 'Bob Smith',
      email: 'bob.smith@outlook.com',
      phone: '9845210987',
      address: '104 Oxford St., Ste. 4',
      city: 'London',
      dob: '1985-11-20',
      source_system: 'StudentPortal-v2',
    },
  },
  {
    name: 'Phonetic Typo & Disparate Ingestion',
    desc: 'Priya Mukherjee vs Preeya Mukherji with swapped characters',
    recordA: {
      full_name: 'Priya Mukherjee',
      email: 'priya.mukherjee@gmail.com',
      phone: '9876543210',
      address: '12 Park Street, Flat 3B',
      city: 'Kolkata',
      dob: '1998-08-12',
      source_system: 'LegacyERP-2019',
    },
    recordB: {
      full_name: 'Preeya Mukherji',
      email: 'priyamukherjee98@gmail.com',
      phone: '9876543210',
      address: '12 Park St., Apt 3B',
      city: 'Kolkata',
      dob: '1998-08-12',
      source_system: 'ManualBatchUpload',
    },
  },
  {
    name: 'Negative Control (Non-Match)',
    desc: 'Two entirely disparate entities to verify zero false positives',
    recordA: {
      full_name: 'Amit Patel',
      email: 'amit.patel@gmail.com',
      phone: '9822334455',
      address: '77 FC Road',
      city: 'Pune',
      dob: '1990-01-15',
      source_system: 'CRM-Salesforce',
    },
    recordB: {
      full_name: 'Suresh Gupta',
      email: 'suresh.gupta@outlook.com',
      phone: '9877889900',
      address: '15 Brigade Road',
      city: 'Bengaluru',
      dob: '1988-06-25',
      source_system: 'OnlineRegistration',
    },
  },
];

export default function SimulatorPage() {
  const [recordA, setRecordA] = useState(PRESETS[0].recordA);
  const [recordB, setRecordB] = useState(PRESETS[0].recordB);

  // Weights
  const [nameWeight, setNameWeight] = useState(0.45);
  const [emailWeight, setEmailWeight] = useState(0.25);
  const [phoneWeight, setPhoneWeight] = useState(0.20);
  const [addressWeight, setAddressWeight] = useState(0.10);

  // Thresholds
  const [thresholdAuto, setThresholdAuto] = useState(0.92);
  const [thresholdReview, setThresholdReview] = useState(0.75);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleSimulate = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordA,
          recordB,
          weights: { nameWeight, emailWeight, phoneWeight, addressWeight },
          thresholdAuto,
          thresholdReview,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Simulation failed');
      setResult(json);
      toast.success('Simulation executed across 7-stage engine');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (preset: typeof PRESETS[0]) => {
    setRecordA(preset.recordA);
    setRecordB(preset.recordB);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-600" />
            Interactive Deduplication Simulator
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Real-time pairwise inspector: test normalization, multi-key candidate blocking, string metrics, and golden survivorship
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulate}
            disabled={loading}
            className="h-8 px-4 rounded-md text-xs font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {loading ? 'Evaluating...' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-stone-500 font-mono uppercase">Presets:</span>
        {PRESETS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => loadPreset(p)}
            className="h-7 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-[11px] font-medium text-stone-700 dark:text-stone-300 hover:border-orange-500 hover:text-orange-600 transition-colors"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Input Comparator Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Record A */}
        <div className="p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Candidate Record A
            </span>
            <input
              type="text"
              value={recordA.source_system}
              onChange={(e) => setRecordA({ ...recordA, source_system: e.target.value })}
              className="text-[11px] font-mono px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-600 dark:text-stone-400"
              placeholder="Source System"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] uppercase font-mono text-stone-500">Full Name</label>
              <input
                type="text"
                value={recordA.full_name}
                onChange={(e) => setRecordA({ ...recordA, full_name: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-stone-500">Email Address</label>
              <input
                type="email"
                value={recordA.email}
                onChange={(e) => setRecordA({ ...recordA, email: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-stone-500">Phone</label>
              <input
                type="text"
                value={recordA.phone}
                onChange={(e) => setRecordA({ ...recordA, phone: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-stone-500">City</label>
              <input
                type="text"
                value={recordA.city}
                onChange={(e) => setRecordA({ ...recordA, city: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase font-mono text-stone-500">Street Address</label>
              <input
                type="text"
                value={recordA.address}
                onChange={(e) => setRecordA({ ...recordA, address: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Record B */}
        <div className="p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              Candidate Record B
            </span>
            <input
              type="text"
              value={recordB.source_system}
              onChange={(e) => setRecordB({ ...recordB, source_system: e.target.value })}
              className="text-[11px] font-mono px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 text-stone-600 dark:text-stone-400"
              placeholder="Source System"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] uppercase font-mono text-stone-500">Full Name</label>
              <input
                type="text"
                value={recordB.full_name}
                onChange={(e) => setRecordB({ ...recordB, full_name: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-stone-500">Email Address</label>
              <input
                type="email"
                value={recordB.email}
                onChange={(e) => setRecordB({ ...recordB, email: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-stone-500">Phone</label>
              <input
                type="text"
                value={recordB.phone}
                onChange={(e) => setRecordB({ ...recordB, phone: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-mono text-stone-500">City</label>
              <input
                type="text"
                value={recordB.city}
                onChange={(e) => setRecordB({ ...recordB, city: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase font-mono text-stone-500">Street Address</label>
              <input
                type="text"
                value={recordB.address}
                onChange={(e) => setRecordB({ ...recordB, address: e.target.value })}
                className="w-full mt-0.5 h-8 px-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Parameter Controls Accordion / Strip */}
      <div className="p-3 bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 font-medium">
          <Sliders className="w-3.5 h-3.5 text-orange-600" />
          <span>Pipeline Tuning:</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-500">w(Name):</span>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={nameWeight}
              onChange={(e) => setNameWeight(Number(e.target.value))}
              className="w-16 accent-orange-600"
            />
            <span className="font-mono text-[11px] w-6">{nameWeight.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-500">w(Email):</span>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.05"
              value={emailWeight}
              onChange={(e) => setEmailWeight(Number(e.target.value))}
              className="w-16 accent-orange-600"
            />
            <span className="font-mono text-[11px] w-6">{emailWeight.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-500">w(Phone):</span>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.05"
              value={phoneWeight}
              onChange={(e) => setPhoneWeight(Number(e.target.value))}
              className="w-16 accent-orange-600"
            />
            <span className="font-mono text-[11px] w-6">{phoneWeight.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-500">w(Address):</span>
            <input
              type="range"
              min="0.05"
              max="0.5"
              step="0.05"
              value={addressWeight}
              onChange={(e) => setAddressWeight(Number(e.target.value))}
              className="w-16 accent-orange-600"
            />
            <span className="font-mono text-[11px] w-6">{addressWeight.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-500">θ(Auto):</span>
            <input
              type="range"
              min="0.80"
              max="0.99"
              step="0.01"
              value={thresholdAuto}
              onChange={(e) => setThresholdAuto(Number(e.target.value))}
              className="w-16 accent-orange-600"
            />
            <span className="font-mono text-[11px] w-6">{thresholdAuto.toFixed(2)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-500">θ(Review):</span>
            <input
              type="range"
              min="0.50"
              max="0.85"
              step="0.01"
              value={thresholdReview}
              onChange={(e) => setThresholdReview(Number(e.target.value))}
              className="w-16 accent-orange-600"
            />
            <span className="font-mono text-[11px] w-6">{thresholdReview.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Simulator Results Display */}
      {result && (
        <div className="space-y-4 pt-2">
          {/* Classification Banner */}
          <div
            className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              result.decision.classification === 'auto_merge'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                : result.decision.classification === 'review'
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                : 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {result.decision.classification === 'auto_merge' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : result.decision.classification === 'review' ? (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              ) : (
                <XCircle className="w-6 h-6 text-stone-500" />
              )}
              <div>
                <div className="text-xs font-mono uppercase tracking-wider font-semibold">
                  Decision Outcome: {result.decision.classification.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-sm font-semibold mt-0.5">
                  {result.decision.explanation}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold font-mono tracking-tight">
                {result.decision.scorePercentage}
              </div>
              <div className="text-[10px] font-mono text-stone-500 uppercase">
                Final Ensemble Score
              </div>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Stage 1: Normalization & Phonetics */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-orange-600" />
                Stage 1: Normalization & Phonetics
              </h2>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2 bg-stone-50 dark:bg-stone-950 rounded border border-stone-100 dark:border-stone-800">
                  <div className="text-[10px] uppercase text-stone-400">Canonical Name</div>
                  <div className="text-stone-900 dark:text-stone-100 font-semibold">{result.normalization.recordA.normalized_name}</div>
                  <div className="text-stone-600 dark:text-stone-400 mt-1">{result.normalization.recordB.normalized_name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-stone-50 dark:bg-stone-950 rounded border border-stone-100 dark:border-stone-800">
                    <div className="text-[10px] uppercase text-stone-400">Soundex</div>
                    <div className="text-stone-800 dark:text-stone-200">{result.normalization.recordA.soundex} vs {result.normalization.recordB.soundex}</div>
                  </div>
                  <div className="p-2 bg-stone-50 dark:bg-stone-950 rounded border border-stone-100 dark:border-stone-800">
                    <div className="text-[10px] uppercase text-stone-400">Metaphone</div>
                    <div className="text-stone-800 dark:text-stone-200">{result.normalization.recordA.metaphone} vs {result.normalization.recordB.metaphone}</div>
                  </div>
                </div>

                <div className="p-2 bg-stone-50 dark:bg-stone-950 rounded border border-stone-100 dark:border-stone-800">
                  <div className="text-[10px] uppercase text-stone-400">Canonical Email</div>
                  <div className="truncate text-stone-800 dark:text-stone-200">{result.normalization.recordA.normalized_email}</div>
                  <div className="truncate text-stone-600 dark:text-stone-400 mt-0.5">{result.normalization.recordB.normalized_email}</div>
                </div>
              </div>
            </div>

            {/* Stage 2: Multi-Key Blocking */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                Stage 2: Multi-Key Blocking Test
              </h2>

              <p className="text-[11px] text-stone-500">
                Determines whether this pair shares an indexing block to avoid O(N²) cartesian comparison:
              </p>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between p-1.5 rounded bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800">
                  <span>Surname Soundex</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${result.blocking.keys.soundex.matched ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}>
                    {result.blocking.keys.soundex.matched ? 'MATCH' : 'DIFFERENT'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800">
                  <span>Metaphone Key</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${result.blocking.keys.metaphone.matched ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}>
                    {result.blocking.keys.metaphone.matched ? 'MATCH' : 'DIFFERENT'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800">
                  <span>Phone Suffix (6 digits)</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${result.blocking.keys.phoneLast6.matched ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}>
                    {result.blocking.keys.phoneLast6.matched ? 'MATCH' : 'DIFFERENT'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800">
                  <span>Email Domain Prefix</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${result.blocking.keys.emailPrefix.matched ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}>
                    {result.blocking.keys.emailPrefix.matched ? 'MATCH' : 'DIFFERENT'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-1.5 rounded bg-stone-50 dark:bg-stone-950 border border-stone-100 dark:border-stone-800">
                  <span>Trigram Sim ≥ 0.40</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${result.blocking.keys.trigramSimOver40.matched ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400'}`}>
                    {result.blocking.keys.trigramSimOver40.matched ? `PASS (${(result.blocking.keys.trigramSimOver40.similarity * 100).toFixed(0)}%)` : 'FAIL'}
                  </span>
                </div>
              </div>
            </div>

            {/* Stage 3: Granular String Metric Scores */}
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg p-4 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-600" />
                Stage 3: Metric Decomposition
              </h2>

              <div className="space-y-2 text-xs font-mono">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>Token-Set Ratio (Word Order Swaps)</span>
                    <span className="font-bold">{(result.metrics.nameDecomposition.tokenSetRatio * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-600 rounded-full" style={{ width: `${result.metrics.nameDecomposition.tokenSetRatio * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>Jaro-Winkler (Prefix Scaled)</span>
                    <span className="font-bold">{(result.metrics.nameDecomposition.jaroWinkler * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${result.metrics.nameDecomposition.jaroWinkler * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>Levenshtein Edit Ratio</span>
                    <span className="font-bold">{(result.metrics.nameDecomposition.levenshteinRatio * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${result.metrics.nameDecomposition.levenshteinRatio * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>PostgreSQL pg_trgm Tri-gram</span>
                    <span className="font-bold">{(result.metrics.nameDecomposition.trigramSimilarity * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600 rounded-full" style={{ width: `${result.metrics.nameDecomposition.trigramSimilarity * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Golden Master Survivorship Preview */}
          <div className="p-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-700 dark:text-stone-300 flex items-center justify-between">
              <span>Stage 6: Golden Record Survivorship Preview</span>
              <span className="text-[11px] font-mono text-stone-500 font-normal">Rule: Maximum Field Completeness & Longest Valid String</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div className="text-[10px] uppercase text-stone-400">Full Name</div>
                <div className="font-semibold truncate text-stone-900 dark:text-stone-100 mt-0.5">{result.goldenRecord.survivingRecord.full_name}</div>
                <div className="text-[9px] text-orange-600 mt-1 uppercase">{result.goldenRecord.fieldProvenance.full_name || 'Elected'}</div>
              </div>

              <div className="p-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div className="text-[10px] uppercase text-stone-400">Email Address</div>
                <div className="font-semibold truncate text-stone-900 dark:text-stone-100 mt-0.5">{result.goldenRecord.survivingRecord.email || '—'}</div>
                <div className="text-[9px] text-orange-600 mt-1 uppercase">{result.goldenRecord.fieldProvenance.email || 'Elected'}</div>
              </div>

              <div className="p-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div className="text-[10px] uppercase text-stone-400">Phone Number</div>
                <div className="font-semibold truncate text-stone-900 dark:text-stone-100 mt-0.5">{result.goldenRecord.survivingRecord.phone || '—'}</div>
                <div className="text-[9px] text-orange-600 mt-1 uppercase">{result.goldenRecord.fieldProvenance.phone || 'Elected'}</div>
              </div>

              <div className="p-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div className="text-[10px] uppercase text-stone-400">Street Address</div>
                <div className="font-semibold truncate text-stone-900 dark:text-stone-100 mt-0.5">{result.goldenRecord.survivingRecord.address || '—'}</div>
                <div className="text-[9px] text-orange-600 mt-1 uppercase">{result.goldenRecord.fieldProvenance.address || 'Elected'}</div>
              </div>

              <div className="p-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div className="text-[10px] uppercase text-stone-400">City</div>
                <div className="font-semibold truncate text-stone-900 dark:text-stone-100 mt-0.5">{result.goldenRecord.survivingRecord.city || '—'}</div>
                <div className="text-[9px] text-orange-600 mt-1 uppercase">{result.goldenRecord.fieldProvenance.city || 'Elected'}</div>
              </div>

              <div className="p-2 rounded bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800">
                <div className="text-[10px] uppercase text-stone-400">Birth Date</div>
                <div className="font-semibold truncate text-stone-900 dark:text-stone-100 mt-0.5">{result.goldenRecord.survivingRecord.dob || '—'}</div>
                <div className="text-[9px] text-orange-600 mt-1 uppercase">{result.goldenRecord.fieldProvenance.dob || 'Elected'}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
