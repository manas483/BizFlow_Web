import { z } from 'zod';
import { isValidGSTIN, isValidIFSC, isValidHSN } from './indian-validators';

export const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sku: z.string().max(50).optional().default(''),
  category: z.string().min(1, "Category is required"),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(5),
  standardCost: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  unit: z.string().max(20).optional().default('pcs'),
  unitsPerBag: z.coerce.number().int().min(1).default(1),
  supplier: z.string().max(100).optional().nullable(),
  hsnCode: z.string().max(20).optional().nullable()
    .refine(
      (val) => !val || isValidHSN(val),
      "HSN code must be exactly 4, 6, or 8 digits"
    ),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  purchaseDate: z.string().optional().nullable(),
  purchaseFrom: z.string().max(100).optional().nullable(),
  purchaseInvoiceNo: z.string().max(100).optional().nullable(),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(1, "Phone is required").max(20),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal('')),
  address: z.string().max(200).optional().nullable(),
  city: z.string().max(50).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  stateCode: z.string().max(10).optional().nullable(),
  gstNumber: z.string().max(20).optional().nullable()
    .refine(
      (val) => !val || isValidGSTIN(val),
      "Invalid GSTIN format or checksum"
    ),
  dues: z.coerce.number().default(0),
  totalPurchases: z.coerce.number().default(0),
});

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  qty: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  hsnCode: z.string().optional().nullable(),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  // Phase 2: Price override audit
  originalPrice: z.coerce.number().min(0).optional().nullable(),
  priceOverrideReason: z.string().max(100).optional().nullable(),
});

export const salePaymentSchema = z.object({
  paymentMethod: z.enum(['cash', 'upi', 'card', 'bank_transfer', 'cheque']),
  amount: z.coerce.number().min(0.01, "Payment amount must be greater than 0"),
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const saleSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  paid: z.coerce.number().min(0).default(0),
  status: z.enum(['draft', 'paid', 'partial', 'unpaid']).optional(),
  notes: z.string().max(500).optional().nullable(),
  placeOfSupply: z.string().max(50).optional().nullable(),
  reverseCharge: z.boolean().default(false),
  isAggregate: z.boolean().default(false),
  aggregateDate: z.string().optional().nullable(),
  invoiceDate: z.string().optional().nullable(),
  // Phase 2: Workflow + payment
  isDraft: z.boolean().optional().default(false),
  paymentTerms: z.string().max(20).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  payments: z.array(salePaymentSchema).optional(),
  // Phase 3: Approvals
  approvalReason: z.string().max(250).optional().nullable(),
  approvedBy: z.string().optional().nullable(),
  approvedAt: z.string().optional().nullable(),
});

/** Relaxed schema for draft saves (allows 0 items) */
export const draftSaleSchema = saleSchema.extend({
  items: z.array(saleItemSchema).default([]),
});

export const businessUpdateSchema = z.object({
  name: z.string().min(1, "Business name is required").optional(),
  gstNumber: z.string().max(20).optional().nullable()
    .refine(
      (val) => !val || isValidGSTIN(val),
      "Invalid GSTIN format or checksum"
    ),
  ownerName: z.string().max(100).optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(200).optional().nullable(),
  businessType: z.string().max(50).optional(),
  bankName: z.string().max(100).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  ifscCode: z.string().max(20).optional().nullable(),
  branch: z.string().max(50).optional().nullable(),
  logoUrl: z.string().url("Invalid URL").optional().nullable(),
  signatureUrl: z.string().url("Invalid URL").optional().nullable(),
  gstInclusive: z.boolean().optional(),
});

export const expenseSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  date: z.string().min(1, "Date is required"),
  note: z.string().max(500).optional().nullable(),
  recurring: z.boolean().default(false),
  invoiceNumbers: z.array(z.string()).optional().default([]),
  excludedProductIds: z.array(z.string()).optional().default([]),
});

