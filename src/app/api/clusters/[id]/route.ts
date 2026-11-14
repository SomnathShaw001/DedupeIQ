import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';



export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureMigrated();
    const db = getDb();
    const { id: clusterId } = await params;

    // 1. Fetch cluster
    const clusterRows = await db.query<{
      id: string;
      golden_record_id: string;
      size: number;
      created_at: string;
    }>(`SELECT * FROM clusters WHERE id = $1`, [clusterId]);

    if (clusterRows.length === 0) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 });
    }

    const cluster = clusterRows[0];

    // 2. Fetch member records
    const members = await db.query(`
      SELECT 
        id, entity_type, full_name, email, phone, address, city, dob, source_system,
        normalized_name, normalized_email, normalized_phone, name_soundex, name_metaphone,
        status, cluster_id, created_at
      FROM records
      WHERE cluster_id = $1
      ORDER BY created_at ASC
    `, [clusterId]);

    // 3. Fetch audit merge log for this cluster
    const auditLogs = await db.query(`
      SELECT id, action, snapshot, performed_at, note
      FROM merge_log
      WHERE cluster_id = $1
      ORDER BY performed_at DESC
    `, [clusterId]);

    return NextResponse.json({
      cluster,
      members,
      auditLogs,
    });
  } catch (error) {
    console.error('Cluster detail error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
