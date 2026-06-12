import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { receivableSchema } from '@/lib/validations';
import { calculateAging } from '@/lib/accounting-utils';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const receivables = await prisma.accountsReceivable.findMany({
      where: {
        businessId: session.user.businessId,
        ...(status ? { status } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    // Calculate aging dynamically
    const aging = calculateAging(
      receivables.map(r => ({ dueDate: r.dueDate, amount: r.amount, paidAmount: r.paidAmount }))
    );

    const totalOutstanding = receivables.reduce((sum, r) => sum + (r.amount - r.paidAmount), 0);

    return NextResponse.json({ receivables, aging, totalOutstanding: Math.round(totalOutstanding * 100) / 100 });
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
    const data = receivableSchema.parse(body);

    const receivable = await prisma.accountsReceivable.create({
      data: {
        ...data,
        dueDate: new Date(data.dueDate),
        businessId: session.user.businessId,
      },
      include: { customer: { select: { id: true, name: true } } },
    });

    return NextResponse.json(receivable, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
