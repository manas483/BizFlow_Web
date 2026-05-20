/// BizFlow Mobile — Root Test Suite
///
/// This file is the entry-point test runner.
/// Feature-specific tests live in test/core/ and test/shared/.
///
/// Smoke tests here verify Phase 1 constants and model availability
/// without requiring device/emulator.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/core/constants/app_constants.dart';
import 'package:bizflow_mobile/core/config/env_config.dart';
import 'package:bizflow_mobile/core/errors/app_error.dart';
import 'package:bizflow_mobile/shared/models/user.dart';
import 'package:bizflow_mobile/shared/models/product.dart';
import 'package:bizflow_mobile/shared/models/customer.dart';
import 'package:bizflow_mobile/shared/models/sale.dart';
import 'package:bizflow_mobile/shared/models/dashboard_stats.dart';
import 'package:bizflow_mobile/shared/providers/auth_provider.dart';

void main() {
  group('Phase 1 — Foundation smoke tests', () {
    test('AppConstants defines required auth keys', () {
      expect(AppConstants.accessTokenKey, isNotEmpty);
      expect(AppConstants.refreshTokenKey, isNotEmpty);
      expect(AppConstants.userDataKey, isNotEmpty);
    });

    test('AppConstants defines required API paths', () {
      expect(AppConstants.authToken, isNotEmpty);
      expect(AppConstants.authRefresh, isNotEmpty);
      expect(AppConstants.authMe, isNotEmpty);
      expect(AppConstants.products, isNotEmpty);
      expect(AppConstants.sales, isNotEmpty);
      expect(AppConstants.customers, isNotEmpty);
    });

    test('Env.init switches environment correctly', () {
      Env.init(Environment.dev);
      expect(Env.isDev, isTrue);

      Env.init(Environment.production);
      expect(Env.isProduction, isTrue);

      // restore
      Env.init(Environment.dev);
    });

    test('All models can be constructed from valid JSON', () {
      final user = User.fromJson({
        'id': 'u1', 'email': 'a@b.com', 'name': 'A',
        'role': 'ADMIN', 'businessId': 'b1',
      });
      expect(user.id, 'u1');

      final product = Product.fromJson({
        'id': 'p1', 'name': 'X', 'sku': 'S1', 'category': 'C',
        'stock': 5, 'purchasePrice': 10.0, 'sellingPrice': 20.0,
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(product.id, 'p1');

      final customer = Customer.fromJson({
        'id': 'c1', 'name': 'N', 'phone': '1',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(customer.id, 'c1');

      final sale = Sale.fromJson({
        'id': 's1', 'invoiceNo': 'INV-001', 'customerId': 'c1',
        'total': 100.0, 'status': 'PAID',
        'createdAt': '2024-01-01T00:00:00.000Z',
      });
      expect(sale.id, 's1');

      final stats = DashboardStats.fromJson({
        'revenue': 1000.0, 'salesCount': 5,
        'customerCount': 3, 'expenses': 200.0,
      });
      expect(stats.profit, closeTo(800.0, 0.001));
    });
  });

  group('Phase 2 — Auth smoke tests', () {
    test('AppError types are instantiable', () {
      const e = NetworkError();
      expect(e, isA<AppError>());
      expect(e, isA<Exception>());
    });

    test('AuthState initial status is unknown', () {
      const state = AuthState();
      expect(state.isUnknown, isTrue);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
    });

    test('AuthStatus enum has all three expected values', () {
      expect(AuthStatus.values, containsAll([
        AuthStatus.unknown,
        AuthStatus.authenticated,
        AuthStatus.unauthenticated,
      ]));
    });
  });
}
