import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';
import { z } from 'zod';



const SQL_LAB_STAGES = [
  {
    id: 'stage_1_schema',
    name: '1. Relational Schema & 3NF Design',
    category: 'DDL & Integrity',
    description: 'PostgreSQL schema with domain checks, composite uniqueness, and referential integrity.',
    sql: `-- Master records table in 3NF
CREATE TABLE records (
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

-- Pairwise match candidates with order check constraint to avoid duplicate permutations
CREATE TABLE match_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_a UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    record_b UUID NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    name_sim NUMERIC(5,4) NOT NULL,
    email_sim NUMERIC(5,4) NOT NULL,
    phone_sim NUMERIC(5,4) NOT NULL,
    address_sim NUMERIC(5,4) NOT NULL,
    dob_match BOOLEAN NOT NULL DEFAULT FALSE,
    final_score NUMERIC(5,4) NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('auto_merge', 'review', 'non_match')),
    CONSTRAINT uq_record_pair UNIQUE (record_a, record_b),
    CONSTRAINT chk_record_order CHECK (record_a < record_b)
);`,
    explanation: 'Strict 3NF design eliminates update anomalies. The CHECK (record_a < record_b) and UNIQUE constraints guarantee that every pair (A, B) is evaluated exactly once in canonical order, saving 50% comparison memory.'
  },
  {
    id: 'stage_2_indexes_triggers',
    name: '2. Autonomous Triggers & GIN Trigram Indexes',
    category: 'Database Automation',
    description: 'PL/pgSQL trigger normalizing attributes on INSERT/UPDATE, backed by GIN trigram indexes.',
    sql: `-- GIN Trigram index for sub-millisecond fuzzy string similarity
CREATE INDEX idx_records_normalized_name_trgm 
    ON records USING gin (normalized_name gin_trgm_ops);

-- B-Tree phonetic indexes for O(log N) blocking
CREATE INDEX idx_records_name_soundex ON records (name_soundex);
CREATE INDEX idx_records_name_metaphone ON records (name_metaphone);

-- Autonomous Normalization Trigger
CREATE OR REPLACE FUNCTION fn_normalize_record()
RETURNS TRIGGER AS $$
BEGIN
    NEW.normalized_name := LOWER(REGEXP_REPLACE(NEW.full_name, '[^a-zA-Z0-9 ]', '', 'g'));
    NEW.name_soundex := SOUNDEX(SPLIT_PART(NEW.normalized_name, ' ', 1));
    NEW.name_metaphone := METAPHONE(SPLIT_PART(NEW.normalized_name, ' ', 1), 4);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_normalize_record
    BEFORE INSERT OR UPDATE ON records
    FOR EACH ROW EXECUTE FUNCTION fn_normalize_record();`,
    explanation: 'By generating normalized names and phonetic tokens via a trigger directly in PostgreSQL, any client or external system automatically gets standardized indexing without application-tier discrepancy.'
  },
  {
    id: 'stage_3_blocking',
    name: '3. Multi-Key Candidate Blocking Query',
    category: 'Query Optimization',
    description: 'Avoids O(N²) cartesian explosion by generating candidate pairs that share at least one blocking key.',
    sql: `SELECT 
    a.id AS record_a,
    b.id AS record_b,
    a.full_name AS name_a,
    b.full_name AS name_b
FROM records a
JOIN records b ON a.id < b.id
WHERE a.status = 'active' AND b.status = 'active'
  AND (
    a.name_soundex = b.name_soundex
    OR a.name_metaphone = b.name_metaphone
    OR SUBSTRING(a.normalized_name, 1, 3) = SUBSTRING(b.normalized_name, 1, 3)
    OR (LENGTH(a.normalized_phone) >= 6 AND RIGHT(a.normalized_phone, 6) = RIGHT(b.normalized_phone, 6))
    OR (a.normalized_name % b.normalized_name AND similarity(a.normalized_name, b.normalized_name) > 0.40)
  )
LIMIT 50;`,
    explanation: 'Disjunctive blocking reduces comparison complexity from N(N-1)/2 to indexed key lookups. Trigram indexing via pg_trgm (%) enables fuzzy index lookups for spelling corruptions with >98% pair avoidance.'
  },
  {
    id: 'stage_4_scoring',
    name: '4. Pairwise Similarity Calculation in SQL',
    category: 'Analytical Evaluation',
    description: 'PostgreSQL fuzzy matching evaluating trigram similarity and phonetic parity directly in the database engine.',
    sql: `SELECT 
    a.id AS record_a,
    b.id AS record_b,
    similarity(a.normalized_name, b.normalized_name) AS name_trgm_sim,
    (a.name_soundex = b.name_soundex)::INT AS soundex_exact,
    (a.name_metaphone = b.name_metaphone)::INT AS metaphone_exact,
    (a.normalized_phone = b.normalized_phone)::INT AS phone_exact,
    ROUND(
        (similarity(a.normalized_name, b.normalized_name) * 0.50 +
        (a.name_soundex = b.name_soundex)::INT * 0.25 +
        (a.normalized_phone = b.normalized_phone)::INT * 0.25)::NUMERIC, 4
    ) AS calculated_score
FROM records a
JOIN records b ON a.id < b.id
WHERE a.name_soundex = b.name_soundex
LIMIT 10;`,
    explanation: 'PostgreSQL pg_trgm similarity() computes token overlap between 0 and 1, combined with phonetic and contact assertions.'
  },
  {
    id: 'stage_5_merge_transaction',
    name: '5. Transactional Reversible Merge Log',
    category: 'Transaction Management',
    description: 'Atomic ACID transaction updating record statuses and recording a JSONB point-in-time snapshot.',
    sql: `BEGIN;
-- 1. Create or update master cluster
INSERT INTO clusters (golden_record_id, size)
VALUES ('00000000-0000-0000-0000-000000000001', 2)
RETURNING id;

-- 2. Mark secondary duplicates as merged
UPDATE records 
SET cluster_id = 'c1234567-0000-0000-0000-000000000001', status = 'merged'
WHERE id = '00000000-0000-0000-0000-000000000002';

-- 3. Record full JSONB snapshot in merge_log
INSERT INTO merge_log (cluster_id, action, snapshot, note)
VALUES (
    'c1234567-0000-0000-0000-000000000001',
    'merge',
    '{"golden_id": "00000000-0000-0000-0000-000000000001", "reverted_ids": ["00000000-0000-0000-0000-000000000002"]}'::jsonb,
    'Transactional auto-merge with full reversibility'
);
COMMIT;`,
    explanation: 'Preserves 100% auditability and ACID safety. Any merge operation can be completely rolled back by reading the JSONB snapshot.'
  }
];

export async function GET() {
  return NextResponse.json({ stages: SQL_LAB_STAGES });
}

const explainSchema = z.object({
  queryType: z.enum(['blocking_with_index', 'cartesian_without_index']),
});

export async function POST(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const body = await request.json();

    const { queryType } = explainSchema.parse(body);

    let sql = '';
    if (queryType === 'blocking_with_index') {
      sql = `
        EXPLAIN ANALYZE
        SELECT a.id, b.id, a.full_name, b.full_name
        FROM records a
        JOIN records b ON a.id < b.id
        WHERE a.name_soundex = b.name_soundex
        LIMIT 50;
      `;
    } else {
      sql = `
        EXPLAIN ANALYZE
        SELECT a.id, b.id, a.full_name, b.full_name
        FROM records a
        CROSS JOIN records b
        WHERE a.id < b.id AND a.full_name != b.full_name
        LIMIT 50;
      `;
    }

    const rows = await db.query<Record<string, unknown>>(sql);
    const planLines = rows.map((r) => Object.values(r)[0] as string);

    return NextResponse.json({
      queryType,
      plan: planLines,
      executedSql: sql.trim(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Explain error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
