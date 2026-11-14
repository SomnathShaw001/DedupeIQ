# DedupeIQ — Intelligent Duplicate Record Detection System

An enterprise-grade master data deduplication and record linkage platform engineered for high-throughput customer, student, and product master databases. Built in Third Normal Form (3NF) on PostgreSQL with raw parameterized SQL, versioned migrations, multi-key candidate blocking, ensemble string metrics, transitive Union-Find clustering, and fully reversible transactional unmerge.

---

## Key Features

1. **Relational 3NF Architecture**: Designed without ORMs using raw parameterized SQL queries, strict domain checks, `record_a < record_b` candidate canonical ordering, and GIN trigram indexes (`gin_trgm_ops`).
2. **Autonomous Normalization Trigger**: PostgreSQL `BEFORE INSERT OR UPDATE` trigger executing `fn_normalize_record()` to automatically derive lowercase canonical tokens, American Soundex, and Metaphone phonetic keys.
3. **Multi-Key Blocking Engine**: Avoids $O(N^2)$ cartesian explosion by generating candidate pairs only if they share a block key (Surname Soundex, Metaphone, Name 3-gram prefix, Phone last 6 digits, Email domain prefix, or Trigram similarity $> 0.40$ via `%`). Avoids $>98\%$ of candidate comparisons.
4. **Ensemble Pairwise Scoring**: Jaro-Winkler with prefix scaling, normalized Levenshtein ratio, PostgreSQL trigram similarity, and Token-Set Ratio (word transposition invariance like "Sharma Rahul" vs "Rahul Sharma"), with configurable weights.
5. **Transitive Union-Find Clustering**: Disjoint-Set forest with path compression and union by rank guarantees transitive closure ($A \sim B$ and $B \sim C \implies \{A, B, C\}$ in $O(\alpha(N))$ time).
6. **Golden Record Survivorship & Reversible Merge**: Elects surviving master records based on field completeness, recency, and descriptive length. Every merge writes an atomic JSONB snapshot into `merge_log` enabling 100% reversible unmerge.
7. **Scientific Benchmarking**: Synthetic data generator producing 2,000 realistic records (Indian and international names) with ~15% controlled injected duplicates and ground truth. Computes Precision, Recall, F1 score, confusion matrix, and threshold optimization curves.
8. **Interactive SQL Lab**: Live inspection of SQL DDL, triggers, and real-time execution planner (`EXPLAIN ANALYZE`) comparing indexed blocking queries against un-indexed cartesian products.

---

## Technology Stack

- **Framework**: Next.js 14+ (App Router, Strict TypeScript)
- **Styling**: Tailwind CSS, Editorial warm-stone theme, dark mode support
- **Database**: PostgreSQL (Neon-compatible via `postgres` / `pg` with raw parameterized SQL) and zero-config local embedded engine via `@electric-sql/pglite` with `pg_trgm` and `fuzzystrmatch` extensions
- **Visualizations**: Recharts (Run trends, Ingestion sources, Threshold vs F1 curve)
- **Notifications**: Sonner
- **Testing**: Vitest unit and integration test suite

---

## Getting Started

### 1. Installation
```bash
git clone https://github.com/your-username/dedupeiq.git
cd dedupeiq
npm install
```

### 2. Configure Database Environment (Optional)
If deploying to Vercel or connecting to a remote Neon PostgreSQL database, configure your `.env`:
```env
DATABASE_URL=postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require
```
*Note: If `DATABASE_URL` is omitted, DedupeIQ automatically runs on embedded PostgreSQL (PGlite) with disk persistence in `.data/dedupeiq.db` with identical `pg_trgm` and `fuzzystrmatch` extensions enabled.*

### 3. Run Migrations
```bash
npm run migrate
```
Applies versioned `.sql` migrations from `/migrations`:
- `001_initial_schema.sql`: 3NF master tables and integrity checks
- `002_indexes_and_triggers.sql`: GIN trigram and B-Tree phonetic indexes and normalization trigger
- `003_views.sql`: Materialized analytics views (`v_duplicate_summary`)

### 4. Seed 2,000 Benchmark Records
```bash
npm run seed
```
Populates 2,000 synthetic records with 15% injected duplicates across Indian and international names, stores ground truth in `benchmark_ground_truth`, and executes the detection pipeline.

### 5. Run Test Suite
```bash
npm test
```
Executes all 31 Vitest unit and integration tests covering normalizers, Jaro-Winkler, Levenshtein, Trigram, Token-Set ratio, Union-Find clustering, golden record survivorship, and end-to-end pipeline execution.

### 6. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Documentation Directory (`/docs`)

- [`/docs/er-diagram.md`](docs/er-diagram.md): Documented Mermaid ER diagram and relational constraints.
- [`/docs/schema-explanation.md`](docs/schema-explanation.md): 3NF schema breakdown, table catalog, and index justification.
- [`/docs/algorithms.md`](docs/algorithms.md): Mathematical formulations for Jaro-Winkler, Levenshtein, Trigrams, Token-Set ratio, and Union-Find.
- [`/docs/normalisation-proof.md`](docs/normalisation-proof.md): Formal Functional Dependency (FD) analysis and 3NF proof.

---

## Keyboard Shortcuts in Review Queue

| Shortcut | Action |
| :--- | :--- |
| `[M]` | Confirm and Merge active candidate pair into cluster |
| `[N]` | Mark candidate pair as Non-Match |
| `[S]` | Skip active candidate pair for later review |
| `[J]` | Navigate to Next candidate |
| `[K]` | Navigate to Previous candidate |

---

## College DBMS Evaluation Summary

- **Zero ORM Rule**: All operations utilize raw parameterized SQL queries via `client.query(sql, params)`.
- **Relational Integrity**: Enforced via composite keys, foreign keys (`ON DELETE SET NULL`, `ON DELETE CASCADE`), deferred constraints, and check constraints (`CHECK(record_a < record_b)`).
- **Indexing Strategy**: Inverted GIN trigram indexing (`normalized_name gin_trgm_ops`) paired with B-Tree phonetic indexes (`name_soundex`, `name_metaphone`).
- **ACID Transaction Safety**: Complete reversibility via JSONB point-in-time snapshots in `merge_log`.
