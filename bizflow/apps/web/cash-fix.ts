import { config } from 'dotenv';
config({ path: '.env' });
import { prisma } from './src/shared/lib/db';

async function main() {
  console.log('--- Starting Cash Book Fixes ---');

  // 1. Ensure 1000 Cash in Hand account exists
  const businesses = await prisma.business.findMany();
  for (const b of businesses) {
    let cashAcc = await prisma.account.findFirst({ where: { code: '1000', businessId: b.id } });
    if (!cashAcc) {
      cashAcc = await prisma.account.create({
        data: {
          code: '1000',
          name: 'Cash in Hand',
          accountType: 'ASSET',
          isSystemAccount: true,
          businessId: b.id,
        }
      });
      console.log(`Created 1000 account for business ${b.id}`);
    }
  }

  // 2. Cash Book Auto Update for Sales
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
            date: sale.invoiceDate || sale.createdAt,
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

  // 3. Cash Book Auto Update for Expenses
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
  console.log('--- Done Cash Book Fixes ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
