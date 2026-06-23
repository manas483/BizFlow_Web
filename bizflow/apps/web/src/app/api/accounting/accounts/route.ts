export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { accountSchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const accountType = searchParams.get('type');
    const parentId = searchParams.get('parentId');
    const isActive = searchParams.get('isActive');

    const accounts = await prisma.account.findMany({
      where: {
        businessId: session.user.businessId,
        ...(accountType ? { accountType: accountType as any } : {}),
        ...(parentId ? { parentId } : {}),
        ...(isActive !== null && isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      },
      include: {
        children: { select: { id: true, code: true, name: true, accountType: true, isActive: true } },
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { journalLines: true } },
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const data = accountSchema.parse(body);

    // Check for duplicate code within the business
    const existing = await prisma.account.findUnique({
      where: { businessId_code: { businessId: session.user.businessId, code: data.code } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Account code already exists' }, { status: 409 });
    }

    const account = await prisma.account.create({
      data: {
        ...data,
        businessId: session.user.businessId,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