export const employeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").max(100),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'SALES_EXECUTIVE', 'STORE_MANAGER', 'EMPLOYEE', 'MANAGER', 'STAFF', 'CUSTOM_ROLE']).default('STAFF'),
  department: z.string().min(1, "Department is required").max(50),
  designation: z.string().max(100).optional().nullable(),
  permissions: z.array(z.string()).optional(),
  salary: z.coerce.number().min(0),
  joinDate: z.string().min(1, "Join date is required"),
  status: z.string().optional().default('INVITATION_SENT'),
  attendance: z.coerce.number().min(0).max(100).optional().default(100),
});

export const quotationItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  qty: z.coerce.number().int().min(1),
  price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  hsnCode: z.string().optional().nullable(),
  gstRate: z.coerce.number().min(0).max(100).default(0),
});

export const quotationSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  items: z.array(quotationItemSchema).min(1, "At least one item is required"),
  notes: z.string().max(500).optional().nullable(),
  placeOfSupply: z.string().max(50).optional().nullable(),
  reverseCharge: z.boolean().default(false),
  validUntil: z.string().optional().nullable(),
});

export const billOfSupplyItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  qty: z.coerce.number().int().min(1),
  price: z.coerce.number().min(0),
  hsnCode: z.string().optional().nullable(),
});

export const billOfSupplySchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  supplyType: z.string().min(1, "Supply type is required"),
  items: z.array(billOfSupplyItemSchema).min(1, "At least one item is required"),
  paid: z.coerce.number().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});

export const debitCreditNoteSchema = z.object({
  saleId: z.string().min(1, "Invoice reference is required"),
  customerId: z.string().min(1, "Customer is required"),
  reason: z.string().min(1, "Reason is required"),
  amount: z.coerce.number().min(0),
  taxAmount: z.coerce.number().min(0).default(0),
  notes: z.string().max(500).optional().nullable(),
});

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .regex(/^[a-zA-Z\s.'-]+$/, "Name can only contain letters, spaces, and basic punctuation"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .max(150, "Email cannot exceed 150 characters")
    .toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character (@$!%*?&)"),
  businessName: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name cannot exceed 100 characters"),
  businessType: z.string().max(50).optional(),
  phone: z
    .string()
    .max(20)
    .optional()
    .refine(
      (val) => !val || /^[+]?[\d\s\-().]{7,20}$/.test(val),
      "Please enter a valid phone number"
    ),
});

// ── Accounting & Finance Schemas ──────────────────────────────────────────────

export const accountSchema = z.object({
  code: z.string().min(1, "Account code is required").max(20),
  name: z.string().min(1, "Account name is required").max(100),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  parentId: z.string().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  openingBalance: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

export const journalLineSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  narration: z.string().max(500).optional().nullable(),
});

export const journalEntrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  narration: z.string().min(1, "Narration is required").max(500),
  reference: z.string().max(100).optional().nullable(),
  lines: z.array(journalLineSchema).min(2, "At least two lines required for a journal entry"),
}).refine(
  (data) => {
    const totalDebit = data.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = data.lines.reduce((sum, l) => sum + l.credit, 0);
    return Math.abs(totalDebit - totalCredit) < 0.01;
  },
  { message: "Total debits must equal total credits", path: ["lines"] }
);

export const cashBookEntrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  transactionType: z.enum(['RECEIPT', 'PAYMENT']),
  accountId: z.string().min(1, "Account is required"),
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  narration: z.string().min(1, "Narration is required").max(500),
  reference: z.string().max(100).optional().nullable(),
});

export const bankAccountSchema = z.object({
  accountName: z.string().min(1, "Account name is required").max(100),
  bankName: z.string().min(1, "Bank name is required").max(100),
  accountNumber: z.string().min(1, "Account number is required").max(50),
  ifscCode: z.string().max(20).optional().nullable()
    .refine(
      (val) => !val || isValidIFSC(val),
      "Invalid IFSC code format (expected: AAAA0NNNNNN)"
    ),
  branch: z.string().max(100).optional().nullable(),
  currentBalance: z.coerce.number().default(0),
});

