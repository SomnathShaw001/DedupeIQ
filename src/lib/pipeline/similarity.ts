/**
 * DedupeIQ Pairwise Similarity Engine
 * High-performance pure TypeScript implementations of string metrics:
 * Jaro-Winkler, Levenshtein ratio, Trigram similarity, and Token-Set Ratio.
 */

/**
 * Standard Levenshtein edit distance
 */
export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const m = s1.length;
  const n = s2.length;
  let prevRow = new Array<number>(n + 1);
  let currRow = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    const c1 = s1[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = c1 === s2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // insertion
        prevRow[j] + 1, // deletion
        prevRow[j - 1] + cost // substitution
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n];
}

/**
 * Levenshtein similarity ratio between 0.0 and 1.0
 */
export function levenshteinRatio(s1: string, s2: string): number {
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  return Number((1 - dist / maxLen).toFixed(4));
}

/**
 * Jaro distance between two strings
 */
export function jaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) {
      k++;
    }
    if (s1[i] !== s2[k]) {
      transpositions++;
    }
    k++;
  }

  const t = transpositions / 2;
  const sim = (matches / len1 + matches / len2 + (matches - t) / matches) / 3;
  return sim;
}

/**
 * Jaro-Winkler similarity with standard prefix scale p = 0.1
 */
export function jaroWinkler(s1: string, s2: string, prefixScale = 0.1): number {
  const jaro = jaroDistance(s1, s2);
  if (jaro < 0.7) return Number(jaro.toFixed(4));

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  const jw = jaro + prefix * prefixScale * (1 - jaro);
  return Number(Math.min(1.0, Math.max(0.0, jw)).toFixed(4));
}

/**
 * Trigram (q-gram of size 3) similarity equivalent to PostgreSQL pg_trgm similarity()
 */
export function trigramSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  // Space-pad strings as in PostgreSQL pg_trgm
  const pad1 = `  ${s1} `;
  const pad2 = `  ${s2} `;

  const getTrigrams = (str: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < str.length - 2; i++) {
      const tri = str.slice(i, i + 3);
      map.set(tri, (map.get(tri) || 0) + 1);
    }
    return map;
  };

  const map1 = getTrigrams(pad1);
  const map2 = getTrigrams(pad2);

  let intersectionCount = 0;
  let total1 = 0;
  let total2 = 0;

  for (const [, count] of map1) total1 += count;
  for (const [, count] of map2) total2 += count;

  for (const [tri, count1] of map1) {
    const count2 = map2.get(tri);
    if (count2) {
      intersectionCount += Math.min(count1, count2);
    }
  }

  const unionCount = total1 + total2 - intersectionCount;
  if (unionCount === 0) return 1.0;
  return Number((intersectionCount / unionCount).toFixed(4));
}

/**
 * Token-Set Ratio:
 * Handles token transpositions, subsets, and word re-orderings (e.g. "Sharma Rahul" vs "Rahul Sharma")
 */
export function tokenSetRatio(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const tokens1 = Array.from(new Set(clean(s1))).sort();
  const tokens2 = Array.from(new Set(clean(s2))).sort();

  if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = tokens1.filter((t) => set2.has(t));
  const diff1 = tokens1.filter((t) => !set2.has(t));
  const diff2 = tokens2.filter((t) => !set1.has(t));

  const sortedInter = intersection.join(' ');
  const sortedInterDiff1 = [...intersection, ...diff1].join(' ');
  const sortedInterDiff2 = [...intersection, ...diff2].join(' ');

  // Compute Jaro-Winkler across combinations
  const scores = [
    jaroWinkler(sortedInter, sortedInterDiff1),
    jaroWinkler(sortedInter, sortedInterDiff2),
    jaroWinkler(sortedInterDiff1, sortedInterDiff2),
  ];

  return Math.max(...scores);
}

export interface ScoringWeights {
  nameWeight: number;
  emailWeight: number;
  phoneWeight: number;
  addressWeight: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  nameWeight: 0.45,
  emailWeight: 0.25,
  phoneWeight: 0.20,
  addressWeight: 0.10,
};

export interface PairCandidateInput {
  full_name: string;
  normalized_name?: string | null;
  email?: string | null;
  normalized_email?: string | null;
  phone?: string | null;
  normalized_phone?: string | null;
  address?: string | null;
  city?: string | null;
  dob?: string | Date | null;
}

export interface PairScoreResult {
  nameSim: number;
  emailSim: number;
  phoneSim: number;
  addressSim: number;
  dobMatch: boolean;
  finalScore: number;
  explanation: string;
}

/**
 * Calculates weighted composite similarity and builds human-readable explanation
 */
