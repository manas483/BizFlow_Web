/**
 * Auto Journal Posting — automatically creates double-entry journal entries
 * when transactions occur (sales, payments, loan EMI).
 *
 * Each function checks AutomationSettings.autoJournal before proceeding.
 * Journals are created with status POSTED and linked to the source transaction.
 */

import { prisma } from '@/shared/lib/db';
import { generateNextNumber } from '@/shared/lib/accounting-utils';
import { calculateGST, extractStateCodeFromGST } from '@/shared/lib/gst-engine';

// ── Types ────────────────────────────────────────────────────────────────────

interface JournalLineInput {
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  debit: number;
  credit: number;
  narration?: string;
  parentCode?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if auto-journal is enabled for the business.
 */
async function isAutoJournalEnabled(businessId: string): Promise<boolean> {
  const settings = await prisma.automationSettings.findUnique({
    where: { businessId },
    select: { autoJournal: true },
  });
  // Default to true if no settings exist
  return settings?.autoJournal ?? true;
}

/**
 * Find or create a system account by code.
 * If the account doesn't exist, it auto-creates it as a system account.
 * Optionally accepts a parentCode to link as a sub-account.
 */
async function findOrCreateAccount(
  businessId: string,
  code: string,
  name: string,
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
  tx: any = prisma,
  parentCode?: string
): Promise<string> {
  const existing = await tx.account.findFirst({
    where: { businessId, code },
    select: { id: true },
  });

  if (existing) return existing.id;

  // Resolve parent account ID if a parentCode is provided
  let parentId: string | undefined;
  if (parentCode) {
    // Ensure the parent account exists first
    const parentAccount = await tx.account.findFirst({
      where: { businessId, code: parentCode },
      select: { id: true },
    });
    parentId = parentAccount?.id;
  }

  const created = await tx.account.create({
    data: {
      code,
      name,
      accountType,
      isSystemAccount: true,
      parentId: parentId || null,
      businessId,
    },
  });

  return created.id;
}

/**
 * Create a journal entry with balanced lines.
 */
async function createJournal(params: {
  businessId: string;
  narration: string;
  reference: string;
  lines: JournalLineInput[];
  tx?: any;
}): Promise<string> {
  const { businessId, narration, reference, lines, tx = prisma } = params;

  // Generate next entry number
  const lastEntry = await tx.journalEntry.findFirst({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    select: { entryNumber: true },
  });
  const entryNumber = generateNextNumber('JE', lastEntry?.entryNumber ?? null);

  // Resolve account IDs
  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      const accountId = await findOrCreateAccount(
        businessId,
        line.accountCode,
        line.accountName,
        line.accountType,
        tx,
        line.parentCode
      );
      return {
        accountId,
        debit: line.debit,
        credit: line.credit,
        narration: line.narration,
      };
    })
  );

  const totalDebit = resolvedLines.reduce((s, l) => s + l.debit, 0);

  const entry = await tx.journalEntry.create({
    data: {
      entryNumber,
      date: new Date(),
      narration,
      reference,
      status: 'POSTED',
      totalAmount: Math.round(totalDebit * 100) / 100,
      businessId,
      lines: {
        create: resolvedLines,
      },
    },
  });

  return entry.id;
}

// ── Sale Journal ─────────────────────────────────────────────────────────────

/**
 * Post journal entry for a sale:
 *   Dr Sundry Debtors – Customer A/C (total incl. tax)
 *   Cr Sales A/C (taxable value)
 *   Cr Output CGST A/C
 *   Cr Output SGST A/C
 *   Cr Output IGST A/C
 */
export async function postSaleJournal(params: {
  saleId: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  total: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  businessId: string;
  tx?: any;
}): Promise<void> {
  try {
    const { saleId, invoiceNo, customerId, customerName, total, taxableValue, cgst, sgst, igst, businessId, tx } = params;

    if (!await isAutoJournalEnabled(businessId)) return;

    // Per-customer debtor sub-account under Trade Receivables (1100)
    const debtorCode = `1100-${customerId.slice(0, 8).toUpperCase()}`;
    const debtorName = `Sundry Debtors – ${customerName}`;

    const lines: JournalLineInput[] = [
      // Dr Customer (Receivable — Asset) — individual debtor account
      {
        accountCode: debtorCode,
        accountName: debtorName,
        accountType: 'ASSET',
        debit: total,
        credit: 0,
        narration: `Receivable from ${customerName}`,
        parentCode: '1100',
      },
      // Cr Sales Revenue
      {
        accountCode: '4000',
        accountName: 'Sales Revenue',
        accountType: 'REVENUE',
        debit: 0,
        credit: taxableValue,
        narration: `Sale ${invoiceNo}`,
      },
    ];

    // Add GST lines only if there are taxes
    if (cgst > 0) {
      lines.push({
        accountCode: '2200',
        accountName: 'Output CGST',
        accountType: 'LIABILITY',
        debit: 0,
        credit: cgst,
        narration: `CGST on ${invoiceNo}`,
      });
    }
    if (sgst > 0) {
      lines.push({
        accountCode: '2201',
        accountName: 'Output SGST',
        accountType: 'LIABILITY',
        debit: 0,
        credit: sgst,
        narration: `SGST on ${invoiceNo}`,
      });
    }
    if (igst > 0) {
      lines.push({
        accountCode: '2202',
        accountName: 'Output IGST',
        accountType: 'LIABILITY',
        debit: 0,
        credit: igst,
        narration: `IGST on ${invoiceNo}`,
      });
    }

    await createJournal({
      businessId,
      narration: `Auto: Sale Invoice ${invoiceNo} to ${customerName}`,
      reference: `SALE:${saleId}`,
      lines,
      tx,
    });
  } catch (err) {
    // Auto-journal must NEVER break the main transaction
    console.error('[AutoJournal] Failed to post sale journal:', err);
  }
}

