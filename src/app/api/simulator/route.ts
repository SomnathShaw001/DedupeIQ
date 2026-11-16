import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  normalizeName,
  normalizeEmail,
  normalizePhone,
  normalizeAddress,
  getSoundex,
  getMetaphone,
} from '@/lib/pipeline/normalization';
import {
  jaroWinkler,
  levenshteinRatio,
  trigramSimilarity,
  tokenSetRatio,
  scorePair,
} from '@/lib/pipeline/similarity';
import { electGoldenRecord } from '@/lib/pipeline/golden-record';

const simulatorSchema = z.object({
  recordA: z.object({
    full_name: z.string().min(1, 'Full name A is required'),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    dob: z.string().optional().nullable(),
    source_system: z.string().optional(),
  }),
  recordB: z.object({
    full_name: z.string().min(1, 'Full name B is required'),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    dob: z.string().optional().nullable(),
    source_system: z.string().optional(),
  }),
  weights: z
    .object({
      nameWeight: z.number().min(0).max(1).optional(),
      emailWeight: z.number().min(0).max(1).optional(),
      phoneWeight: z.number().min(0).max(1).optional(),
      addressWeight: z.number().min(0).max(1).optional(),
    })
    .optional(),
  thresholdAuto: z.number().min(0.5).max(1.0).optional().default(0.92),
  thresholdReview: z.number().min(0.3).max(0.95).optional().default(0.75),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = simulatorSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input payload', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { recordA, recordB, weights, thresholdAuto, thresholdReview } = parsed.data;

    // 1. Stage 1: Normalization
    const normA = {
      full_name: recordA.full_name,
      normalized_name: normalizeName(recordA.full_name),
      email: recordA.email ?? '',
      normalized_email: normalizeEmail(recordA.email),
      phone: recordA.phone ?? '',
      normalized_phone: normalizePhone(recordA.phone),
      address: recordA.address ?? '',
      normalized_address: normalizeAddress(recordA.address),
      soundex: getSoundex(recordA.full_name),
      metaphone: getMetaphone(recordA.full_name),
      city: recordA.city ?? '',
      dob: recordA.dob ?? '',
      source_system: recordA.source_system ?? 'System A',
    };

    const normB = {
      full_name: recordB.full_name,
      normalized_name: normalizeName(recordB.full_name),
      email: recordB.email ?? '',
      normalized_email: normalizeEmail(recordB.email),
      phone: recordB.phone ?? '',
      normalized_phone: normalizePhone(recordB.phone),
      address: recordB.address ?? '',
      normalized_address: normalizeAddress(recordB.address),
      soundex: getSoundex(recordB.full_name),
      metaphone: getMetaphone(recordB.full_name),
      city: recordB.city ?? '',
      dob: recordB.dob ?? '',
      source_system: recordB.source_system ?? 'System B',
    };

    // 2. Stage 2: Multi-Key Blocking Verification
    const name3A = normA.normalized_name.slice(0, 3);
    const name3B = normB.normalized_name.slice(0, 3);
    const phone6A = normA.normalized_phone.slice(-6);
    const phone6B = normB.normalized_phone.slice(-6);
    const emailPrefixA = normA.normalized_email.split('@')[0]?.slice(0, 4) || '';
    const emailPrefixB = normB.normalized_email.split('@')[0]?.slice(0, 4) || '';
    const nameTrigramSim = trigramSimilarity(normA.normalized_name, normB.normalized_name);

    const soundexMatch = Boolean(normA.soundex && normB.soundex && normA.soundex === normB.soundex);
    const metaphoneMatch = Boolean(normA.metaphone && normB.metaphone && normA.metaphone === normB.metaphone);
    const namePrefixMatch = Boolean(name3A.length >= 3 && name3B.length >= 3 && name3A === name3B);
    const phoneSuffixMatch = Boolean(phone6A.length >= 6 && phone6B.length >= 6 && phone6A === phone6B);
    const emailPrefixMatch = Boolean(emailPrefixA.length >= 4 && emailPrefixB.length >= 4 && emailPrefixA === emailPrefixB);
    const trigramThresholdMatch = nameTrigramSim >= 0.40;

    const blockingPassed = soundexMatch || metaphoneMatch || namePrefixMatch || phoneSuffixMatch || emailPrefixMatch || trigramThresholdMatch;

    const blockingReport = {
      passed: blockingPassed,
      keys: {
        soundex: { matched: soundexMatch, keyA: normA.soundex, keyB: normB.soundex },
        metaphone: { matched: metaphoneMatch, keyA: normA.metaphone, keyB: normB.metaphone },
        name3gramPrefix: { matched: namePrefixMatch, keyA: name3A, keyB: name3B },
        phoneLast6: { matched: phoneSuffixMatch, keyA: phone6A, keyB: phone6B },
        emailPrefix: { matched: emailPrefixMatch, keyA: emailPrefixA, keyB: emailPrefixB },
        trigramSimOver40: { matched: trigramThresholdMatch, similarity: Number(nameTrigramSim.toFixed(4)) },
      },
    };

    // 3. Stage 3: Granular Metric Decomposition
    const jaroWinklerScore = jaroWinkler(normA.normalized_name, normB.normalized_name);
    const levenshteinScore = levenshteinRatio(normA.normalized_name, normB.normalized_name);
    const tokenSetScore = tokenSetRatio(normA.normalized_name, normB.normalized_name);
    const trigramScore = nameTrigramSim;

    // Full pair scoring via official scorePair pipeline
    const pairScores = scorePair(
      {
        full_name: normA.full_name,
        normalized_name: normA.normalized_name,
        email: normA.email,
        normalized_email: normA.normalized_email,
        phone: normA.phone,
        normalized_phone: normA.normalized_phone,
        address: normA.normalized_address,
        dob: normA.dob,
      },
      {
        full_name: normB.full_name,
        normalized_name: normB.normalized_name,
        email: normB.email,
        normalized_email: normB.normalized_email,
        phone: normB.phone,
        normalized_phone: normB.normalized_phone,
        address: normB.normalized_address,
        dob: normB.dob,
      },
      weights ? {
        nameWeight: weights.nameWeight ?? 0.45,
        emailWeight: weights.emailWeight ?? 0.25,
        phoneWeight: weights.phoneWeight ?? 0.20,
        addressWeight: weights.addressWeight ?? 0.10,
      } : undefined
    );

    // 4. Stage 4: Decision Classification
    let decision: 'auto_merge' | 'review' | 'non_match' = 'non_match';
    if (pairScores.finalScore >= thresholdAuto) {
      decision = 'auto_merge';
    } else if (pairScores.finalScore >= thresholdReview) {
      decision = 'review';
    }

    // 5. Stage 5: Golden Master Survivorship Preview
    const dummyRecordA = {
      id: 'A',
      entity_type: 'customer' as const,
      full_name: recordA.full_name,
      email: recordA.email || null,
      phone: recordA.phone || null,
      address: recordA.address || null,
      city: recordA.city || null,
      dob: recordA.dob || null,
      source_system: recordA.source_system || 'Source A',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    };

    const dummyRecordB = {
      id: 'B',
      entity_type: 'customer' as const,
      full_name: recordB.full_name,
      email: recordB.email || null,
      phone: recordB.phone || null,
      address: recordB.address || null,
      city: recordB.city || null,
      dob: recordB.dob || null,
      source_system: recordB.source_system || 'Source B',
      created_at: new Date().toISOString(),
    };

    const goldenResult = electGoldenRecord([dummyRecordA, dummyRecordB]);

    const fieldProvenance: Record<string, string> = {};
    for (const [fName, fData] of Object.entries(goldenResult.fieldSources)) {
      fieldProvenance[fName] = fData.winnerRecordId === 'A' ? 'Record A' : 'Record B';
    }

    return NextResponse.json({
      success: true,
      normalization: {
        recordA: normA,
        recordB: normB,
      },
      blocking: blockingReport,
      metrics: {
        nameDecomposition: {
          jaroWinkler: Number(jaroWinklerScore.toFixed(4)),
          levenshteinRatio: Number(levenshteinScore.toFixed(4)),
          tokenSetRatio: Number(tokenSetScore.toFixed(4)),
          trigramSimilarity: Number(trigramScore.toFixed(4)),
          compositeNameScore: Number(pairScores.nameSim.toFixed(4)),
        },
        pairScores: {
          nameSim: Number(pairScores.nameSim.toFixed(4)),
          emailSim: Number(pairScores.emailSim.toFixed(4)),
          phoneSim: Number(pairScores.phoneSim.toFixed(4)),
          addressSim: Number(pairScores.addressSim.toFixed(4)),
          dobMatch: pairScores.dobMatch,
          finalScore: Number(pairScores.finalScore.toFixed(4)),
        },
      },
      decision: {
        classification: decision,
        thresholdAuto,
        thresholdReview,
        scorePercentage: (pairScores.finalScore * 100).toFixed(1) + '%',
        explanation: `${(pairScores.finalScore * 100).toFixed(1)}% match: Name ${(pairScores.nameSim * 100).toFixed(0)}%, Email ${(pairScores.emailSim * 100).toFixed(0)}%, Phone ${(pairScores.phoneSim * 100).toFixed(0)}%, Address ${(pairScores.addressSim * 100).toFixed(0)}%`,
      },
      goldenRecord: {
        survivingRecord: goldenResult.syntheticRecord,
        fieldProvenance,
      },
    });
  } catch (error) {
    console.error('Simulator error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
