import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';

export async function GET(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (action && (action === 'merge' || action === 'unmerge')) {
      params.push(action);
      whereClauses.push(`m.action = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await db.queryOne<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM merge_log m ${whereSql}`,
      params
    );
    const total = Number(countRes?.count ?? 0);

    const logSql = `
      SELECT 
        m.id,
        m.cluster_id,
        m.action,
        m.snapshot,
        m.performed_at,
        m.note,
        c.golden_record_id,
        c.size as current_cluster_size
      FROM merge_log m
      LEFT JOIN clusters c ON m.cluster_id = c.id
      ${whereSql}
      ORDER BY m.performed_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const logs = await db.query(logSql, [...params, limit, offset]);

    // Aggregate summary
    const summary = await db.queryOne<{
      total_actions: string | number;
      merge_count: string | number;
      unmerge_count: string | number;
    }>(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE action = 'merge') as merge_count,
        COUNT(*) FILTER (WHERE action = 'unmerge') as unmerge_count
      FROM merge_log
    `);

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalActions: Number(summary?.total_actions ?? 0),
        mergeCount: Number(summary?.merge_count ?? 0),
        unmergeCount: Number(summary?.unmerge_count ?? 0),
      },
    });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
