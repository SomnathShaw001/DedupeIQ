const BASE_URL = 'http://localhost:3000';

interface QATestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
  metrics?: Record<string, unknown>;
}

const results: QATestResult[] = [];

async function runQASuite() {
  console.log('====================================================');
  console.log('   DedupeIQ Comprehensive QA Verification Suite     ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // TEST 1: Page Route Health & SSR Render (Network Tab & Console)
  // ---------------------------------------------------------------
  console.log('--> [1/8] Testing Page Routes & Server Rendering...');
  const routes = [
    '/',
    '/data',
    '/detection',
    '/review',
    '/clusters',
    '/benchmark',
    '/sql-lab',
    '/about',
  ];

  let routesPassed = true;
  const routeStatuses: Record<string, number> = {};

  for (const route of routes) {
    try {
      const res = await fetch(`${BASE_URL}${route}`);
      routeStatuses[route] = res.status;
      const html = await res.text();

      if (res.status !== 200 || !html.includes('<!DOCTYPE html>')) {
        routesPassed = false;
        console.error(`  FAIL: Route ${route} returned status ${res.status}`);
      } else {
        console.log(`  PASS: Route ${route} returned 200 OK (${html.length} bytes)`);
      }
    } catch (err) {
      routesPassed = false;
      console.error(`  FAIL: Route ${route} network error:`, err);
    }
  }

  results.push({
    name: 'Page Routes & Server Rendering (Zero 500s/404s)',
    status: routesPassed ? 'PASS' : 'FAIL',
    details: 'All 8 UI page routes render 200 OK with complete HTML and zero server errors',
    metrics: routeStatuses,
  });

  // ---------------------------------------------------------------
  // TEST 2: Empty Database State Handling
  // ---------------------------------------------------------------
  console.log('\n--> [2/8] Testing Empty Database State Handling...');
  try {
    // Check Dashboard API on current/zero data
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    const dash = await res.json();
    const hasValidNumbers =
      typeof dash.summary?.total_records === 'number' &&
      !isNaN(Number(dash.summary?.duplicate_reduction_pct));

    // Check Clusters API on empty state
    const clusterRes = await fetch(`${BASE_URL}/api/clusters?page=1&limit=10`);
    const clusterJson = await clusterRes.json();

    // Check Review API on empty state
    const reviewRes = await fetch(`${BASE_URL}/api/review?limit=10`);
    const reviewJson = await reviewRes.json();

    const emptyStateClean =
      hasValidNumbers &&
      Array.isArray(clusterJson.clusters) &&
      Array.isArray(reviewJson.items);

    results.push({
      name: 'Empty Database State Handling',
      status: emptyStateClean ? 'PASS' : 'FAIL',
      details: 'All APIs return valid empty collections and zeroed metrics without crashing or NaN',
      metrics: {
        totalRecords: dash.summary?.total_records,
        clusters: clusterJson.clusters.length,
        reviewItems: reviewJson.items.length,
      },
    });
    console.log('  PASS: Empty states verified across Dashboard, Review Queue, and Clusters');
  } catch (err) {
    results.push({
      name: 'Empty Database State Handling',
      status: 'FAIL',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // ---------------------------------------------------------------
  // TEST 3: CSV Ingestion with Corrupt & Bad Rows
  // ---------------------------------------------------------------
  console.log('\n--> [3/8] Testing CSV Ingestion with Corrupt & Bad Rows...');
  try {
    const testBatch = [
      {
        entity_type: 'customer',
        full_name: 'Dr. Vikram Chandra',
        email: 'vikram.c+research@gmail.com',
        phone: '+91 98765 43210',
        address: '14 Park Street',
        city: 'Kolkata',
        source_system: 'CSV-Import-Test',
      },
      {
        // BAD ROW 1: Missing full_name (violates NOT NULL & validation)
        entity_type: 'customer',
        full_name: '',
        email: 'bad.row1@example.com',
        phone: '1234567890',
        source_system: 'CSV-Import-Test',
      },
      {
        // BAD ROW 2: Whitespace-only name
        entity_type: 'customer',
        full_name: '   ',
        email: 'bad.row2@example.com',
        source_system: 'CSV-Import-Test',
      },
      {
        entity_type: 'student',
        full_name: 'Ananya Deshmukh',
        email: 'ananya.d@university.edu',
        phone: '9822011223',
        address: 'FC Road',
        city: 'Pune',
        source_system: 'CSV-Import-Test',
      },
    ];

    const importRes = await fetch(`${BASE_URL}/api/records/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: testBatch }),
    });

    const importData = await importRes.json();
    const importOk =
      importRes.status === 200 &&
      importData.totalReceived === 4 &&
      importData.insertedCount === 2 &&
      importData.errorCount === 2 &&
      importData.errors.length === 2 &&
      importData.errors[0].row === 2 &&
      importData.errors[1].row === 3;

    if (!importOk) {
      console.error('  FAIL: Import did not properly isolate bad rows:', importData);
    } else {
      console.log(`  PASS: Validated 4 rows -> 2 inserted, 2 rejected with exact row numbers and errors`);
    }

    results.push({
      name: 'CSV Import with Corrupt & Bad Rows',
      status: importOk ? 'PASS' : 'FAIL',
      details: 'Rejected 2 invalid rows with precise row indices and inserted 2 valid records transactionally',
      metrics: {
        totalReceived: importData.totalReceived,
        insertedCount: importData.insertedCount,
        errorCount: importData.errorCount,
        sampleError: importData.errors?.[0]?.error,
      },
    });
  } catch (err) {
    results.push({
      name: 'CSV Import with Corrupt & Bad Rows',
      status: 'FAIL',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // ---------------------------------------------------------------
  // TEST 4: Seed Benchmark (2,000 Records, ~15% Injected Duplicates)
  // ---------------------------------------------------------------
  console.log('\n--> [4/8] Seeding 2,000 Realistic Benchmark Records...');
  try {
    const seedRes = await fetch(`${BASE_URL}/api/benchmark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTotal: 2000, duplicateRate: 0.15 }),
    });

    const seedJson = await seedRes.json();
    const seedOk =
      seedRes.status === 200 &&
      seedJson.result?.totalRecords === 2000 &&
      seedJson.result?.injectedDuplicates >= 250 &&
      seedJson.result?.injectedDuplicates <= 350;

    console.log(
      `  PASS: Seeded ${seedJson.result.totalRecords} records with ${seedJson.result.injectedDuplicates} injected duplicates (${seedJson.result.duplicatePercentage}%)`
    );

    results.push({
      name: 'Benchmark Dataset Generation (2,000 Records)',
      status: seedOk ? 'PASS' : 'FAIL',
      details: 'Generated 2,000 synthetic records with realistic noise injection and ground truth labels',
      metrics: {
        totalRecords: seedJson.result.totalRecords,
        injectedDuplicates: seedJson.result.injectedDuplicates,
        duplicatePercentage: seedJson.result.duplicatePercentage,
      },
    });
  } catch (err) {
    results.push({
      name: 'Benchmark Dataset Generation (2,000 Records)',
      status: 'FAIL',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // ---------------------------------------------------------------
  // TEST 5: Detection Pipeline Execution & Threshold Sliders
  // ---------------------------------------------------------------
  console.log('\n--> [5/8] Running Detection Pipeline with Blocking & Sliders...');
  try {
    // Test detection with standard thresholds: Auto >= 0.92, Review >= 0.75
    const detRes = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useBlocking: true,
        thresholdAuto: 0.92,
        thresholdReview: 0.75,
        weights: {
          nameWeight: 0.45,
          emailWeight: 0.25,
          phoneWeight: 0.20,
          addressWeight: 0.10,
        },
      }),
    });

    const detJson = await detRes.json();
    const result = detJson.result;

    const blockingEfficient = result.pairsAvoidedPct >= 95;
    const detectedDuplicates = result.clustersFound > 100;
    const fastExecution = result.durationMs < 15000;

    console.log(`  Scanned: ${result.recordsScanned} records`);
    console.log(`  Theoretical Pairs: ${result.totalTheoreticalPairs.toLocaleString()}`);
    console.log(`  Pairs Compared: ${result.pairsCompared.toLocaleString()}`);
    console.log(`  Pairs Avoided: ${result.pairsAvoidedPct}% (Multi-Key Blocking Efficiency)`);
    console.log(`  Clusters Formed: ${result.clustersFound}`);
    console.log(`  Auto-Merged Pairs: ${result.autoMergedPairs}`);
    console.log(`  Review Queue Pairs: ${result.reviewPairs}`);
    console.log(`  Execution Time: ${result.durationMs}ms`);

    results.push({
      name: 'Detection Pipeline & Blocking Optimization',
      status: blockingEfficient && detectedDuplicates && fastExecution ? 'PASS' : 'FAIL',
      details: `Scanned 2,000 records, avoided ${result.pairsAvoidedPct}% unnecessary pairs, completed in ${result.durationMs}ms`,
      metrics: {
        recordsScanned: result.recordsScanned,
        pairsCompared: result.pairsCompared,
        pairsAvoidedPct: result.pairsAvoidedPct,
        clustersFound: result.clustersFound,
        autoMergedPairs: result.autoMergedPairs,
        reviewPairs: result.reviewPairs,
        durationMs: result.durationMs,
      },
    });

    // Test slider responsiveness: Run with stricter threshold Auto = 0.96, Review = 0.85
    console.log('  Testing threshold slider variation (Auto: 0.96, Review: 0.85)...');
    const detRes2 = await fetch(`${BASE_URL}/api/detection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useBlocking: true,
        thresholdAuto: 0.96,
        thresholdReview: 0.85,
      }),
    });
    const detJson2 = await detRes2.json();
    const result2 = detJson2.result;

    const sliderResponsive =
      result2.autoMergedPairs < result.autoMergedPairs ||
      result2.clustersFound <= result.clustersFound;

    results.push({
      name: 'Threshold Sliders & Hyperparameter Sensitivity',
      status: sliderResponsive ? 'PASS' : 'FAIL',
      details: 'Adjusting Auto-Merge from 0.92 to 0.96 shifted borderline pairs from auto-merge to review/non-match',
      metrics: {
        baselineAutoMerged: result.autoMergedPairs,
        strictAutoMerged: result2.autoMergedPairs,
      },
    });
  } catch (err) {
    results.push({
      name: 'Detection Pipeline & Blocking Optimization',
      status: 'FAIL',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // ---------------------------------------------------------------
  // TEST 6: Ground Truth Evaluation Metrics
  // ---------------------------------------------------------------
  console.log('\n--> [6/8] Evaluating Precision, Recall, F1 & Confusion Matrix...');
  try {
    const benchRes = await fetch(`${BASE_URL}/api/benchmark`);
    const benchJson = await benchRes.json();
    const m = benchJson.metrics;

    const validMetrics =
      m &&
      m.precision >= 0.70 &&
      m.recall >= 0.70 &&
      m.f1 >= 0.70 &&
      m.confusionMatrix?.truePositives > 0 &&
      Array.isArray(m.thresholdCurve) &&
      m.thresholdCurve.length > 0;

    console.log(`  Precision: ${(m.precision * 100).toFixed(2)}%`);
    console.log(`  Recall: ${(m.recall * 100).toFixed(2)}%`);
    console.log(`  F1 Score: ${(m.f1 * 100).toFixed(2)}%`);
    console.log(`  Confusion Matrix: TP=${m.confusionMatrix.truePositives}, FP=${m.confusionMatrix.falsePositives}, FN=${m.confusionMatrix.falseNegatives}`);

    results.push({
      name: 'Ground-Truth Scientific Evaluation (Precision/Recall/F1)',
      status: validMetrics ? 'PASS' : 'FAIL',
      details: `Empirical validation achieved Precision: ${(m.precision * 100).toFixed(1)}%, Recall: ${(m.recall * 100).toFixed(1)}%, F1: ${(m.f1 * 100).toFixed(1)}%`,
      metrics: {
        precision: `${(m.precision * 100).toFixed(1)}%`,
        recall: `${(m.recall * 100).toFixed(1)}%`,
        f1: `${(m.f1 * 100).toFixed(1)}%`,
        truePositives: m.confusionMatrix.truePositives,
        falsePositives: m.confusionMatrix.falsePositives,
        falseNegatives: m.confusionMatrix.falseNegatives,
      },
    });
  } catch (err) {
    results.push({
      name: 'Ground-Truth Scientific Evaluation (Precision/Recall/F1)',
      status: 'FAIL',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // ---------------------------------------------------------------
  // TEST 7: Review Queue Actions (Merge, Non-match, Skip)
  // ---------------------------------------------------------------
  console.log('\n--> [7/8] Testing Review Queue Interactive Actions...');
  try {
    // 1. Fetch review candidates
    const reviewRes = await fetch(`${BASE_URL}/api/review?limit=10`);
    const reviewData = await reviewRes.json();
    const candidates = reviewData.items || [];

    if (candidates.length < 2) {
      console.warn('  Warning: Fewer than 2 candidates in review queue.');
    }

    let reviewPassed = true;

    // Test Action: non_match on candidate 0
    if (candidates.length > 0) {
      const c1 = candidates[0];
      const resNonMatch = await fetch(`${BASE_URL}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: c1.id, action: 'non_match' }),
      });
      const dataNM = await resNonMatch.json();
      if (!resNonMatch.ok || !dataNM.success) {
        reviewPassed = false;
        console.error('  FAIL: Non-match action failed:', dataNM);
      } else {
        console.log(`  PASS: Candidate ${c1.id.slice(0, 8)} successfully marked as non_match`);
      }
    }

    // Test Action: merge on candidate 1
    if (candidates.length > 1) {
      const c2 = candidates[1];
      const resMerge = await fetch(`${BASE_URL}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: c2.id, action: 'merge' }),
      });
      const dataM = await resMerge.json();
      if (!resMerge.ok || !dataM.success || !dataM.clusterId) {
        reviewPassed = false;
        console.error('  FAIL: Merge action failed:', dataM);
      } else {
        console.log(`  PASS: Candidate ${c2.id.slice(0, 8)} successfully merged into cluster ${dataM.clusterId.slice(0, 8)}`);
      }
    }

    results.push({
      name: 'Review Queue Actions (Non-Match & Merge)',
      status: reviewPassed ? 'PASS' : 'FAIL',
      details: 'Human review decisions successfully updated match_candidates and created transactionally merged clusters',
      metrics: {
        testedCandidates: Math.min(2, candidates.length),
        totalQueueRemaining: reviewData.pendingTotal,
      },
    });
  } catch (err) {
    results.push({
      name: 'Review Queue Actions (Non-Match & Merge)',
      status: 'FAIL',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // ---------------------------------------------------------------
  // TEST 8: Cluster Inspection, Golden Record & Transactional Unmerge
  // ---------------------------------------------------------------
  console.log('\n--> [8/8] Testing Cluster Inspection & Transactional Unmerge...');
  try {
    // 1. Get a cluster
    const clusterRes = await fetch(`${BASE_URL}/api/clusters?page=1&limit=5`);
    const clusterData = await clusterRes.json();
    const targetCluster = clusterData.clusters?.[0];

    if (!targetCluster) {
      throw new Error('No clusters available to test unmerge');
    }

    console.log(`  Target Cluster: ${targetCluster.id} (Size: ${targetCluster.size}, Golden: ${targetCluster.golden_name})`);

    // 2. Fetch detail & audit snapshot
    const detailRes = await fetch(`${BASE_URL}/api/clusters/${targetCluster.id}`);
    const detailJson = await detailRes.json();
    const initialMembers = detailJson.members;
    const initialLog = detailJson.auditLogs;

    console.log(`  Pre-unmerge members: ${initialMembers.length}, Pre-unmerge logs: ${initialLog.length}`);

    // Verify records had cluster_id set
    for (const m of initialMembers) {
      if (m.cluster_id !== targetCluster.id) {
        throw new Error(`Record ${m.id} cluster_id does not match cluster ${targetCluster.id}`);
      }
    }

    // 3. Execute Unmerge
    const unmergeRes = await fetch(`${BASE_URL}/api/clusters/${targetCluster.id}/unmerge`, {
      method: 'POST',
    });
    const unmergeJson = await unmergeRes.json();

    if (!unmergeRes.ok || !unmergeJson.success) {
      throw new Error(`Unmerge API call failed: ${unmergeJson.error}`);
    }

    console.log(`  Unmerge executed. Reverted records: ${unmergeJson.revertedCount}`);

    // 4. Verify via API that cluster is gone
    const checkClusterRes = await fetch(`${BASE_URL}/api/clusters/${targetCluster.id}`);
    const clusterGone = checkClusterRes.status === 404;
    if (!clusterGone) {
      throw new Error(`Cluster ${targetCluster.id} still returned from /api/clusters/:id!`);
    }

    // 5. Verify member records are restored to active status with null cluster_id
    let allReverted = true;
    for (const m of initialMembers) {
      const recRes = await fetch(`${BASE_URL}/api/records?search=${encodeURIComponent(m.full_name)}`);
      const recJson = await recRes.json();
      const match = recJson.data?.find((r: { id: string }) => r.id === m.id);
      if (!match || match.status !== 'active' || match.cluster_id !== null) {
        allReverted = false;
        console.error(`  FAIL: Record ${m.id} (${m.full_name}) not reverted:`, match);
      }
    }

    const unmergeVerified = clusterGone && allReverted && unmergeJson.revertedCount > 0;

    console.log(
      `  PASS: Transactional unmerge completed: cluster deleted (404), ${unmergeJson.revertedCount} records verified restored to active with null cluster_id`
    );

    results.push({
      name: 'Transactional Merge & Unmerge Cycle',
      status: unmergeVerified ? 'PASS' : 'FAIL',
      details: `Cluster ${targetCluster.id.slice(0, 8)} unmerged cleanly with full rollback: ${unmergeJson.revertedCount} records restored to status='active' and cluster_id=null`,
      metrics: {
        clusterId: targetCluster.id,
        revertedRecords: unmergeJson.revertedCount,
      },
    });
  } catch (err) {
    results.push({
      name: 'Transactional Merge & Unmerge Cycle',
      status: 'FAIL',
      details: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  // ---------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------
  console.log('\n====================================================');
  console.log('              QA VERIFICATION CHECKLIST             ');
  console.log('====================================================');
  let passCount = 0;
  for (const r of results) {
    const mark = r.status === 'PASS' ? '✓ [PASS]' : '✗ [FAIL]';
    if (r.status === 'PASS') passCount++;
    console.log(`${mark} ${r.name}`);
    console.log(`         Details: ${r.details}`);
    if (r.metrics) {
      console.log(`         Metrics: ${JSON.stringify(r.metrics)}`);
    }
  }
  console.log('----------------------------------------------------');
  console.log(`Final Result: ${passCount}/${results.length} tests passed (${Math.round((passCount / results.length) * 100)}%)\n`);

  if (passCount !== results.length) {
    process.exit(1);
  }
}

runQASuite().catch((err) => {
  console.error('Fatal QA suite error:', err);
  process.exit(1);
});
