import { describe, test, expect } from 'vitest';
import { generateNextNumber } from '@/shared/lib/accounting-utils';

describe('Accounting Utils - generateNextNumber', () => {
  test('Returns 0001 when lastNumber is null', () => {
    expect(generateNextNumber('INV', null)).toBe('INV-0001');
    expect(generateNextNumber('JE', null)).toBe('JE-0001');
  });

  test('Increments existing number correctly', () => {
    expect(generateNextNumber('INV', 'INV-0042')).toBe('INV-0043');
    expect(generateNextNumber('JE', 'JE-0999')).toBe('JE-1000');
  });

  test('Overflow past 4 digits is handled correctly', () => {
    expect(generateNextNumber('JE', 'JE-9999')).toBe('JE-10000');
    expect(generateNextNumber('LOAN', 'LOAN-100042')).toBe('LOAN-100043');
  });

  test('Handles poorly formatted last numbers gracefully', () => {
    expect(generateNextNumber('INV', 'INV-INVALID')).toBe('INV-0001');
    expect(generateNextNumber('QTN', 'QTN-')).toBe('QTN-0001');
  });
});
