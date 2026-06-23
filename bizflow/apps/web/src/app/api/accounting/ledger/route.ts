export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Verify account belongs to this business
    const account = await prisma.account.findFirst({
      where: { id: accountId, businessId: session.user.businessId },
    });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // Fetch all journal lines for this account (only from POSTED entries)
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: {
          businessId: session.user.businessId,
          status: 'POSTED',
          ...(from || to ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to.split('T')[0]}T23:59:59.999Z`) } : {}),
            },
          } : {}),
        },
      },
      include: {
        journalEntry: { select: { id: true, entryNumber: true, date: true, narration: true } },
      },
      orderBy: { journalEntry: { date: 'asc' } },
    });

    // Build running balance
    let balance = account.openingBalance;
    const isDebitNormal = account.accountType === 'ASSET' || account.accountType === 'EXPENSE';

    const ledger = lines.map(line => {
      if (isDebitNormal) {
        balance += line.debit - line.credit;
      } else {
        balance += line.credit - line.debit;
      }
      return {
        id: line.id,
        debit: line.debit,
        credit: line.credit,
        narration: line.narration,
        journalEntry: {
          id: line.journalEntry.id,
          entryNumber: line.journalEntry.entryNumber,
          date: line.journalEntry.date,
          narration: line.journalEntry.narration,
        },
        balance: Math.round(balance * 100) / 100,
      };
    });

    return NextResponse.json({
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        openingBalance: account.openingBalance,
      },
      entries: ledger,
      openingBalance: account.openingBalance,
      closingBalance: Math.round(balance * 100) / 100,
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

