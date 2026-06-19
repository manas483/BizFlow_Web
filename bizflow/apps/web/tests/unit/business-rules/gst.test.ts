import { describe, test, expect } from 'vitest';
import {
  calculateGST,
  calculateInvoiceGST,
  extractStateCodeFromGST,
} from '@/shared/lib/gst-engine';

describe('GST Engine - extractStateCodeFromGST', () => {
  test('valid GSTIN returns state code', () => {
    expect(extractStateCodeFromGST('29ABCDE1234F1Z5')).toBe('29');
    expect(extractStateCodeFromGST('27AAPFU0939F1ZV')).toBe('27');
  });

  test('null or undefined input returns null', () => {
    expect(extractStateCodeFromGST(null)).toBeNull();
    expect(extractStateCodeFromGST(undefined)).toBeNull();
  });

  test('short string returns null', () => {
    expect(extractStateCodeFromGST('2')).toBeNull();
    expect(extractStateCodeFromGST('')).toBeNull();
  });

  test('non-numeric prefix returns null', () => {
    expect(extractStateCodeFromGST('ABABCDE1234F1Z5')).toBeNull();
  });
});

describe('GST Engine - calculateGST (Intra-State)', () => {
  test('18% GST rate', () => {
    const result = calculateGST({
      amount: 1000,
      gstRate: 18,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
    });
    expect(result.taxableValue).toBe(1000);
    expect(result.cgst).toBe(90);
    expect(result.sgst).toBe(90);
    expect(result.igst).toBe(0);
    expect(result.totalTax).toBe(180);
    expect(result.grandTotal).toBe(1180);
    expect(result.isInterState).toBe(false);
  });

  test('12% GST rate', () => {
    const result = calculateGST({
      amount: 1000,
      gstRate: 12,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
    });
    expect(result.cgst).toBe(60);
    expect(result.sgst).toBe(60);
    expect(result.igst).toBe(0);
    expect(result.totalTax).toBe(120);
    expect(result.grandTotal).toBe(1120);
  });

  test('5% GST rate', () => {
    const result = calculateGST({
      amount: 1000,
      gstRate: 5,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
    });
    expect(result.cgst).toBe(25);
    expect(result.sgst).toBe(25);
    expect(result.totalTax).toBe(50);
    expect(result.grandTotal).toBe(1050);
  });

  test('0% GST rate', () => {
    const result = calculateGST({
      amount: 1000,
      gstRate: 0,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
    });
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(1000);
  });
});

describe('GST Engine - calculateGST (Inter-State)', () => {
  test('18% IGST rate', () => {
    const result = calculateGST({
      amount: 1000,
      gstRate: 18,
      businessStateCode: '29',
      placeOfSupplyCode: '27',
    });
    expect(result.taxableValue).toBe(1000);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(180);
    expect(result.totalTax).toBe(180);
    expect(result.grandTotal).toBe(1180);
    expect(result.isInterState).toBe(true);
  });

  test('12% IGST rate', () => {
    const result = calculateGST({
      amount: 1000,
      gstRate: 12,
      businessStateCode: '29',
      placeOfSupplyCode: '27',
    });
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(120);
    expect(result.totalTax).toBe(120);
    expect(result.grandTotal).toBe(1120);
  });
});

describe('GST Engine - calculateGST (GST Inclusive)', () => {
  test('₹1,180 @ 18% extracts ₹1,000 taxable', () => {
    const result = calculateGST({
      amount: 1180,
      gstRate: 18,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
      gstInclusive: true,
    });
    expect(result.taxableValue).toBeCloseTo(1000, 2);
    expect(result.cgst).toBeCloseTo(90, 2);
    expect(result.sgst).toBeCloseTo(90, 2);
    expect(result.igst).toBe(0);
    expect(result.totalTax).toBe(180);
    expect(result.grandTotal).toBe(1180);
  });

  test('₹525 @ 5% extracts ₹500 taxable', () => {
    const result = calculateGST({
      amount: 525,
      gstRate: 5,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
      gstInclusive: true,
    });
    expect(result.taxableValue).toBeCloseTo(500, 2);
    expect(result.cgst).toBeCloseTo(12.5, 2);
    expect(result.sgst).toBeCloseTo(12.5, 2);
    expect(result.totalTax).toBe(25);
    expect(result.grandTotal).toBe(525);
  });

  test('₹1,000 @ 0% returns ₹1,000 unchanged', () => {
    const result = calculateGST({
      amount: 1000,
      gstRate: 0,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
      gstInclusive: true,
    });
    expect(result.taxableValue).toBe(1000);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(1000);
  });
});

describe('GST Engine - calculateGST (Edge Cases)', () => {
  test('Fractional rounding: ₹333 @ 18% → verify 2-decimal precision', () => {
    const result = calculateGST({
      amount: 333,
      gstRate: 18,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
    });
    expect(result.taxableValue).toBe(333);
    // 333 * 9% = 29.97
    expect(result.cgst).toBe(29.97);
    expect(result.sgst).toBe(29.97);
    // 29.97 + 29.97 = 59.94
    expect(result.totalTax).toBe(59.94);
    // 333 + 59.94 = 392.94
    expect(result.grandTotal).toBe(392.94);
  });

  test('Zero amount edge case', () => {
    const result = calculateGST({
      amount: 0,
      gstRate: 18,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
    });
    expect(result.taxableValue).toBe(0);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  test('Negative amount edge case', () => {
    const result = calculateGST({
      amount: -1000,
      gstRate: 18,
      businessStateCode: '29',
      placeOfSupplyCode: '29',
    });
    expect(result.taxableValue).toBe(-1000);
    expect(result.cgst).toBe(-90);
    expect(result.sgst).toBe(-90);
    expect(result.totalTax).toBe(-180);
    expect(result.grandTotal).toBe(-1180);
  });
});

describe('GST Engine - calculateInvoiceGST', () => {
  test('Multi-item invoice with mixed rates (Intra-State)', () => {
    const result = calculateInvoiceGST({
      items: [
        { amount: 1000, gstRate: 18 }, // cgst: 90, sgst: 90
        { amount: 500, gstRate: 5 },   // cgst: 12.5, sgst: 12.5
        { amount: 200, gstRate: 0 },   // tax: 0
      ],
      businessStateCode: '29',
      placeOfSupplyCode: '29',
    });
    expect(result.isInterState).toBe(false);
    expect(result.totalTaxableValue).toBe(1700);
    expect(result.totalCgst).toBe(102.5);
    expect(result.totalSgst).toBe(102.5);
    expect(result.totalIgst).toBe(0);
    expect(result.totalTax).toBe(205);
    expect(result.grandTotal).toBe(1905);
    expect(result.items).toHaveLength(3);
  });

  test('Multi-item invoice with mixed rates (Inter-State)', () => {
    const result = calculateInvoiceGST({
      items: [
        { amount: 1000, gstRate: 18 }, // igst: 180
        { amount: 500, gstRate: 12 },  // igst: 60
      ],
      businessStateCode: '29',
      placeOfSupplyCode: '27',
    });
    expect(result.isInterState).toBe(true);
    expect(result.totalTaxableValue).toBe(1500);
    expect(result.totalCgst).toBe(0);
    expect(result.totalSgst).toBe(0);
    expect(result.totalIgst).toBe(240);
    expect(result.totalTax).toBe(240);
    expect(result.grandTotal).toBe(1740);
  });
});
