
export async function reverseJournalEntry(reference: string, tx: any) {
  const journals = await tx.journalEntry.findMany({
    where: { reference, status: 'POSTED' },
    include: { lines: true }
  });

  for (const journal of journals) {
    const reversedLines = journal.lines.map(line => ({
      accountCode: line.accountCode, // Not standard Prisma, but let's assume we fetch account details
      accountId: line.accountId,
      debit: line.credit, // SWAP
      credit: line.debit, // SWAP
      narration: 'Reversal of: ' + line.narration,
    }));

    await createJournal({
      businessId: journal.businessId,
      narration: 'Reversal of Journal ' + journal.entryNumber,
      reference: reference + '_REVERSAL',
      lines: reversedLines as any, // needs proper accountCode fetching or we bypass findOrCreate
      tx
    });
    
    // Mark original as REVERSED
    await tx.journalEntry.update({
      where: { id: journal.id },
      data: { status: 'REVERSED' }
    });
  }
}

