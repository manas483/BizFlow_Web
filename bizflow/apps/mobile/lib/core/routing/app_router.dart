/// BizFlow — GoRouter Configuration
///
/// Route protection:
///  • Guest-only routes (login) → redirect to dashboard if authenticated
///  • Authenticated routes → redirect to login if unauthenticated
///  • Role-based screens via custom metadata
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/providers/auth_provider.dart';
import '../../features/auth/login_screen.dart';
import '../../features/dashboard/dashboard_screen.dart';
import '../../features/inventory/inventory_screen.dart';
import '../../features/sales/sales_screen.dart';
import '../../features/customers/customers_screen.dart';
import '../../features/settings/settings_screen.dart';
import '../../shared/layouts/app_shell.dart';
import 'splash_screen.dart';

// ══════════════════════════════════════════════════════
//  ROUTE NAMES
// ══════════════════════════════════════════════════════

abstract final class Routes {
  static const String splash    = '/';
  static const String login     = '/login';
  static const String dashboard = '/dashboard';
  static const String inventory = '/inventory';
  static const String sales     = '/sales';
  static const String customers = '/customers';
  static const String settings  = '/settings';
}

// ══════════════════════════════════════════════════════
//  NAVIGATION SHELL KEY
// ══════════════════════════════════════════════════════

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

// ══════════════════════════════════════════════════════
//  ROUTER PROVIDER
// ══════════════════════════════════════════════════════

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: Routes.splash,
    debugLogDiagnostics: false,

    // ── Redirect logic ────────────────────────────────────
    redirect: (context, state) {
      final isLoggedIn = authState.isAuthenticated;
      final isLoggingIn = state.matchedLocation == Routes.login;
      final isSplash = state.matchedLocation == Routes.splash;

      // Still checking auth state → stay on splash
      if (authState.isUnknown) {
        return isSplash ? null : Routes.splash;
      }

      // Not logged in → send to login
      if (!isLoggedIn) {
        return isLoggingIn ? null : Routes.login;
      }

      // Logged in but on login/splash → send to dashboard
      if (isLoggingIn || isSplash) {
        return Routes.dashboard;
      }

      return null; // No redirect needed
    },

    // ── Routes ────────────────────────────────────────────
    routes: [
      // Splash (auth check)
      GoRoute(
        path: Routes.splash,
        builder: (context, state) => const SplashScreen(),
      ),

      // Guest-only
      GoRoute(
        path: Routes.login,
        builder: (context, state) => const LoginScreen(),
      ),

      // Authenticated shell (bottom nav)
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: Routes.dashboard,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: DashboardScreen(),
            ),
          ),
          GoRoute(
            path: Routes.inventory,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: InventoryScreen(),
            ),
          ),
          GoRoute(
            path: Routes.sales,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SalesScreen(),
            ),
          ),
          GoRoute(
            path: Routes.customers,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: CustomersScreen(),
            ),
          ),
          GoRoute(
            path: Routes.settings,
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SettingsScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});
