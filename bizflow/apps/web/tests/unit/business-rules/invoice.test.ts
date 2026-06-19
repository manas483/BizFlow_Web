import { describe, test, expect } from 'vitest';
import { calculateInvoiceTotal, InvoiceLineInput } from '@/shared/lib/invoice-engine';

describe('Invoice Engine', () => {
  const defaultState = '29'; // Karnataka

  test('Single item, no discount, 18% GST', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 2, price: 500, discount: 0, gstRate: 18 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.subtotal).toBe(1000);
    expect(result.totalDiscount).toBe(0);
    expect(result.totalTaxable).toBe(1000);
    expect(result.totalTax).toBe(180);
    expect(result.grandTotal).toBe(1180);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].lineTotal).toBe(1180);
  });

  test('Single item, ₹100 flat discount, 18% GST (discount-then-tax ordering)', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 2, price: 500, discount: 100, gstRate: 18 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.subtotal).toBe(1000);
    expect(result.totalDiscount).toBe(100);
    expect(result.totalTaxable).toBe(900);
    expect(result.totalCgst).toBe(81);
    expect(result.totalSgst).toBe(81);
    expect(result.totalTax).toBe(162);
    expect(result.grandTotal).toBe(1062);
  });

  test('Multi-line with mixed GST rates (18% + 12%)', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 2, price: 500, discount: 0, gstRate: 18 }, // Taxable: 1000, Tax: 180
      { qty: 1, price: 1000, discount: 0, gstRate: 12 } // Taxable: 1000, Tax: 120
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.totalTaxable).toBe(2000);
    expect(result.totalTax).toBe(300);
    expect(result.grandTotal).toBe(2300);
  });

  test('GST-inclusive mode', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 1, price: 1180, discount: 0, gstRate: 18 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState, true);
    
    expect(result.totalTaxable).toBe(1000);
    expect(result.totalTax).toBe(180);
    expect(result.grandTotal).toBe(1180);
  });

  test('Inter-state: IGST only, no CGST/SGST split', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 2, price: 500, discount: 0, gstRate: 18 }
    ];
    
    // Supply code 27 (Maharashtra) !== 29 (Karnataka) -> Inter-state
    const result = calculateInvoiceTotal(lines, defaultState, '27');
    
    expect(result.isInterState).toBe(true);
    expect(result.totalCgst).toBe(0);
    expect(result.totalSgst).toBe(0);
    expect(result.totalIgst).toBe(180);
    expect(result.totalTax).toBe(180);
    expect(result.grandTotal).toBe(1180);
  });

  test('All-zero items: no NaN, no division by zero', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 0, price: 0, discount: 0, gstRate: 0 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.subtotal).toBe(0);
    expect(result.totalTaxable).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  test('Large amounts (₹10,00,000+) for floating-point precision', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 10, price: 1234567.89, discount: 0, gstRate: 18 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    const subtotal = 12345678.90;
    expect(result.subtotal).toBe(subtotal);
    expect(result.totalTaxable).toBe(subtotal);
    expect(result.totalCgst).toBe(1111111.10);
    expect(result.totalSgst).toBe(1111111.10);
    expect(result.totalTax).toBe(2222222.20);
    expect(result.grandTotal).toBe(14567901.10);
  });

  test('100% discount (discount = subtotal)', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 2, price: 500, discount: 1000, gstRate: 18 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.subtotal).toBe(1000);
    expect(result.totalDiscount).toBe(1000);
    expect(result.totalTaxable).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  test('Discount > subtotal -> clamp taxable to 0, never go negative', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 2, price: 500, discount: 1500, gstRate: 18 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.subtotal).toBe(1000);
    expect(result.totalDiscount).toBe(1500);
    expect(result.totalTaxable).toBe(0); // Clamped
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  test('Multi-line with per-line discounts', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 2, price: 500, discount: 200, gstRate: 18 }, // Taxable: 800, Tax: 144
      { qty: 1, price: 1000, discount: 100, gstRate: 12 } // Taxable: 900, Tax: 108
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.subtotal).toBe(2000);
    expect(result.totalDiscount).toBe(300);
    expect(result.totalTaxable).toBe(1700);
    expect(result.totalTax).toBe(252);
    expect(result.grandTotal).toBe(1952);
  });

  test('Single line, 0% GST rate', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 2, price: 500, discount: 0, gstRate: 0 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.totalTaxable).toBe(1000);
    expect(result.totalTax).toBe(0);
    expect(result.grandTotal).toBe(1000);
  });

  test('Verify lines[] array in result matches input count', () => {
    const lines: InvoiceLineInput[] = [
      { qty: 1, price: 100, discount: 0, gstRate: 5 },
      { qty: 2, price: 200, discount: 0, gstRate: 12 },
      { qty: 3, price: 300, discount: 0, gstRate: 18 }
    ];
    
    const result = calculateInvoiceTotal(lines, defaultState, defaultState);
    
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0].taxableAmount).toBe(100);
    expect(result.lines[1].taxableAmount).toBe(400);
    expect(result.lines[2].taxableAmount).toBe(900);
  });
});
