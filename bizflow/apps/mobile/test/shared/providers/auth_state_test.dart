/// Phase 2 — AuthState unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/shared/providers/auth_provider.dart';
import 'package:bizflow_mobile/shared/models/user.dart';

void main() {
  const testUser = User(
    id: 'u1',
    email: 'admin@biz.com',
    name: 'Sacha',
    role: 'ADMIN',
    businessId: 'b1',
  );

  group('AuthState defaults', () {
    test('initial state is unknown, not loading, no error', () {
      const state = AuthState();
      expect(state.status, AuthStatus.unknown);
      expect(state.isUnknown, isTrue);
      expect(state.isAuthenticated, isFalse);
      expect(state.isUnauthenticated, isFalse);
      expect(state.isLoading, isFalse);
      expect(state.error, isNull);
      expect(state.user, isNull);
    });
  });

  group('AuthState.copyWith', () {
    test('updates status while preserving other fields', () {
      const original = AuthState(status: AuthStatus.unknown, isLoading: true);
      final updated = original.copyWith(status: AuthStatus.unauthenticated);
      expect(updated.status, AuthStatus.unauthenticated);
      expect(updated.isLoading, isTrue); // preserved
    });

    test('clears error when copyWith is called with error: null', () {
      const original = AuthState(error: 'Some error');
      final updated = original.copyWith(isLoading: false);
      // copyWith passes error: null → clears error
      expect(updated.error, isNull);
    });

    test('preserves user when not explicitly overridden', () {
      const original = AuthState(
        status: AuthStatus.authenticated,
        user: testUser,
      );
      final updated = original.copyWith(isLoading: false);
      expect(updated.user, testUser);
    });

    test('sets loading state correctly', () {
      const state = AuthState();
      final loading = state.copyWith(isLoading: true);
      expect(loading.isLoading, isTrue);
    });
  });

  group('AuthState status getters', () {
    test('isAuthenticated is true only when status is authenticated', () {
      const state = AuthState(
        status: AuthStatus.authenticated,
        user: testUser,
      );
      expect(state.isAuthenticated, isTrue);
      expect(state.isUnauthenticated, isFalse);
      expect(state.isUnknown, isFalse);
    });

    test('isUnauthenticated is true only when status is unauthenticated', () {
      const state = AuthState(status: AuthStatus.unauthenticated);
      expect(state.isUnauthenticated, isTrue);
      expect(state.isAuthenticated, isFalse);
      expect(state.isUnknown, isFalse);
    });

    test('isUnknown is true only when status is unknown', () {
      const state = AuthState(status: AuthStatus.unknown);
      expect(state.isUnknown, isTrue);
      expect(state.isAuthenticated, isFalse);
      expect(state.isUnauthenticated, isFalse);
    });
  });

  group('AuthState authenticated construction', () {
    test('authenticated state carries user', () {
      const state = AuthState(
        status: AuthStatus.authenticated,
        user: testUser,
      );
      expect(state.user, isNotNull);
      expect(state.user!.name, 'Sacha');
      expect(state.user!.role, 'ADMIN');
    });

    test('unauthenticated state has no user', () {
      const state = AuthState(status: AuthStatus.unauthenticated);
      expect(state.user, isNull);
    });
  });
}
