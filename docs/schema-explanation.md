# DedupeIQ Database Schema Specification

## 1. Design Philosophy
The DedupeIQ relational architecture is developed in strict **Third Normal Form (3NF)**:
- **1NF**: Every column contains atomic values, no repeating groups.
- **2NF**: All non-key attributes are fully functionally dependent on the primary key.
- **3NF**: No transitive dependencies between non-key attributes. Normalization columns (`normalized_name`, `name_soundex`, etc.) are derived projection columns generated via deterministic database triggers to accelerate search and blocking without data redundancy across tables.

## 2. Table Catalog

### `entities`
Master registry for entities tracked in the deduplication engine.
- `id` (UUID, PK): Unique entity identifier.
- `entity_type` (VARCHAR(20), CHECK): Discriminator for domain context (`customer`, `student`, `product`).
- `created_at` (TIMESTAMPTZ): Registration timestamp.

### `records`
The operational data plane containing raw inputs from various sources along with trigger-maintained canonical projections.
- `id` (UUID, PK): Unique record identifier.
- `entity_type` (VARCHAR(20), NOT NULL): Domain partition.
- `full_name` (TEXT, NOT NULL): Raw original name.
- `email`, `phone`, `address`, `city`, `dob`: Raw attribute values.
- `source_system` (TEXT, NOT NULL): Originating system (e.g., `CRM-Salesforce`, `StudentPortal`, `LegacyERP`).
- `normalized_name` (TEXT): Lowercased, stripped of honorifics, punctuation removed, whitespace collapsed.
- `normalized_email` (TEXT): Normalized lowercase, Gmail dot-removal, and plus-aliasing stripped.
- `normalized_phone` (TEXT): Canonical digits-only format stripped of international trunk prefixes.
- `name_soundex` (VARCHAR(10)): 4-character American Soundex phonetic code of primary name token.
- `name_metaphone` (VARCHAR(20)): Metaphone phonetic transformation of primary name token.
- `status` (VARCHAR(20), CHECK): Current lifecycle state (`active`, `merged`, `archived`).
- `cluster_id` (UUID, FK nullable): Linkage to disjoint cluster if matched.

### `match_candidates`
Pairwise comparison store generated during the blocking and scoring pipeline.
- `id` (UUID, PK): Unique candidate comparison identifier.
- `record_a`, `record_b` (UUID, FK): Foreign keys to `records(id)` with constraint `record_a < record_b` to avoid duplicates and self-comparison.
- `name_sim`, `email_sim`, `phone_sim`, `address_sim` (NUMERIC(5,4)): Normalized field-level similarity metrics between 0.0000 and 1.0000.
- `dob_match` (BOOLEAN): Exact match flag on date of birth.
- `final_score` (NUMERIC(5,4)): Weighted composite similarity score.
- `decision` (VARCHAR(20), CHECK): Engine classification (`auto_merge`, `review`, `non_match`).

### `clusters`
Equivalence classes of duplicate records grouped via Union-Find transitive closure.
- `id` (UUID, PK): Cluster identity.
- `golden_record_id` (UUID, FK nullable): Elected surviving master record.
- `size` (INT): Cardinality of records belonging to this cluster.
- `created_at` (TIMESTAMPTZ): Formation timestamp.

### `merge_log`
Append-only transactional journal capturing state transitions for full unmerge reversibility.
- `id` (UUID, PK): Log identifier.
- `cluster_id` (UUID, FK): Cluster operated upon.
- `action` (VARCHAR(20), CHECK): Operation executed (`merge`, `unmerge`).
- `snapshot` (JSONB): Complete serialized state of all member records, golden record selection, and match candidate statuses before the operation.
- `performed_at` (TIMESTAMPTZ): Operation timestamp.
- `note` (TEXT): User reason or automated trigger notation.

### `detection_runs`
Telemetry and reproducibility audit log for batch detection jobs.
- `id` (UUID, PK): Detection job run identity.
- `started_at`, `finished_at` (TIMESTAMPTZ): Execution duration tracking.
- `records_scanned`, `pairs_compared`, `clusters_found`: Cardinality and reduction telemetry.
- `threshold_auto`, `threshold_review` (NUMERIC(5,4)): Threshold hyperparameters applied.
- `config` (JSONB): Weights and blocking rules active during execution.

### `benchmark_ground_truth`
Ground truth matrix for synthetic corruption benchmark experiments.
- `record_id` (UUID, PK, FK): Record identifier.
- `true_group_id` (UUID): True identity cluster for evaluating precision, recall, and F1.

## 3. Indexing Strategy
- **GIN Trigram Indexes**: `idx_records_normalized_name_trgm` and `idx_records_normalized_email_trgm` use PostgreSQL's `pg_trgm` inverted indexes with `gin_trgm_ops` to enable sub-millisecond similarity lookups via the `%` operator.
- **B-Tree Phonetic Indexes**: `idx_records_name_soundex` and `idx_records_name_metaphone` partition the candidate space into phonetic buckets for $O(\log N)$ blocking lookups.
- **Candidate Lookup Indexes**: B-Tree on `decision` and `final_score DESC` allows the Review Queue and Dashboard to paginate and query pending records with minimal page reads.
