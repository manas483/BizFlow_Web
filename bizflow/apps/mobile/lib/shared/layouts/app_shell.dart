/// BizFlow — App Shell (Bottom Navigation)
///
/// Authenticated layout with bottom navigation bar.
/// Uses GoRouter's ShellRoute for tab-based navigation.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/routing/app_router.dart';
import '../../core/theme/colors.dart';
import '../widgets/floating_bottom_nav.dart';

class AppShell extends StatelessWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    return switch (location) {
      Routes.dashboard => 0,
      Routes.inventory => 1,
      Routes.sales     => 2,
      Routes.customers => 3,
      Routes.settings  => 4,
      _                => 0,
    };
  }

  void _onTap(BuildContext context, int index) {
    final route = switch (index) {
      0 => Routes.dashboard,
      1 => Routes.inventory,
      2 => Routes.sales,
      3 => Routes.customers,
      4 => Routes.settings,
      _ => Routes.dashboard,
    };
    context.go(route);
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _currentIndex(context);

    return Scaffold(
      extendBody: true, // Required for floating nav to sit over content
      body: child,
      bottomNavigationBar: FloatingBottomNav(
        currentIndex: currentIndex,
        onTap: (index) => _onTap(context, index),
        onPosTap: () {
          // Placeholder for Phase 6 POS integration
        },
        items: const [
          BottomNavItem(
            icon: Icons.dashboard_outlined,
            activeIcon: Icons.dashboard_rounded,
            label: 'Home',
          ),
          BottomNavItem(
            icon: Icons.inventory_2_outlined,
            activeIcon: Icons.inventory_2_rounded,
            label: 'Inventory',
          ),
          BottomNavItem(
            icon: Icons.receipt_long_outlined,
            activeIcon: Icons.receipt_long_rounded,
            label: 'Sales',
          ),
          BottomNavItem(
            icon: Icons.people_outline_rounded,
            activeIcon: Icons.people_rounded,
            label: 'Customers',
          ),
        ],
      ),
    );
  }
}
