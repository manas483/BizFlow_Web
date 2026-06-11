import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sku: z.string().max(50).optional().default(''),
  category: z.string().min(1, "Category is required"),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(5),
  purchasePrice: z.coerce.number().min(0).default(0),
  basePurchasePrice: z.coerce.number().min(0).default(0),
  transportCost: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  unit: z.string().max(20).optional().default('pcs'),
  unitsPerBag: z.coerce.number().int().min(1).default(1),
  supplier: z.string().max(100).optional().nullable(),
  hsnCode: z.string().max(20).optional().nullable(),
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
  gstNumber: z.string().max(20).optional().nullable(),
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
});

export const saleSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  paid: z.coerce.number().min(0).default(0),
  status: z.enum(['paid', 'partial', 'unpaid']).optional(),
  notes: z.string().max(500).optional().nullable(),
  placeOfSupply: z.string().max(50).optional().nullable(),
  reverseCharge: z.boolean().default(false),
  isAggregate: z.boolean().default(false),
  aggregateDate: z.string().optional().nullable(),
});

export const businessUpdateSchema = z.object({
  name: z.string().min(1, "Business name is required").optional(),
  gstNumber: z.string().max(20).optional().nullable(),
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
});

export const employeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email").max(100),
  phone: z.string().max(20).optional().nullable(),
  role: z.enum(['SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF', 'CUSTOM_ROLE']).default('STAFF'),
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