export function scorePair(
  a: PairCandidateInput,
  b: PairCandidateInput,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): PairScoreResult {
  // 1. Name score: ensemble of Jaro-Winkler, Trigram, and Token-Set ratio
  const nameA = a.normalized_name || a.full_name.toLowerCase();
  const nameB = b.normalized_name || b.full_name.toLowerCase();

  const jwName = jaroWinkler(nameA, nameB);
  const triName = trigramSimilarity(nameA, nameB);
  const tsrName = tokenSetRatio(nameA, nameB);
  const nameSim = Number(Math.max(jwName * 0.5 + triName * 0.5, tsrName).toFixed(4));

  // 2. Email score: exact or high-ratio
  let emailSim = 0.0;
  const emailA = a.normalized_email || a.email?.toLowerCase();
  const emailB = b.normalized_email || b.email?.toLowerCase();

  if (emailA && emailB) {
    if (emailA === emailB) {
      emailSim = 1.0;
    } else {
      emailSim = jaroWinkler(emailA, emailB);
    }
  }

  // 3. Phone score: exact digits match or Levenshtein
  let phoneSim = 0.0;
  const phoneA = a.normalized_phone || a.phone?.replace(/\D/g, '');
  const phoneB = b.normalized_phone || b.phone?.replace(/\D/g, '');

  if (phoneA && phoneB) {
    if (phoneA === phoneB) {
      phoneSim = 1.0;
    } else if (phoneA.length >= 7 && phoneB.length >= 7) {
      // Check last 7 digits
      const suffixA = phoneA.slice(-7);
      const suffixB = phoneB.slice(-7);
      if (suffixA === suffixB) {
        phoneSim = 0.95;
      } else {
        phoneSim = levenshteinRatio(phoneA, phoneB);
      }
    } else {
      phoneSim = levenshteinRatio(phoneA, phoneB);
    }
  }

  // 4. Address score: token set + Levenshtein
  let addressSim = 0.0;
  const addrA = [a.address, a.city].filter(Boolean).join(' ').toLowerCase();
  const addrB = [b.address, b.city].filter(Boolean).join(' ').toLowerCase();

  if (addrA && addrB) {
    const tsrAddr = tokenSetRatio(addrA, addrB);
    const triAddr = trigramSimilarity(addrA, addrB);
    addressSim = Number(Math.max(tsrAddr, triAddr).toFixed(4));
  }

  // 5. DOB match
  let dobMatch = false;
  if (a.dob && b.dob) {
    const dobStrA = a.dob instanceof Date ? a.dob.toISOString().slice(0, 10) : String(a.dob).slice(0, 10);
    const dobStrB = b.dob instanceof Date ? b.dob.toISOString().slice(0, 10) : String(b.dob).slice(0, 10);
    dobMatch = dobStrA === dobStrB;
  }

  // Calculate weighted score with dynamic re-weighting for missing fields
  let totalWeight = weights.nameWeight;
  let rawScore = nameSim * weights.nameWeight;

  if (emailA && emailB) {
    rawScore += emailSim * weights.emailWeight;
    totalWeight += weights.emailWeight;
  }
  if (phoneA && phoneB) {
    rawScore += phoneSim * weights.phoneWeight;
    totalWeight += weights.phoneWeight;
  }
  if (addrA && addrB) {
    rawScore += addressSim * weights.addressWeight;
    totalWeight += weights.addressWeight;
  }

  let finalScore = totalWeight > 0 ? rawScore / totalWeight : nameSim;

  // DOB bonus/penalty adjustments
  if (a.dob && b.dob) {
    if (dobMatch) {
      finalScore = Math.min(1.0, finalScore + 0.04);
    } else {
      finalScore = Math.max(0.0, finalScore - 0.08);
    }
  }

  finalScore = Number(finalScore.toFixed(4));

  // Build explanation
  const parts: string[] = [];
  parts.push(`name ${Math.round(nameSim * 100)}%`);

  if (emailA && emailB) {
    parts.push(emailSim === 1.0 ? 'email exact' : `email ${Math.round(emailSim * 100)}%`);
  }
  if (phoneA && phoneB) {
    parts.push(phoneSim === 1.0 ? 'phone exact' : `phone ${Math.round(phoneSim * 100)}%`);
  }
  if (addrA && addrB) {
    parts.push(`address ${Math.round(addressSim * 100)}%`);
  }
  if (a.dob && b.dob) {
    parts.push(dobMatch ? 'DOB match' : 'DOB mismatch');
  }

  const explanation = parts.join(', ');

  return {
    nameSim,
    emailSim,
    phoneSim,
    addressSim,
    dobMatch,
    finalScore,
    explanation,
  };
}
