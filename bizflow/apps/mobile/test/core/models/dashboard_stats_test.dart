/// Phase 1 — DashboardStats model unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/shared/models/dashboard_stats.dart';

void main() {
  const baseJson = {
    'revenue': 250000.0,
    'salesCount': 42,
    'customerCount': 15,
    'expenses': 80000.0,
    'changes': {
      'revenue': 12.5,
      'sales': -3.2,
      'expenses': 5.0,
      'customers': 8.0,
    },
  };

  group('DashboardStats.fromJson', () {
    test('parses all top-level fields correctly', () {
      final s = DashboardStats.fromJson(baseJson);
      expect(s.revenue, 250000.0);
      expect(s.salesCount, 42);
      expect(s.customerCount, 15);
      expect(s.expenses, 80000.0);
    });

    test('defaults all numeric fields to 0 when missing', () {
      final s = DashboardStats.fromJson({
        'changes': {},
      });
      expect(s.revenue, 0.0);
      expect(s.salesCount, 0);
      expect(s.customerCount, 0);
      expect(s.expenses, 0.0);
    });

    test('handles missing changes key gracefully', () {
      final s = DashboardStats.fromJson({
        'revenue': 1000.0,
        'salesCount': 5,
        'customerCount': 3,
        'expenses': 200.0,
      });
      expect(s.changes.revenue, 0.0);
      expect(s.changes.sales, 0.0);
    });

    test('profit = revenue - expenses', () {
      final s = DashboardStats.fromJson(baseJson);
      expect(s.profit, closeTo(170000.0, 0.001));
    });

    test('profit is negative when expenses exceed revenue', () {
      final s = DashboardStats.fromJson({
        ...baseJson,
        'revenue': 10000.0,
        'expenses': 50000.0,
      });
      expect(s.profit, closeTo(-40000.0, 0.001));
    });
  });

  group('DashboardChanges.fromJson', () {
    test('parses all change percentages', () {
      final s = DashboardStats.fromJson(baseJson);
      expect(s.changes.revenue, 12.5);
      expect(s.changes.sales, -3.2);
      expect(s.changes.expenses, 5.0);
      expect(s.changes.customers, 8.0);
    });

    test('defaults all changes to 0 when empty map', () {
      final s = DashboardStats.fromJson({...baseJson, 'changes': {}});
      expect(s.changes.revenue, 0.0);
      expect(s.changes.sales, 0.0);
      expect(s.changes.expenses, 0.0);
      expect(s.changes.customers, 0.0);
    });
  });
}
