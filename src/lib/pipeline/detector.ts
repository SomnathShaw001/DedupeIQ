/**
 * DedupeIQ Detection Engine & Pipeline Orchestrator
 * Coordinates blocking, candidate generation, pairwise scoring, classification,
 * transitive Union-Find clustering, golden record election, and batched database persistence.
 */

import { getDb, DbClient } from '../db';
import { ensureMigrated } from '../db/migrate';
import {
  scorePair,
  DEFAULT_SCORING_WEIGHTS,
  ScoringWeights,
  PairScoreResult,
} from './similarity';
import { DisjointSet } from './union-find';
import { electGoldenRecord, MasterRecordData } from './golden-record';

export interface DetectionConfig {
  entityType?: 'customer' | 'student' | 'product' | null;
  thresholdAuto?: number;
  thresholdReview?: number;
  weights?: Partial<ScoringWeights>;
  useBlocking?: boolean;
}

export interface DetectionResult {
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

export async function runDetection(config: DetectionConfig = {}): Promise<DetectionResult> {
  const startTime = Date.now();
  await ensureMigrated();
  const db = getDb();

  const thresholdAuto = config.thresholdAuto ?? 0.92;
  const thresholdReview = config.thresholdReview ?? 0.75;
  const weights: ScoringWeights = {
    ...DEFAULT_SCORING_WEIGHTS,
    ...(config.weights || {}),
  };
  const useBlocking = config.useBlocking !== false;

  // 1. Fetch active records
  let sql = `
    SELECT 
      id, entity_type, full_name, email, phone, address, city, dob, source_system,
      normalized_name, normalized_email, normalized_phone, name_soundex, name_metaphone,
      status, cluster_id, created_at
    FROM records
    WHERE status != 'archived'
  `;
  const params: unknown[] = [];
  if (config.entityType) {
    sql += ` AND entity_type = $1`;
    params.push(config.entityType);
  }
  sql += ` ORDER BY created_at ASC`;

  const records = await db.query<MasterRecordData>(sql, params);
  const n = records.length;
  const totalTheoreticalPairs = n > 1 ? (n * (n - 1)) / 2 : 0;

  if (n < 2) {
    const runId = await recordEmptyRun(db, n, thresholdAuto, thresholdReview, config);
    return {
      runId,
      recordsScanned: n,
      totalTheoreticalPairs,
      pairsCompared: 0,
      pairsAvoidedPct: 100.0,
      clustersFound: 0,
      autoMergedPairs: 0,
      reviewPairs: 0,
      nonMatchPairs: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // 2. High-Performance In-Memory Blocking Hash Indexes
  // Maps blocking key -> array of record indices
  const candidatePairKeys = new Set<string>();

  if (useBlocking) {
    const soundexBuckets = new Map<string, number[]>();
    const metaphoneBuckets = new Map<string, number[]>();
    const namePrefixBuckets = new Map<string, number[]>();
    const phoneSuffixBuckets = new Map<string, number[]>();
    const emailPrefixBuckets = new Map<string, number[]>();

    for (let i = 0; i < n; i++) {
      const r = records[i];

      // Soundex bucket
      if (r.name_soundex) {
        const bucket = soundexBuckets.get(r.name_soundex as string) || [];
        bucket.push(i);
        soundexBuckets.set(r.name_soundex as string, bucket);
      }

      // Metaphone bucket
      if (r.name_metaphone) {
        const bucket = metaphoneBuckets.get(r.name_metaphone as string) || [];
        bucket.push(i);
        metaphoneBuckets.set(r.name_metaphone as string, bucket);
      }

      // Name prefix bucket (first 3 letters of normalized name)
      const normName = (r.normalized_name as string) || '';
      if (normName.length >= 3) {
        const prefix = normName.slice(0, 3);
        const bucket = namePrefixBuckets.get(prefix) || [];
        bucket.push(i);
        namePrefixBuckets.set(prefix, bucket);
      }

      // Phone suffix bucket (last 6 digits)
      const normPhone = (r.normalized_phone as string) || '';
      if (normPhone.length >= 6) {
        const suffix = normPhone.slice(-6);
        const bucket = phoneSuffixBuckets.get(suffix) || [];
        bucket.push(i);
        phoneSuffixBuckets.set(suffix, bucket);
      }

      // Email domain + local prefix bucket
      const normEmail = (r.normalized_email as string) || '';
      if (normEmail.includes('@')) {
        const parts = normEmail.split('@');
        const key = `${parts[0].slice(0, 3)}@${parts[1]}`;
        const bucket = emailPrefixBuckets.get(key) || [];
        bucket.push(i);
        emailPrefixBuckets.set(key, bucket);
      }
    }

    // Helper to generate candidate pairs from buckets
    const addBuckets = (bucketMap: Map<string, number[]>, maxBucketSize = 300) => {
      for (const indices of bucketMap.values()) {
        if (indices.length > maxBucketSize) {
          // Skip overly broad buckets to prevent combinatorial explosion
          continue;
        }
        for (let a = 0; a < indices.length; a++) {
          for (let b = a + 1; b < indices.length; b++) {
            const idx1 = Math.min(indices[a], indices[b]);
            const idx2 = Math.max(indices[a], indices[b]);
            candidatePairKeys.add(`${idx1}:${idx2}`);
          }
        }
      }
    };

    addBuckets(soundexBuckets);
    addBuckets(metaphoneBuckets);
    addBuckets(namePrefixBuckets);
    addBuckets(phoneSuffixBuckets);
    addBuckets(emailPrefixBuckets);
  } else {
    // Brute force cartesian pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        candidatePairKeys.add(`${i}:${j}`);
      }
    }
  }

  const pairsCompared = candidatePairKeys.size;
  const pairsAvoidedPct =
    totalTheoreticalPairs > 0
      ? Number((((totalTheoreticalPairs - pairsCompared) / totalTheoreticalPairs) * 100).toFixed(2))
      : 100.0;

  // 3. Pairwise scoring and classification
  interface CandidateToSave {
    recordA: MasterRecordData;
    recordB: MasterRecordData;
    scores: PairScoreResult;
    decision: 'auto_merge' | 'review' | 'non_match';
  }

  const candidatesToSave: CandidateToSave[] = [];
  const autoMergePairs: [string, string][] = [];
  let autoMergedCount = 0;
  let reviewCount = 0;
  let nonMatchCount = 0;

  for (const pairKey of candidatePairKeys) {
    const [idxA, idxB] = pairKey.split(':').map(Number);
    const recA = records[idxA];
    const recB = records[idxB];

    // Canonical ordering: ensure record_a.id < record_b.id for DB constraint
    const [first, second] = recA.id < recB.id ? [recA, recB] : [recB, recA];

    const scores = scorePair(first, second, weights);

    let decision: 'auto_merge' | 'review' | 'non_match';
    if (scores.finalScore >= thresholdAuto) {
      decision = 'auto_merge';
      autoMergedCount++;
      autoMergePairs.push([first.id, second.id]);
    } else if (scores.finalScore >= thresholdReview) {
      decision = 'review';
      reviewCount++;
    } else {
      decision = 'non_match';
      nonMatchCount++;
    }

    // Only persist review and auto_merge pairs, plus borderline non-match pairs (>0.50) to optimize storage
    if (decision !== 'non_match' || scores.finalScore >= 0.5) {
      candidatesToSave.push({
        recordA: first,
        recordB: second,
        scores,
        decision,
      });
    }
  }

  // 4. Transitive Clustering via Union-Find for auto_merged pairs
  const uf = new DisjointSet();
  for (const [idA, idB] of autoMergePairs) {
    uf.union(idA, idB);
  }

  const ufClusters = uf.getClusters();
  // Filter for genuine duplicate clusters with size > 1
  const duplicateClusters = Array.from(ufClusters.entries()).filter(
    ([, members]) => members.length > 1
  );

  // 5. Batch Database Persistence inside Transaction
  const recordMap = new Map<string, MasterRecordData>();
  for (const r of records) {
    recordMap.set(r.id, r);
  }

  let createdRunId = '';

  await db.transaction(async (tx) => {
    // A. Batch upsert match candidates (in batches of 500)
    const BATCH_SIZE = 500;
    for (let i = 0; i < candidatesToSave.length; i += BATCH_SIZE) {
      const chunk = candidatesToSave.slice(i, i + BATCH_SIZE);
      for (const item of chunk) {
        await tx.query(
          `
          INSERT INTO match_candidates (
            record_a, record_b, name_sim, email_sim, phone_sim, address_sim, dob_match, final_score, decision
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (record_a, record_b) DO UPDATE SET
            name_sim = EXCLUDED.name_sim,
            email_sim = EXCLUDED.email_sim,
            phone_sim = EXCLUDED.phone_sim,
            address_sim = EXCLUDED.address_sim,
            dob_match = EXCLUDED.dob_match,
            final_score = EXCLUDED.final_score,
            decision = EXCLUDED.decision
          `,
          [
            item.recordA.id,
            item.recordB.id,
            item.scores.nameSim,
            item.scores.emailSim,
            item.scores.phoneSim,
            item.scores.addressSim,
            item.scores.dobMatch,
            item.scores.finalScore,
            item.decision,
          ]
        );
      }
    }

    // B. Create Clusters & elect golden records
    for (const [, memberIds] of duplicateClusters) {
      const clusterMembers = memberIds
        .map((id) => recordMap.get(id))
        .filter((r): r is MasterRecordData => r !== undefined);

      if (clusterMembers.length < 2) continue;

      const goldenElection = electGoldenRecord(clusterMembers);
      const goldenId = goldenElection.goldenRecordId;

      // Create or reuse cluster
      const clusterRows = await tx.query<{ id: string }>(
        `INSERT INTO clusters (golden_record_id, size) VALUES ($1, $2) RETURNING id`,
        [goldenId, clusterMembers.length]
      );
      const clusterId = clusterRows[0].id;

      // Mark member records
      for (const m of clusterMembers) {
        const isGolden = m.id === goldenId;
        const newStatus = isGolden ? 'active' : 'merged';
        await tx.query(
          `UPDATE records SET cluster_id = $1, status = $2 WHERE id = $3`,
          [clusterId, newStatus, m.id]
        );
      }

      // Record snapshot in merge_log for reversible unmerge
      const snapshot = {
        cluster_id: clusterId,
        golden_record_id: goldenId,
        members: clusterMembers.map((m) => ({
          id: m.id,
          status: m.status,
          cluster_id: m.cluster_id,
        })),
        field_sources: goldenElection.fieldSources,
      };

      await tx.query(
        `INSERT INTO merge_log (cluster_id, action, snapshot, note) VALUES ($1, 'merge', $2, $3)`,
        [clusterId, JSON.stringify(snapshot), `Auto-merged by detection run (${clusterMembers.length} records)`]
      );
    }

    // C. Record Detection Run Telemetry
    const runRows = await tx.query<{ id: string }>(
      `
      INSERT INTO detection_runs (
        finished_at, records_scanned, pairs_compared, clusters_found,
        threshold_auto, threshold_review, config
      ) VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        n,
        pairsCompared,
        duplicateClusters.length,
        thresholdAuto,
        thresholdReview,
        JSON.stringify({
          ...config,
          weights,
          pairsAvoidedPct,
          autoMergedCount,
          reviewCount,
          nonMatchCount,
        }),
      ]
    );

    createdRunId = runRows[0].id;
  });

  return {
    runId: createdRunId,
    recordsScanned: n,
    totalTheoreticalPairs,
    pairsCompared,
    pairsAvoidedPct,
    clustersFound: duplicateClusters.length,
    autoMergedPairs: autoMergedCount,
    reviewPairs: reviewCount,
    nonMatchPairs: nonMatchCount,
    durationMs: Date.now() - startTime,
  };
}

async function recordEmptyRun(
  db: DbClient,
  recordsScanned: number,
  thresholdAuto: number,
  thresholdReview: number,
  config: DetectionConfig
): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `
    INSERT INTO detection_runs (
      finished_at, records_scanned, pairs_compared, clusters_found,
      threshold_auto, threshold_review, config
    ) VALUES (CURRENT_TIMESTAMP, $1, 0, 0, $2, $3, $4)
    RETURNING id
    `,
    [recordsScanned, thresholdAuto, thresholdReview, JSON.stringify(config)]
  );
  return rows[0].id;
}
