import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    let migrationStatus = 'ok';
    let migrationError: string | null = null;
    try {
      await ensureMigrated();
    } catch (migErr) {
      migrationStatus = 'failed';
      migrationError = migErr instanceof Error ? migErr.message : String(migErr);
      console.error('Migration failed in /api/dashboard:', migErr);
    }

    const db = getDb();

    // 1. Fetch KPI metrics from analytical view
    let summary = {
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
      last_run_id: null as string | null,
      last_run_at: null as string | null,
      last_run_records: 0,
      last_run_pairs: 0,
      last_run_clusters: 0,
      duplicate_reduction_pct: '0.00',
    };

    let summaryError: string | null = null;
    try {
      const summaryRows = await db.query(`SELECT * FROM v_duplicate_summary LIMIT 1`);
      const raw = summaryRows[0] || {};
      summary = {
        total_records: Number(raw.total_records ?? 0),
        active_records: Number(raw.active_records ?? 0),
        merged_records: Number(raw.merged_records ?? 0),
        archived_records: Number(raw.archived_records ?? 0),
        clustered_records: Number(raw.clustered_records ?? 0),
        total_clusters: Number(raw.total_clusters ?? 0),
        duplicate_clusters_count: Number(raw.duplicate_clusters_count ?? 0),
        avg_cluster_size: (raw.avg_cluster_size as string) ?? '0.00',
        max_cluster_size: Number(raw.max_cluster_size ?? 0),
        total_candidates: Number(raw.total_candidates ?? 0),
        auto_merged_count: Number(raw.auto_merged_count ?? 0),
        pending_review_count: Number(raw.pending_review_count ?? 0),
        non_match_count: Number(raw.non_match_count ?? 0),
        last_run_id: (raw.last_run_id as string) ?? null,
        last_run_at: (raw.last_run_at as string) ?? null,
        last_run_records: Number(raw.last_run_records ?? 0),
        last_run_pairs: Number(raw.last_run_pairs ?? 0),
        last_run_clusters: Number(raw.last_run_clusters ?? 0),
        duplicate_reduction_pct: (raw.duplicate_reduction_pct as string) ?? '0.00',
      };
    } catch (e) {
      summaryError = e instanceof Error ? e.message : String(e);
      console.warn('v_duplicate_summary query failed:', e);
    }

    // 2. Fetch source system distribution
    let sourceRows: unknown[] = [];
    try {
      sourceRows = await db.query(`SELECT * FROM v_source_duplicate_summary`);
    } catch (e) {
      console.warn('v_source_duplicate_summary query failed:', e);
    }

    // 3. Fetch recent detection run history
    let runRows: unknown[] = [];
    try {
      runRows = await db.query(`
        SELECT 
          id, started_at, finished_at, records_scanned, pairs_compared, clusters_found,
          threshold_auto, threshold_review, config
        FROM detection_runs
        ORDER BY started_at ASC
        LIMIT 15
      `);
    } catch (e) {
      console.warn('detection_runs query failed:', e);
    }

    // 4. Entity breakdown
    let entityRows: unknown[] = [];
    try {
      entityRows = await db.query(`
        SELECT 
          entity_type,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE status = 'merged') AS merged_count
        FROM records
        GROUP BY entity_type
      `);
    } catch (e) {
      console.warn('entity breakdown query failed:', e);
    }

    return NextResponse.json({
      summary,
      sources: sourceRows,
      runs: runRows,
      entityBreakdown: entityRows,
      dbMode: db.getMode(),
      diagnostics: {
        migrationStatus,
        migrationError,
        summaryError,
      },
    });
  } catch (error) {
    console.error('Fatal error in /api/dashboard:', error);
    return NextResponse.json(
      {
        summary: {
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
        },
        sources: [],
        runs: [],
        entityBreakdown: [],
        dbMode: 'local_pglite',
        error: error instanceof Error ? error.message : 'Internal Server Error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 200 }
    );
  }
}
