import { describe, it, expect } from 'vitest';
import {
  calculateCompleteness,
  electGoldenRecord,
  computeStringDiff,
  MasterRecordData,
} from '../src/lib/pipeline/golden-record';

describe('Golden Record Survivorship', () => {
  it('calculates completeness scores based on populated attributes', () => {
    const sparseRecord: MasterRecordData = {
      id: '1',
      entity_type: 'customer',
      full_name: 'John Doe',
      source_system: 'CRM',
    };

    const richRecord: MasterRecordData = {
      id: '2',
      entity_type: 'customer',
      full_name: 'Johnathan Doe',
      email: 'john@example.com',
      phone: '5551234567',
      address: '100 Main St',
      city: 'Austin',
      dob: '1990-01-01',
      source_system: 'Portal',
    };

    expect(calculateCompleteness(richRecord)).toBeGreaterThan(calculateCompleteness(sparseRecord));
  });

  it('elects the golden record and synthesizes winning values per field', () => {
    const recordA: MasterRecordData = {
      id: 'rec-a',
      entity_type: 'customer',
      full_name: 'Bob Smith',
      email: 'bob.smith@gmail.com',
      phone: '9876543210',
      address: '104 Baker St.',
      source_system: 'Legacy',
      created_at: new Date('2022-01-01'),
    };

    const recordB: MasterRecordData = {
      id: 'rec-b',
      entity_type: 'customer',
      full_name: 'Robert Smith',
      email: 'robert.smith@newdomain.com',
      phone: '+91 98765 43210',
      address: '104 Baker Street, Suite 4B',
      city: 'London',
      source_system: 'CRM-New',
      created_at: new Date('2023-06-01'),
    };

    const election = electGoldenRecord([recordA, recordB]);
    expect(election.goldenRecordId).toBe('rec-b');
    // Longest valid name survives
    expect(election.syntheticRecord.full_name).toBe('Robert Smith');
    // Longest descriptive address survives
    expect(election.syntheticRecord.address).toBe('104 Baker Street, Suite 4B');
    // City from B survives
    expect(election.syntheticRecord.city).toBe('London');
  });

  describe('computeStringDiff', () => {
    it('accurately identifies common and distinct words', () => {
      const { diffA, diffB } = computeStringDiff('Rahul Sharma', 'Sharma Rahul');
      expect(diffA.every((d) => d.type === 'same')).toBe(true);
      expect(diffB.every((d) => d.type === 'same')).toBe(true);
    });

    it('identifies additions and deletions in differences', () => {
      const { diffA, diffB } = computeStringDiff('Baker St', 'Baker Street Suite 4B');
      expect(diffA.some((d) => d.type === 'removed')).toBe(true);
      expect(diffB.some((d) => d.type === 'added')).toBe(true);
    });
  });
});
