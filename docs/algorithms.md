# DedupeIQ Algorithm Specification & Mathematical Foundations

DedupeIQ implements an industry-grade, multi-stage duplicate detection and record linkage pipeline designed to reduce $O(N^2)$ exhaustive comparisons to $O(N \log N)$ while preserving high recall ($>95\%$).

---

## Stage 1: String Normalization
Raw human-entered data contains inconsistent case, punctuation, honorific titles, and colloquial nicknames. Normalization standardizes representations deterministically before similarity evaluation:
1. **Case & Unicode Folding**: Conversion to lowercase UTF-8 and strip diacritics.
2. **Title & Salutation Stripping**: RegEx pruning of prefixes (`Mr`, `Mrs`, `Ms`, `Dr`, `Prof`, `Shri`, `Smt`).
3. **Street Address Expansion**: Canonical dictionary replacement (`St` $\to$ `Street`, `Ave` $\to$ `Avenue`, `Rd` $\to$ `Road`, `Apt` $\to$ `Apartment`, `Blvd` $\to$ `Boulevard`).
4. **Email Canonicalization**: Stripping sub-addressing (`+tag`) and removing dots in standard Gmail addresses (`john.doe+news@gmail.com` $\to$ `johndoe@gmail.com`).
5. **E.164 Clean Digits**: Stripping non-digit characters, pruning international prefixes (`+91`, `+1`), or leading zero trunk codes.
6. **Nickname Mapping**: Mapping familiar variants to root formal names (`Bob` $\to$ `Robert`, `Bill` $\to$ `William`, `Dick` $\to$ `Richard`, `Jim` $\to$ `James`, `Jack` $\to$ `John`, `Liz` $\to$ `Elizabeth`, etc.).

---

## Stage 2: Multi-Key Blocking Engine
For a dataset of $N = 10,000$ records, a naive cartesian product requires:
$$\frac{N(N - 1)}{2} = \frac{10,000 \times 9,999}{2} \approx 49,995,000 \text{ pairwise comparisons}$$
This causes severe quadratic bottleneck in database execution. DedupeIQ applies multi-key disjunctive blocking:
Record pair $(A, B)$ is evaluated if and only if they match on at least one blocking key:
1. **Surname Soundex**: $\text{soundex}(A.\text{name\_token}) = \text{soundex}(B.\text{name\_token})$
2. **Metaphone Key**: $\text{metaphone}(A.\text{name\_token}) = \text{metaphone}(B.\text{name\_token})$
3. **Name Prefix**: $\text{substring}(A.\text{normalized\_name}, 1, 3) = \text{substring}(B.\text{normalized\_name}, 1, 3)$
4. **Phone Suffix**: Rightmost 6 digits of normalized phone.
5. **Email Domain + Prefix**: Domain match and first 3 characters of local username.
6. **Trigram Operator (`%`)**: $A.\text{normalized\_name} \ \%\ B.\text{normalized\_name}$ utilizing GIN trigram indexing with similarity threshold $\ge 0.40$.

**Efficiency Metric**:
$$\text{Pairs Avoided \%} = \left( 1 - \frac{\text{Candidate Pairs Evaluated}}{\frac{N(N-1)}{2}} \right) \times 100\%$$
Typically achieves $> 98.5\%$ reduction in pairs evaluated.

---

## Stage 3: Pairwise Similarity Metrics

### 1. Jaro-Winkler Similarity
Designed specifically for person names. Given strings $s_1$ and $s_2$:
$$d_j = \begin{cases} 0 & \text{if } m = 0 \\ \frac{1}{3} \left( \frac{m}{|s_1|} + \frac{m}{|s_2|} + \frac{m - t}{m} \right) & \text{otherwise} \end{cases}$$
Where $m$ is the number of matching characters within window $\lfloor \frac{\max(|s_1|, |s_2|)}{2} \rfloor - 1$, and $t$ is half the number of transpositions.
The Winkler adjustment awards a bonus for common prefixes up to length $L \le 4$:
$$d_w = d_j + (L \cdot p \cdot (1 - d_j))$$
with prefix scaling factor $p = 0.1$.

