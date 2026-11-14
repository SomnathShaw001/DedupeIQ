/**
 * DedupeIQ Normalization Engine
 * Handles stage-1 deterministic standardization of names, emails, phones, addresses, and nicknames.
 */

// Common English and International Nickname dictionary mapping familiar names to root canonical names
export const NICKNAME_MAP: Record<string, string> = {
  bob: 'robert',
  bobby: 'robert',
  rob: 'robert',
  robbie: 'robert',
  bill: 'william',
  billy: 'william',
  will: 'william',
  willy: 'william',
  liam: 'william',
  dick: 'richard',
  rick: 'richard',
  richie: 'richard',
  jim: 'james',
  jimmy: 'james',
  jamie: 'james',
  jack: 'john',
  jackie: 'john',
  johnny: 'john',
  alex: 'alexander',
  alec: 'alexander',
  sasha: 'alexander',
  liz: 'elizabeth',
  lizzie: 'elizabeth',
  beth: 'elizabeth',
  betty: 'elizabeth',
  eliza: 'elizabeth',
  mike: 'michael',
  mikey: 'michael',
  mick: 'michael',
  dave: 'david',
  davy: 'david',
  dan: 'daniel',
  danny: 'daniel',
  tom: 'thomas',
  tommy: 'thomas',
  tony: 'anthony',
  chris: 'christopher',
  sam: 'samuel',
  sammy: 'samuel',
  ben: 'benjamin',
  benny: 'benjamin',
  ted: 'edward',
  teddy: 'edward',
  ed: 'edward',
  eddie: 'edward',
  kate: 'katherine',
  katie: 'katherine',
  cathy: 'catherine',
  maggie: 'margaret',
  meg: 'margaret',
  peggy: 'margaret',
  tonia: 'antonia',
  ron: 'ronald',
  ronny: 'ronald',
  greg: 'gregory',
  steve: 'stephen',
  steven: 'stephen',
  ken: 'kenneth',
  kenny: 'kenneth',
  andy: 'andrew',
  drew: 'andrew',
  pete: 'peter',
  matt: 'matthew',
  matty: 'matthew',
  joe: 'joseph',
  joey: 'joseph',
  charles: 'charlie',
  chuck: 'charles',
  chaz: 'charles',
  rahul: 'rahul',
  amit: 'amit',
  priya: 'priya',
  neha: 'neha',
  vikram: 'vikram',
  suresh: 'suresh',
  raj: 'rajesh',
  raju: 'rajesh',
};

// Common Street Address Abbreviation dictionary mapping short forms to canonical words
export const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  st: 'street',
  'st.': 'street',
  ave: 'avenue',
  'ave.': 'avenue',
  rd: 'road',
  'rd.': 'road',
  blvd: 'boulevard',
  'blvd.': 'boulevard',
  dr: 'drive',
  'dr.': 'drive',
  ln: 'lane',
  'ln.': 'lane',
  ct: 'court',
  'ct.': 'court',
  pl: 'place',
  'pl.': 'place',
  sq: 'square',
  'sq.': 'square',
  pkwy: 'parkway',
  'pkwy.': 'parkway',
  hwy: 'highway',
  'hwy.': 'highway',
  apt: 'apartment',
  'apt.': 'apartment',
  ste: 'suite',
  'ste.': 'suite',
  fl: 'floor',
  'fl.': 'floor',
  bldg: 'building',
  'bldg.': 'building',
  dept: 'department',
  'dept.': 'department',
  rm: 'room',
  'rm.': 'room',
  pk: 'park',
  'pk.': 'park',
  cl: 'circle',
  'cl.': 'circle',
};

/**
 * Normalizes full person or product names:
 * 1. Lowercase
 * 2. Strip salutations and honorifics (Mr, Mrs, Ms, Miss, Dr, Prof, Shri, Smt)
 * 3. Replace common nicknames with root canonical names
 * 4. Remove punctuation
 * 5. Collapse duplicate whitespace
 */
export function normalizeName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  let str = name.trim().toLowerCase();

  // Strip salutations
  str = str.replace(/^(mr\.|mr|mrs\.|mrs|ms\.|ms|miss|dr\.|dr|prof\.|prof|shri\.|shri|smt\.|smt)\s+/i, '');

  // Strip non-alphanumeric except spaces
  str = str.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse whitespace
  str = str.replace(/\s+/g, ' ').trim();

  // Tokenize and map nicknames
  const tokens = str.split(' ').map((token) => NICKNAME_MAP[token] || token);
  return tokens.join(' ');
}

