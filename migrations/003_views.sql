-- Migration 003: Analytics Views
-- DedupeIQ Materialized Metric Projections and Administrative Summary Views

CREATE OR REPLACE VIEW v_duplicate_summary AS
WITH record_metrics AS (
    SELECT 
        COUNT(*) AS total_records,
        COUNT(*) FILTER (WHERE status = 'active') AS active_records,
        COUNT(*) FILTER (WHERE status = 'merged') AS merged_records,
        COUNT(*) FILTER (WHERE status = 'archived') AS archived_records,
        COUNT(*) FILTER (WHERE cluster_id IS NOT NULL) AS clustered_records
    FROM records
),
cluster_metrics AS (
    SELECT 
        COUNT(*) AS total_clusters,
        COALESCE(AVG(size), 0)::NUMERIC(5,2) AS avg_cluster_size,
        COALESCE(MAX(size), 0) AS max_cluster_size,
        COUNT(*) FILTER (WHERE size > 1) AS duplicate_clusters_count
    FROM clusters
),
candidate_metrics AS (
    SELECT 
        COUNT(*) AS total_candidates,
        COUNT(*) FILTER (WHERE decision = 'auto_merge') AS auto_merged_count,
        COUNT(*) FILTER (WHERE decision = 'review') AS pending_review_count,
        COUNT(*) FILTER (WHERE decision = 'non_match') AS non_match_count
    FROM match_candidates
),
last_run AS (
    SELECT 
        id AS last_run_id,
        finished_at AS last_run_at,
        records_scanned AS last_run_records,
        pairs_compared AS last_run_pairs,
        clusters_found AS last_run_clusters
    FROM detection_runs
    ORDER BY started_at DESC
    LIMIT 1
)
SELECT 
    r.total_records,
    r.active_records,
    r.merged_records,
    r.archived_records,
    r.clustered_records,
    c.total_clusters,
    c.duplicate_clusters_count,
    c.avg_cluster_size,
    c.max_cluster_size,
    m.total_candidates,
    m.auto_merged_count,
    m.pending_review_count,
    m.non_match_count,
    lr.last_run_id,
    lr.last_run_at,
    lr.last_run_records,
    lr.last_run_pairs,
    lr.last_run_clusters,
    CASE 
        WHEN r.total_records > 0 
        THEN ROUND((r.merged_records::NUMERIC / r.total_records::NUMERIC) * 100, 2)
        ELSE 0.00 
    END AS duplicate_reduction_pct
FROM record_metrics r
CROSS JOIN cluster_metrics c
CROSS JOIN candidate_metrics m
LEFT JOIN last_run lr ON TRUE;

COMMENT ON VIEW v_duplicate_summary IS 'Real-time aggregated KPIs covering data volume, cluster distribution, candidate decisions, and reduction percentage';

-- View for source system duplicate rate analysis
CREATE OR REPLACE VIEW v_source_duplicate_summary AS
SELECT 
    r.source_system,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE r.status = 'merged') AS merged_records,
    COUNT(*) FILTER (WHERE r.cluster_id IS NOT NULL) AS clustered_records,
    CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE r.status = 'merged')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
        ELSE 0.00 
    END AS duplicate_rate_pct
FROM records r
GROUP BY r.source_system
ORDER BY total_records DESC;

COMMENT ON VIEW v_source_duplicate_summary IS 'System-of-record metrics highlighting high-duplicate data ingestion sources';
