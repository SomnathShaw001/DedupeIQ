import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';
import Papa from 'papaparse';



export async function GET() {
  try {
    await ensureMigrated();
    const db = getDb();

    const rows = await db.query(`
      SELECT 
        r.id,
        r.entity_type,
        r.full_name,
        r.email,
        r.phone,
        r.address,
        r.city,
        r.dob,
        r.source_system,
        r.status,
        r.cluster_id,
        CASE WHEN c.golden_record_id = r.id THEN 'true' ELSE 'false' END AS is_golden_record,
        r.created_at
      FROM records r
      LEFT JOIN clusters c ON r.cluster_id = c.id
      ORDER BY r.cluster_id NULLS LAST, r.created_at ASC
    `);

    const csvString = Papa.unparse(rows);

    return new NextResponse(csvString, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dedupeiq_records_${Date.now()}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
