import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { payableSchema } from '@/lib/validations';
import { calculateAging } from '@/lib/accounting-utils';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const payables = await prisma.accountsPayable.findMany({
      where: {
        businessId: session.user.businessId,
        ...(status ? { status } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });

    const aging = calculateAging(
      payables.map(p => ({ dueDate: p.dueDate, amount: p.amount, paidAmount: p.paidAmount }))
    );

    const totalOutstanding = payables.reduce((sum, p) => sum + (p.amount - p.paidAmount), 0);

    return NextResponse.json({ payables, aging, totalOutstanding: Math.round(totalOutstanding * 100) / 100 });
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
    const data = payableSchema.parse(body);

    const payable = await prisma.accountsPayable.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
        businessId: session.user.businessId,
      },
    });

    return NextResponse.json(payable, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
