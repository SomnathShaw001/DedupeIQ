import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../src/lib/db';
import { ensureMigrated } from '../src/lib/db/migrate';
import { runDetection } from '../src/lib/pipeline/detector';
import { randomUUID } from 'crypto';

describe('DedupeIQ Pipeline Integration', () => {
  const db = getDb();

  beforeAll(async () => {
    await ensureMigrated();
  });

  it('detects, blocks, scores, clusters, and audits duplicates end-to-end', async () => {
    // 1. Clean test sandbox
    await db.query(`DELETE FROM match_candidates`);
    await db.query(`DELETE FROM merge_log`);
    await db.query(`DELETE FROM clusters`);
    await db.query(`DELETE FROM records`);

    const id1 = randomUUID();
    const id2 = randomUUID();
    const id3 = randomUUID();
    const idDistinct = randomUUID();

    // 2. Insert records: id1, id2, and id3 are variants of the same person
    await db.query(`
      INSERT INTO records (id, entity_type, full_name, email, phone, address, city, source_system, status)
      VALUES 
        ($1, 'customer', 'Vikram Singh', 'vikram.singh@gmail.com', '9876543210', '12 MG Road', 'Pune', 'CRM', 'active'),
        ($2, 'customer', 'Singh Vikram', 'vikramsingh+work@gmail.com', '+91 98765 43210', '12 MG Rd', 'Pune', 'Portal', 'active'),
        ($3, 'customer', 'Vickram Singh', 'vikram.singh@outlook.com', '9876543210', '12 MG Road, Floor 3', 'Pune', 'App', 'active'),
        ($4, 'customer', 'Emily Johnson', 'emily.johnson@example.com', '5551234567', '45 Park Ave', 'Seattle', 'Web', 'active');
    `, [id1, id2, id3, idDistinct]);

    // 3. Execute detection pipeline
    const result = await runDetection({
      thresholdAuto: 0.90,
      thresholdReview: 0.70,
      useBlocking: true,
    });

    expect(result.recordsScanned).toBe(4);
    expect(result.pairsCompared).toBeGreaterThan(0);
    expect(result.clustersFound).toBeGreaterThanOrEqual(1);

    // 4. Verify cluster and golden record formation in DB
    const clusterRows = await db.query<{ id: string; golden_record_id: string; size: number }>(
      `SELECT * FROM clusters ORDER BY created_at DESC LIMIT 1`
    );
    expect(clusterRows.length).toBe(1);
    expect(clusterRows[0].size).toBeGreaterThanOrEqual(2);

    // 5. Verify records status updates
    const memberRows = await db.query<{ id: string; status: string; cluster_id: string }>(
      `SELECT id, status, cluster_id FROM records WHERE id IN ($1, $2, $3)`,
      [id1, id2, id3]
    );

    const activeMembers = memberRows.filter((r) => r.status === 'active');
    const mergedMembers = memberRows.filter((r) => r.status === 'merged');

    expect(activeMembers.length).toBe(1); // Golden record remains active
    expect(mergedMembers.length).toBe(memberRows.length - 1); // Others marked merged

    // 6. Verify transactional audit trail in merge_log
    const mergeLogs = await db.query<{ action: string; snapshot: { cluster_id: string } }>(
      `SELECT action, snapshot FROM merge_log WHERE cluster_id = $1`,
      [clusterRows[0].id]
    );
    expect(mergeLogs.length).toBe(1);
    expect(mergeLogs[0].action).toBe('merge');
    expect(mergeLogs[0].snapshot).toBeDefined();
  });
});
