import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';
import { calculateAging } from '@/shared/lib/accounting-utils';

describe('calculateAging', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('Items placed in correct age buckets (0–30, 31–60, 61–90, 90+)', () => {
    const items = [
      { dueDate: new Date('2025-01-10T12:00:00Z'), amount: 100, paidAmount: 0 }, // 5 days overdue -> 0-30
      { dueDate: new Date('2024-12-01T12:00:00Z'), amount: 200, paidAmount: 0 }, // 45 days overdue -> 31-60
      { dueDate: new Date('2024-11-01T12:00:00Z'), amount: 300, paidAmount: 0 }, // 75 days overdue -> 61-90
      { dueDate: new Date('2024-09-01T12:00:00Z'), amount: 400, paidAmount: 0 }, // 136 days overdue -> 91+
    ];

    const result = calculateAging(items);

    expect(result).toHaveLength(4);
    
    expect(result[0].label).toBe('0–30 days');
    expect(result[0].amount).toBe(100);
    expect(result[0].count).toBe(1);

    expect(result[1].label).toBe('31–60 days');
    expect(result[1].amount).toBe(200);
    expect(result[1].count).toBe(1);

    expect(result[2].label).toBe('61–90 days');
    expect(result[2].amount).toBe(300);
    expect(result[2].count).toBe(1);

    expect(result[3].label).toBe('91+ days');
    expect(result[3].amount).toBe(400);
    expect(result[3].count).toBe(1);
  });

  test('Fully paid items excluded (outstanding ≤ 0)', () => {
    const items = [
      { dueDate: new Date('2024-12-01T12:00:00Z'), amount: 100, paidAmount: 100 }, // Fully paid
      { dueDate: new Date('2024-12-01T12:00:00Z'), amount: 200, paidAmount: 250 }, // Overpaid
    ];

    const result = calculateAging(items);

    result.forEach(bucket => {
      expect(bucket.amount).toBe(0);
      expect(bucket.count).toBe(0);
    });
  });

  test('Custom bucket boundaries [15, 45, 90] → labels adjust dynamically', () => {
    const items = [
      { dueDate: new Date('2025-01-05T12:00:00Z'), amount: 100, paidAmount: 0 }, // 10 days
      { dueDate: new Date('2024-12-15T12:00:00Z'), amount: 200, paidAmount: 0 }, // 31 days
    ];

    const result = calculateAging(items, new Date('2025-01-15T12:00:00Z'), [15, 45, 90]);

    expect(result[0].label).toBe('0–15 days');
    expect(result[0].amount).toBe(100);

    expect(result[1].label).toBe('16–45 days');
    expect(result[1].amount).toBe(200);

    expect(result[2].label).toBe('46–90 days');
    expect(result[3].label).toBe('91+ days');
  });

  test('All items within same bucket → other buckets show 0', () => {
    const items = [
      { dueDate: new Date('2025-01-10T12:00:00Z'), amount: 100, paidAmount: 0 },
      { dueDate: new Date('2025-01-12T12:00:00Z'), amount: 200, paidAmount: 0 },
    ];

    const result = calculateAging(items);

    expect(result[0].amount).toBe(300);
    expect(result[1].amount).toBe(0);
    expect(result[2].amount).toBe(0);
    expect(result[3].amount).toBe(0);
  });

  test('Edge: item due exactly today → 0 days overdue → first bucket', () => {
    const items = [
      { dueDate: new Date('2025-01-15T12:00:00Z'), amount: 500, paidAmount: 0 },
    ];

    const result = calculateAging(items);

    expect(result[0].amount).toBe(500);
    expect(result[0].count).toBe(1);
  });

  test('Edge: item due in the future → 0 overdue days (not negative)', () => {
    const items = [
      { dueDate: new Date('2025-01-20T12:00:00Z'), amount: 500, paidAmount: 0 },
    ];

    const result = calculateAging(items);

    // Overdue days is Math.max(0, daysOverdue) which puts future items into the 0 bucket
    expect(result[0].amount).toBe(500);
    expect(result[0].count).toBe(1);
  });

  test('Amounts round to 2 decimal places', () => {
    const items = [
      { dueDate: new Date('2025-01-10T12:00:00Z'), amount: 100.123, paidAmount: 50.111 }, // 50.012 -> 50.01
    ];

    const result = calculateAging(items);

    expect(result[0].amount).toBe(50.01);
  });
});
