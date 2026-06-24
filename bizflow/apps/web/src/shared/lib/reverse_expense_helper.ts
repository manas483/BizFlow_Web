
import { prisma } from './db';
import { postExpenseJournal, postCashBookEntry } from './auto-journal';

export async function reverseExpenseJournals(expenseId: string, session: any) {
  const journals = await prisma.journalEntry.findMany({
    where: { reference: 'EXPENSE:' + expenseId, status: 'POSTED' },
    include: { lines: { include: { account: true } } }
  });

  for (const journal of journals) {
    const reversedLines = journal.lines.map((line: any) => ({
      accountCode: line.account.code,
      accountName: line.account.name,
      accountType: line.account.accountType,
      debit: line.credit,
      credit: line.debit,
      narration: 'Reversal: ' + line.narration,
    }));

    // Generate next entry number
    const lastEntry = await prisma.journalEntry.findFirst({
      where: { businessId: journal.businessId },
      orderBy: { createdAt: 'desc' },
      select: { entryNumber: true },
    });
    const { generateNextNumber } = await import('./accounting-utils');
    const entryNumber = generateNextNumber('JE', lastEntry?.entryNumber ?? null);

    const resolvedLines = reversedLines.map((line: any) => ({
      accountId: line.accountId || (journal.lines.find((l: any) => l.account.code === line.accountCode)?.accountId),
      debit: line.debit,
      credit: line.credit,
      narration: line.narration,
    }));

    await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(),
        narration: 'Reversal of Journal ' + journal.entryNumber,
        reference: 'EXPENSE:' + expenseId + '_REV',
        status: 'POSTED',
        totalAmount: journal.totalAmount,
        businessId: journal.businessId,
        lines: { create: resolvedLines }
      }
    });

    await prisma.journalEntry.update({ where: { id: journal.id }, data: { status: 'REVERSED' } });
  }
}

