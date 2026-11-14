import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { fuzzystrmatch } from '@electric-sql/pglite/contrib/fuzzystrmatch';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import path from 'path';
import fs from 'fs';

export interface QueryResultRow {
  [column: string]: unknown;
}

export interface DbClient {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;
  exec(sql: string): Promise<void>;
  transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T>;
  getMode(): 'neon_postgres' | 'local_pglite';
}

// Global singleton to prevent connection leaks across Next.js hot-reloads
declare global {
  var __dbInstance: DbClient | undefined;
}

class PostgresDbClient implements DbClient {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  getMode(): 'neon_postgres' | 'local_pglite' {
    return 'neon_postgres';
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pool.query(sql, params);
    return res.rows as T[];
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const res = await this.pool.query(sql, params);
    return { rowCount: res.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  async transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txClient: DbClient = {
        getMode: () => 'neon_postgres',
        query: async <R extends QueryResultRow = QueryResultRow>(text: string, p: unknown[] = []) => {
          const res = await client.query(text, p);
          return res.rows as R[];
        },
        queryOne: async <R extends QueryResultRow = QueryResultRow>(text: string, p: unknown[] = []): Promise<R | null> => {
          const res = await client.query(text, p);
          return (res.rows[0] as R) ?? null;
        },
        execute: async (text: string, p: unknown[] = []) => {
          const res = await client.query(text, p);
          return { rowCount: res.rowCount ?? 0 };
        },
        exec: async (text: string) => {
          await client.query(text);
        },
        transaction: () => {
          throw new Error('Nested transactions are not supported directly in this transaction block');
        },
      };
      const result = await callback(txClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

class PGliteDbClient implements DbClient {
  private pglite: PGlite;
  private initPromise: Promise<void> | null = null;

  constructor(dataDir?: string) {
    if (dataDir && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.pglite = new PGlite(dataDir, {
      extensions: {
        fuzzystrmatch,
        pg_trgm,
      },
    });
  }

  getMode(): 'neon_postgres' | 'local_pglite' {
    return 'local_pglite';
  }

  private async ensureReady(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        await this.pglite.waitReady;
      })();
    }
    await this.initPromise;
  }

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    await this.ensureReady();
    const res = await this.pglite.query(sql, params);
    return (res.rows || []) as T[];
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    await this.ensureReady();
    const res = await this.pglite.query(sql, params);
    return { rowCount: res.affectedRows ?? res.rows?.length ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.ensureReady();
    await this.pglite.exec(sql);
  }

  async transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
    await this.ensureReady();
    return await this.pglite.transaction(async (tx) => {
      const txClient: DbClient = {
        getMode: () => 'local_pglite',
        query: async <R extends QueryResultRow = QueryResultRow>(text: string, p: unknown[] = []) => {
          const res = await tx.query(text, p);
          return (res.rows || []) as R[];
        },
        queryOne: async <R extends QueryResultRow = QueryResultRow>(text: string, p: unknown[] = []): Promise<R | null> => {
          const res = await tx.query(text, p);
          return (res.rows?.[0] as R) ?? null;
        },
        execute: async (text: string, p: unknown[] = []) => {
          const res = await tx.query(text, p);
          return { rowCount: res.affectedRows ?? res.rows?.length ?? 0 };
        },
        exec: async (text: string) => {
          await tx.exec(text);
        },
        transaction: () => {
          throw new Error('Nested transactions not supported');
        },
      };
      return await callback(txClient);
    });
  }
}

export function getDb(): DbClient {
  if (global.__dbInstance) {
    return global.__dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl && !databaseUrl.startsWith('pglite://')) {
    global.__dbInstance = new PostgresDbClient(databaseUrl);
  } else {
    const defaultDataDir = path.resolve(process.cwd(), '.data', 'dedupeiq.db');
    global.__dbInstance = new PGliteDbClient(defaultDataDir);
  }

  return global.__dbInstance;
}

export const db = getDb();
