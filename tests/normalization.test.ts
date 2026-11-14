import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  normalizeEmail,
  normalizePhone,
  normalizeAddress,
  getSoundex,
  getMetaphone,
} from '../src/lib/pipeline/normalization';

describe('Normalization Engine', () => {
  describe('normalizeName', () => {
    it('strips honorific titles and salutations', () => {
      expect(normalizeName('Dr. John Smith')).toBe('john smith');
      expect(normalizeName('Mr. Rahul Sharma')).toBe('rahul sharma');
      expect(normalizeName('Prof. Vikram Singh')).toBe('vikram singh');
      expect(normalizeName('Smt. Priya Patel')).toBe('priya patel');
      expect(normalizeName('Ms. Emily Davis')).toBe('emily davis');
    });

    it('maps nicknames to formal root names', () => {
      expect(normalizeName('Bob Johnson')).toBe('robert johnson');
      expect(normalizeName('Bill Clinton')).toBe('william clinton');
      expect(normalizeName('Jim Beam')).toBe('james beam');
      expect(normalizeName('Jack Ryan')).toBe('john ryan');
      expect(normalizeName('Alex Wright')).toBe('alexander wright');
    });

    it('removes punctuation and collapses extra whitespace', () => {
      expect(normalizeName('  John-Paul   O\'Connor  ')).toBe('john paul o connor');
    });
  });

  describe('normalizeEmail', () => {
    it('strips Gmail dot aliases and preserves canonical account', () => {
      expect(normalizeEmail('john.doe@gmail.com')).toBe('johndoe@gmail.com');
      expect(normalizeEmail('r.a.h.u.l.sharma@gmail.com')).toBe('rahulsharma@gmail.com');
      expect(normalizeEmail('user@googlemail.com')).toBe('user@gmail.com');
    });

    it('strips plus-addressing sub-aliases', () => {
      expect(normalizeEmail('john.doe+news@gmail.com')).toBe('johndoe@gmail.com');
      expect(normalizeEmail('sarah+work123@company.org')).toBe('sarah@company.org');
    });

    it('handles lowercase trimming', () => {
      expect(normalizeEmail('  User.Name@Domain.COM  ')).toBe('user.name@domain.com');
    });
  });

  describe('normalizePhone', () => {
    it('strips non-digits and international country codes (+91, +1)', () => {
      expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
      expect(normalizePhone('+1 (555) 234-5678')).toBe('5552345678');
      expect(normalizePhone('09876543210')).toBe('9876543210');
      expect(normalizePhone('98765-43210')).toBe('9876543210');
    });
  });

  describe('normalizeAddress', () => {
    it('expands common street and unit abbreviations', () => {
      expect(normalizeAddress('104 Baker St., Apt. 4B')).toBe('104 baker street apartment 4b');
      expect(normalizeAddress('500 Fifth Ave, Ste 200')).toBe('500 fifth avenue suite 200');
      expect(normalizeAddress('12 MG Rd, Fl 3')).toBe('12 mg road floor 3');
      expect(normalizeAddress('77 Sunset Blvd.')).toBe('77 sunset boulevard');
    });
  });

  describe('Phonetic Encoders', () => {
    it('computes correct American Soundex', () => {
      expect(getSoundex('Smith')).toBe('S530');
      expect(getSoundex('Smyth')).toBe('S530');
      expect(getSoundex('Robert')).toBe('R163');
      expect(getSoundex('Rupert')).toBe('R163');
    });

    it('computes Metaphone keys', () => {
      expect(getMetaphone('Smith', 4)).toBe('SM0');
      expect(getMetaphone('Smyth', 4)).toBe('SM0');
      expect(getMetaphone('Knight', 4)).toBe('NT');
      expect(getMetaphone('Night', 4)).toBe('NT');
    });
  });
});
