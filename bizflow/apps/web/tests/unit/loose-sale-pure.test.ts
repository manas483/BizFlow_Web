/**
 * Loose Sale Module — Pure Logic Tests
 *
 * Tests utility functions and Zod validation schemas with no database required.
 * These tests run without any migrations and will always pass.
 */

import { describe, test, expect } from 'vitest';
import {
  packToBaseUnit,
  baseToLayerQty,
  deriveStockFromBase,
  formatLooseStock,
  canDeduct,
} from '../../src/shared/lib/loose-utils';
import { productSchema, productPackagingSchema } from '../../src/shared/lib/validations';

// ─── 1. Pure utility tests ────────────────────────────────────────────────────

describe('Loose Utility — Pure Functions', () => {
  test('packToBaseUnit converts correctly', () => {
    expect(packToBaseUnit(2, 50)).toBe(100);   // 2 bags × 50 Kg
    expect(packToBaseUnit(5, 1)).toBe(5);       // 5 Kg loose
    expect(packToBaseUnit(0.5, 50)).toBe(25);  // half a bag = 25 Kg
  });

  test('baseToLayerQty converts base units to fractional bag quantity', () => {
    expect(baseToLayerQty(100, 50)).toBe(2);    // 100 Kg = 2 bags
    expect(baseToLayerQty(75, 50)).toBe(1.5);   // 75 Kg = 1.5 bags
    expect(baseToLayerQty(25, 50)).toBe(0.5);   // 25 Kg = 0.5 bags
  });

  test('baseToLayerQty throws on zero or negative primaryFactor', () => {
    expect(() => baseToLayerQty(50, 0)).toThrow('Primary factor must be positive');
    expect(() => baseToLayerQty(50, -1)).toThrow();
  });

  test('deriveStockFromBase always floors', () => {
    expect(deriveStockFromBase(4895, 50)).toBe(97);   // floor(4895/50)=97
    expect(deriveStockFromBase(4900, 50)).toBe(98);   // exact
    expect(deriveStockFromBase(49, 50)).toBe(0);      // less than 1 bag
    expect(deriveStockFromBase(0, 50)).toBe(0);
  });

  test('canDeduct returns correct result', () => {
    expect(canDeduct(50, 4895)).toBe(true);
    expect(canDeduct(4895, 4895)).toBe(true);  // exact — boundary
    expect(canDeduct(4896, 4895)).toBe(false);
  });

  describe('formatLooseStock display', () => {
    test('whole bags only — no remainder', () => {
      const result = formatLooseStock(5000, 50, 'Bag', 'Kg');
      expect(result.wholePacks).toBe(100);
      expect(result.remainder).toBe(0);
      expect(result.display).toBe('100 Bags');
    });

    test('mixed bags and loose', () => {
      const result = formatLooseStock(4895, 50, 'Bag', 'Kg');
      expect(result.wholePacks).toBe(97);
      expect(result.remainder).toBe(45);
      expect(result.display).toBe('97 Bags + 45 Kg');
    });

    test('only loose (less than one bag)', () => {
      const result = formatLooseStock(12, 50, 'Bag', 'Kg');
      expect(result.wholePacks).toBe(0);
      expect(result.remainder).toBe(12);
      expect(result.display).toBe('12 Kg');
    });

    test('singular bag label', () => {
      const result = formatLooseStock(50, 50, 'Bag', 'Kg');
      expect(result.display).toBe('1 Bag');
    });

    test('zero stock', () => {
      const result = formatLooseStock(0, 50, 'Bag', 'Kg');
      expect(result.wholePacks).toBe(0);
      expect(result.remainder).toBe(0);
    });

    test('floating-point remainder does not produce noise', () => {
      // 3 × 50 = 150, baseStock = 175.7 → 25.7 Kg remainder
      const result = formatLooseStock(175.7, 50, 'Bag', 'Kg');
      expect(result.wholePacks).toBe(3);
      expect(result.remainder).toBeCloseTo(25.7, 2);
    });
  });
});

// ─── 2. Zod Validation Tests ─────────────────────────────────────────────────

