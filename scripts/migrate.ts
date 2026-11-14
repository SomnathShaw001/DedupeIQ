import { runMigrations } from '../src/lib/db/migrate';

async function main() {
  console.log('Running DedupeIQ database migrations...');
  try {
    const result = await runMigrations();
    console.log(`Migrations complete. Applied: ${result.applied.length}, Skipped: ${result.skipped.length}`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
