import { describe, it, expect } from 'vitest';
import { DisjointSet } from '../src/lib/pipeline/union-find';

describe('DisjointSet Union-Find Clustering', () => {
  it('correctly forms singletons on initialization', () => {
    const uf = new DisjointSet();
    uf.makeSet('A');
    uf.makeSet('B');
    expect(uf.find('A')).toBe('A');
    expect(uf.find('B')).toBe('B');
    expect(uf.connected('A', 'B')).toBe(false);
  });

  it('unites two elements and verifies connectivity', () => {
    const uf = new DisjointSet();
    expect(uf.union('A', 'B')).toBe(true);
    expect(uf.connected('A', 'B')).toBe(true);
    expect(uf.size('A')).toBe(2);
    expect(uf.size('B')).toBe(2);
  });

  it('enforces transitivity: A~B and B~C implies A~C', () => {
    const uf = new DisjointSet();
    uf.union('A', 'B');
    uf.union('B', 'C');
    expect(uf.connected('A', 'C')).toBe(true);
    expect(uf.size('A')).toBe(3);

    const clusters = uf.getClusters();
    expect(clusters.size).toBe(1);
    const members = Array.from(clusters.values())[0];
    expect(members.sort()).toEqual(['A', 'B', 'C']);
  });

  it('handles multiple disjoint clusters correctly', () => {
    const uf = new DisjointSet();
    uf.union('A', 'B');
    uf.union('C', 'D');
    uf.union('D', 'E');

    expect(uf.connected('A', 'B')).toBe(true);
    expect(uf.connected('C', 'E')).toBe(true);
    expect(uf.connected('A', 'C')).toBe(false);

    const clusters = uf.getClusters();
    expect(clusters.size).toBe(2);
  });

  it('returns false when uniting already connected nodes', () => {
    const uf = new DisjointSet();
    uf.union('X', 'Y');
    expect(uf.union('X', 'Y')).toBe(false);
  });
});