describe('Zod Validation — productPackagingSchema', () => {
  test('rejects conversionFactor ≤ 0', () => {
    const result = productPackagingSchema.safeParse({
      label: 'Bad Pack', unit: 'Bag', conversionFactor: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/positive/i);
    }
  });

  test('rejects negative defaultPrice', () => {
    const result = productPackagingSchema.safeParse({
      label: 'Test', unit: 'Bag', conversionFactor: 50, defaultPrice: -10,
    });
    expect(result.success).toBe(false);
  });

  test('accepts valid packaging', () => {
    const result = productPackagingSchema.safeParse({
      label: '50 Kg Bag', unit: 'Bag', conversionFactor: 50, defaultPrice: 2800,
      isPurchaseUnit: true, isLoose: false, isDefault: true, sortOrder: 0, active: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('Zod Validation — productSchema loose-sale superRefine', () => {
  const baseLooseProduct = {
    name: 'Test Wheat',
    sku: 'TEST-001',
    category: 'Grain',
    stock: 0, minStock: 5, standardCost: 2500, sellingPrice: 2800,
    unit: 'Bag', unitsPerBag: 1, gstRate: 0,
    allowLooseSale: true,
    baseUnit: 'Kg',
  };

  const validPackaging = [
    { label: '50 Kg Bag', unit: 'Bag', conversionFactor: 50, isPurchaseUnit: true, isLoose: false, isDefault: true, sortOrder: 0, active: true },
    { label: 'Loose Kg', unit: 'Kg', conversionFactor: 1, isPurchaseUnit: false, isLoose: true, isDefault: false, sortOrder: 1, active: true },
  ];

  test('accepts valid loose product', () => {
    const result = productSchema.safeParse({ ...baseLooseProduct, packagingOptions: validPackaging });
    expect(result.success).toBe(true);
  });

  test('rejects missing baseUnit for loose product', () => {
    const result = productSchema.safeParse({ ...baseLooseProduct, baseUnit: null, packagingOptions: validPackaging });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths).toContain('baseUnit');
    }
  });

  test('rejects duplicate labels (case-insensitive)', () => {
    const result = productSchema.safeParse({
      ...baseLooseProduct,
      packagingOptions: [
        { label: 'Loose', unit: 'Kg', conversionFactor: 1, isPurchaseUnit: true, active: true },
        { label: '  LOOSE  ', unit: 'Kg', conversionFactor: 2, isPurchaseUnit: false, active: true }, // duplicate
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const dupeIssue = result.error.issues.find(i => i.message.toLowerCase().includes('duplicate'));
      expect(dupeIssue).toBeTruthy();
    }
  });

  test('rejects duplicate conversion factors', () => {
    const result = productSchema.safeParse({
      ...baseLooseProduct,
      packagingOptions: [
        { label: 'Bag A', unit: 'Bag', conversionFactor: 50, isPurchaseUnit: true, active: true },
        { label: 'Bag B', unit: 'Bag', conversionFactor: 50, isPurchaseUnit: false, active: true }, // same factor
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.message.toLowerCase().includes('duplicate conversion'));
      expect(issue).toBeTruthy();
    }
  });

  test('rejects when no packaging has isPurchaseUnit = true', () => {
    const result = productSchema.safeParse({
      ...baseLooseProduct,
      packagingOptions: [
        { label: 'Pack A', unit: 'Bag', conversionFactor: 50, isPurchaseUnit: false, active: true },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.message.toLowerCase().includes('exactly one'));
      expect(issue).toBeTruthy();
    }
  });

  test('rejects when base unit appears as a packaging label', () => {
    const result = productSchema.safeParse({
      ...baseLooseProduct, // baseUnit: 'Kg'
      packagingOptions: [
        { label: 'Kg', unit: 'Bag', conversionFactor: 50, isPurchaseUnit: true, active: true }, // label == baseUnit
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find(i => i.message.toLowerCase().includes('base unit'));
      expect(issue).toBeTruthy();
    }
  });

  test('non-loose product passes without packaging', () => {
    const result = productSchema.safeParse({
      name: 'Normal Product', sku: 'NP-001', category: 'General',
      stock: 10, minStock: 5, standardCost: 100, sellingPrice: 150,
      unit: 'pcs', unitsPerBag: 1, gstRate: 18,
      allowLooseSale: false,
    });
    expect(result.success).toBe(true);
  });
});