### 2. Levenshtein Ratio
Computes normalized edit distance:
$$\text{sim}_{\text{lev}}(s_1, s_2) = 1 - \frac{\text{lev}(s_1, s_2)}{\max(|s_1|, |s_2|)}$$
Where $\text{lev}(s_1, s_2)$ is the minimum single-character insertions, deletions, or substitutions required to transform $s_1$ into $s_2$.

### 3. Trigram Similarity
Based on shared 3-character sequences (q-grams). For strings $s_1$ and $s_2$ padded with boundary spaces:
$$\text{sim}_{\text{tri}}(s_1, s_2) = \frac{|\text{tri}(s_1) \cap \text{tri}(s_2)|}{|\text{tri}(s_1) \cup \text{tri}(s_2)|}$$

### 4. Token-Set Ratio
Accommodates transposed name tokens (e.g., "Sharma Rahul" vs "Rahul Sharma" or "John Michael Doe" vs "Doe John"):
1. Tokenize into words, remove duplicates, and sort alphabetically.
2. Form intersection string $I = \text{tokens}(s_1) \cap \text{tokens}(s_2)$.
3. Compare sorted string differences:
$$\text{sim}_{\text{tsr}} = \max(\text{sim}(I, I \cup D_1), \text{sim}(I, I \cup D_2), \text{sim}(I \cup D_1, I \cup D_2))$$

### 5. Composite Scoring Formula
$$S(A, B) = w_{\text{name}} \cdot S_{\text{name}} + w_{\text{email}} \cdot S_{\text{email}} + w_{\text{phone}} \cdot S_{\text{phone}} + w_{\text{addr}} \cdot S_{\text{addr}} + \Delta_{\text{dob}}$$
Default weights:
- $w_{\text{name}} = 0.45$
- $w_{\text{email}} = 0.25$
- $w_{\text{phone}} = 0.20$
- $w_{\text{addr}} = 0.10$
- $\Delta_{\text{dob}} = +0.05$ bonus if exact DOB match when provided, or $-0.05$ penalty if contradictory.

---

## Stage 4: Decision Classification
- **Auto-Merge**: $S(A, B) \ge \tau_{\text{auto}}$ (Default: $0.92$)
- **Human Review**: $\tau_{\text{review}} \le S(A, B) < \tau_{\text{auto}}$ (Default: $[0.75, 0.92)$)
- **Non-Match**: $S(A, B) < \tau_{\text{review}}$ (Default: $< 0.75$)

---

## Stage 5: Transitive Clustering (Disjoint-Set Union-Find)
When pairs $A \sim B$ and $B \sim C$ exceed the match threshold, transitivity dictates that $\{A, B, C\}$ constitute an equivalence cluster. DedupeIQ applies Union-Find with:
1. **Path Compression**: Flattens tree traversal during `find(x)`, yielding nearly constant amortized query time $\alpha(N)$.
2. **Union by Rank**: Always attaches the smaller depth tree under the root of the deeper tree.
Amortized time complexity: $O(M \cdot \alpha(N))$, where $\alpha$ is the Inverse Ackermann function ($\alpha(N) < 5$ for all practical universe sizes).

---

## Stage 6: Golden Record Survivorship Rules
Within each cluster $\{r_1, r_2, \dots, r_k\}$, DedupeIQ constructs an elected **Golden Master Record** using field-level survivorship rules:
1. **Completeness First**: Discard null or blank values.
2. **Field Length Heuristic**: For addresses and titles, select the longest descriptive string (e.g., "104 Baker Street, Suite 4B" over "104 Baker St").
3. **Temporal Recency**: For volatile attributes (phone, email), select the value from the most recently updated record.
4. **Format Confidence**: Favor verified E.164 phone numbers and verified domain emails.

---

## Stage 7: Transactional Merge & Reversible Unmerge
A merge operation executes atomically:
1. All non-golden records in cluster update `status = 'merged'`.
2. Golden record is designated as `golden_record_id` on the cluster.
3. Pre-merge states of all participating records and candidate link tables are serialized into `merge_log.snapshot` as a JSONB payload.
4. An `unmerge` reads the snapshot, atomically restores each record's prior status, clears cluster assignments, and restores candidate flags within a single PostgreSQL transaction.
