import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';



export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrated();
    const db = getDb();
    const { id: clusterId } = await params;

    let finalReverted = 0;
    await db.transaction(async (tx) => {
      // 1. Fetch latest snapshot
      const logRows = await tx.query<{
        id: string;
        snapshot: {
          members?: { id: string; status: string; cluster_id: string | null }[];
          cluster_id?: string;
        };
      }>(
        `SELECT id, snapshot FROM merge_log WHERE cluster_id = $1 AND action = 'merge' ORDER BY performed_at DESC LIMIT 1`,
        [clusterId]
      );

      const snapshot = logRows[0]?.snapshot;

      let revertedCount = 0;
      if (snapshot && snapshot.members && snapshot.members.length > 0) {
        // Revert member records according to pre-merge snapshot
        for (const m of snapshot.members) {
          await tx.query(
            `UPDATE records SET status = 'active', cluster_id = NULL WHERE id = $1`,
            [m.id]
          );
          revertedCount++;
        }
      } else {
        // Fallback: reset all records currently assigned to this cluster
        const currentMembers = await tx.query<{ id: string }>(
          `SELECT id FROM records WHERE cluster_id = $1`,
          [clusterId]
        );
        await tx.query(
          `UPDATE records SET status = 'active', cluster_id = NULL WHERE cluster_id = $1`,
          [clusterId]
        );
        revertedCount = currentMembers.length;
      }
      finalReverted = revertedCount;

      // Record unmerge in merge_log
      await tx.query(
        `
        INSERT INTO merge_log (cluster_id, action, snapshot, note)
        VALUES ($1, 'unmerge', $2, $3)
        `,
        [
          clusterId,
          JSON.stringify({ unmerged_at: new Date().toISOString(), prior_snapshot_id: logRows[0]?.id || null, reverted_count: revertedCount }),
          'Cluster unmerged and reverted to active standalone records',
        ]
      );

      // Delete the cluster
      await tx.query(`DELETE FROM clusters WHERE id = $1`, [clusterId]);
    });

    return NextResponse.json({
      success: true,
      revertedCount: finalReverted,
      message: `Cluster successfully unmerged and reverted ${finalReverted} records`,
    });
  } catch (error) {
    console.error('Cluster unmerge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
