/// BizFlow — AppBottomSheet
///
/// Centralised bottom sheet helper. Use this for ALL sheets in the app.
/// Never call showModalBottomSheet directly from feature screens.
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/radius.dart';
import '../../core/theme/spacing.dart';
import '../../core/theme/shadows.dart';

// ══════════════════════════════════════════════════════
//  DRAG HANDLE
// ══════════════════════════════════════════════════════

class _DragHandle extends StatelessWidget {
  const _DragHandle();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Center(
      child: Container(
        width: 36,
        height: 4,
        margin: const EdgeInsets.only(top: AppSpacing.md, bottom: AppSpacing.sm),
        decoration: BoxDecoration(
          color: isDark
              ? AppColors.darkTextMuted
              : AppColors.lightTextMuted,
          borderRadius: AppRadius.radiusFull,
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  SHEET CONTAINER (shared scaffold)
// ══════════════════════════════════════════════════════

class _SheetContainer extends StatelessWidget {
  final Widget child;

  const _SheetContainer({required this.child});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: AppRadius.bottomSheet,
      child: BackdropFilter(
        filter: isDark
            ? ImageFilter.blur(sigmaX: 20, sigmaY: 20)
            : ImageFilter.blur(sigmaX: 12, sigmaY: 12),
        child: Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkSurface : AppColors.lightSurface,
            borderRadius: AppRadius.bottomSheet,
            border: Border.all(
              color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
            ),
            boxShadow: AppShadows.modal(Theme.of(context).brightness),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const _DragHandle(),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════

/// Shows a draggable scrollable bottom sheet.
/// [minSize] and [maxSize] are fractions of screen height (0.0–1.0).
Future<T?> showAppSheet<T>({
  required BuildContext context,
  required Widget Function(BuildContext, ScrollController) builder,
  double minSize = 0.4,
  double maxSize = 0.92,
  double initialSize = 0.5,
  bool isDismissible = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: isDismissible,
    backgroundColor: Colors.transparent,
    useRootNavigator: true,
    builder: (ctx) => DraggableScrollableSheet(
      initialChildSize: initialSize,
      minChildSize: minSize,
      maxChildSize: maxSize,
      expand: false,
      builder: (ctx2, scrollController) => _SheetContainer(
        child: builder(ctx2, scrollController),
      ),
    ),
  );
}

/// Shows a fixed-height confirmation sheet (~280dp).
/// [title], [body], primary [confirmLabel] (destructive-aware), [cancelLabel].
Future<bool?> showConfirmSheet({
  required BuildContext context,
  required String title,
  String? body,
  String confirmLabel = 'Confirm',
  String cancelLabel = 'Cancel',
  bool isDestructive = false,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    useRootNavigator: true,
    builder: (ctx) => _SheetContainer(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.base,
          AppSpacing.sm,
          AppSpacing.base,
          AppSpacing.xxl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              title,
              style: Theme.of(ctx).textTheme.titleLarge,
              textAlign: TextAlign.center,
            ),
            if (body != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                body,
                style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(ctx).brightness == Brightness.dark
                          ? AppColors.darkTextSecondary
                          : AppColors.lightTextSecondary,
                    ),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor:
                    isDestructive ? AppColors.error : AppColors.brand500,
                minimumSize: const Size.fromHeight(AppSpacing.huge),
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.button,
                ),
              ),
              child: Text(confirmLabel),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(AppSpacing.huge),
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.button,
                ),
              ),
              child: Text(cancelLabel),
            ),
          ],
        ),
      ),
    ),
  );
}

/// Shows a selection sheet with an optional search bar at the top.
/// Calls [onSelected] when an item is tapped.
Future<void> showSelectionSheet<T>({
  required BuildContext context,
  required String title,
  required List<T> items,
  required String Function(T) labelOf,
  required void Function(T) onSelected,
  Widget Function(T)? leadingOf,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    useRootNavigator: true,
    builder: (ctx) => DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (ctx2, scrollCtrl) => _SheetContainer(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.base),
              child: Text(title,
                  style: Theme.of(ctx2).textTheme.titleMedium),
            ),
            const SizedBox(height: AppSpacing.sm),
            Flexible(
              child: ListView.builder(
                controller: scrollCtrl,
                shrinkWrap: true,
                itemCount: items.length,
                itemBuilder: (_, i) {
                  final item = items[i];
                  return ListTile(
                    leading: leadingOf != null ? leadingOf(item) : null,
                    title: Text(labelOf(item)),
                    onTap: () {
                      Navigator.of(ctx2).pop();
                      onSelected(item);
                    },
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.base),
          ],
        ),
      ),
    ),
  );
}
