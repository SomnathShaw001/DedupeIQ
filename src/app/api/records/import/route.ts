import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';
import { z } from 'zod';



const importRowSchema = z.object({
  entity_type: z
    .enum(['customer', 'student', 'product'])
    .optional()
    .default('customer'),
  full_name: z.string().trim().min(1, 'Name is required and cannot be empty'),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  dob: z.string().optional().nullable(),
  source_system: z.string().optional().default('CSV-Import'),
});

const importPayloadSchema = z.object({
  records: z.array(z.record(z.string(), z.unknown())).min(1, 'At least 1 record required'),
});

export async function POST(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const body = await request.json();

    const parsed = importPayloadSchema.parse(body);
    const validRows: z.infer<typeof importRowSchema>[] = [];
    const errors: { row: number; error: string }[] = [];

    parsed.records.forEach((row, index) => {
      const result = importRowSchema.safeParse(row);
      if (result.success) {
        validRows.push(result.data);
      } else {
        const errorMsg = result.error.issues.map((i) => i.message).join('; ');
        errors.push({
          row: index + 1,
          error: errorMsg,
        });
      }
    });

    if (validRows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in import data', errors },
        { status: 400 }
      );
    }

    let insertedCount = 0;
    await db.transaction(async (tx) => {
      const BATCH_SIZE = 200;
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const chunk = validRows.slice(i, i + BATCH_SIZE);
        for (const r of chunk) {
          await tx.query(
            `
            INSERT INTO records (
              entity_type, full_name, email, phone, address, city, dob, source_system, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
            `,
            [
              r.entity_type,
              r.full_name.trim(),
              r.email?.trim() || null,
              r.phone?.trim() || null,
              r.address?.trim() || null,
              r.city?.trim() || null,
              r.dob?.trim() || null,
              r.source_system.trim(),
            ]
          );
          insertedCount++;
        }
      }
    });

    return NextResponse.json({
      success: true,
      totalReceived: parsed.records.length,
      insertedCount,
      errorCount: errors.length,
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
