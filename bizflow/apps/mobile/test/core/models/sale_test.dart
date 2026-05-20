/// Phase 1 — Sale model unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/shared/models/sale.dart';

void main() {
  const baseJson = {
    'id': 's1',
    'invoiceNo': 'INV-001',
    'customerId': 'c1',
    'total': 1000.0,
    'paid': 600.0,
    'status': 'PARTIAL',
    'createdAt': '2024-06-01T10:00:00.000Z',
  };

  group('Sale.fromJson', () {
    test('parses all required fields', () {
      final s = Sale.fromJson(baseJson);
      expect(s.id, 's1');
      expect(s.invoiceNo, 'INV-001');
      expect(s.customerId, 'c1');
      expect(s.total, 1000.0);
      expect(s.paid, 600.0);
      expect(s.status, 'PARTIAL');
    });

    test('defaults paid to 0 when missing', () {
      final s = Sale.fromJson({...baseJson}..remove('paid'));
      expect(s.paid, 0.0);
    });

    test('notes is null when not provided', () {
      final s = Sale.fromJson(baseJson);
      expect(s.notes, isNull);
    });

    test('customer is null when not in json', () {
      final s = Sale.fromJson(baseJson);
      expect(s.customer, isNull);
    });

    test('parses nested SaleCustomer', () {
      final s = Sale.fromJson({
        ...baseJson,
        'customer': {'id': 'c1', 'name': 'Acme', 'phone': '9999999999'},
      });
      expect(s.customer, isNotNull);
      expect(s.customer!.name, 'Acme');
      expect(s.customer!.phone, '9999999999');
    });
  });

  group('Sale computed properties', () {
    test('due = total - paid', () {
      final s = Sale.fromJson(baseJson);
      expect(s.due, closeTo(400.0, 0.001));
    });

    test('isPaid is true when status is PAID', () {
      final s = Sale.fromJson({...baseJson, 'status': 'PAID'});
      expect(s.isPaid, isTrue);
      expect(s.isPartial, isFalse);
      expect(s.isUnpaid, isFalse);
    });

    test('isPartial is true when status is PARTIAL', () {
      final s = Sale.fromJson(baseJson);
      expect(s.isPartial, isTrue);
      expect(s.isPaid, isFalse);
      expect(s.isUnpaid, isFalse);
    });

    test('isUnpaid is true when status is UNPAID', () {
      final s = Sale.fromJson({...baseJson, 'status': 'UNPAID'});
      expect(s.isUnpaid, isTrue);
      expect(s.isPaid, isFalse);
      expect(s.isPartial, isFalse);
    });
  });

  group('SaleCustomer.fromJson', () {
    test('parses id, name, and optional phone', () {
      final sc = SaleCustomer.fromJson({
        'id': 'c1',
        'name': 'Test Customer',
        'phone': '1234567890',
      });
      expect(sc.id, 'c1');
      expect(sc.name, 'Test Customer');
      expect(sc.phone, '1234567890');
    });

    test('phone is null when missing', () {
      final sc = SaleCustomer.fromJson({'id': 'c1', 'name': 'Walk-In'});
      expect(sc.phone, isNull);
    });
  });
}
