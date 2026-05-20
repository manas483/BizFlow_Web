/// Phase 1 — Customer model unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/shared/models/customer.dart';

void main() {
  const baseJson = {
    'id': 'c1',
    'name': 'Acme Corp',
    'phone': '9876543210',
    'email': 'acme@corp.com',
    'city': 'Mumbai',
    'dues': 5000.0,
    'totalPurchases': 50000.0,
    'status': 'active',
    'createdAt': '2024-01-01T00:00:00.000Z',
  };

  group('Customer.fromJson', () {
    test('parses all fields correctly', () {
      final c = Customer.fromJson(baseJson);
      expect(c.id, 'c1');
      expect(c.name, 'Acme Corp');
      expect(c.phone, '9876543210');
      expect(c.email, 'acme@corp.com');
      expect(c.city, 'Mumbai');
      expect(c.dues, 5000.0);
      expect(c.totalPurchases, 50000.0);
      expect(c.status, 'active');
    });

    test('handles missing optional fields as null', () {
      final c = Customer.fromJson({
        'id': 'c2',
        'name': 'Walk-In',
        'phone': '0000000000',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(c.email, isNull);
      expect(c.city, isNull);
      expect(c.address, isNull);
      expect(c.gstNumber, isNull);
      expect(c.state, isNull);
    });

    test('defaults dues to 0 when missing', () {
      final c = Customer.fromJson({...baseJson}..remove('dues'));
      expect(c.dues, 0.0);
    });

    test('defaults totalPurchases to 0 when missing', () {
      final c = Customer.fromJson({...baseJson}..remove('totalPurchases'));
      expect(c.totalPurchases, 0.0);
    });

    test('defaults status to active when missing', () {
      final c = Customer.fromJson({...baseJson}..remove('status'));
      expect(c.status, 'active');
    });
  });

  group('Customer computed properties', () {
    test('hasDues is true when dues > 0', () {
      final c = Customer.fromJson(baseJson);
      expect(c.hasDues, isTrue);
    });

    test('hasDues is false when dues is 0', () {
      final c = Customer.fromJson({...baseJson, 'dues': 0});
      expect(c.hasDues, isFalse);
    });

    test('initials returns uppercased first character', () {
      final c = Customer.fromJson(baseJson);
      expect(c.initials, 'A');
    });

    test('initials returns ? for empty name', () {
      final c = Customer.fromJson({...baseJson, 'name': ''});
      expect(c.initials, '?');
    });
  });
}
