import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';



export async function GET() {
  try {
    await ensureMigrated();
    const db = getDb();

    // 1. Fetch KPI metrics from analytical view
    const summaryRows = await db.query(`SELECT * FROM v_duplicate_summary LIMIT 1`);
    const summary = summaryRows[0] || {
      total_records: 0,
      active_records: 0,
      merged_records: 0,
      archived_records: 0,
      clustered_records: 0,
      total_clusters: 0,
      duplicate_clusters_count: 0,
      avg_cluster_size: '0.00',
      max_cluster_size: 0,
      total_candidates: 0,
      auto_merged_count: 0,
      pending_review_count: 0,
      non_match_count: 0,
      last_run_id: null,
      last_run_at: null,
      last_run_records: 0,
      last_run_pairs: 0,
      last_run_clusters: 0,
      duplicate_reduction_pct: '0.00',
    };

    // 2. Fetch source system distribution
    const sourceRows = await db.query(`SELECT * FROM v_source_duplicate_summary`);

    // 3. Fetch recent detection run history for trend visualization
    const runRows = await db.query(`
      SELECT 
        id, started_at, finished_at, records_scanned, pairs_compared, clusters_found,
        threshold_auto, threshold_review, config
      FROM detection_runs
      ORDER BY started_at ASC
      LIMIT 15
    `);

    // 4. Entity breakdown
    const entityRows = await db.query(`
      SELECT 
        entity_type,
        COUNT(*) AS count,
        COUNT(*) FILTER (WHERE status = 'merged') AS merged_count
      FROM records
      GROUP BY entity_type
    `);

    return NextResponse.json({
      summary,
      sources: sourceRows,
      runs: runRows,
      entityBreakdown: entityRows,
      dbMode: db.getMode(),
    });
  } catch (error) {
    console.error('Error in /api/dashboard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
