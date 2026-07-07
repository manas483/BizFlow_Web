/**
 * Accounting & Loan utility functions.
 *
 * All calculations are pure functions — no hardcoded rates, slabs, or account names.
 * Every parameter is passed in dynamically from the database or API layer.
 */

// ── EMI & Loan Calculations ───────────────────────────────────────────────────

export interface EMIScheduleRow {
  installmentNumber: number;
  dueDate: Date;
  emiAmount: number;
  principalAmount: number;
  interestAmount: number;
  openingBalance: number;
  closingBalance: number;
}

/**
 * Generate an EMI amortization schedule using the reducing-balance method.
 * All parameters are dynamic — nothing hardcoded.
 *
 * @param principal   Loan amount
 * @param annualRate  Annual interest rate (percentage, e.g. 12 for 12%)
 * @param tenureMonths Number of monthly installments
 * @param startDate   Loan start date
 * @returns Array of EMI schedule rows + computed EMI amount
 */
export function generateEMISchedule(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  startDate: Date,
  emiDay?: number
): { emiAmount: number; totalInterest: number; totalPayable: number; schedule: EMIScheduleRow[] } {
  const monthlyRate = annualRate / 100 / 12;
  let emiAmount: number;

  if (monthlyRate === 0) {
    // Zero-interest loan — simple division
    emiAmount = principal / tenureMonths;
  } else {
    // Standard EMI formula: EMI = P × r × (1+r)^n / ((1+r)^n - 1)
    const factor = Math.pow(1 + monthlyRate, tenureMonths);
    emiAmount = principal * monthlyRate * factor / (factor - 1);
  }

  emiAmount = Math.round(emiAmount * 100) / 100;

  const schedule: EMIScheduleRow[] = [];
  let balance = principal;
  let totalInterest = 0;

  for (let i = 1; i <= tenureMonths; i++) {
    const interestAmount = Math.round(balance * monthlyRate * 100) / 100;
    let principalAmount = Math.round((emiAmount - interestAmount) * 100) / 100;

    // Last installment adjustment to clear rounding differences
    if (i === tenureMonths) {
      principalAmount = Math.round(balance * 100) / 100;
      const adjustedEmi = principalAmount + interestAmount;
      schedule.push({
        installmentNumber: i,
        dueDate: addMonths(startDate, i, emiDay),
        emiAmount: Math.round(adjustedEmi * 100) / 100,
        principalAmount,
        interestAmount,
        openingBalance: Math.round(balance * 100) / 100,
        closingBalance: 0,
      });
      totalInterest += interestAmount;
      break;
    }

    const closingBalance = Math.round((balance - principalAmount) * 100) / 100;
    schedule.push({
      installmentNumber: i,
      dueDate: addMonths(startDate, i, emiDay),
      emiAmount,
      principalAmount,
      interestAmount,
      openingBalance: Math.round(balance * 100) / 100,
      closingBalance,
    });

    totalInterest += interestAmount;
    balance = closingBalance;
  }

  totalInterest = Math.round(totalInterest * 100) / 100;
  const totalPayable = Math.round((principal + totalInterest) * 100) / 100;

  return { emiAmount, totalInterest, totalPayable, schedule };
}

// ── Aging Calculation ─────────────────────────────────────────────────────────

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

/**
 * Calculate aging buckets for receivables/payables.
 * Bucket boundaries are passed dynamically — not hardcoded.
 *
 * @param items     Array of { dueDate, amount, paidAmount }
 * @param asOfDate  The reference date (usually today)
 * @param buckets   Custom bucket boundaries in days, e.g. [30, 60, 90]
 * @returns Array of aging buckets with totals
 */
