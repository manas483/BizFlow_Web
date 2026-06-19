import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { computeBalanceSheet, computeProfitLoss, type LedgerEntry } from '@/shared/lib/accounting-utils';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const asOf = searchParams.get('asOf');

    const dateFilter = asOf ? { lte: new Date(asOf) } : undefined;

    // Fetch all journal lines (POSTED entries only)
    const lines = await prisma.journalLine.findMany({
      where: {
        journalEntry: {
          businessId: session.user.businessId,
          status: 'POSTED',
          ...(dateFilter ? { date: dateFilter } : {}),
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, accountType: true } },
      },
    });

    const entries: LedgerEntry[] = lines.map(l => ({
      accountId: l.account.id,
      accountCode: l.account.code,
      accountName: l.account.name,
      accountType: l.account.accountType,
      debit: l.debit,
      credit: l.credit,
    }));

    // First compute P&L to get retained earnings
    const plEntries = entries.filter(e => e.accountType === 'REVENUE' || e.accountType === 'EXPENSE');
    const pl = computeProfitLoss(plEntries);

    // Then compute balance sheet with net profit carried forward
    const bsEntries = entries.filter(e => ['ASSET', 'LIABILITY', 'EQUITY'].includes(e.accountType));
    const result = computeBalanceSheet(bsEntries, pl.netProfit);

    return NextResponse.json({
      ...result,
      asOf: asOf ?? 'current',
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
