/// Phase 2 — User model unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/shared/models/user.dart';

void main() {
  // ── Fixture ────────────────────────────────────────────
  const fullJson = {
    'id': 'u1',
    'email': 'admin@biz.com',
    'name': 'Sacha',
    'role': 'ADMIN',
    'businessId': 'b1',
    'businessType': 'RETAIL',
    'permissions': ['sales:read', 'inventory:write'],
  };

  group('User.fromJson', () {
    test('parses all fields correctly', () {
      final user = User.fromJson(fullJson);
      expect(user.id, 'u1');
      expect(user.email, 'admin@biz.com');
      expect(user.name, 'Sacha');
      expect(user.role, 'ADMIN');
      expect(user.businessId, 'b1');
      expect(user.businessType, 'RETAIL');
      expect(user.permissions, ['sales:read', 'inventory:write']);
    });

    test('handles missing optional fields gracefully', () {
      final user = User.fromJson({
        'id': 'u2',
        'email': 'staff@biz.com',
        'name': 'Staff',
        'role': 'EMPLOYEE',
        'businessId': 'b1',
      });
      expect(user.businessType, isNull);
      expect(user.permissions, isEmpty);
    });

    test('falls back to EMPLOYEE when role is missing', () {
      final user = User.fromJson({
        'id': 'u3',
        'email': 'x@biz.com',
        'name': 'X',
        'businessId': 'b1',
      });
      expect(user.role, 'EMPLOYEE');
    });

    test('coerces numeric id to string', () {
      final user = User.fromJson({...fullJson, 'id': 42});
      expect(user.id, '42');
    });
  });

  group('User.toJson / round-trip', () {
    test('toJson preserves all fields', () {
      final user = User.fromJson(fullJson);
      final json = user.toJson();
      expect(json['id'], 'u1');
      expect(json['email'], 'admin@biz.com');
      expect(json['role'], 'ADMIN');
      expect(json['permissions'], ['sales:read', 'inventory:write']);
    });

    test('JSON string round-trip is identical', () {
      final original = User.fromJson(fullJson);
      final restored = User.fromJsonString(original.toJsonString());
      expect(restored.id, original.id);
      expect(restored.email, original.email);
      expect(restored.name, original.name);
      expect(restored.role, original.role);
      expect(restored.permissions, original.permissions);
    });
  });

  group('User helpers', () {
    test('hasPermission returns true for existing permission', () {
      final user = User.fromJson(fullJson);
      expect(user.hasPermission('sales:read'), isTrue);
      expect(user.hasPermission('inventory:write'), isTrue);
    });

    test('hasPermission returns false for missing permission', () {
      final user = User.fromJson(fullJson);
      expect(user.hasPermission('reports:read'), isFalse);
    });

    test('isAdmin is true for ADMIN role', () {
      final user = User.fromJson(fullJson);
      expect(user.isAdmin, isTrue);
    });

    test('isAdmin is true for OWNER role', () {
      final user = User.fromJson({...fullJson, 'role': 'OWNER'});
      expect(user.isAdmin, isTrue);
    });

    test('isAdmin is false for EMPLOYEE role', () {
      final user = User.fromJson({...fullJson, 'role': 'EMPLOYEE'});
      expect(user.isAdmin, isFalse);
    });
  });
}
