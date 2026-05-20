/// BizFlow — Auth State Provider
///
/// Global auth state using Riverpod. Drives routing guards.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../../core/errors/app_error.dart';

// ══════════════════════════════════════════════════════
//  AUTH STATE
// ══════════════════════════════════════════════════════

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final User? user;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    AuthStatus? status,
    User? user,
    bool? isLoading,
    String? error,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: user ?? this.user,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isUnauthenticated => status == AuthStatus.unauthenticated;
  bool get isUnknown => status == AuthStatus.unknown;
}

// ══════════════════════════════════════════════════════
//  AUTH NOTIFIER
// ══════════════════════════════════════════════════════

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(const AuthState());

  /// Called at app start — tries to restore session
  Future<void> initialize() async {
    state = state.copyWith(isLoading: true);
    try {
      final user = await _authService.tryRestoreSession();
      if (user != null) {
        state = AuthState(
          status: AuthStatus.authenticated,
          user: user,
        );
      } else {
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    } catch (_) {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  /// Login
  Future<void> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final user = await _authService.login(email, password);
      state = AuthState(
        status: AuthStatus.authenticated,
        user: user,
      );
    } catch (e) {
      final errorMsg = e is AppError ? e.message : e.toString();
      state = state.copyWith(
        isLoading: false,
        error: errorMsg,
        status: AuthStatus.unauthenticated,
      );
    }
  }

  /// Logout
  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    await _authService.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Update user data after profile changes
  void updateUser(User user) {
    state = state.copyWith(user: user);
  }
}

// ══════════════════════════════════════════════════════
//  PROVIDER
// ══════════════════════════════════════════════════════

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.read(authServiceProvider);
  return AuthNotifier(authService);
});
