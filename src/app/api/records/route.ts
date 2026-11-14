import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ensureMigrated } from '@/lib/db/migrate';
import { z } from 'zod';



const recordSchema = z.object({
  id: z.string().uuid().optional(),
  entity_type: z.enum(['customer', 'student', 'product']),
  full_name: z.string().min(1, 'Full name is required').max(255),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable().or(z.literal('')),
  address: z.string().max(500).optional().nullable().or(z.literal('')),
  city: z.string().max(100).optional().nullable().or(z.literal('')),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DOB must be YYYY-MM-DD').optional().nullable().or(z.literal('')),
  source_system: z.string().min(1, 'Source system is required').max(100),
  status: z.enum(['active', 'merged', 'archived']).default('active'),
});

export async function GET(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const search = searchParams.get('search')?.trim() || '';
    const entityType = searchParams.get('entity_type')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const sourceSystem = searchParams.get('source_system')?.trim() || '';
    const clusterId = searchParams.get('cluster_id')?.trim() || '';

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(
        full_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex} OR
        city ILIKE $${paramIndex} OR
        normalized_name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (entityType) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(entityType);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (sourceSystem) {
      conditions.push(`source_system = $${paramIndex}`);
      params.push(sourceSystem);
      paramIndex++;
    }

    if (clusterId) {
      conditions.push(`cluster_id = $${paramIndex}`);
      params.push(clusterId);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Count query
    const countSql = `SELECT COUNT(*) AS total FROM records WHERE ${whereClause}`;
    const countRows = await db.query<{ total: string | number }>(countSql, params);
    const total = Number(countRows[0]?.total || 0);

    // Data query with pagination
    const dataSql = `
      SELECT 
        id, entity_type, full_name, email, phone, address, city, dob, source_system,
        normalized_name, normalized_email, normalized_phone, name_soundex, name_metaphone,
        status, cluster_id, created_at
      FROM records
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const rows = await db.query(dataSql, params);

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching records:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const json = await request.json();

    const parsed = recordSchema.parse(json);

    const emailVal = parsed.email && parsed.email.trim() ? parsed.email.trim() : null;
    const phoneVal = parsed.phone && parsed.phone.trim() ? parsed.phone.trim() : null;
    const addrVal = parsed.address && parsed.address.trim() ? parsed.address.trim() : null;
    const cityVal = parsed.city && parsed.city.trim() ? parsed.city.trim() : null;
    const dobVal = parsed.dob && parsed.dob.trim() ? parsed.dob.trim() : null;

    const rows = await db.query(
      `
      INSERT INTO records (
        entity_type, full_name, email, phone, address, city, dob, source_system, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        parsed.entity_type,
        parsed.full_name.trim(),
        emailVal,
        phoneVal,
        addrVal,
        cityVal,
        dobVal,
        parsed.source_system.trim(),
        parsed.status || 'active',
      ]
    );

    return NextResponse.json({ success: true, record: rows[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Error creating record:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const json = await request.json();

    const idSchema = z.string().uuid();
    const recordId = idSchema.parse(json.id);
    const parsed = recordSchema.parse(json);

    const emailVal = parsed.email && parsed.email.trim() ? parsed.email.trim() : null;
    const phoneVal = parsed.phone && parsed.phone.trim() ? parsed.phone.trim() : null;
    const addrVal = parsed.address && parsed.address.trim() ? parsed.address.trim() : null;
    const cityVal = parsed.city && parsed.city.trim() ? parsed.city.trim() : null;
    const dobVal = parsed.dob && parsed.dob.trim() ? parsed.dob.trim() : null;

    const rows = await db.query(
      `
      UPDATE records SET
        entity_type = $1,
        full_name = $2,
        email = $3,
        phone = $4,
        address = $5,
        city = $6,
        dob = $7,
        source_system = $8,
        status = $9
      WHERE id = $10
      RETURNING *
      `,
      [
        parsed.entity_type,
        parsed.full_name.trim(),
        emailVal,
        phoneVal,
        addrVal,
        cityVal,
        dobVal,
        parsed.source_system.trim(),
        parsed.status || 'active',
        recordId,
      ]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, record: rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error('Error updating record:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureMigrated();
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 });
    }

    // Soft delete / archive to maintain relational integrity
    await db.query(`UPDATE records SET status = 'archived' WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting record:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