// ── Customer Payment Journal ─────────────────────────────────────────────────

/**
 * Post journal entry for customer payment:
 *   Dr Bank/Cash A/C
 *   Cr Sundry Debtors – Customer A/C
 */
export async function postPaymentJournal(params: {
  paymentId: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'bank' | 'cash';
  reference?: string;
  businessId: string;
  tx?: any;
}): Promise<void> {
  try {
    const { paymentId, customerId, customerName, amount, paymentMethod, reference, businessId, tx } = params;

    if (!await isAutoJournalEnabled(businessId)) return;

    const bankAccountCode = paymentMethod === 'cash' ? '1000' : '1010';
    const bankAccountName = paymentMethod === 'cash' ? 'Cash in Hand' : 'Bank Account';

    // Per-customer debtor sub-account (must match the one from postSaleJournal)
    const debtorCode = `1100-${customerId.slice(0, 8).toUpperCase()}`;
    const debtorName = `Sundry Debtors – ${customerName}`;

    await createJournal({
      businessId,
      narration: `Auto: Payment received from ${customerName}`,
      reference: `PAYMENT:${paymentId}`,
      lines: [
        {
          accountCode: bankAccountCode,
          accountName: bankAccountName,
          accountType: 'ASSET',
          debit: amount,
          credit: 0,
          narration: `Payment from ${customerName}`,
        },
        {
          accountCode: debtorCode,
          accountName: debtorName,
          accountType: 'ASSET',
          debit: 0,
          credit: amount,
          narration: `Received from ${customerName}`,
          parentCode: '1100',
        },
      ],
      tx,
    });
  } catch (err) {
    console.error('[AutoJournal] Failed to post payment journal:', err);
  }
}

// ── Loan EMI Payment Journal ─────────────────────────────────────────────────

/**
 * Post journal entry for loan EMI payment:
 *   Dr Loan Liability A/C (principal portion)
 *   Dr Interest Expense A/C (interest portion)
 *   Cr Bank A/C (total EMI amount)
 */
export async function postLoanEMIJournal(params: {
  paymentId: string;
  loanNumber: string;
  principalPaid: number;
  interestPaid: number;
  totalAmount: number;
  businessId: string;
  tx?: any;
}): Promise<void> {
  try {
    const { paymentId, loanNumber, principalPaid, interestPaid, totalAmount, businessId, tx } = params;

    if (!await isAutoJournalEnabled(businessId)) return;

    const lines: JournalLineInput[] = [];

    if (principalPaid > 0) {
      lines.push({
        accountCode: '2300',
        accountName: 'Loan Liability',
        accountType: 'LIABILITY',
        debit: principalPaid,
        credit: 0,
        narration: `Principal repayment - ${loanNumber}`,
      });
    }

    if (interestPaid > 0) {
      lines.push({
        accountCode: '5200',
        accountName: 'Interest Expense',
        accountType: 'EXPENSE',
        debit: interestPaid,
        credit: 0,
        narration: `Interest - ${loanNumber}`,
      });
    }

    lines.push({
      accountCode: '1010',
      accountName: 'Bank Account',
      accountType: 'ASSET',
      debit: 0,
      credit: totalAmount,
      narration: `EMI payment - ${loanNumber}`,
    });

    await createJournal({
      businessId,
      narration: `Auto: Loan EMI payment for ${loanNumber}`,
      reference: `LOAN_PAYMENT:${paymentId}`,
      lines,
      tx,
    });
  } catch (err) {
    console.error('[AutoJournal] Failed to post loan EMI journal:', err);
  }
}

// ── Expense Journal ──────────────────────────────────────────────────────────

