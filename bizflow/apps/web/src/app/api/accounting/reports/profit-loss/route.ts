import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { computeProfitLoss, type LedgerEntry } from '@/shared/lib/accounting-utils';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Fetch all journal lines for REVENUE and EXPENSE accounts (POSTED entries only)
    const lines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          businessId: session.user.businessId,
          status: 'POSTED',
          ...(from || to ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          } : {}),
        },
        account: {
          accountType: { in: ['REVENUE', 'EXPENSE'] },
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, accountType: true } },
      },
    });

    // Map to LedgerEntry format
    const entries: LedgerEntry[] = lines.map(l => ({
      accountId: l.account.id,
      accountCode: l.account.code,
      accountName: l.account.name,
      accountType: l.account.accountType,
      debit: l.debit,
      credit: l.credit,
    }));

    const result = computeProfitLoss(entries);

    return NextResponse.json({
      ...result,
      period: { from: from ?? 'inception', to: to ?? 'current' },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
