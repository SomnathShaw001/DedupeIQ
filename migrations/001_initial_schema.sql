-- Migration 001: Initial Schema
-- DedupeIQ Master Database Schema
-- Extensions, Enums, Tables and 3NF Constraints

CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- 1. Entities master registry
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('customer', 'student', 'product')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE entities IS 'Registry of entity types tracked within DedupeIQ master data';

-- 2. Clusters table (defined before records for foreign key linkage)
CREATE TABLE IF NOT EXISTS clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    golden_record_id UUID,
    size INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE clusters IS 'Disjoint-set groupings representing real-world distinct entities with calculated golden records';

-- 3. Master records table (3NF with normalized columns and phonetic codes)
CREATE TABLE IF NOT EXISTS records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('customer', 'student', 'product')),
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    dob DATE,
    source_system TEXT NOT NULL,
    normalized_name TEXT,
    normalized_email TEXT,
    normalized_phone TEXT,
    name_soundex VARCHAR(10),
    name_metaphone VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'archived')),
    cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE records IS 'Raw and normalized entity records across heterogeneous source systems';

-- Link golden_record_id foreign key back to records
ALTER TABLE clusters
    ADD CONSTRAINT fk_clusters_golden_record
    FOREIGN KEY (golden_record_id)
    REFERENCES records(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

-- 4. Match candidates table (pairwise similarity scores and human/auto decisions)
CREATE TABLE IF NOT EXISTS match_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_a UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    record_b UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    name_sim NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    email_sim NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    phone_sim NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    address_sim NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    dob_match BOOLEAN NOT NULL DEFAULT FALSE,
    final_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('auto_merge', 'review', 'non_match')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_record_pair UNIQUE (record_a, record_b),
    CONSTRAINT chk_record_order CHECK (record_a < record_b)
);

COMMENT ON TABLE match_candidates IS 'Evaluated record pairs that passed blocking criteria with field similarities and decision classifications';

-- 5. Merge audit log (transactional snapshots for 100% reversible merge and unmerge)
CREATE TABLE IF NOT EXISTS merge_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('merge', 'unmerge')),
    snapshot JSONB NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note TEXT
);

COMMENT ON TABLE merge_log IS 'Immutable transactional audit trail capturing pre-merge states for complete reversibility';

-- 6. Detection execution runs (telemetry, performance benchmarks, and run configurations)
CREATE TABLE IF NOT EXISTS detection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    records_scanned INT NOT NULL DEFAULT 0,
    pairs_compared INT NOT NULL DEFAULT 0,
    clusters_found INT NOT NULL DEFAULT 0,
    threshold_auto NUMERIC(5,4) NOT NULL DEFAULT 0.9200,
    threshold_review NUMERIC(5,4) NOT NULL DEFAULT 0.7500,
    config JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE detection_runs IS 'Historical run metrics logging execution duration, candidates generated, and threshold hyperparameters';

-- 7. Benchmark ground truth for evaluation
CREATE TABLE IF NOT EXISTS benchmark_ground_truth (
    record_id UUID PRIMARY KEY REFERENCES records(id) ON DELETE CASCADE,
    true_group_id UUID NOT NULL
);

COMMENT ON TABLE benchmark_ground_truth IS 'Ground-truth clustering assignments for scientific benchmarking of precision, recall, and F1';
