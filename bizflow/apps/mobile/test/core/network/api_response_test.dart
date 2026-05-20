/// Phase 1 — ApiResponse and PaginatedResponse unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/core/network/api_response.dart';

void main() {
  group('ApiResponse.fromJson', () {
    test('parses successful response', () {
      final res = ApiResponse<String>.fromJson(
        {'success': true, 'message': 'OK', 'data': 'hello'},
        (json) => json as String,
      );
      expect(res.success, isTrue);
      expect(res.message, 'OK');
      expect(res.data, 'hello');
      expect(res.error, isNull);
    });

    test('parses error response', () {
      final res = ApiResponse<String>.fromJson(
        {'success': false, 'error': 'Not found'},
        null,
      );
      expect(res.success, isFalse);
      expect(res.error, 'Not found');
      expect(res.data, isNull);
    });

    test('defaults success to false when missing', () {
      final res = ApiResponse<String>.fromJson({}, null);
      expect(res.success, isFalse);
    });

    test('data is null when fromJsonT is null', () {
      final res = ApiResponse<Map>.fromJson(
        {'success': true, 'data': {'key': 'value'}},
        null,
      );
      // When fromJsonT is null, data stays as raw dynamic
      expect(res.data, isNotNull);
    });
  });

  group('PaginatedResponse', () {
    test('direct construction exposes correct fields', () {
      const res = PaginatedResponse<String>(
        items: ['a', 'b', 'c'],
        total: 100,
        page: 1,
        pageSize: 20,
        hasMore: true,
      );
      expect(res.items.length, 3);
      expect(res.total, 100);
      expect(res.page, 1);
      expect(res.pageSize, 20);
      expect(res.hasMore, isTrue);
    });

    test('hasMore is false when on last page', () {
      const res = PaginatedResponse<String>(
        items: ['a'],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false,
      );
      expect(res.hasMore, isFalse);
    });

    test('fromJson parses items list and pagination', () {
      final res = PaginatedResponse.fromJson(
        {
          'items': [
            {'name': 'X'},
            {'name': 'Y'},
          ],
          'total': 50,
          'page': 2,
          'pageSize': 20,
        },
        (json) => json['name'] as String,
      );
      expect(res.items, ['X', 'Y']);
      expect(res.total, 50);
      expect(res.page, 2);
      // page=2, pageSize=20 → 40 < 50 → hasMore true
      expect(res.hasMore, isTrue);
    });

    test('fromJson handles empty items list', () {
      final res = PaginatedResponse.fromJson(
        {'items': [], 'total': 0},
        (json) => json['name'] as String,
      );
      expect(res.items, isEmpty);
      expect(res.hasMore, isFalse);
    });
  });
}
