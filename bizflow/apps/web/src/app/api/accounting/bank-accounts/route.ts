import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { bankAccountSchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const accounts = await prisma.bankAccount.findMany({
      where: { businessId: session.user.businessId },
      include: {
        _count: { select: { bankBookEntries: true } },
      },
      orderBy: { createdAt: 'desc' },
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
    const data = bankAccountSchema.parse(body);

    const existing = await prisma.bankAccount.findUnique({
      where: { businessId_accountNumber: { businessId: session.user.businessId, accountNumber: data.accountNumber } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Bank account number already exists' }, { status: 409 });
    }

    const account = await prisma.bankAccount.create({
      data: { ...data, businessId: session.user.businessId },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
