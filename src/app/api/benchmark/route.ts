import { NextRequest, NextResponse } from 'next/server';
import { ensureMigrated } from '@/lib/db/migrate';
import { seedBenchmarkDataset } from '@/lib/benchmark/generator';
import { evaluateBenchmark } from '@/lib/benchmark/evaluator';
import { z } from 'zod';



const seedSchema = z.object({
  targetTotal: z.number().min(50).max(5000).optional().default(2000),
  duplicateRate: z.number().min(0.05).max(0.5).optional().default(0.15),
});

export async function GET() {
  try {
    await ensureMigrated();
    const metrics = await evaluateBenchmark();
    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Benchmark evaluation error:', error);
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
      // Default empty
    }

    const { targetTotal, duplicateRate } = seedSchema.parse(body);
    const seedResult = await seedBenchmarkDataset(targetTotal, duplicateRate);

    return NextResponse.json({ success: true, result: seedResult });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Benchmark seed error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