/**
 * Post journal entry for an expense:
 *   Dr Expense Category A/C (amount)
 *   Cr Cash in Hand A/C (amount)
 */
export async function postExpenseJournal(params: {
  expenseId: string;
  category: string;
  amount: number;
  note?: string;
  businessId: string;
  tx?: any;
}): Promise<void> {
  try {
    const { expenseId, category, amount, note, businessId, tx } = params;

    if (!await isAutoJournalEnabled(businessId)) return;

    // Map common expense categories to account codes
    const categoryCodeMap: Record<string, { code: string; name: string }> = {
      'Transport': { code: '5100', name: 'Transport Expense' },
      'Rent': { code: '5110', name: 'Rent Expense' },
      'Salary': { code: '5120', name: 'Salary Expense' },
      'Utilities': { code: '5130', name: 'Utilities Expense' },
      'Office Supplies': { code: '5140', name: 'Office Supplies' },
      'Raw Material': { code: '5150', name: 'Raw Material Purchase' },
      'Purchase': { code: '5150', name: 'Purchase Expense' },
      'Marketing': { code: '5160', name: 'Marketing Expense' },
      'Maintenance': { code: '5170', name: 'Maintenance Expense' },
      'Insurance': { code: '5180', name: 'Insurance Expense' },
    };

    const mapped = categoryCodeMap[category] || {
      code: '5199',
      name: `${category} Expense`,
    };

    await createJournal({
      businessId,
      narration: `Auto: Expense — ${category}${note ? ` (${note})` : ''}`,
      reference: `EXPENSE:${expenseId}`,
      lines: [
        {
          accountCode: mapped.code,
          accountName: mapped.name,
          accountType: 'EXPENSE',
          debit: amount,
          credit: 0,
          narration: `${category} expense`,
        },
        {
          accountCode: '1000',
          accountName: 'Cash in Hand',
          accountType: 'ASSET',
          debit: 0,
          credit: amount,
          narration: `Payment for ${category}`,
        },
      ],
      tx,
    });
  } catch (err) {
    console.error('[AutoJournal] Failed to post expense journal:', err);
  }
}

// ── Payable Journal ──────────────────────────────────────────────────────────

/**
 * Post journal entry for an accounts payable:
 *   Dr Purchase / Expense A/C (amount)
 *   Cr Trade Payables A/C (amount)
 */
export async function postPayableJournal(params: {
  payableId: string;
  supplierName: string;
  amount: number;
  category?: string;
  businessId: string;
  tx?: any;
}): Promise<void> {
  try {
    const { payableId, supplierName, amount, category, businessId, tx } = params;

    if (!await isAutoJournalEnabled(businessId)) return;

    const expenseCode = category === 'Raw Material' || category === 'Purchase' ? '5150' : '5199';
    const expenseName = category === 'Raw Material' || category === 'Purchase'
      ? 'Raw Material Purchase'
      : `${category || 'General'} Expense`;

    // Per-supplier creditor sub-account under Trade Payables (2100)
    const creditorCode = `2100-${payableId.slice(0, 8).toUpperCase()}`;
    const creditorName = `Sundry Creditors – ${supplierName}`;

    await createJournal({
      businessId,
      narration: `Auto: Payable to ${supplierName}`,
      reference: `PAYABLE:${payableId}`,
      lines: [
        {
          accountCode: expenseCode,
          accountName: expenseName,
          accountType: 'EXPENSE',
          debit: amount,
          credit: 0,
          narration: `Payable to ${supplierName}`,
        },
        {
          accountCode: creditorCode,
          accountName: creditorName,
          accountType: 'LIABILITY',
          debit: 0,
          credit: amount,
          narration: `Due to ${supplierName}`,
          parentCode: '2100',
        },
      ],
      tx,
    });
  } catch (err) {
    console.error('[AutoJournal] Failed to post payable journal:', err);
  }
}

// ── Cash Book Auto Entry ─────────────────────────────────────────────────────

/**
 * Auto-create a CashBookEntry (RECEIPT or PAYMENT).
 */
export async function postCashBookEntry(params: {
  amount: number;
  type: 'RECEIPT' | 'PAYMENT';
  narration: string;
  reference: string;
  businessId: string;
  date?: Date;
  tx?: any;
}): Promise<void> {
  try {
    const { amount, type, narration, reference, businessId, date, tx = prisma } = params;

    // Get or create Cash in Hand account for the accountId FK
    const cashAccountId = await findOrCreateAccount(businessId, '1000', 'Cash in Hand', 'ASSET', tx);

    await tx.cashBookEntry.create({
      data: {
        date: date || new Date(),
        transactionType: type,
        accountId: cashAccountId,
        amount,
        narration,
        reference,
        businessId,
      },
    });
  } catch (err) {
    console.error('[AutoJournal] Failed to create cash book entry:', err);
  }
}
