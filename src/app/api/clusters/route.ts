import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';



export async function GET(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '15', 10)));
    const offset = (page - 1) * limit;

    const countRows = await db.query<{ total: string | number }>(
      `SELECT COUNT(*) AS total FROM clusters WHERE size > 1`
    );
    const total = Number(countRows[0]?.total || 0);

    const clusterRows = await db.query<{
      id: string;
      golden_record_id: string;
      size: number;
      created_at: string;
      golden_name: string;
      golden_email: string | null;
      golden_phone: string | null;
      golden_city: string | null;
      entity_type: string;
    }>(`
      SELECT 
        c.id, c.golden_record_id, c.size, c.created_at,
        r.full_name AS golden_name, r.email AS golden_email,
        r.phone AS golden_phone, r.city AS golden_city, r.entity_type
      FROM clusters c
      LEFT JOIN records r ON c.golden_record_id = r.id
      WHERE c.size > 1
      ORDER BY c.size DESC, c.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // Fetch members for these clusters
    const clusterIds = clusterRows.map((c) => c.id);
    const memberMap = new Map<string, unknown[]>();

    if (clusterIds.length > 0) {
      const placeholders = clusterIds.map((_, i) => `$${i + 1}`).join(',');
      const memberRows = await db.query<{
        id: string;
        cluster_id: string;
        full_name: string;
        email: string | null;
        phone: string | null;
        status: string;
        source_system: string;
      }>(`
        SELECT id, cluster_id, full_name, email, phone, status, source_system
        FROM records
        WHERE cluster_id IN (${placeholders})
        ORDER BY created_at ASC
      `, clusterIds);

      for (const m of memberRows) {
        const list = memberMap.get(m.cluster_id) || [];
        list.push(m);
        memberMap.set(m.cluster_id, list);
      }
    }

    const clusters = clusterRows.map((c) => ({
      ...c,
      members: memberMap.get(c.id) || [],
    }));

    return NextResponse.json({
      clusters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Clusters list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
