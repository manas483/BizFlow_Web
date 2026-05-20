/// BizFlow — StatusBadge
///
/// Semantic color chip for status display. Use instead of raw Chip/Container.
library;

import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/radius.dart';
import '../../core/theme/typography.dart';

enum BadgeVariant { success, warning, error, info, neutral, brand }

class StatusBadge extends StatelessWidget {
  final String label;
  final BadgeVariant variant;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.label,
    this.variant = BadgeVariant.neutral,
    this.icon,
  });

  // ── Convenience constructors ───────────────────────
  const StatusBadge.success({super.key, required this.label, this.icon})
      : variant = BadgeVariant.success;

  const StatusBadge.warning({super.key, required this.label, this.icon})
      : variant = BadgeVariant.warning;

  const StatusBadge.error({super.key, required this.label, this.icon})
      : variant = BadgeVariant.error;

  const StatusBadge.info({super.key, required this.label, this.icon})
      : variant = BadgeVariant.info;

  const StatusBadge.brand({super.key, required this.label, this.icon})
      : variant = BadgeVariant.brand;

  Color get _color {
    switch (variant) {
      case BadgeVariant.success: return AppColors.success;
      case BadgeVariant.warning: return AppColors.warning;
      case BadgeVariant.error:   return AppColors.error;
      case BadgeVariant.info:    return AppColors.info;
      case BadgeVariant.brand:   return AppColors.brand500;
      case BadgeVariant.neutral: return AppColors.stockOut;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = _color;
    
    Color getBgColor() {
      if (isDark) return color.withValues(alpha: 0.15);
      switch (variant) {
        case BadgeVariant.success: return AppColors.pastelSuccess;
        case BadgeVariant.warning: return AppColors.pastelWarning;
        case BadgeVariant.error:   return AppColors.pastelError;
        case BadgeVariant.info:    return AppColors.pastelInfo;
        case BadgeVariant.brand:   return AppColors.pastelBrand;
        case BadgeVariant.neutral: return AppColors.stockOut.withValues(alpha: 0.1);
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: getBgColor(),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(
          color: isDark ? color.withValues(alpha: 0.25) : Colors.transparent,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 4),
          ],
          Text(label, style: AppTypography.chipLabel(color)),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  STOCK BADGE — convenience wrapper for inventory
// ══════════════════════════════════════════════════════

class StockBadge extends StatelessWidget {
  final int quantity;
  final int? lowStockThreshold;

  const StockBadge({
    super.key,
    required this.quantity,
    this.lowStockThreshold = 10,
  });

  @override
  Widget build(BuildContext context) {
    if (quantity <= 0) {
      return const StatusBadge.error(label: 'Out');
    } else if (quantity <= (lowStockThreshold ?? 10)) {
      return StatusBadge.warning(label: '$quantity left');
    } else {
      return StatusBadge.success(label: '$quantity');
    }
  }
}
