import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { bankReconciliationSchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const bankAccountId = searchParams.get('bankAccountId');

    const reconciliations = await prisma.bankReconciliation.findMany({
      where: {
        businessId: session.user.businessId,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      include: {
        bankAccount: { select: { id: true, accountName: true, bankName: true } },
      },
      orderBy: { statementDate: 'desc' },
    });

    return NextResponse.json(reconciliations);
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
    const data = bankReconciliationSchema.parse(body);

    // Get current book balance from bank account
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: data.bankAccountId, businessId: session.user.businessId },
    });
    if (!bankAccount) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });

    // Get unreconciled entries
    const unreconciledEntries = await prisma.bankBookEntry.findMany({
      where: {
        bankAccountId: data.bankAccountId,
        reconciliationStatus: 'PENDING',
        businessId: session.user.businessId,
      },
      select: { id: true },
    });

    // Mark selected entries as matched
    if (data.reconciledEntries.length > 0) {
      await prisma.bankBookEntry.updateMany({
        where: { id: { in: data.reconciledEntries } },
        data: { reconciliationStatus: 'MATCHED', reconciliationDate: new Date() },
      });
    }

    const reconciliation = await prisma.bankReconciliation.create({
      data: {
        bankAccountId: data.bankAccountId,
        statementDate: new Date(data.statementDate),
        statementBalance: data.statementBalance,
        bookBalance: bankAccount.currentBalance,
        adjustedBalance: data.statementBalance,
        reconciledEntries: data.reconciledEntries,
        unreconciledEntries: unreconciledEntries
          .filter(e => !data.reconciledEntries.includes(e.id))
          .map(e => e.id),
        notes: data.notes,
        status: 'COMPLETED',
        businessId: session.user.businessId,
      },
      include: { bankAccount: { select: { id: true, accountName: true } } },
    });

    return NextResponse.json(reconciliation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
