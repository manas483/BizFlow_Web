/// BizFlow — AppDialog
///
/// Centralised dialog helper. Use this for ALL dialogs in the app.
/// Never use showDialog directly from feature screens.
library;

import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/radius.dart';
import '../../core/theme/spacing.dart';

// ══════════════════════════════════════════════════════
//  ALERT DIALOG (1 action — informational)
// ══════════════════════════════════════════════════════

/// Shows a single-button informational alert dialog.
Future<void> showAlertDialog({
  required BuildContext context,
  required String title,
  required String message,
  String buttonLabel = 'OK',
  IconData? icon,
  Color? iconColor,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => _AppDialogShell(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: (iconColor ?? AppColors.info).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Icon(icon, size: 28, color: iconColor ?? AppColors.info),
            ),
            const SizedBox(height: AppSpacing.base),
          ],
          Text(
            title,
            style: Theme.of(ctx).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(ctx).brightness == Brightness.dark
                      ? AppColors.darkTextSecondary
                      : AppColors.lightTextSecondary,
                ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          SizedBox(
            width: double.infinity,
            height: AppSpacing.huge,
            child: FilledButton(
              onPressed: () => Navigator.of(ctx).pop(),
              style: FilledButton.styleFrom(
                shape: RoundedRectangleBorder(borderRadius: AppRadius.button),
              ),
              child: Text(buttonLabel),
            ),
          ),
        ],
      ),
    ),
  );
}

// ══════════════════════════════════════════════════════
//  CONFIRM DIALOG (2 actions — destructive-aware)
// ══════════════════════════════════════════════════════

/// Shows a two-button confirmation dialog.
/// Returns `true` if confirmed, `false`/`null` if cancelled.
Future<bool?> showConfirmDialog({
  required BuildContext context,
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
  String cancelLabel = 'Cancel',
  bool isDestructive = false,
  IconData? icon,
}) {
  final confirmColor = isDestructive ? AppColors.error : AppColors.brand500;

  return showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => _AppDialogShell(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: confirmColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Icon(icon, size: 28, color: confirmColor),
            ),
            const SizedBox(height: AppSpacing.base),
          ],
          Text(
            title,
            style: Theme.of(ctx).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(ctx).brightness == Brightness.dark
                      ? AppColors.darkTextSecondary
                      : AppColors.lightTextSecondary,
                ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          SizedBox(
            width: double.infinity,
            height: AppSpacing.huge,
            child: FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor: confirmColor,
                shape:
                    RoundedRectangleBorder(borderRadius: AppRadius.button),
              ),
              child: Text(confirmLabel),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            height: AppSpacing.huge,
            child: OutlinedButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              style: OutlinedButton.styleFrom(
                shape:
                    RoundedRectangleBorder(borderRadius: AppRadius.button),
              ),
              child: Text(cancelLabel),
            ),
          ),
        ],
      ),
    ),
  );
}

// ══════════════════════════════════════════════════════
//  INTERNAL SHELL
// ══════════════════════════════════════════════════════

class _AppDialogShell extends StatelessWidget {
  final Widget child;
  const _AppDialogShell({required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Dialog(
      backgroundColor: isDark ? AppColors.darkSurface : AppColors.lightSurface,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.radiusXl),
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: child,
      ),
    );
  }
}
