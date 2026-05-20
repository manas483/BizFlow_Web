/// Phase 1 — Product model unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/shared/models/product.dart';

void main() {
  const baseJson = {
    'id': 'p1',
    'name': 'Widget A',
    'sku': 'WGT-001',
    'category': 'Electronics',
    'stock': 10,
    'minStock': 5,
    'purchasePrice': 100.0,
    'sellingPrice': 150.0,
    'gstRate': 18.0,
    'unit': 'pcs',
    'createdAt': '2024-01-01T00:00:00.000Z',
  };

  group('Product.fromJson', () {
    test('parses all required fields', () {
      final p = Product.fromJson(baseJson);
      expect(p.id, 'p1');
      expect(p.name, 'Widget A');
      expect(p.sku, 'WGT-001');
      expect(p.category, 'Electronics');
      expect(p.stock, 10);
      expect(p.minStock, 5);
      expect(p.purchasePrice, 100.0);
      expect(p.sellingPrice, 150.0);
      expect(p.gstRate, 18.0);
      expect(p.unit, 'pcs');
    });

    test('defaults minStock to 5 when missing', () {
      final p = Product.fromJson({...baseJson}..remove('minStock'));
      expect(p.minStock, 5);
    });

    test('defaults gstRate to 0 when missing', () {
      final p = Product.fromJson({...baseJson}..remove('gstRate'));
      expect(p.gstRate, 0.0);
    });

    test('defaults unit to pcs when missing', () {
      final p = Product.fromJson({...baseJson}..remove('unit'));
      expect(p.unit, 'pcs');
    });

    test('handles integer stock as num', () {
      final p = Product.fromJson({...baseJson, 'stock': 7});
      expect(p.stock, 7);
    });

    test('handles optional supplier and hsnCode as null', () {
      final p = Product.fromJson(baseJson);
      expect(p.supplier, isNull);
      expect(p.hsnCode, isNull);
    });
  });

  group('Product computed properties', () {
    test('isLowStock is true when stock <= minStock', () {
      final p = Product.fromJson({...baseJson, 'stock': 5, 'minStock': 5});
      expect(p.isLowStock, isTrue);
    });

    test('isLowStock is false when stock > minStock', () {
      final p = Product.fromJson({...baseJson, 'stock': 10, 'minStock': 5});
      expect(p.isLowStock, isFalse);
    });

    test('isOutOfStock is true when stock is 0', () {
      final p = Product.fromJson({...baseJson, 'stock': 0});
      expect(p.isOutOfStock, isTrue);
    });

    test('isOutOfStock is false when stock > 0', () {
      final p = Product.fromJson(baseJson);
      expect(p.isOutOfStock, isFalse);
    });

    test('profit is sellingPrice - purchasePrice', () {
      final p = Product.fromJson(baseJson);
      expect(p.profit, closeTo(50.0, 0.001));
    });

    test('margin is correct percentage', () {
      // profit=50, purchasePrice=100 → 50%
      final p = Product.fromJson(baseJson);
      expect(p.margin, closeTo(50.0, 0.001));
    });

    test('margin is 0 when purchasePrice is 0', () {
      final p = Product.fromJson({...baseJson, 'purchasePrice': 0});
      expect(p.margin, 0.0);
    });
  });
}
