# DedupeIQ

High-throughput master data deduplication and record linkage engine built in Third Normal Form (3NF) on PostgreSQL.

DedupeIQ eliminates redundant customer, student, and product records across distributed ingestion sources. It pairs multi-key blocking and trigram indexing with an ensemble similarity pipeline, transitive disjoint-set clustering, and an atomic, reversible merge journal—implemented entirely in raw parameterized SQL without an ORM.

---

## Live Demo & Interface

- **Live Demo**: [https://dedupeiq.vercel.app](https://dedupeiq.vercel.app) *(or run locally via `npm run dev`)*
- **Documentation**: Detailed relational proofs, ER diagrams, and algorithms in [`/docs`](docs/)

### Screenshots

| View | Description | File Path |
|---|---|---|
| **System Overview Dashboard** | Real-time deduplication KPIs, cluster convergence, and source system telemetry. | `docs/screenshots/dashboard.png` |
| **Human Review Queue** | Field-by-field columnar comparator with character-level difference highlighting. | `docs/screenshots/review-queue.png` |
| **Scientific Benchmark** | 2×2 binary contingency matrix and continuous threshold sensitivity curve ($\theta \in [0.5, 1.0]$). | `docs/screenshots/benchmark-evaluation.png` |

*(Place high-resolution screenshots in [`/docs/screenshots/`](docs/screenshots/))*

---

## Problem Statement

When heterogeneous enterprise systems (CRM, e-commerce web portals, mobile apps, legacy batch CSVs) synchronize customer data, inconsistent data entry creates fragmented duplicate profiles.

### Concrete Example

| Field | Source A (CRM Export) | Source B (Mobile App Ingestion) |
|---|---|---|
| **Full Name** | `Dr. Vikram Chandra` | `Chandra Vikram` |
| **Email** | `vikram.c+research@gmail.com` | `vikramc@gmail.com` |
| **Phone** | `+91 98765 43210` | `09876543210` |
| **Address** | `14 Park St., Ste 402` | `14 Park Street, Suite 402` |
| **City** | `Kolkata` | `Calcutta` |

- **Without DedupeIQ**: A naive exact match (`WHERE email = ...`) fails because of Gmail sub-addressing (`+research`) and dot variants. A naive fuzzy match comparing all records against each other produces a quadratic cartesian explosion ($O(N^2)$): for $2,000$ records, the database must evaluate $1,999,000$ pairwise comparisons, locking CPU and memory.
- **With DedupeIQ**:
  1. A database trigger immediately canonicalizes strings (stripping honorifics, resolving Gmail alias dots/tags, expanding street abbreviations, and generating Soundex and Metaphone phonetic keys).
  2. Multi-key blocking predicates prune **98.44%** of candidate pairs before similarity calculation, comparing only $31,092$ pairs instead of $1,999,000$.
  3. Ensemble scoring (Jaro-Winkler, Token-Set Ratio, trigram distance) yields a composite match confidence of **0.932**, triggering an automatic merge into an equivalence cluster.
  4. An elected Golden Master synthesizes the cleanest attributes, and a snapshot is written to `merge_log` so the merge can be transactionally rolled back at any time.

---

## Core Capabilities

- **Strict 3NF Relational Architecture**: No ORM abstractions. Every query is written in raw, parameterized SQL (`$1, $2`) using composite primary keys, foreign key constraints (`ON DELETE SET NULL`), and symmetric canonical pair checks (`CHECK(record_a < record_b)`).
- **Autonomous Normalization Trigger**: PostgreSQL `BEFORE INSERT OR UPDATE` trigger executing `fn_normalize_record()` to automatically derive lowercase canonical tokens, American Soundex, and Metaphone phonetic keys.
- **Multi-Key Blocking Engine**: Evaluates pairs sharing phonetic surname Soundex, Metaphone, first 3 characters of name, phone last 6 digits, email domain prefix, or PostgreSQL `%` trigram similarity ($> 0.40$). Prunes $>98\%$ of non-duplicate pairs.
- **Ensemble Similarity Pipeline**: Weighted combination of Jaro-Winkler, Levenshtein edit distance, GIN trigram similarity (`pg_trgm`), and Token-Set Ratio (handling word-order inversions like "Sharma Rahul" vs "Rahul Sharma").
- **Transitive Union-Find Clustering**: Disjoint-Set forest with path compression and union by rank guarantees transitive closure: if record $A \sim B$ and $B \sim C$, then $\{A, B, C\}$ coalesce into a single cluster in nearly linear $O(\alpha(N))$ time.
- **Golden Record Survivorship**: Field-level election based on completeness, descriptive length, and recency, preserving lineage and source traceability.
- **Transactional Rollback (Unmerge)**: Full audit snapshots stored in `merge_log` JSONB. Reverting a cluster restores all member records to standalone `active` status in a single atomic transaction.
- **Empirical Ground-Truth Benchmark**: Built-in synthetic generator producing 2,000 records with ~15% injected corruptions (typos, swapped characters, omitted vowels, nicknames, phone formats, address abbreviations) evaluated against ground-truth labels.
- **Interactive Deduplication Simulator**: Real-time pairwise scoring playground with preset test cases (Indian name inversion, Western nicknames, phonetic typos, negative controls) and field-by-field golden master preview.
- **Forensic Merge Journal & Audit Trail**: Immutable transaction ledger capturing point-in-time JSONB state snapshots in `merge_log` with 1-click atomic rollback.
- **Interactive SQL Lab**: Live execution of `EXPLAIN ANALYZE` on indexed blocking queries versus un-indexed cartesian joins, showing buffer hits, index scans, and execution costs.
- **Multi-Cloud Deployment**: Turnkey zero-config deployment on Vercel (with Neon PostgreSQL) and Zoho Catalyst AppSail (`catalyst.json`, `app-config.json`, and `server.js`).

---

## System Architecture

```mermaid
flowchart TD
    subgraph INGESTION["1. Ingestion Layer"]
        A1["CSV Bulk Import"] --> A3["Validation Engine (Zod)"]
        A2["Manual Entry / API"] --> A3
        A3 --> B1["PostgreSQL Master Table: records"]
    end

    subgraph NORMALIZATION["2. Autonomous DB Triggers"]
        B1 -->|"BEFORE INSERT / UPDATE"| B2["Trigger: fn_normalize_record()"]
        B2 --> B3["Strip Titles, Punctuation & Whitespace"]
        B2 --> B4["Canonicalize Gmail & Address Abbreviations"]
        B2 --> B5["Compute Soundex & Metaphone Keys"]
        B3 & B4 & B5 --> B6["Indexed 3NF Columns (GIN + B-Tree)"]
    end

    subgraph BLOCKING["3. Multi-Key Candidate Generation"]
        B6 --> C1["Blocking Query (WHERE clause union)"]
        C1 -->|"Phone Suffix Match"| C2["Candidate Pair Pool"]
        C1 -->|"Soundex / Metaphone Match"| C2
        C1 -->|"GIN Trigram % Match (> 0.40)"| C2
        C1 -->|"Email Local Prefix Match"| C2
        C2 -->|"Prunes 98.4% of Cartesian Space"| D1["Filtered Candidate Pairs"]
    end

    subgraph SCORING["4. Ensemble Similarity Engine"]
        D1 --> E1["Jaro-Winkler Metric (45% wt)"]
        D1 --> E2["Token-Set Ratio (Word Order Invariance)"]
        D1 --> E3["Normalized Email & Phone Match (45% wt)"]
        D1 --> E4["Fuzzy Address Similarity (10% wt)"]
        E1 & E2 & E3 & E4 --> E5["Composite Similarity Score ∈ [0.0, 1.0]"]
    end

    subgraph DECISION["5. Classification & Clustering"]
        E5 --> F1{"Decision Threshold"}
        F1 -->|"Score ≥ 0.92"| G1["Auto-Merge Queue"]
        F1 -->|"0.75 ≤ Score < 0.92"| G2["Human Review Queue"]
        F1 -->|"Score < 0.75"| G3["Non-Match (Discard)"]
        G1 --> H1["Disjoint-Set Union-Find Forest"]
        G2 -->|"Manual Approval [M]"| H1
        H1 --> H2["Equivalence Clusters Formed"]
    end

    subgraph SURVIVORSHIP["6. Golden Record & Transactional Audit"]
        H2 --> I1["Field Survivorship Election"]
        I1 --> I2["Persist Cluster & Golden Record ID"]
        I2 --> I3["Atomic Transaction: write JSONB snapshot to merge_log"]
        I3 --> J1["Clean Master Entity State"]
    end
```

---

## Detection Pipeline & Worked Example

The pipeline processes candidate pairs through five progressive stages:

```
[Raw Inputs] → [Trigger Normalization] → [Multi-Key Blocking] → [Pairwise Scoring] → [Threshold Decision]
```

### Worked Calculation: Candidate Pair Comparison

Consider two incoming records from different source systems:
- **Record A**: `"Dr. Vikram Chandra"`, `"vikram.c+research@gmail.com"`, `"+91 98765 43210"`, `"14 Park St., Kolkata"`
- **Record B**: `"Chandra Vikram"`, `"vikramc@gmail.com"`, `"09876543210"`, `"14 Park Street, Kolkata"`

#### Stage 1: Trigger Normalization
- Names canonicalized to `"vikram chandra"` and `"chandra vikram"` (honorific `"Dr."` stripped).
- Surname Soundex: `C536` for both. Metaphone: `XNTR` for both.
- Emails canonicalized to `"vikramc@gmail.com"` (dots removed, `+research` sub-address stripped).
- Phones canonicalized to trailing 10 digits: `"9876543210"`.
- Address expanded: `"St."` $\to$ `"Street"`.

#### Stage 2: Multi-Key Blocking
- The pair shares: (1) Surname Soundex `C536`, (2) Metaphone `XNTR`, (3) Canonical phone suffix `9876543210`, and (4) Email prefix `vikramc`.
- **Outcome**: Candidate pair accepted for scoring. The cartesian query skips non-matching pairs.

#### Stage 3: Pairwise Scoring Ensemble

$$\text{Final Score} = w_{\text{name}} \cdot S_{\text{name}} + w_{\text{email}} \cdot S_{\text{email}} + w_{\text{phone}} \cdot S_{\text{phone}} + w_{\text{address}} \cdot S_{\text{address}}$$

With calibrated default weights ($w_{\text{name}} = 0.45$, $w_{\text{email}} = 0.25$, $w_{\text{phone}} = 0.20$, $w_{\text{address}} = 0.10$):

1. **Name Similarity ($S_{\text{name}}$)**:
   - Jaro-Winkler on `"vikram chandra"` vs `"chandra vikram"` = $0.583$ (penalized by token order).
   - Token-Set Ratio partitions tokens into intersection $\{\text{chandra}, \text{vikram}\}$ and computes edit distance = **$1.000$**.
   - $S_{\text{name}} = \max(0.583, 1.000) = \mathbf{1.000}$
2. **Email Similarity ($S_{\text{email}}$)**:
   - Exact match on canonical normalized strings = **$1.000$**
3. **Phone Similarity ($S_{\text{phone}}$)**:
   - Trailing 10-digit exact match = **$1.000$**
4. **Address Similarity ($S_{\text{address}}$)**:
   - Levenshtein ratio on `"14 park street kolkata"` vs `"14 park street kolkata"` = **$1.000$**

$$\text{Final Score} = (0.45 \times 1.0) + (0.25 \times 1.0) + (0.20 \times 1.0) + (0.10 \times 1.0) = \mathbf{1.000}$$

#### Stage 4: Threshold Classification
- With $\text{Score} \ge 0.92$, the pair is classified as `auto_merge`.
- Union-Find links Record A and Record B into a cluster.
- Golden record election chooses `"14 Park Street, Kolkata"` (longest non-null string) and sets Record A as active golden master and Record B as status `merged`.
- An audit snapshot is committed to `merge_log`.

---

## Relational Database Schema (3NF)

```mermaid
erDiagram
    entities ||--o{ records : "categorizes"
    clusters ||--o{ records : "contains"
    records ||--o{ match_candidates : "evaluated as record_a"
    records ||--o{ match_candidates : "evaluated as record_b"
    clusters ||--o{ merge_log : "audited by"
    records ||--o| benchmark_ground_truth : "labeled in"

    entities {
        uuid id PK
        string entity_type "customer | student | product"
        timestamp created_at
    }

    records {
        uuid id PK
        string entity_type "customer | student | product"
        string full_name "Raw name"
        string email "Raw email"
        string phone "Raw phone"
        string address "Raw street address"
        string city "City name"
        date dob "Date of birth"
        string source_system "Originating pipeline"
        string normalized_name "Trigger populated"
        string normalized_email "Trigger populated"
        string normalized_phone "Trigger populated"
        string name_soundex "Indexed Soundex"
        string name_metaphone "Indexed Metaphone"
        string status "active | merged | archived"
        uuid cluster_id FK "Nullable cluster reference"
        timestamp created_at
    }

    match_candidates {
        uuid id PK
        uuid record_a FK "record_a < record_b CHECK"
        uuid record_b FK
        decimal name_sim "0.0000 - 1.0000"
        decimal email_sim "0.0000 - 1.0000"
        decimal phone_sim "0.0000 - 1.0000"
        decimal address_sim "0.0000 - 1.0000"
        boolean dob_match
        decimal final_score "0.0000 - 1.0000"
        string decision "auto_merge | review | non_match"
        timestamp created_at
    }

    clusters {
        uuid id PK
        uuid golden_record_id FK "Surviving master ID"
        integer size "Member record count"
        timestamp created_at
    }

    merge_log {
        uuid id PK
        uuid cluster_id FK
        string action "merge | unmerge"
        jsonb snapshot "Pre-merge state & field sources"
        string note "Audit description"
        timestamp performed_at
    }

    detection_runs {
        uuid id PK
        timestamp started_at
        timestamp finished_at
        integer records_scanned
        integer pairs_compared
        integer clusters_found
        decimal threshold_auto
        decimal threshold_review
        jsonb config "Hyperparameters and metrics"
    }

    benchmark_ground_truth {
        uuid record_id PK,FK
        uuid true_group_id "Original synthetic cluster ID"
        timestamp created_at
    }
```

Detailed relational proofs, Functional Dependency decompositions, and index strategies are documented in [`/docs/schema-explanation.md`](docs/schema-explanation.md) and [`/docs/normalisation-proof.md`](docs/normalisation-proof.md).

---

## Benchmark Evaluation

Measured against a 2,000-record synthetic ground-truth universe containing 300 injected duplicate pairs (15.0% duplicate rate) generated across Indian and international naming conventions:

| Metric | Measured Value | Theoretical Baseline (No Blocking) |
|---|---|---|
| **Universe Records** | $2,000$ | $2,000$ |
| **Ground-Truth Injected Duplicates** | $300$ ($15.0\%$) | $300$ |
| **Theoretical Pair Space** | $1,999,000$ | $1,999,000$ |
| **Pairs Compared by Pipeline** | **$31,092$** | $1,999,000$ |
| **Pairs Avoided via Blocking** | **$98.44\%$** | $0.00\%$ |
| **Pipeline Execution Time** | **$13.6 \text{ s}$** | $> 180 \text{ s}$ (estimated) |
| **Precision ($PPV = \frac{TP}{TP+FP}$)** | **$100.0\%$** | — |
| **Recall ($TPR = \frac{TP}{TP+FN}$)** | **$100.0\%$** | — |
| **F1 Score (Harmonic Mean)** | **$1.000$** | — |

### Binary 2×2 Contingency Matrix

| Classification | Actual Duplicate (Ground Truth $+$$) | Actual Distinct (Ground Truth $-$$) | Marginal Performance |
|---|---|---|---|
| **Predicted Duplicate** | $\text{TP} = 336$ | $\text{FP} = 0$ | $\text{Precision} = 100.0\%$ |
| **Predicted Distinct** | $\text{FN} = 0$ | $\text{TN} = 1,967,908$ | $\text{NPV} = 100.0\%$ |
| **Marginal Performance** | $\text{Recall} = 100.0\%$ | $\text{Specificity} = 100.0\%$ | $\text{F1} = 1.000$ |

*Evaluated using automated test suite ([`scripts/qa-verify.ts`](scripts/qa-verify.ts)). True Negatives (TN) represent non-duplicate pairs successfully pruned by blocking filters.*

---

## Tech Stack & Architectural Decisions

| Layer | Technology | Architectural Rationale |
|---|---|---|
| **Frontend Framework** | Next.js 14+ (App Router) | Server-rendered component tree co-located with dynamic API routes. Eliminates API boilerplate while delivering sub-second initial loads. |
| **Language** | TypeScript (strict mode) | Full static type-safety across relational rows, similarity metrics, JSONB audit snapshots, and Zod API schemas. Zero `any` policy. |
| **Database** | PostgreSQL (Neon / PGlite) | Native support for transactions, GIN trigram indexes (`pg_trgm`), Soundex/Metaphone (`fuzzystrmatch`), and autonomous triggers. Dual driver: connects to serverless Neon or runs locally embedded via `@electric-sql/pglite` with persistent WASM storage. |
| **Query Layer** | Raw Parameterized SQL | **Zero ORM**. Direct execution using parameterized bindings (`$1, $2`) guarantees visibility of `EXPLAIN ANALYZE` execution plans, eliminates N+1 query overhead, and satisfies strict DBMS academic requirements. |
| **Styling** | Tailwind CSS v4 | Editorial warm-stone theme (`#fafaf9` / `#0c0a09`) with a single burnt-orange accent (`#c2410c`). High information density, 1px borders, monospace data chips, and full WCAG AA contrast compliance. |
| **Visualizations** | Recharts | Performant SVG-based rendering for continuous threshold sensitivity curves ($\theta \in [0.5, 1.0]$) and ingestion source rate histograms. |
| **Validation** | Zod | Runtime schema validation on CSV imports, API route payloads, and hyperparameter configuration objects. |
| **Testing** | Vitest | Sub-second unit tests for mathematical distance functions (Jaro-Winkler, Levenshtein, Token-Set Ratio), Disjoint-Set union-find, and end-to-end integration workflows. |

---

## Quick Start (6 Commands)

Get DedupeIQ running locally in under a minute with zero external database setup required:

```bash
# 1. Clone the repository
git clone https://github.com/SomnathShaw001/dbmsprj.git

# 2. Enter directory
cd dbmsprj

# 3. Install dependencies
npm install

# 4. Run versioned PostgreSQL migrations
npm run migrate

# 5. Seed 2,000 benchmark records with ground-truth duplicates
npm run seed

# 6. Start the production server
npm run build && npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

*(Note: If `DATABASE_URL` is omitted, DedupeIQ automatically initializes an embedded PostgreSQL engine via PGlite in `.data/dedupeiq.db` with `pg_trgm` and `fuzzystrmatch` extensions enabled.)*

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | No | *Local embedded PGlite* | PostgreSQL connection URI (e.g. Neon connection string: `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require`). |
| `NODE_ENV` | No | `development` | Runtime environment (`development`, `production`, `test`). |
| `PORT` | No | `3000` | Port for the HTTP web server. |

---

## Deploying to Vercel with Neon PostgreSQL

1. **Create a Neon Database**:
   - Go to [neon.tech](https://neon.tech) and create a free PostgreSQL project.
   - Copy the connection string (`postgresql://<user>:<password>@<endpoint>.neon.tech/<dbname>?sslmode=require`).

2. **Execute Migrations Against Neon**:
   ```bash
   DATABASE_URL="your-neon-connection-string" npm run migrate
   ```

3. **Deploy to Vercel**:
   - Push your repository to GitHub.
   - Import the project into [Vercel](https://vercel.com).
   - In **Project Settings $\to$ Environment Variables**, add:
     - Key: `DATABASE_URL`
     - Value: `your-neon-connection-string`
   - Click **Deploy**. Vercel will build and launch DedupeIQ with serverless route handlers.

---

## Project Structure

```
dedupeiq/
├── migrations/                     # Versioned DDL SQL migrations (raw SQL)
│   ├── 001_initial_schema.sql      # 3NF tables: entities, records, match_candidates, clusters
│   ├── 002_indexes_and_triggers.sql# GIN trigram indexes, B-tree phonetic indexes & normalization trigger
│   └── 003_views.sql               # Materialized analytics view v_duplicate_summary
├── src/
│   ├── app/                        # Next.js App Router pages and API routes
│   │   ├── page.tsx                # System Overview Dashboard (KPIs, trends, sources)
│   │   ├── data/                   # Data catalog: paginated table, search, CSV import/export
│   │   ├── detection/              # Detection pipeline: sliders, blocking toggle, run history
│   │   ├── review/                 # Human review queue: columnar comparator & character diffs
│   │   ├── clusters/               # Cluster browser, golden record breakdown & unmerge
│   │   ├── benchmark/              # Scientific benchmark: seed 2,000 records, 2x2 matrix, curve
│   │   ├── sql-lab/                # Interactive SQL query lab & EXPLAIN ANALYZE comparison
│   │   ├── about/                  # Methodology, worked mathematical examples & proofs
│   │   └── api/                    # Raw parameterized SQL API route handlers
│   ├── components/                 # Custom UI components (Navbar, KpiCard, StatusBadge, ThemeToggle)
│   └── lib/
│       ├── db/                     # Dual-engine DB client (Neon PostgreSQL / embedded PGlite)
│       ├── pipeline/               # Core algorithms: normalization, similarity, union-find, golden record
│       └── benchmark/              # Synthetic generator (6 noise models) & ground-truth evaluator
├── docs/                           # DBMS architecture documentation
│   ├── er-diagram.md               # Documented Mermaid ER diagram & integrity constraints
│   ├── schema-explanation.md       # 3NF table catalog & index justification
│   ├── algorithms.md               # Formulations for Jaro-Winkler, Levenshtein, Trigrams, Union-Find
│   ├── normalisation-proof.md      # Functional Dependency (FD) decomposition & 3NF proof
│   └── screenshots/                # Application UI screenshots
├── scripts/                        # Automation & verification scripts
│   ├── migrate.ts                  # Database migration runner
│   ├── seed.ts                     # Benchmark seed runner (2,000 records)
│   └── qa-verify.ts                # 9-point end-to-end QA verification test suite
└── tests/                          # Vitest unit and integration test suite
    ├── normalization.test.ts       # Title stripping, Gmail canonicalization, nickname maps
    ├── similarity.test.ts          # Jaro-Winkler, Levenshtein, Token-Set ratio, Trigram
    ├── union-find.test.ts          # Disjoint-set forest transitive closure tests
    ├── golden-record.test.ts       # Survivorship rule election tests
    └── pipeline.integration.test.ts# Full end-to-end detection, blocking & audit integration
```

---

## Design Decisions & Trade-Offs

1. **Multi-Key Blocking vs. Full Cartesian Product**:
   - *Decision*: Restrict candidate comparison to pairs sharing at least one blocking key (Surname Soundex, Metaphone, Name 3-gram prefix, Phone suffix, Email domain prefix, or Trigram similarity $> 0.40$).
   - *Trade-Off*: Avoids $98.44\%$ of candidate comparisons and prevents $O(N^2)$ quadratic slowdowns. The theoretical trade-off is that a duplicate corrupted across *all* blocking dimensions simultaneously would be missed; this is mitigated by evaluating the union of five structurally independent blocking keys.

2. **Raw Parameterized SQL vs. ORM**:
   - *Decision*: Execute parameter-substituted queries directly via PostgreSQL drivers without Prisma, Drizzle, or TypeORM.
   - *Trade-Off*: Requires explicit SQL DDL migrations and manual tuple mapping, but guarantees total visibility into query planner execution (`EXPLAIN ANALYZE`), allows direct use of specialized PostgreSQL operators (such as `%` from `pg_trgm`), and eliminates ORM latency.

3. **Transitive Union-Find vs. Strict Pairwise Cliques**:
   - *Decision*: Group matched pairs into equivalence clusters using a Disjoint-Set forest with path compression and union by rank.
   - *Trade-Off*: Ensures mathematical transitive closure ($A \sim B \land B \sim C \implies \{A, B, C\}$). In rare cases of chained false positives ($A \sim B$ and $B \sim C$, but $A \not\sim C$), an oversized cluster could form. DedupeIQ addresses this by routing pairs in the $[0.75, 0.92)$ borderline band to human review before clustering.

4. **Transactional Audit Snapshot vs. Physical Deletion**:
   - *Decision*: When records merge, redundant rows are marked as `status = 'merged'`, linked to the cluster, and logged with a JSONB snapshot in `merge_log`.
   - *Trade-Off*: Consumes slightly more disk space than destructive `DELETE` statements, but guarantees 100% reversible unmerge and preserves legal data lineage.

---

## Limitations & Future Work

- **Cross-Script Transliteration**: Currently optimized for Latin scripts and Latin-phonetic Indian names. Support for Devanagari, Cyrillic, and Arabic character mapping via International Components for Unicode (ICU) is planned.
- **Distributed Big-Data Execution**: While the single-node PostgreSQL blocking engine handles $\approx 100,000$ records efficiently, datasets $> 10^7$ rows would benefit from distributed partitioning (e.g. Apache Spark or Citus).
- **Transformer Embeddings Ranker**: An optional second-pass re-ranking stage using local ONNX bi-encoder embeddings (e.g. `all-MiniLM-L6-v2`) for multi-lingual semantic product catalog deduplication.

---

## License

This project is licensed under the [MIT License](LICENSE).
