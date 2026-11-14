import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';
import { computeStringDiff, electGoldenRecord, MasterRecordData } from '@/lib/pipeline/golden-record';
import { z } from 'zod';



export async function GET(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const candidates = await db.query<{
      id: string;
      record_a: string;
      record_b: string;
      name_sim: string | number;
      email_sim: string | number;
      phone_sim: string | number;
      address_sim: string | number;
      dob_match: boolean;
      final_score: string | number;
      decision: string;
      created_at: string;
      // Record A fields
      a_name: string;
      a_email: string | null;
      a_phone: string | null;
      a_address: string | null;
      a_city: string | null;
      a_dob: string | null;
      a_source: string;
      a_status: string;
      // Record B fields
      b_name: string;
      b_email: string | null;
      b_phone: string | null;
      b_address: string | null;
      b_city: string | null;
      b_dob: string | null;
      b_source: string;
      b_status: string;
    }>(`
      SELECT 
        c.id, c.record_a, c.record_b, c.name_sim, c.email_sim, c.phone_sim, c.address_sim,
        c.dob_match, c.final_score, c.decision, c.created_at,
        ra.full_name AS a_name, ra.email AS a_email, ra.phone AS a_phone,
        ra.address AS a_address, ra.city AS a_city, ra.dob AS a_dob,
        ra.source_system AS a_source, ra.status AS a_status,
        rb.full_name AS b_name, rb.email AS b_email, rb.phone AS b_phone,
        rb.address AS b_address, rb.city AS b_city, rb.dob AS b_dob,
        rb.source_system AS b_source, rb.status AS b_status
      FROM match_candidates c
      JOIN records ra ON c.record_a = ra.id
      JOIN records rb ON c.record_b = rb.id
      WHERE c.decision = 'review'
      ORDER BY c.final_score DESC, c.created_at DESC
      LIMIT $1
    `, [limit]);

    const countRows = await db.query<{ total: string | number }>(
      `SELECT COUNT(*) AS total FROM match_candidates WHERE decision = 'review'`
    );
    const pendingTotal = Number(countRows[0]?.total || 0);

    const items = candidates.map((row) => {
      const nameDiff = computeStringDiff(row.a_name, row.b_name);
      const emailDiff = computeStringDiff(row.a_email, row.b_email);
      const phoneDiff = computeStringDiff(row.a_phone, row.b_phone);
      const addrDiff = computeStringDiff(
        [row.a_address, row.a_city].filter(Boolean).join(', '),
        [row.b_address, row.b_city].filter(Boolean).join(', ')
      );

      return {
        id: row.id,
        recordA: {
          id: row.record_a,
          full_name: row.a_name,
          email: row.a_email,
          phone: row.a_phone,
          address: row.a_address,
          city: row.a_city,
          dob: row.a_dob,
          source_system: row.a_source,
          status: row.a_status,
        },
        recordB: {
          id: row.record_b,
          full_name: row.b_name,
          email: row.b_email,
          phone: row.b_phone,
          address: row.b_address,
          city: row.b_city,
          dob: row.b_dob,
          source_system: row.b_source,
          status: row.b_status,
        },
        scores: {
          finalScore: Number(row.final_score),
          nameSim: Number(row.name_sim),
          emailSim: Number(row.email_sim),
          phoneSim: Number(row.phone_sim),
          addressSim: Number(row.address_sim),
          dobMatch: Boolean(row.dob_match),
        },
        diffs: {
          name: nameDiff,
          email: emailDiff,
          phone: phoneDiff,
          address: addrDiff,
        },
      };
    });

    return NextResponse.json({
      items,
      pendingTotal,
    });
  } catch (error) {
    console.error('Review queue error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

const reviewDecisionSchema = z.object({
  candidateId: z.string().uuid(),
  action: z.enum(['merge', 'non_match', 'skip']),
});

export async function POST(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const body = await request.json();

    const { candidateId, action } = reviewDecisionSchema.parse(body);

    if (action === 'skip') {
      return NextResponse.json({ success: true, message: 'Candidate skipped' });
    }

    if (action === 'non_match') {
      await db.query(
        `UPDATE match_candidates SET decision = 'non_match' WHERE id = $1`,
        [candidateId]
      );
      return NextResponse.json({ success: true, decision: 'non_match' });
    }

    // Action: 'merge'
    // 1. Fetch candidate pair details
    const candidateRows = await db.query<{
      record_a: string;
      record_b: string;
    }>(`SELECT record_a, record_b FROM match_candidates WHERE id = $1`, [candidateId]);

    if (candidateRows.length === 0) {
      return NextResponse.json({ error: 'Candidate pair not found' }, { status: 404 });
    }

    const { record_a, record_b } = candidateRows[0];

    let finalClusterId: string | null = null;
    await db.transaction(async (tx) => {
      // Fetch both records
      const records = await tx.query<MasterRecordData>(
        `SELECT * FROM records WHERE id IN ($1, $2)`,
        [record_a, record_b]
      );

      if (records.length < 2) {
        throw new Error('One or both records not found for merging');
      }

      // Check existing clusters
      const clusterIdA = records.find((r) => r.id === record_a)?.cluster_id;
      const clusterIdB = records.find((r) => r.id === record_b)?.cluster_id;

      let targetClusterId = clusterIdA || clusterIdB;

      // Fetch all member records belonging to these cluster(s)
      let allMembers = records;
      if (targetClusterId) {
        allMembers = await tx.query<MasterRecordData>(
          `SELECT * FROM records WHERE cluster_id = $1 OR id IN ($2, $3)`,
          [targetClusterId, record_a, record_b]
        );
      }

      // Elect golden record
      const goldenElection = electGoldenRecord(allMembers);
      const goldenId = goldenElection.goldenRecordId;

      if (!targetClusterId) {
        const clusterRes = await tx.query<{ id: string }>(
          `INSERT INTO clusters (golden_record_id, size) VALUES ($1, $2) RETURNING id`,
          [goldenId, allMembers.length]
        );
        targetClusterId = clusterRes[0].id;
      } else {
        await tx.query(
          `UPDATE clusters SET golden_record_id = $1, size = $2 WHERE id = $3`,
          [goldenId, allMembers.length, targetClusterId]
        );
      }
      finalClusterId = targetClusterId;

      // Update record assignments
      for (const m of allMembers) {
        const isGolden = m.id === goldenId;
        await tx.query(
          `UPDATE records SET cluster_id = $1, status = $2 WHERE id = $3`,
          [targetClusterId, isGolden ? 'active' : 'merged', m.id]
        );
      }

      // Update candidate decision
      await tx.query(
        `UPDATE match_candidates SET decision = 'auto_merge' WHERE id = $1`,
        [candidateId]
      );

      // Write snapshot to merge_log
      const snapshot = {
        cluster_id: targetClusterId,
        golden_record_id: goldenId,
        members: allMembers.map((m) => ({
          id: m.id,
          status: m.status,
          cluster_id: m.cluster_id,
        })),
        field_sources: goldenElection.fieldSources,
      };

      await tx.query(
        `INSERT INTO merge_log (cluster_id, action, snapshot, note) VALUES ($1, 'merge', $2, $3)`,
        [
          targetClusterId,
          JSON.stringify(snapshot),
          `Manually verified and merged via Review Queue`,
        ]
      );
    });

    return NextResponse.json({ success: true, decision: 'merged', clusterId: finalClusterId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Submit review decision error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