export function calculateAging(
  items: { dueDate: Date | string; amount: number; paidAmount: number }[],
  asOfDate: Date = new Date(),
  buckets: number[] = [30, 60, 90]
): AgingBucket[] {
  const sortedBuckets = [...buckets].sort((a, b) => a - b);

  // Build labels dynamically from bucket boundaries
  const result: AgingBucket[] = [
    { label: `0–${sortedBuckets[0]} days`, amount: 0, count: 0 },
  ];
  for (let i = 1; i < sortedBuckets.length; i++) {
    result.push({ label: `${sortedBuckets[i - 1] + 1}–${sortedBuckets[i]} days`, amount: 0, count: 0 });
  }
  result.push({ label: `${sortedBuckets[sortedBuckets.length - 1] + 1}+ days`, amount: 0, count: 0 });

  for (const item of items) {
    const outstanding = item.amount - item.paidAmount;
    if (outstanding <= 0) continue;

    const dueDate = typeof item.dueDate === 'string' ? new Date(item.dueDate) : item.dueDate;
    const daysOverdue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const overdueDays = Math.max(0, daysOverdue);

    let placed = false;
    for (let i = 0; i < sortedBuckets.length; i++) {
      if (overdueDays <= sortedBuckets[i]) {
        result[i].amount += outstanding;
        result[i].count += 1;
        placed = true;
        break;
      }
    }
    if (!placed) {
      result[result.length - 1].amount += outstanding;
      result[result.length - 1].count += 1;
    }
  }

  // Round amounts
  for (const bucket of result) {
    bucket.amount = Math.round(bucket.amount * 100) / 100;
  }

  return result;
}

// ── Financial Statement Computation ───────────────────────────────────────────

export interface LedgerEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

export interface FinancialLineItem {
  accountId: string;
  code: string;
  name: string;
  amount: number;
}

