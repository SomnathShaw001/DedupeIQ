/**
 * DedupeIQ Scientific Benchmark Evaluation Engine
 * Evaluates match candidates against ground-truth clustering assignments
 * to compute Precision, Recall, F1 Score, Confusion Matrix, and Threshold vs F1 curve.
 */

import { getDb } from '../db';

export interface ConfusionMatrix {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
}

export interface ThresholdPoint {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface BenchmarkMetrics {
  totalGroundTruthDuplicates: number;
  evaluatedCandidates: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix: ConfusionMatrix;
  thresholdCurve: ThresholdPoint[];
}

export async function evaluateBenchmark(): Promise<BenchmarkMetrics> {
  const db = getDb();

  // 1. Fetch ground truth mappings
  const gtRows = await db.query<{ record_id: string; true_group_id: string }>(
    `SELECT record_id, true_group_id FROM benchmark_ground_truth`
  );
  const gtMap = new Map<string, string>();
  for (const row of gtRows) {
    gtMap.set(row.record_id, row.true_group_id);
  }

  // Find all true duplicate pairs in ground truth
  // Group by true_group_id
  const groupMembers = new Map<string, string[]>();
  for (const [recId, grpId] of gtMap.entries()) {
    const list = groupMembers.get(grpId) || [];
    list.push(recId);
    groupMembers.set(grpId, list);
  }

  const trueDuplicatePairKeys = new Set<string>();
  for (const members of groupMembers.values()) {
    if (members.length > 1) {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const idA = members[i] < members[j] ? members[i] : members[j];
          const idB = members[i] < members[j] ? members[j] : members[i];
          trueDuplicatePairKeys.add(`${idA}:${idB}`);
        }
      }
    }
  }

  const totalGroundTruthDuplicates = trueDuplicatePairKeys.size;

  // 2. Fetch match candidates from database
  const candidateRows = await db.query<{
    record_a: string;
    record_b: string;
    final_score: string | number;
    decision: 'auto_merge' | 'review' | 'non_match';
  }>(`
    SELECT record_a, record_b, final_score, decision
    FROM match_candidates
  `);

  let tp = 0;
  let fp = 0;

  const foundPositivePairKeys = new Set<string>();

  for (const c of candidateRows) {
    const idA = c.record_a < c.record_b ? c.record_a : c.record_b;
    const idB = c.record_a < c.record_b ? c.record_b : c.record_a;
    const key = `${idA}:${idB}`;

    const isMatch = c.decision === 'auto_merge' || c.decision === 'review';
    const isGroundTruthDuplicate = trueDuplicatePairKeys.has(key);

    if (isMatch) {
      foundPositivePairKeys.add(key);
      if (isGroundTruthDuplicate) {
        tp++;
      } else {
        fp++;
      }
    }
  }

  const fn = Math.max(0, totalGroundTruthDuplicates - tp);

  // Total possible negative pairs in the dataset:
  const n = gtRows.length;
  const totalPairs = n > 1 ? (n * (n - 1)) / 2 : 0;
  const totalTrueNegatives = totalPairs - totalGroundTruthDuplicates;
  const tn = Math.max(0, totalTrueNegatives - fp);

  const precision = tp + fp > 0 ? Number((tp / (tp + fp)).toFixed(4)) : 0;
  const recall = tp + fn > 0 ? Number((tp / (tp + fn)).toFixed(4)) : 0;
  const f1 =
    precision + recall > 0
      ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
      : 0;

  // 3. Compute Threshold vs F1 curve across varying threshold cutoffs
  const thresholdCurve: ThresholdPoint[] = [];
  const thresholds = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.92, 0.95, 0.98];

  for (const t of thresholds) {
    let tTP = 0;
    let tFP = 0;

    for (const c of candidateRows) {
      const score = Number(c.final_score);
      const idA = c.record_a < c.record_b ? c.record_a : c.record_b;
      const idB = c.record_a < c.record_b ? c.record_b : c.record_a;
      const key = `${idA}:${idB}`;
      const isGroundTruthDuplicate = trueDuplicatePairKeys.has(key);

      if (score >= t) {
        if (isGroundTruthDuplicate) {
          tTP++;
        } else {
          tFP++;
        }
      }
    }

    const tFN = Math.max(0, totalGroundTruthDuplicates - tTP);
    const tPrecision = tTP + tFP > 0 ? Number((tTP / (tTP + tFP)).toFixed(4)) : 0;
    const tRecall = tTP + tFN > 0 ? Number((tTP / (tTP + tFN)).toFixed(4)) : 0;
    const tF1 =
      tPrecision + tRecall > 0
        ? Number(((2 * tPrecision * tRecall) / (tPrecision + tRecall)).toFixed(4))
        : 0;

    thresholdCurve.push({
      threshold: t,
      precision: tPrecision,
      recall: tRecall,
      f1: tF1,
    });
  }

  return {
    totalGroundTruthDuplicates,
    evaluatedCandidates: candidateRows.length,
    precision,
    recall,
    f1,
    confusionMatrix: {
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      trueNegatives: tn,
    },
    thresholdCurve,
  };
}
