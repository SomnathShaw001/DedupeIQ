/**
 * DedupeIQ Disjoint-Set (Union-Find) Data Structure
 * Implements transitive grouping with path compression and union by rank.
 * Amortized complexity: O(alpha(N)) per operation where alpha is Inverse Ackermann.
 */
export class DisjointSet {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();
  private groupSize: Map<string, number> = new Map();

  /**
   * Initializes or registers an element
   */
  makeSet(element: string): void {
    if (!this.parent.has(element)) {
      this.parent.set(element, element);
      this.rank.set(element, 0);
      this.groupSize.set(element, 1);
    }
  }

  /**
   * Finds the representative root of an element with path compression
   */
  find(element: string): string {
    this.makeSet(element);
    let root = element;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }

    // Path compression
    let curr = element;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }

    return root;
  }

  /**
   * Unites the sets containing elementA and elementB using union by rank
   * Returns true if two disjoint sets were merged, false if already connected
   */
  union(elementA: string, elementB: string): boolean {
    const rootA = this.find(elementA);
    const rootB = this.find(elementB);

    if (rootA === rootB) return false;

    const rankA = this.rank.get(rootA) || 0;
    const rankB = this.rank.get(rootB) || 0;
    const sizeA = this.groupSize.get(rootA) || 1;
    const sizeB = this.groupSize.get(rootB) || 1;

    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
      this.groupSize.set(rootB, sizeA + sizeB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
      this.groupSize.set(rootA, sizeA + sizeB);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
      this.groupSize.set(rootA, sizeA + sizeB);
    }

    return true;
  }

  /**
   * Checks if two elements belong to the same cluster
   */
  connected(elementA: string, elementB: string): boolean {
    return this.find(elementA) === this.find(elementB);
  }

  /**
   * Gets the size of the cluster containing element
   */
  size(element: string): number {
    const root = this.find(element);
    return this.groupSize.get(root) || 1;
  }

  /**
   * Returns all clusters as a Map of rootId -> array of memberIds
   */
  getClusters(): Map<string, string[]> {
    const clusters = new Map<string, string[]>();
    for (const element of this.parent.keys()) {
      const root = this.find(element);
      const list = clusters.get(root);
      if (list) {
        list.push(element);
      } else {
        clusters.set(root, [element]);
      }
    }
    return clusters;
  }
}