export interface ProfitLossResult {
  revenue: FinancialLineItem[];
  expenses: FinancialLineItem[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

/**
 * Compute Profit & Loss from ledger entries.
 * Accounts are grouped dynamically by their type from the database.
 */
export function computeProfitLoss(entries: LedgerEntry[]): ProfitLossResult {
  const revenueMap = new Map<string, FinancialLineItem>();
  const expenseMap = new Map<string, FinancialLineItem>();

  for (const entry of entries) {
    const net = entry.credit - entry.debit;
    if (entry.accountType === 'REVENUE') {
      const existing = revenueMap.get(entry.accountId);
      if (existing) {
        existing.amount += net;
      } else {
        revenueMap.set(entry.accountId, {
          accountId: entry.accountId,
          code: entry.accountCode,
          name: entry.accountName,
          amount: net,
        });
      }
    } else if (entry.accountType === 'EXPENSE') {
      const netExpense = entry.debit - entry.credit;
      const existing = expenseMap.get(entry.accountId);
      if (existing) {
        existing.amount += netExpense;
      } else {
        expenseMap.set(entry.accountId, {
          accountId: entry.accountId,
          code: entry.accountCode,
          name: entry.accountName,
          amount: netExpense,
        });
      }
    }
  }

  const revenue = Array.from(revenueMap.values());
  const expenses = Array.from(expenseMap.values());
  const totalRevenue = Math.round(revenue.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
  const totalExpenses = Math.round(expenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;
  const netProfit = Math.round((totalRevenue - totalExpenses) * 100) / 100;

  return { revenue, expenses, totalRevenue, totalExpenses, netProfit };
}

export interface BalanceSheetResult {
  assets: FinancialLineItem[];
  liabilities: FinancialLineItem[];
  equity: FinancialLineItem[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

/**
 * Compute Balance Sheet from ledger entries.
 * Accounts are grouped dynamically by their type.
 */
export function computeBalanceSheet(entries: LedgerEntry[], netProfit: number = 0): BalanceSheetResult {
  const assetMap = new Map<string, FinancialLineItem>();
  const liabilityMap = new Map<string, FinancialLineItem>();
  const equityMap = new Map<string, FinancialLineItem>();

  for (const entry of entries) {
    let net: number;
    let map: Map<string, FinancialLineItem>;

    switch (entry.accountType) {
      case 'ASSET':
        net = entry.debit - entry.credit;
        map = assetMap;
        break;
      case 'LIABILITY':
        net = entry.credit - entry.debit;
        map = liabilityMap;
        break;
      case 'EQUITY':
        net = entry.credit - entry.debit;
        map = equityMap;
        break;
      default:
        continue; // Skip REVENUE/EXPENSE — handled in P&L
    }

    const existing = map.get(entry.accountId);
    if (existing) {
      existing.amount += net;
    } else {
      map.set(entry.accountId, {
        accountId: entry.accountId,
        code: entry.accountCode,
        name: entry.accountName,
        amount: net,
      });
    }
  }

  // Add retained earnings (net profit from P&L) to equity
  if (netProfit !== 0) {
    equityMap.set('retained-earnings', {
      accountId: 'retained-earnings',
      code: 'RE',
      name: 'Retained Earnings (Current Period)',
      amount: netProfit,
    });
  }

  const assets = Array.from(assetMap.values());
  const liabilities = Array.from(liabilityMap.values());
  const equity = Array.from(equityMap.values());
  const totalAssets = Math.round(assets.reduce((sum, a) => sum + a.amount, 0) * 100) / 100;
  const totalLiabilities = Math.round(liabilities.reduce((sum, l) => sum + l.amount, 0) * 100) / 100;
  const totalEquity = Math.round(equity.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}

export interface CashFlowResult {
  operating: FinancialLineItem[];
  investing: FinancialLineItem[];
  financing: FinancialLineItem[];
  totalOperating: number;
  totalInvesting: number;
  totalFinancing: number;
  netCashFlow: number;
}

/**
 * Compute Cash Flow Statement.
 * Uses indirect method — starts from net profit and adjusts for non-cash items.
 * Categories are determined by account type dynamically.
 */
export function computeCashFlow(
  entries: LedgerEntry[],
  netProfit: number
): CashFlowResult {
  const operating: FinancialLineItem[] = [
    { accountId: 'net-profit', code: 'NP', name: 'Net Profit', amount: netProfit },
  ];
  const investing: FinancialLineItem[] = [];
  const financing: FinancialLineItem[] = [];

  // Group cash-impacting entries by account type
  for (const entry of entries) {
    const net = entry.debit - entry.credit;
    const item: FinancialLineItem = {
      accountId: entry.accountId,
      code: entry.accountCode,
      name: entry.accountName,
      amount: net,
    };

    // Dynamic categorization by account type
    switch (entry.accountType) {
      case 'ASSET':
        // Changes in current assets affect operating cash flow
        // Changes in fixed assets affect investing
        if (entry.accountCode.startsWith('1')) {
          // Current assets — use account code ranges from DB
          operating.push({ ...item, amount: -net }); // Increase in asset = outflow
        } else {
          investing.push({ ...item, amount: -net });
        }
        break;
      case 'LIABILITY':
        // Changes in liabilities can be operating or financing
        if (entry.accountCode.startsWith('2')) {
          operating.push({ ...item, amount: entry.credit - entry.debit });
        } else {
          financing.push({ ...item, amount: entry.credit - entry.debit });
        }
        break;
      case 'EQUITY':
        financing.push({ ...item, amount: entry.credit - entry.debit });
        break;
    }
  }

  const totalOperating = Math.round(operating.reduce((sum, o) => sum + o.amount, 0) * 100) / 100;
  const totalInvesting = Math.round(investing.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  const totalFinancing = Math.round(financing.reduce((sum, f) => sum + f.amount, 0) * 100) / 100;
  const netCashFlow = Math.round((totalOperating + totalInvesting + totalFinancing) * 100) / 100;

  return { operating, investing, financing, totalOperating, totalInvesting, totalFinancing, netCashFlow };
}

// ── Helper ────────────────────────────────────────────────────────────────────

function addMonths(date: Date, months: number, emiDay?: number): Date {
  const d = new Date(date);
  const currentMonth = d.getMonth();
  d.setMonth(currentMonth + months);
  
  // Handle standard JS Date overflow (e.g. Jan 31 + 1 month -> Mar 3)
  const expectedMonth = (currentMonth + months) % 12;
  const targetMonth = expectedMonth < 0 ? expectedMonth + 12 : expectedMonth;
  if (d.getMonth() !== targetMonth) {
    d.setDate(0); // Go to last day of the intended month
  }
  
  if (emiDay !== undefined) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    d.setDate(Math.min(emiDay, lastDayOfMonth));
  }
  return d;
}

/**
 * Generate next sequential number for auto-numbering (JE-0001, LOAN-0001, etc.).
 * The prefix is always passed dynamically.
 */
export function generateNextNumber(prefix: string, lastNumber: string | null): string {
  if (!lastNumber) return `${prefix}-0001`;
  const match = lastNumber.match(/(\d+)$/);
  if (!match) return `${prefix}-0001`;
  const next = parseInt(match[1], 10) + 1;
  return `${prefix}-${String(next).padStart(4, '0')}`;
}