/**
 * Normalizes email addresses:
 * 1. Lowercase
 * 2. Trim whitespace
 * 3. Strip sub-addressing (+tag)
 * 4. Remove dots for Gmail and Googlemail accounts
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf('@');
  if (atIndex === -1) return trimmed;

  let local = trimmed.slice(0, atIndex);
  let domain = trimmed.slice(atIndex + 1);

  // Strip +aliases
  const plusIndex = local.indexOf('+');
  if (plusIndex !== -1) {
    local = local.slice(0, plusIndex);
  }

  // Canonicalize gmail dots
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }

  return `${local}@${domain}`;
}

/**
 * Normalizes telephone numbers to canonical digits:
 * 1. Strips all non-digit characters
 * 2. Strips leading international country codes (+91, +1) if full length permits
 * 3. Strips national leading 0 if trunk code
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  let digits = phone.replace(/\D/g, '');

  // Handle +91 (India) 12-digit format
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && (digits.startsWith('1') || digits.startsWith('0'))) {
    // Handle +1 (US/Canada) or leading 0 trunk code
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Normalizes street addresses:
 * 1. Lowercase
 * 2. Remove punctuation
 * 3. Expand standard abbreviations (St -> Street, Ave -> Avenue, etc.)
 * 4. Collapse whitespace
 */
export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr || typeof addr !== 'string') return '';
  let str = addr.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  str = str.replace(/\s+/g, ' ').trim();

  const words = str.split(' ').map((w) => ADDRESS_ABBREVIATIONS[w] || w);
  return words.join(' ');
}

/**
 * Classic American Soundex algorithm implementation
 * Produces a letter followed by 3 numeric digits (e.g. S530 for Smith)
 */
export function getSoundex(str: string | null | undefined): string {
  if (!str) return 'Z000';
  const clean = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return 'Z000';

  const firstLetter = clean[0];
  const soundexMap: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };

  let code = firstLetter;
  let prevCode = soundexMap[firstLetter] || '0';

  for (let i = 1; i < clean.length && code.length < 4; i++) {
    const char = clean[i];
    const currCode = soundexMap[char] || '0';

    if (currCode !== '0' && currCode !== prevCode) {
      code += currCode;
    }
    prevCode = currCode;
  }

  return code.padEnd(4, '0');
}

/**
 * Simplified Metaphone phonetic implementation
 * Produces phonetic key representing pronunciation
 */
export function getMetaphone(str: string | null | undefined, maxLen = 4): string {
  if (!str) return '';
  const clean = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (!clean) return '';

  let res = '';
  let i = 0;

  // Initial letter transformations
  if (clean.startsWith('KN') || clean.startsWith('GN') || clean.startsWith('PN') || clean.startsWith('WR')) {
    i = 1;
  } else if (clean.startsWith('X')) {
    res += 'S';
    i = 1;
  }

  while (i < clean.length && res.length < maxLen) {
    const c = clean[i];
    const next = clean[i + 1] || '';
    const prev = clean[i - 1] || '';

    // Ignore duplicate characters except C
    if (c === prev && c !== 'C') {
      i++;
      continue;
    }

    if (i === 0 && 'AEIOU'.includes(c)) {
      res += c;
    } else if (c === 'B') {
      if (prev !== 'M' || i !== clean.length - 1) res += 'B';
    } else if (c === 'C') {
      if (next === 'H') {
        res += 'X';
        i++;
      } else if ('EIY'.includes(next)) {
        res += 'S';
      } else {
        res += 'K';
      }
    } else if (c === 'D') {
      if (next === 'G' && 'EIY'.includes(clean[i + 2] || '')) {
        res += 'J';
        i += 2;
      } else {
        res += 'T';
      }
    } else if (c === 'F') {
      res += 'F';
    } else if (c === 'G') {
      if (next === 'H') {
        // Silent GH (e.g. Knight, Night, Weight, Dough)
        i++;
      } else if (next === 'N' && i + 1 === clean.length - 1) {
        // Silent GN at end (e.g. Sign)
      } else if ('EIY'.includes(next)) {
        res += 'J';
      } else {
        res += 'K';
      }
    } else if (c === 'H') {
      if (prev === 'G') {
        // Already handled silent GH
      } else if ('AEIOU'.includes(next) && !'CSPTG'.includes(prev)) {
        res += 'H';
      }
    } else if (c === 'J') {
      res += 'J';
    } else if (c === 'K') {
      if (prev !== 'C') res += 'K';
    } else if (c === 'L') {
      res += 'L';
    } else if (c === 'M') {
      res += 'M';
    } else if (c === 'N') {
      res += 'N';
    } else if (c === 'P') {
      if (next === 'H') {
        res += 'F';
        i++;
      } else {
        res += 'P';
      }
    } else if (c === 'Q') {
      res += 'K';
    } else if (c === 'R') {
      res += 'R';
    } else if (c === 'S') {
      if (next === 'H') {
        res += 'X';
        i++;
      } else {
        res += 'S';
      }
    } else if (c === 'T') {
      if (next === 'H') {
        res += '0';
        i++;
      } else if (next === 'I' && (clean[i + 2] === 'A' || clean[i + 2] === 'O')) {
        res += 'X';
      } else {
        res += 'T';
      }
    } else if (c === 'V') {
      res += 'F';
    } else if (c === 'W' || c === 'Y') {
      if ('AEIOU'.includes(next)) res += c;
    } else if (c === 'Z') {
      res += 'S';
    }

    i++;
  }

  return res.padEnd(maxLen, '').slice(0, maxLen);
}
