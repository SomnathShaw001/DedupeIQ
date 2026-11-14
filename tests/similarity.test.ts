import { describe, it, expect } from 'vitest';
import {
  jaroWinkler,
  levenshteinDistance,
  levenshteinRatio,
  trigramSimilarity,
  tokenSetRatio,
  scorePair,
} from '../src/lib/pipeline/similarity';

describe('Similarity Metrics', () => {
  describe('Levenshtein Distance & Ratio', () => {
    it('calculates exact edit distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('sharma', 'sharma')).toBe(0);
      expect(levenshteinDistance('robert', 'rupert')).toBe(2);
    });

    it('calculates normalized similarity ratio', () => {
      expect(levenshteinRatio('sharma', 'sharma')).toBe(1.0);
      expect(levenshteinRatio('sharma', 'sharrma')).toBeCloseTo(0.857, 2);
      expect(levenshteinRatio('completely', 'different')).toBeLessThan(0.3);
    });
  });

  describe('Jaro-Winkler Similarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(jaroWinkler('martha', 'martha')).toBe(1.0);
    });

    it('rewards common prefixes', () => {
      const scorePrefix = jaroWinkler('dixon', 'dicksonx');
      expect(scorePrefix).toBeGreaterThan(0.8);
    });

    it('scores typographical errors highly', () => {
      expect(jaroWinkler('johndoe', 'jonhdow')).toBeGreaterThan(0.85);
      expect(jaroWinkler('rahul', 'rauhl')).toBeGreaterThan(0.88);
    });
  });

  describe('Trigram Similarity', () => {
    it('matches PostgreSQL pg_trgm behavior for identical strings', () => {
      expect(trigramSimilarity('rahul sharma', 'rahul sharma')).toBe(1.0);
    });

    it('measures sub-word character overlap', () => {
      const sim = trigramSimilarity('baker street', 'baker st');
      expect(sim).toBeGreaterThan(0.5);
    });
  });

  describe('Token-Set Ratio', () => {
    it('handles inverted name word order seamlessly', () => {
      const sim = tokenSetRatio('Sharma Rahul', 'Rahul Sharma');
      expect(sim).toBe(1.0);
    });

    it('handles extra middle names or subsets', () => {
      const sim = tokenSetRatio('John Michael Doe', 'John Doe');
      expect(sim).toBe(1.0);
    });
  });

  describe('scorePair Composite Pipeline', () => {
    it('computes weighted composite score and explanation for matching pair', () => {
      const a = {
        full_name: 'Rahul Sharma',
        email: 'rahul.sharma@gmail.com',
        phone: '9876543210',
        address: '104 MG Road',
        city: 'Bengaluru',
        dob: '1995-05-12',
      };

      const b = {
        full_name: 'Sharma Rahul',
        email: 'rahulsharma+work@gmail.com',
        phone: '+91 98765 43210',
        address: '104 MG Rd.',
        city: 'Bengaluru',
        dob: '1995-05-12',
      };

      const result = scorePair(a, b);
      expect(result.finalScore).toBeGreaterThanOrEqual(0.92);
      expect(result.dobMatch).toBe(true);
      expect(result.explanation).toContain('name');
    });

    it('scores non-matching records low', () => {
      const a = {
        full_name: 'John Smith',
        email: 'john@example.com',
        phone: '5551234567',
      };

      const b = {
        full_name: 'Priya Patel',
        email: 'priya@sample.org',
        phone: '9876543210',
      };

      const result = scorePair(a, b);
      expect(result.finalScore).toBeLessThan(0.5);
      expect(result.finalScore).toBeLessThan(0.75); // Non-match threshold
    });
  });
});
