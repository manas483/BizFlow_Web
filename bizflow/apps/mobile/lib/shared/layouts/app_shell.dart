/// BizFlow — App Shell (Bottom Navigation)
///
/// Authenticated layout with bottom navigation bar.
/// Uses GoRouter's ShellRoute for tab-based navigation.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/routing/app_router.dart';
import '../../core/theme/colors.dart';

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final currentIndex = _currentIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
          border: Border(
            top: BorderSide(
              color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
              width: 1,
            ),
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                Expanded(
                  child: _NavItem(
                    icon: Icons.dashboard_rounded,
                    label: 'Home',
                    isSelected: currentIndex == 0,
                    onTap: () => _onTap(context, 0),
                  ),
                ),
                Expanded(
                  child: _NavItem(
                    icon: Icons.inventory_2_rounded,
                    label: 'Inventory',
                    isSelected: currentIndex == 1,
                    onTap: () => _onTap(context, 1),
                  ),
                ),
                Expanded(
                  child: _NavItem(
                    icon: Icons.receipt_long_rounded,
                    label: 'Sales',
                    isSelected: currentIndex == 2,
                    onTap: () => _onTap(context, 2),
                  ),
                ),
                Expanded(
                  child: _NavItem(
                    icon: Icons.people_rounded,
                    label: 'Customers',
                    isSelected: currentIndex == 3,
                    onTap: () => _onTap(context, 3),
                  ),
                ),
                Expanded(
                  child: _NavItem(
                    icon: Icons.settings_rounded,
                    label: 'Settings',
                    isSelected: currentIndex == 4,
                    onTap: () => _onTap(context, 4),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final selectedColor = isDark ? AppColors.brand400 : AppColors.brand600;
    final unselectedColor = isDark ? AppColors.darkTextMuted : AppColors.lightTextMuted;
    final color = isSelected ? selectedColor : unselectedColor;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: isSelected
                    ? selectedColor.withValues(alpha: 0.12)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 22, color: color),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
