/// BizFlow — AppToast
///
/// Branded top-banner toast. Use for all user feedback notifications.
/// Never use SnackBar or raw alerts.
library;

import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/radius.dart';
import '../../core/theme/spacing.dart';

enum ToastVariant { success, error, warning, info }

class AppToast {
  AppToast._();

  static void show(
    BuildContext context,
    String message, {
    ToastVariant variant = ToastVariant.info,
    Duration duration = const Duration(seconds: 4),
  }) {
    final overlay = Overlay.of(context);
    final entry = OverlayEntry(
      builder: (_) => _ToastBanner(
        message: message,
        variant: variant,
        duration: duration,
      ),
    );

    overlay.insert(entry);
    Future.delayed(duration + const Duration(milliseconds: 300), entry.remove);
  }

  static void success(BuildContext context, String message) =>
      show(context, message, variant: ToastVariant.success);

  static void error(BuildContext context, String message) =>
      show(context, message, variant: ToastVariant.error);

  static void warning(BuildContext context, String message) =>
      show(context, message, variant: ToastVariant.warning);

  static void info(BuildContext context, String message) =>
      show(context, message, variant: ToastVariant.info);
}

// ══════════════════════════════════════════════════════
//  INTERNAL BANNER
// ══════════════════════════════════════════════════════

class _ToastBanner extends StatefulWidget {
  final String message;
  final ToastVariant variant;
  final Duration duration;

  const _ToastBanner({
    required this.message,
    required this.variant,
    required this.duration,
  });

  @override
  State<_ToastBanner> createState() => _ToastBannerState();
}

class _ToastBannerState extends State<_ToastBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<Offset> _slide;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
      reverseDuration: const Duration(milliseconds: 220),
    );

    _slide = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));

    _opacity = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);

    _ctrl.forward();

    Future.delayed(widget.duration, () async {
      if (mounted) await _ctrl.reverse();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Color get _bgColor {
    switch (widget.variant) {
      case ToastVariant.success: return AppColors.success;
      case ToastVariant.error:   return AppColors.error;
      case ToastVariant.warning: return AppColors.warning;
      case ToastVariant.info:    return AppColors.info;
    }
  }

  IconData get _icon {
    switch (widget.variant) {
      case ToastVariant.success: return Icons.check_circle_rounded;
      case ToastVariant.error:   return Icons.error_rounded;
      case ToastVariant.warning: return Icons.warning_rounded;
      case ToastVariant.info:    return Icons.info_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: MediaQuery.of(context).viewPadding.top + AppSpacing.sm,
      left: AppSpacing.base,
      right: AppSpacing.base,
      child: SlideTransition(
        position: _slide,
        child: FadeTransition(
          opacity: _opacity,
          child: Material(
            color: Colors.transparent,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.base,
                vertical: AppSpacing.md,
              ),
              decoration: BoxDecoration(
                color: _bgColor,
                borderRadius: BorderRadius.circular(AppRadius.md),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x33000000),
                    blurRadius: 16,
                    offset: Offset(0, 6),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Icon(_icon, size: 20, color: Colors.white),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      widget.message,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
