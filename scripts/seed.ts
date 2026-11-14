import { seedBenchmarkDataset } from '../src/lib/benchmark/generator';
import { runDetection } from '../src/lib/pipeline/detector';

async function main() {
  console.log('Seeding DedupeIQ dataset with 2,000 synthetic records & ground truth...');
  try {
    const seedResult = await seedBenchmarkDataset(2000, 0.15);
    console.log(`✓ Seeded ${seedResult.totalRecords} records (${seedResult.injectedDuplicates} injected duplicates, ${seedResult.duplicatePercentage}% duplicate rate)`);

    console.log('Running initial detection pipeline on seeded records...');
    const detectionResult = await runDetection();
    console.log(`✓ Detection completed in ${detectionResult.durationMs}ms:`);
    console.log(`  - Records Scanned: ${detectionResult.recordsScanned}`);
    console.log(`  - Pairs Compared: ${detectionResult.pairsCompared} (Avoided: ${detectionResult.pairsAvoidedPct}%)`);
    console.log(`  - Auto-Merged Pairs: ${detectionResult.autoMergedPairs}`);
    console.log(`  - Pending Human Review: ${detectionResult.reviewPairs}`);
    console.log(`  - Duplicate Clusters Formed: ${detectionResult.clustersFound}`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

main();
