import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';
import { runDetection } from '@/lib/pipeline/detector';
import { z } from 'zod';



const detectionRunConfigSchema = z.object({
  entityType: z.enum(['customer', 'student', 'product']).optional().nullable(),
  thresholdAuto: z.number().min(0.5).max(1.0).optional(),
  thresholdReview: z.number().min(0.3).max(0.95).optional(),
  weights: z
    .object({
      nameWeight: z.number().min(0).max(1).optional(),
      emailWeight: z.number().min(0).max(1).optional(),
      phoneWeight: z.number().min(0).max(1).optional(),
      addressWeight: z.number().min(0).max(1).optional(),
    })
    .optional(),
  useBlocking: z.boolean().optional(),
});

export async function GET() {
  try {
    await ensureMigrated();
    const db = getDb();

    const runs = await db.query(`
      SELECT 
        id, started_at, finished_at, records_scanned, pairs_compared, clusters_found,
        threshold_auto, threshold_review, config
      FROM detection_runs
      ORDER BY started_at DESC
      LIMIT 50
    `);

    return NextResponse.json({ runs });
  } catch (error) {
    console.error('Detection runs fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureMigrated();
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Default empty config
    }

    const validated = detectionRunConfigSchema.parse(body);
    const result = await runDetection(validated);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Detection run error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
