export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { cashBookEntrySchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const type = searchParams.get('type');

    const entries = await prisma.cashBookEntry.findMany({
      where: {
        businessId: session.user.businessId,
        ...(type ? { transactionType: type as any } : {}),
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      include: {
        account: { select: { id: true, code: true, name: true, accountType: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalReceipts = entries.filter(e => e.transactionType === 'RECEIPT').reduce((s, e) => s + e.amount, 0);
    const totalPayments = entries.filter(e => e.transactionType === 'PAYMENT').reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({
      entries,
      totalReceipts: Math.round(totalReceipts * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      netCash: Math.round((totalReceipts - totalPayments) * 100) / 100,
    });
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
    const data = cashBookEntrySchema.parse(body);

    const entry = await prisma.cashBookEntry.create({
      data: {
        ...data,
        date: new Date(data.date),
        businessId: session.user.businessId,
      },
      include: { account: { select: { id: true, code: true, name: true } } },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

