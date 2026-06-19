import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './src/shared/lib/db';

async function main() {
  console.log('--- Starting DB Fixes ---');

  // 1. Fix Deleted Invoices showing in Journal Entries
  // Find all JournalEntries with reference starting with 'SALE:'
  const saleJournals = await prisma.journalEntry.findMany({
    where: { reference: { startsWith: 'SALE:' } }
  });

  let reversedCount = 0;
  for (const je of saleJournals) {
    const saleId = je.reference!.split(':')[1];
    const saleExists = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!saleExists && je.status !== 'REVERSED') {
      await prisma.journalEntry.update({
        where: { id: je.id },
        data: { status: 'REVERSED' }
      });
      reversedCount++;
    }
  }
  console.log(`Reversed ${reversedCount} orphaned journal entries.`);

  // 2. Chart of Accounts - Debtors & Creditors
  const customers = await prisma.customer.findMany();
  let debtorCount = 0;
  for (const c of customers) {
    const debtorCode = `1100-${c.id.slice(0, 8).toUpperCase()}`;
    const existing = await prisma.account.findFirst({ where: { code: debtorCode } });
    if (!existing) {
      await prisma.account.create({
        data: {
          code: debtorCode,
          name: `Sundry Debtors – ${c.name}`,
          accountType: 'ASSET',
          parentId: (await prisma.account.findFirst({ where: { code: '1100', businessId: c.businessId } }))?.id || null,
          businessId: c.businessId,
          isSystemAccount: true,
        }
      });
      debtorCount++;
    }
  }
  console.log(`Created ${debtorCount} new debtor accounts.`);

  // 3. Cash Book Auto Update
  const sales = await prisma.sale.findMany({ where: { paid: { gt: 0 } } });
  let cashBookCount = 0;
  for (const sale of sales) {
    const existingCash = await prisma.cashBookEntry.findFirst({
      where: { reference: sale.invoiceNo }
    });
    if (!existingCash) {
      const cashAccount = await prisma.account.findFirst({ where: { code: '1000', businessId: sale.businessId } });
      if (cashAccount) {
        await prisma.cashBookEntry.create({
          data: {
            date: sale.createdAt,
            transactionType: 'RECEIPT',
            accountId: cashAccount.id,
            amount: sale.paid,
            narration: `Payment received for Invoice ${sale.invoiceNo}`,
            reference: sale.invoiceNo,
            businessId: sale.businessId,
          }
        });
        cashBookCount++;
      }
    }
  }

  const expenses = await prisma.expense.findMany();
  for (const exp of expenses) {
    const existingCash = await prisma.cashBookEntry.findFirst({
      where: { reference: `EXP:${exp.id}` }
    });
    if (!existingCash) {
      const cashAccount = await prisma.account.findFirst({ where: { code: '1000', businessId: exp.businessId } });
      if (cashAccount) {
        await prisma.cashBookEntry.create({
          data: {
            date: exp.date,
            transactionType: 'PAYMENT',
            accountId: cashAccount.id,
            amount: exp.amount,
            narration: `${exp.category} expense${exp.note ? `: ${exp.note}` : ''}`,
            reference: `EXP:${exp.id}`,
            businessId: exp.businessId,
          }
        });
        cashBookCount++;
      }
    }
  }
  console.log(`Created ${cashBookCount} missing cash book entries.`);

  // 4. Accounts Payable
  const purchaseExpenses = await prisma.expense.findMany({
    where: { category: { in: ['Purchase', 'Raw Material', 'Supplier Payment', 'Inventory'] } }
  });
  let apCount = 0;
  for (const exp of purchaseExpenses) {
    const existingAp = await prisma.accountsPayable.findFirst({
      where: { invoiceRef: `EXP-${exp.id.slice(0, 8)}` }
    });
    if (!existingAp) {
      await prisma.accountsPayable.create({
        data: {
          supplierName: exp.note || exp.category,
          invoiceRef: `EXP-${exp.id.slice(0, 8)}`,
          amount: exp.amount,
          paidAmount: exp.amount,
          dueDate: exp.date,
          category: exp.category,
          status: 'PAID',
          businessId: exp.businessId,
        }
      });
      apCount++;
    }
  }
  console.log(`Created ${apCount} missing AP entries.`);

  console.log('--- Done DB Fixes ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
