/**
 * DedupeIQ Golden Record Survivorship Engine & Field Diffing
 * Applies deterministic survivorship rules:
 * - Completeness score
 * - Recency
 * - Longest descriptive valid value
 * Generates character-level diff representations for side-by-side UI review.
 */

export interface MasterRecordData {
  id: string;
  entity_type: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  dob?: string | Date | null;
  source_system: string;
  created_at?: string | Date | null;
  status?: string;
  cluster_id?: string | null;
  [key: string]: unknown;
}

export interface GoldenRecordResult {
  goldenRecordId: string;
  syntheticRecord: Omit<MasterRecordData, 'id'> & { id: string };
  fieldSources: Record<string, { winnerRecordId: string; value: unknown; rule: string }>;
}

/**
 * Calculates a completeness score for a record based on populated non-null attributes
 */
export function calculateCompleteness(record: MasterRecordData): number {
  let score = 0;
  if (record.full_name && record.full_name.trim()) score += 3;
  if (record.email && record.email.trim()) score += 3;
  if (record.phone && record.phone.trim()) score += 2;
  if (record.address && record.address.trim()) score += 2;
  if (record.city && record.city.trim()) score += 1;
  if (record.dob) score += 2;
  return score;
}

/**
 * Elects the primary golden record and synthesizes best-of-breed survivorship values
 */
export function electGoldenRecord(records: MasterRecordData[]): GoldenRecordResult {
  if (records.length === 0) {
    throw new Error('Cannot elect golden record from empty record set');
  }

  // Sort candidates by completeness descending, then recency descending
  const ranked = [...records].sort((a, b) => {
    const compA = calculateCompleteness(a);
    const compB = calculateCompleteness(b);
    if (compA !== compB) return compB - compA;

    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });

  const primaryWinner = ranked[0];
  const fieldSources: GoldenRecordResult['fieldSources'] = {};

  // Survivorship for full_name: longest non-blank valid name
  const nameCandidate = records
    .filter((r) => r.full_name && r.full_name.trim())
    .sort((a, b) => b.full_name.trim().length - a.full_name.trim().length)[0] || primaryWinner;
  fieldSources['full_name'] = {
    winnerRecordId: nameCandidate.id,
    value: nameCandidate.full_name,
    rule: 'longest_valid_string',
  };

  // Survivorship for email: most recent non-null email
  const emailCandidate = records
    .filter((r) => r.email && r.email.trim())
    .sort((a, b) => (new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()))[0];
  if (emailCandidate) {
    fieldSources['email'] = {
      winnerRecordId: emailCandidate.id,
      value: emailCandidate.email,
      rule: 'most_recent_timestamp',
    };
  }

  // Survivorship for phone: cleanest longest phone
  const phoneCandidate = records
    .filter((r) => r.phone && r.phone.trim())
    .sort((a, b) => (b.phone || '').replace(/\D/g, '').length - (a.phone || '').replace(/\D/g, '').length)[0];
  if (phoneCandidate) {
    fieldSources['phone'] = {
      winnerRecordId: phoneCandidate.id,
      value: phoneCandidate.phone,
      rule: 'most_complete_digits',
    };
  }

  // Survivorship for address: longest descriptive address
  const addrCandidate = records
    .filter((r) => r.address && r.address.trim())
    .sort((a, b) => (b.address?.length || 0) - (a.address?.length || 0))[0];
  if (addrCandidate) {
    fieldSources['address'] = {
      winnerRecordId: addrCandidate.id,
      value: addrCandidate.address,
      rule: 'longest_descriptive_address',
    };
  }

  // Survivorship for city: most frequent or longest
  const cityCandidate = records
    .filter((r) => r.city && r.city.trim())
    .sort((a, b) => (b.city?.length || 0) - (a.city?.length || 0))[0];
  if (cityCandidate) {
    fieldSources['city'] = {
      winnerRecordId: cityCandidate.id,
      value: cityCandidate.city,
      rule: 'longest_valid_string',
    };
  }

  // Survivorship for dob: first non-null
  const dobCandidate = records.find((r) => r.dob != null);
  if (dobCandidate) {
    fieldSources['dob'] = {
      winnerRecordId: dobCandidate.id,
      value: dobCandidate.dob,
      rule: 'first_present_value',
    };
  }

  const syntheticRecord = {
    id: primaryWinner.id,
    entity_type: primaryWinner.entity_type,
    full_name: (fieldSources['full_name']?.value as string) || primaryWinner.full_name,
    email: (fieldSources['email']?.value as string) || primaryWinner.email || null,
    phone: (fieldSources['phone']?.value as string) || primaryWinner.phone || null,
    address: (fieldSources['address']?.value as string) || primaryWinner.address || null,
    city: (fieldSources['city']?.value as string) || primaryWinner.city || null,
    dob: (fieldSources['dob']?.value as string | Date) || primaryWinner.dob || null,
    source_system: primaryWinner.source_system,
    created_at: primaryWinner.created_at,
    status: 'active',
    cluster_id: primaryWinner.cluster_id,
  };

  return {
    goldenRecordId: primaryWinner.id,
    syntheticRecord,
    fieldSources,
  };
}

export interface DiffPart {
  type: 'same' | 'added' | 'removed';
  value: string;
}

/**
 * Character-level difference computation for highlighting text discrepancies in UI
 */
export function computeStringDiff(strA: string | null | undefined, strB: string | null | undefined): {
  diffA: DiffPart[];
  diffB: DiffPart[];
} {
  const a = strA || '';
  const b = strB || '';

  if (a === b) {
    return {
      diffA: [{ type: 'same', value: a }],
      diffB: [{ type: 'same', value: b }],
    };
  }

  // Simple Longest Common Subsequence or word token diff
  const wordsA = a.split(/(\s+)/);
  const wordsB = b.split(/(\s+)/);

  const setB = new Set(wordsB.map((w) => w.toLowerCase()));
  const setA = new Set(wordsA.map((w) => w.toLowerCase()));

  const diffA: DiffPart[] = wordsA.map((w) => ({
    type: setB.has(w.toLowerCase()) ? 'same' : 'removed',
    value: w,
  }));

  const diffB: DiffPart[] = wordsB.map((w) => ({
    type: setA.has(w.toLowerCase()) ? 'same' : 'added',
    value: w,
  }));

  return { diffA, diffB };
}
