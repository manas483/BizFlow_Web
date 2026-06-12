import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { computeProfitLoss, computeCashFlow, type LedgerEntry } from '@/lib/accounting-utils';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

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

    // Compute net profit first
    const plEntries = entries.filter(e => e.accountType === 'REVENUE' || e.accountType === 'EXPENSE');
    const pl = computeProfitLoss(plEntries);

    // Then compute cash flow
    const bsEntries = entries.filter(e => ['ASSET', 'LIABILITY', 'EQUITY'].includes(e.accountType));
    const result = computeCashFlow(bsEntries, pl.netProfit);

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
