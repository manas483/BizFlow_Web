export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { businessUpdateSchema } from '@/shared/lib/validations';
import { z } from 'zod';

// GET /api/business — fetch current business info
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/business — update business info (SUPER_ADMIN only)
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await req.json();
    const validatedData = businessUpdateSchema.parse(body);

    const existing = await prisma.business.findUnique({
      where: { id: session.user.businessId },
    });

    const business = await prisma.business.update({
      where: { id: session.user.businessId },
      data: validatedData,
    });

    const { logAudit, computeChanges } = await import('@/shared/lib/audit');
    if (existing) {
      const changes = computeChanges(existing as any, business as any);
      if (changes) {
        await logAudit({
          session,
          action: 'UPDATE',
          entityType: 'Business',
          entityId: business.id,
          entityLabel: business.name,
          changes,
        });
      }
    }

    return NextResponse.json(business);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


