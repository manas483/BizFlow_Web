import { describe, test, expect } from 'vitest';
import {
  isValidGSTIN,
  isValidPAN,
  isValidIFSC,
  isValidHSN,
} from '@/shared/lib/indian-validators';
import {
  productSchema,
  customerSchema,
  saleSchema,
  journalEntrySchema,
  registerSchema,
  loanMasterSchema,
} from '@/shared/lib/validations';

describe('Validation Engine - Indian Regulatory', () => {
  describe('GSTIN Validation', () => {
    test('Valid GSTIN passes', () => {
      // W is 32 (checksum valid)
      expect(isValidGSTIN('29ABCDE1234F1ZW')).toBe(true);
      expect(isValidGSTIN('27AAPFU0939F1ZV')).toBe(true); // Maharashtra
    });

    test('Invalid state code fails', () => {
      // 99 is not a valid Indian state code
      expect(isValidGSTIN('99ABCDE1234F1ZW')).toBe(false);
    });

    test('Wrong length fails', () => {
      expect(isValidGSTIN('29ABCDE1234F1Z')).toBe(false); // 14 chars
    });

    test('Empty string fails', () => {
      expect(isValidGSTIN('')).toBe(false);
    });

    test('Lowercase input auto-normalized and validated', () => {
      expect(isValidGSTIN('29abcde1234f1zw')).toBe(true);
    });

    test('Valid format but wrong checksum digit fails', () => {
      // Last digit changed from W to X
      expect(isValidGSTIN('29ABCDE1234F1ZX')).toBe(false);
    });
  });

  describe('PAN Validation', () => {
    test('Valid PAN passes', () => {
      expect(isValidPAN('ABCDE1234F')).toBe(true);
    });

    test('Digit in wrong position fails', () => {
      // 4th char is digit instead of letter
      expect(isValidPAN('ABC1E1234F')).toBe(false);
    });

    test('Wrong length fails', () => {
      expect(isValidPAN('ABCDE1234')).toBe(false); // 9 chars
    });
  });

  describe('IFSC Validation', () => {
    test('Valid IFSC passes', () => {
      expect(isValidIFSC('SBIN0001234')).toBe(true);
    });

    test('5th char not 0 fails', () => {
      expect(isValidIFSC('SBINO001234')).toBe(false); // Letter O instead of 0
    });

    test('Too short fails', () => {
      expect(isValidIFSC('SBIN00123')).toBe(false);
    });
  });

  describe('HSN Validation', () => {
    test('Valid lengths pass', () => {
      expect(isValidHSN('1234')).toBe(true);
      expect(isValidHSN('123456')).toBe(true);
      expect(isValidHSN('12345678')).toBe(true);
    });

    test('Invalid lengths fail', () => {
      expect(isValidHSN('123')).toBe(false);
      expect(isValidHSN('12345')).toBe(false);
    });

    test('Non-numeric fails', () => {
      expect(isValidHSN('12A4')).toBe(false);
    });
  });
});

describe('Validation Engine - Zod Schemas', () => {
  describe('Product Schema', () => {
    test('Valid data passes', () => {
      const data = { name: 'Test Product', category: 'General' };
      const result = productSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('Negative price fails', () => {
      const data = { name: 'Test', category: 'General', sellingPrice: -10 };
      const result = productSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    test('Missing name fails', () => {
      const data = { category: 'General' };
      const result = productSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Customer Schema', () => {
    test('Valid data passes', () => {
      const data = { name: 'Acme Corp', phone: '9876543210' };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    test('Empty phone passes', () => {
      const data = { name: 'Acme Corp', phone: '' };
      const result = customerSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Sale Schema', () => {
    test('At least 1 item required', () => {
      const data = { customerId: 'c1', items: [] };
      const result = saleSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    test('Negative qty rejected', () => {
      const data = {
        customerId: 'c1',
        items: [{ productId: 'p1', qty: -5, price: 100 }],
      };
      const result = saleSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Journal Entry Schema', () => {
    test('Debits ≠ Credits → rejection', () => {
      const data = {
        date: '2025-01-01',
        narration: 'Test entry',
        lines: [
          { accountId: 'a1', debit: 100, credit: 0 },
          { accountId: 'a2', debit: 0, credit: 50 }, // Off by 50
        ],
      };
      const result = journalEntrySchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Total debits must equal total credits");
      }
    });

    test('Debits = Credits → success', () => {
      const data = {
        date: '2025-01-01',
        narration: 'Test entry',
        lines: [
          { accountId: 'a1', debit: 100, credit: 0 },
          { accountId: 'a2', debit: 0, credit: 100 },
        ],
      };
      const result = journalEntrySchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('Register Schema', () => {
    test('Password complexity & email lowercase', () => {
      const data = {
        name: 'John Doe',
        email: 'USER@EXAMPLE.COM',
        password: 'Password123!',
        businessName: 'My Biz',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });

    test('Weak password fails', () => {
      const data = {
        name: 'John Doe',
        email: 'user@example.com',
        password: 'password', // missing upper, number, special
        businessName: 'My Biz',
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Loan Master Schema', () => {
    test('Negative principal fails', () => {
      const data = {
        borrowerName: 'Alice',
        amount: -50000,
        interestRate: 10,
        tenure: 12,
        startDate: '2025-01-01',
      };
      const result = loanMasterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    test('0 tenure fails', () => {
      const data = {
        borrowerName: 'Alice',
        amount: 50000,
        interestRate: 10,
        tenure: 0,
        startDate: '2025-01-01',
      };
      const result = loanMasterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    test('Rate > 100 fails', () => {
      const data = {
        borrowerName: 'Alice',
        amount: 50000,
        interestRate: 150,
        tenure: 12,
        startDate: '2025-01-01',
      };
      const result = loanMasterSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});