export const bankBookEntrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  transactionType: z.enum(['RECEIPT', 'PAYMENT']),
  bankAccountId: z.string().min(1, "Bank account is required"),
  accountId: z.string().min(1, "Ledger account is required"),
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  narration: z.string().min(1, "Narration is required").max(500),
  reference: z.string().max(100).optional().nullable(),
});

export const bankReconciliationSchema = z.object({
  bankAccountId: z.string().min(1, "Bank account is required"),
  statementDate: z.string().min(1, "Statement date is required"),
  statementBalance: z.coerce.number(),
  reconciledEntries: z.array(z.string()).optional().default([]),
  notes: z.string().max(500).optional().nullable(),
});

export const gstReturnSchema = z.object({
  period: z.string().min(1, "Period is required"),
  returnType: z.string().min(1, "Return type is required"),
  filingDate: z.string().optional().nullable(),
  status: z.string().default("PENDING"),
  totalTaxable: z.coerce.number().min(0).default(0),
  totalCgst: z.coerce.number().min(0).default(0),
  totalSgst: z.coerce.number().min(0).default(0),
  totalIgst: z.coerce.number().min(0).default(0),
  totalCess: z.coerce.number().min(0).default(0),
  data: z.any().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
}).refine(
  (d) => {
    if (d.status === "FILED" || d.status === "REVISED") return !!d.filingDate;
    return true;
  },
  { message: "Filing Date is required when status is Filed or Revised", path: ["filingDate"] }
);

export const tdsEntrySchema = z.object({
  section: z.string().min(1, "TDS section is required"),
  deducteeName: z.string().min(1, "Deductee name is required").max(100),
  deducteePan: z.string().max(20).optional().nullable(),
  paymentDate: z.string().min(1, "Payment date is required"),
  paymentAmount: z.coerce.number().min(0.01, "Payment amount must be positive"),
  tdsRate: z.coerce.number().min(0).max(100),
  tdsAmount: z.coerce.number().min(0),
  depositDate: z.string().optional().nullable(),
  challanNo: z.string().max(50).optional().nullable(),
  status: z.string().default("DEDUCTED"),
  notes: z.string().max(500).optional().nullable(),
});

export const receivableSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  invoiceRef: z.string().min(1, "Invoice reference is required").max(100),
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  paidAmount: z.coerce.number().min(0).default(0),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().max(500).optional().nullable(),
});

export const payableSchema = z.object({
  supplierName: z.string().min(1, "Supplier name is required").max(100),
  invoiceRef: z.string().min(1, "Invoice reference is required").max(100),
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  paidAmount: z.coerce.number().min(0).default(0),
  dueDate: z.string().min(1, "Due date is required"),
  category: z.string().max(50).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// ── Loan & EMI Schemas ────────────────────────────────────────────────────────

export const loanMasterSchema = z.object({
  borrowerName: z.string().min(1, "Borrower name is required").max(100),
  loanType: z.enum(['TERM_LOAN', 'PERSONAL_LOAN', 'BUSINESS_LOAN', 'HOME_LOAN', 'VEHICLE_LOAN', 'GOLD_LOAN', 'WORKING_CAPITAL', 'OTHER']).default('TERM_LOAN'),
  amount: z.coerce.number().min(1, "Loan amount must be positive"),
  interestRate: z.coerce.number().min(0).max(100),
  tenure: z.coerce.number().int().min(1, "Tenure must be at least 1 month"),
  startDate: z.string().min(1, "Start date is required"),
  lender: z.string().max(100).optional().nullable(),
  purpose: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const loanPaymentSchema = z.object({
  paymentDate: z.string().min(1, "Payment date is required"),
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  paymentType: z.string().default("EMI"),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});
