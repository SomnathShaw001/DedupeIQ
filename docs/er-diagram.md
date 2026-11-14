# DedupeIQ Entity-Relationship Diagram (ERD)

The DedupeIQ schema is engineered in **Third Normal Form (3NF)** to support high-throughput deduplication, fuzzy record linkage, auditable survivorship, and scientific benchmarking with ground-truth validation.

```mermaid
erDiagram
    entities ||--o{ records : "categorizes"
    clusters ||--o{ records : "groups"
    clusters |o--|| records : "elects golden_record"
    clusters ||--o{ merge_log : "audits"
    records ||--o{ match_candidates : "record_a"
    records ||--o{ match_candidates : "record_b"
    records ||--o| benchmark_ground_truth : "labels"
    
    entities {
        uuid id PK
        varchar entity_type "customer | student | product"
        timestamptz created_at
    }

    records {
        uuid id PK
        varchar entity_type "customer | student | product"
        text full_name
        text email
        text phone
        text address
        text city
        date dob
        text source_system
        text normalized_name
        text normalized_email
        text normalized_phone
        varchar name_soundex
        varchar name_metaphone
        varchar status "active | merged | archived"
        uuid cluster_id FK
        timestamptz created_at
    }

    clusters {
        uuid id PK
        uuid golden_record_id FK "nullable, deferred"
        int size "default 1"
        timestamptz created_at
    }

    match_candidates {
        uuid id PK
        uuid record_a FK "record_a < record_b"
        uuid record_b FK
        numeric name_sim "0.0000 - 1.0000"
        numeric email_sim "0.0000 - 1.0000"
        numeric phone_sim "0.0000 - 1.0000"
        numeric address_sim "0.0000 - 1.0000"
        boolean dob_match
        numeric final_score "0.0000 - 1.0000"
        varchar decision "auto_merge | review | non_match"
        timestamptz created_at
    }

    merge_log {
        uuid id PK
        uuid cluster_id FK
        varchar action "merge | unmerge"
        jsonb snapshot "full pre-merge state"
        timestamptz performed_at
        text note
    }

    detection_runs {
        uuid id PK
        timestamptz started_at
        timestamptz finished_at
        int records_scanned
        int pairs_compared
        int clusters_found
        numeric threshold_auto
        numeric threshold_review
        jsonb config
    }

    benchmark_ground_truth {
        uuid record_id PK, FK
        uuid true_group_id
    }
```

## Relational Constraints & Keys
1. **Primary Key Format**: Standard UUIDv4 (`gen_random_uuid()`) to prevent ID collision across distributed source systems.
2. **Canonical Candidate Ordering**: `CHECK (record_a < record_b)` guarantees that each pair is evaluated at most once, and `UNIQUE(record_a, record_b)` enforces strict idempotency.
3. **Cluster & Record Linkage**: `clusters.golden_record_id` is an initially deferred foreign key referencing `records.id`, while `records.cluster_id` is an `ON DELETE SET NULL` foreign key referencing `clusters.id`.
4. **Candidate Referential Integrity**: Both `record_a` and `record_b` have `ON DELETE CASCADE` constraints so removing a record automatically purges invalid candidate pairs.
5. **Merge Traceability**: `merge_log` captures complete pre-action JSONB snapshots allowing 100% reversible rollbacks.
