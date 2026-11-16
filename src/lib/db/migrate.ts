import fs from 'fs';
import path from 'path';
import { getDb } from './index';

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  const db = getDb();

  // Create migrations table if not exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedRows = await db.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  const alreadyApplied = new Set(appliedRows.map((r) => r.version));

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      skipped.push(file);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`Applying migration: ${file}...`);

    await db.exec(sql);
    await db.query(
      'INSERT INTO schema_migrations (version, applied_at) VALUES ($1, CURRENT_TIMESTAMP)',
      [file]
    );

    applied.push(file);
    console.log(`✓ Migration applied: ${file}`);
  }

  return { applied, skipped };
}

let migrationPromise: Promise<{ applied: string[]; skipped: string[] }> | null = null;

export async function ensureMigrated(): Promise<{ applied: string[]; skipped: string[] }> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const res = await runMigrations();
      try {
        const db = getDb();
        const countRes = await db.queryOne<{ count: string | number }>(
          'SELECT COUNT(*) as count FROM records'
        );
        const count = Number(countRes?.count ?? 0);
        if (count === 0) {
          console.log('Database initialized empty. Auto-seeding starter master records and running detection...');
          const { seedBenchmarkDataset } = await import('../benchmark/generator');
          const { runDetection } = await import('../pipeline/detector');
          await seedBenchmarkDataset(150, 0.16);
          await runDetection({ useBlocking: true, thresholdAuto: 0.92, thresholdReview: 0.75 });
          console.log('✓ Initial master records and duplicate detection executed successfully.');
        }
      } catch (autoSeedErr) {
        console.warn('Startup auto-seed check skipped or non-fatal:', autoSeedErr);
      }
      return res;
    })().catch((err) => {
      migrationPromise = null;
      throw err;
    });
  }
  return migrationPromise;
}
