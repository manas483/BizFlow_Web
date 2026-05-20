/// BizFlow — FloatingBottomNav
///
/// Glassmorphic floating bottom navigation bar with spring tab animations,
/// a centred POS gradient pill, and an active indicator dot.
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/radius.dart';
import '../../core/theme/spacing.dart';

// ══════════════════════════════════════════════════════
//  NAV ITEM MODEL
// ══════════════════════════════════════════════════════

class BottomNavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const BottomNavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}

// ══════════════════════════════════════════════════════
//  FLOATING BOTTOM NAV
// ══════════════════════════════════════════════════════

class FloatingBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<BottomNavItem> items;
  final VoidCallback onPosTap;

  const FloatingBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
    required this.onPosTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bottomPadding = MediaQuery.of(context).viewPadding.bottom;

    return Container(
      height: AppSpacing.bottomNavHeight + bottomPadding,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
          ),
        ),
      ),
      child: ClipRect(
        child: BackdropFilter(
          filter: isDark
              ? ImageFilter.blur(sigmaX: 20, sigmaY: 20)
              : ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            color: isDark
                ? AppColors.darkSurface.withValues(alpha: 0.85)
                : AppColors.lightSurface.withValues(alpha: 0.9),
            padding: EdgeInsets.only(bottom: bottomPadding),
            child: Row(
              children: _buildItems(context),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildItems(BuildContext context) {
    // items list has 4 entries: [Dashboard, Inventory, Customers, More]
    // POS pill is injected as centre item (index 2)
    final result = <Widget>[];

    for (int i = 0; i < items.length; i++) {
      // inject POS pill before index 2
      if (i == 2) {
        result.add(_PosButton(onTap: onPosTap));
      }
      result.add(
        Expanded(
          child: _NavItem(
            item: items[i],
            isActive: currentIndex == i,
            onTap: () {
              HapticFeedback.selectionClick();
              onTap(i);
            },
          ),
        ),
      );
    }
    return result;
  }
}

// ══════════════════════════════════════════════════════
//  INDIVIDUAL NAV ITEM
// ══════════════════════════════════════════════════════

class _NavItem extends StatefulWidget {
  final BottomNavItem item;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.item,
    required this.isActive,
    required this.onTap,
  });

  @override
  State<_NavItem> createState() => _NavItemState();
}

class _NavItemState extends State<_NavItem>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 180),
      value: widget.isActive ? 1.0 : 0.8,
    );
    _scale = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack);
  }

  @override
  void didUpdateWidget(_NavItem old) {
    super.didUpdateWidget(old);
    if (widget.isActive != old.isActive) {
      widget.isActive ? _ctrl.forward() : _ctrl.reverse();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        height: AppSpacing.bottomNavHeight,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ScaleTransition(
              scale: _scale,
              child: Icon(
                widget.isActive ? widget.item.activeIcon : widget.item.icon,
                size: 24,
                color: widget.isActive
                    ? AppColors.brand500
                    : (isDark
                        ? AppColors.darkTextMuted
                        : AppColors.lightTextMuted),
              ),
            ),
            const SizedBox(height: 2),
            // Active dot indicator
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: widget.isActive ? 4 : 0,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.brand500,
                borderRadius: AppRadius.radiusFull,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  POS PILL BUTTON (centre)
// ══════════════════════════════════════════════════════

class _PosButton extends StatefulWidget {
  final VoidCallback onTap;
  const _PosButton({required this.onTap});

  @override
  State<_PosButton> createState() => _PosButtonState();
}

class _PosButtonState extends State<_PosButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
      lowerBound: 0.93,
      upperBound: 1.0,
      value: 1.0,
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      child: ScaleTransition(
        scale: _ctrl,
        child: GestureDetector(
          onTapDown: (_) {
            HapticFeedback.mediumImpact();
            _ctrl.reverse();
          },
          onTapUp: (_) {
            _ctrl.forward();
            widget.onTap();
          },
          onTapCancel: () => _ctrl.forward(),
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: AppColors.brandGradient,
              borderRadius: AppRadius.radiusFull,
              boxShadow: [
                BoxShadow(
                  color: AppColors.brand500.withValues(alpha: 0.4),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(
              Icons.point_of_sale_rounded,
              color: Colors.white,
              size: 24,
            ),
          ),
        ),
      ),
    );
  }
}
