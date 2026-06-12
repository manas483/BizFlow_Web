import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { bankBookEntrySchema } from '@/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const bankAccountId = searchParams.get('bankAccountId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const reconciliationStatus = searchParams.get('reconciliationStatus');

    const entries = await prisma.bankBookEntry.findMany({
      where: {
        businessId: session.user.businessId,
        ...(bankAccountId ? { bankAccountId } : {}),
        ...(reconciliationStatus ? { reconciliationStatus: reconciliationStatus as any } : {}),
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      include: {
        bankAccount: { select: { id: true, accountName: true, bankName: true } },
        account: { select: { id: true, code: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    const totalReceipts = entries.filter(e => e.transactionType === 'RECEIPT').reduce((s, e) => s + e.amount, 0);
    const totalPayments = entries.filter(e => e.transactionType === 'PAYMENT').reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({
      entries,
      totalReceipts: Math.round(totalReceipts * 100) / 100,
      totalPayments: Math.round(totalPayments * 100) / 100,
      netBalance: Math.round((totalReceipts - totalPayments) * 100) / 100,
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
    const data = bankBookEntrySchema.parse(body);

    const entry = await prisma.bankBookEntry.create({
      data: {
        ...data,
        date: new Date(data.date),
        businessId: session.user.businessId,
      },
      include: {
        bankAccount: { select: { id: true, accountName: true } },
        account: { select: { id: true, code: true, name: true } },
      },
    });

    // Update bank account balance
    const balanceChange = data.transactionType === 'RECEIPT' ? data.amount : -data.amount;
    await prisma.bankAccount.update({
      where: { id: data.bankAccountId },
      data: { currentBalance: { increment: balanceChange } },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
