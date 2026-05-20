/// BizFlow — Design System Playground Screen
///
/// Single source of UI truth. Every shared component is showcased here.
/// Accessible from Settings in DEBUG builds only (feature_dev_tools).
/// MUST be hidden / removed before production release.
library;

import 'package:flutter/material.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/radius.dart';
import '../../core/theme/spacing.dart';
import '../../core/theme/typography.dart';
import '../../shared/widgets/shared_widgets.dart';
import '../../shared/widgets/app_bottom_sheet.dart';
import '../../shared/widgets/app_dialog.dart';
import '../../shared/widgets/app_toast.dart';
import '../../shared/widgets/brand_spinner.dart';
import '../../shared/widgets/filter_chip_row.dart';
import '../../shared/widgets/pressable_card.dart';
import '../../shared/widgets/status_badge.dart';
import '../../shared/widgets/app_text_field.dart';

class DesignSystemPlaygroundScreen extends StatefulWidget {
  const DesignSystemPlaygroundScreen({super.key});

  @override
  State<DesignSystemPlaygroundScreen> createState() =>
      _DesignSystemPlaygroundScreenState();
}

class _DesignSystemPlaygroundScreenState
    extends State<DesignSystemPlaygroundScreen> {
  // Filter chip state
  String _selectedFilter = 'All';
  final _filterOptions = ['All', 'Low Stock', 'Out of Stock', 'Electronics'];

  // Text field state
  final _textCtrl = TextEditingController();
  String? _fieldError;

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Design Playground'),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.base,
          vertical: AppSpacing.base,
        ),
        children: [
          _buildSectionLabel(context, '01 · COLORS'),
          _buildColorsSection(context, isDark),
          _buildSectionLabel(context, '02 · TYPOGRAPHY'),
          _buildTypographySection(context, isDark),
          _buildSectionLabel(context, '03 · SPACING & RADIUS'),
          _buildSpacingSection(context, isDark),
          _buildSectionLabel(context, '04 · BUTTONS'),
          _buildButtonsSection(context),
          _buildSectionLabel(context, '05 · STATUS BADGES'),
          _buildBadgesSection(),
          _buildSectionLabel(context, '06 · CARDS'),
          _buildCardsSection(context),
          _buildSectionLabel(context, '07 · INPUTS'),
          _buildInputsSection(context),
          _buildSectionLabel(context, '08 · FILTER CHIPS'),
          _buildFilterChipsSection(),
          _buildSectionLabel(context, '09 · LOADERS'),
          _buildLoadersSection(context),
          _buildSectionLabel(context, '10 · TOAST'),
          _buildToastSection(context),
          _buildSectionLabel(context, '11 · SHEETS'),
          _buildSheetsSection(context),
          _buildSectionLabel(context, '12 · DIALOGS'),
          _buildDialogsSection(context),
          _buildSectionLabel(context, '13 · ICONS'),
          _buildIconsSection(context, isDark),
          const SizedBox(height: AppSpacing.mega),
        ],
      ),
    );
  }

  // ── Section label ──────────────────────────────────

  Widget _buildSectionLabel(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.only(
          top: AppSpacing.xl, bottom: AppSpacing.md),
      child: Text(
        label,
        style: AppTypography.chipLabel(AppColors.brand500),
      ),
    );
  }

  // ── 01 COLORS ──────────────────────────────────────

  Widget _buildColorsSection(BuildContext context, bool isDark) {
    final swatches = [
      ('brand500', AppColors.brand500),
      ('brand400', AppColors.brand400),
      ('brand300', AppColors.brand300),
      ('indigo500', AppColors.indigo500),
      ('success', AppColors.success),
      ('warning', AppColors.warning),
      ('error', AppColors.error),
      ('info', AppColors.info),
      ('darkBg', AppColors.darkBg),
      ('darkSurface', AppColors.darkSurface),
      ('lightBg', AppColors.lightBg),
      ('lightSurface', AppColors.lightSurface),
    ];

    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: AppSpacing.sm,
        crossAxisSpacing: AppSpacing.sm,
        childAspectRatio: 0.85,
      ),
      itemCount: swatches.length,
      itemBuilder: (_, i) {
        final (name, color) = swatches[i];
        return Column(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(
                    color: isDark
                        ? AppColors.darkBorder
                        : AppColors.lightBorder,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              name,
              style: Theme.of(context).textTheme.labelSmall,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        );
      },
    );
  }

  // ── 02 TYPOGRAPHY ──────────────────────────────────

  Widget _buildTypographySection(BuildContext context, bool isDark) {
    final styles = [
      ('Display', Theme.of(context).textTheme.displaySmall),
      ('Headline', Theme.of(context).textTheme.headlineMedium),
      ('Title', Theme.of(context).textTheme.titleLarge),
      ('Body', Theme.of(context).textTheme.bodyMedium),
      ('Caption', Theme.of(context).textTheme.labelSmall),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: styles.map((entry) {
          final (label, style) = entry;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                SizedBox(
                  width: 72,
                  child: Text(
                    label,
                    style: AppTypography.chipLabel(
                      isDark
                          ? AppColors.darkTextMuted
                          : AppColors.lightTextMuted,
                    ),
                  ),
                ),
                Expanded(
                  child: Text('BizFlow ERP', style: style),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── 03 SPACING & RADIUS ────────────────────────────

  Widget _buildSpacingSection(BuildContext context, bool isDark) {
    final spacings = [
      ('xs=4', AppSpacing.xs),
      ('sm=8', AppSpacing.sm),
      ('md=12', AppSpacing.md),
      ('base=16', AppSpacing.base),
      ('lg=20', AppSpacing.lg),
      ('xl=24', AppSpacing.xl),
      ('xxl=32', AppSpacing.xxl),
    ];

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: spacings.map((entry) {
          final (label, size) = entry;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: [
                SizedBox(
                  width: 72,
                  child: Text(
                    label,
                    style: AppTypography.chipLabel(
                      isDark
                          ? AppColors.darkTextMuted
                          : AppColors.lightTextMuted,
                    ),
                  ),
                ),
                Container(
                  height: 12,
                  width: size * 2,
                  decoration: BoxDecoration(
                    color: AppColors.brand500.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // ── 04 BUTTONS ─────────────────────────────────────

  Widget _buildButtonsSection(BuildContext context) {
    return Column(
      children: [
        AppButton(
          label: 'Primary Button',
          onPressed: () {},
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Gradient Button',
          onPressed: () {},
          useGradient: true,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'Outlined Button',
          onPressed: () {},
          isOutlined: true,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppButton(
          label: 'With Icon',
          onPressed: () {},
          useGradient: true,
          icon: Icons.add_rounded,
        ),
        const SizedBox(height: AppSpacing.sm),
        const AppButton(
          label: 'Loading State',
          onPressed: null,
          isLoading: true,
          useGradient: true,
        ),
        const SizedBox(height: AppSpacing.sm),
        const AppButton(
          label: 'Disabled',
          onPressed: null,
        ),
      ],
    );
  }

  // ── 05 STATUS BADGES ───────────────────────────────

  Widget _buildBadgesSection() {
    return const GlassCard(
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: [
          StatusBadge.success(label: 'Paid'),
          StatusBadge.warning(label: 'Low Stock'),
          StatusBadge.error(label: 'Overdue'),
          StatusBadge.info(label: 'Processing'),
          StatusBadge.brand(label: 'Active'),
          StatusBadge(label: 'Neutral', variant: BadgeVariant.neutral),
          StockBadge(quantity: 0),
          StockBadge(quantity: 5),
          StockBadge(quantity: 42),
        ],
      ),
    );
  }

  // ── 06 CARDS ───────────────────────────────────────

  Widget _buildCardsSection(BuildContext context) {
    return Column(
      children: [
        GlassCard(
          child: Row(children: [
            const Icon(Icons.info_outline_rounded, size: 20),
            const SizedBox(width: AppSpacing.sm),
            Text('Standard GlassCard',
                style: Theme.of(context).textTheme.bodyMedium),
          ]),
        ),
        const SizedBox(height: AppSpacing.sm),
        PressableCard(
          onTap: () {},
          child: Row(children: [
            const Icon(Icons.touch_app_rounded,
                size: 20, color: AppColors.brand500),
            const SizedBox(width: AppSpacing.sm),
            Text('PressableCard — tap me',
                style: Theme.of(context).textTheme.bodyMedium),
          ]),
        ),
        const SizedBox(height: AppSpacing.sm),
        const KpiCard(
          title: 'Revenue Today',
          value: '₹24,500',
          icon: Icons.trending_up_rounded,
          iconColor: AppColors.success,
          subtitle: '+12%',
        ),
      ],
    );
  }

  // ── 07 INPUTS ──────────────────────────────────────

  Widget _buildInputsSection(BuildContext context) {
    return Column(
      children: [
        AppTextField(
          controller: _textCtrl,
          label: 'Standard Input',
          hint: 'Type something...',
          onChanged: (_) => setState(() => _fieldError = null),
        ),
        const SizedBox(height: AppSpacing.sm),
        AppTextField(
          label: 'With Error',
          hint: 'Email address',
          errorText: _fieldError ?? 'Invalid email address',
          prefixIcon: const Icon(Icons.email_outlined, size: 18),
        ),
        const SizedBox(height: AppSpacing.sm),
        const AppTextField(
          label: 'Disabled Input',
          hint: 'Cannot edit',
          enabled: false,
        ),
        const SizedBox(height: AppSpacing.sm),
        const AppSearchBar(hintText: 'Search products...'),
      ],
    );
  }

  // ── 08 FILTER CHIPS ────────────────────────────────

  Widget _buildFilterChipsSection() {
    return FilterChipRow<String>(
      options: _filterOptions,
      selected: _selectedFilter,
      labelOf: (s) => s,
      onSelected: (s) => setState(() => _selectedFilter = s),
      padding: EdgeInsets.zero,
    );
  }

  // ── 09 LOADERS ─────────────────────────────────────

  Widget _buildLoadersSection(BuildContext context) {
    return Column(
      children: [
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('BrandSpinner variants',
                  style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: AppSpacing.base),
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Column(children: [
                    BrandSpinner.small(),
                    SizedBox(height: 4),
                    Text('small', style: TextStyle(fontSize: 10)),
                  ]),
                  Column(children: [
                    BrandSpinner(),
                    SizedBox(height: 4),
                    Text('default', style: TextStyle(fontSize: 10)),
                  ]),
                  Column(children: [
                    BrandSpinner.large(),
                    SizedBox(height: 4),
                    Text('large', style: TextStyle(fontSize: 10)),
                  ]),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        const ShimmerCard(height: 72),
        const SizedBox(height: AppSpacing.sm),
        const ShimmerList(itemCount: 3, itemHeight: 64),
      ],
    );
  }

  // ── 10 TOAST ───────────────────────────────────────

  Widget _buildToastSection(BuildContext context) {
    return GlassCard(
      child: Column(
        children: [
          _toastRow(context, 'Show Success Toast', ToastVariant.success),
          const SizedBox(height: AppSpacing.sm),
          _toastRow(context, 'Show Error Toast', ToastVariant.error),
          const SizedBox(height: AppSpacing.sm),
          _toastRow(context, 'Show Warning Toast', ToastVariant.warning),
          const SizedBox(height: AppSpacing.sm),
          _toastRow(context, 'Show Info Toast', ToastVariant.info),
        ],
      ),
    );
  }

  Widget _toastRow(BuildContext context, String label, ToastVariant v) {
    final color = switch (v) {
      ToastVariant.success => AppColors.success,
      ToastVariant.error => AppColors.error,
      ToastVariant.warning => AppColors.warning,
      ToastVariant.info => AppColors.info,
    };
    final msg = switch (v) {
      ToastVariant.success => 'Payment recorded successfully',
      ToastVariant.error => 'Invoice creation failed',
      ToastVariant.warning => 'Low stock: only 3 left',
      ToastVariant.info => 'Syncing data...',
    };
    return Row(
      children: [
        Container(
            width: 10, height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: AppSpacing.sm),
        Expanded(child: Text(label,
            style: Theme.of(context).textTheme.bodySmall)),
        TextButton(
          onPressed: () => AppToast.show(context, msg, variant: v),
          child: const Text('Show'),
        ),
      ],
    );
  }

  // ── 11 SHEETS ──────────────────────────────────────

  Widget _buildSheetsSection(BuildContext context) {
    return GlassCard(
      child: Column(
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Standard draggable sheet'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => showAppSheet(
              context: context,
              builder: (ctx, scroll) => SingleChildScrollView(
                controller: scroll,
                padding: const EdgeInsets.all(AppSpacing.base),
                child: Column(children: [
                  Text('Standard Sheet',
                      style: Theme.of(ctx).textTheme.titleLarge),
                  const SizedBox(height: AppSpacing.base),
                  const Text('Draggable, scrollable, blur backdrop.'),
                  const SizedBox(height: AppSpacing.xxxl),
                ]),
              ),
            ),
          ),
          const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Confirmation sheet'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () async {
              final result = await showConfirmSheet(
                context: context,
                title: 'Delete Product?',
                body: 'This action cannot be undone.',
                confirmLabel: 'Delete',
                cancelLabel: 'Cancel',
                isDestructive: true,
              );
              if (result == true && context.mounted) {
                AppToast.error(context, 'Product deleted');
              }
            },
          ),
          const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Selection sheet'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => showSelectionSheet<String>(
              context: context,
              title: 'Select Category',
              items: const ['Electronics', 'Clothing', 'Food', 'Accessories'],
              labelOf: (s) => s,
              onSelected: (s) =>
                  AppToast.success(context, 'Selected: $s'),
            ),
          ),
        ],
      ),
    );
  }

  // ── 12 DIALOGS ─────────────────────────────────────

  Widget _buildDialogsSection(BuildContext context) {
    return GlassCard(
      child: Column(
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Alert dialog'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () => showAlertDialog(
              context: context,
              title: 'Session Expired',
              message:
                  'Your session has expired. Please log in again to continue.',
              icon: Icons.lock_outline_rounded,
              iconColor: AppColors.warning,
            ),
          ),
          const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Confirm dialog (destructive)'),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () async {
              final ok = await showConfirmDialog(
                context: context,
                title: 'Log Out',
                message:
                    'Are you sure you want to log out? All unsaved data will be lost.',
                confirmLabel: 'Log Out',
                cancelLabel: 'Stay',
                isDestructive: true,
                icon: Icons.logout_rounded,
              );
              if (ok == true && context.mounted) {
                AppToast.info(context, 'Logged out');
              }
            },
          ),
        ],
      ),
    );
  }

  // ── 13 ICONS ───────────────────────────────────────

  Widget _buildIconsSection(BuildContext context, bool isDark) {
    final icons = [
      (Icons.dashboard_rounded, 'dashboard'),
      (Icons.inventory_2_rounded, 'inventory'),
      (Icons.point_of_sale_rounded, 'pos'),
      (Icons.people_rounded, 'customers'),
      (Icons.bar_chart_rounded, 'reports'),
      (Icons.notifications_rounded, 'notifs'),
      (Icons.qr_code_scanner_rounded, 'scanner'),
      (Icons.settings_rounded, 'settings'),
      (Icons.person_rounded, 'profile'),
      (Icons.access_time_rounded, 'attendance'),
      (Icons.search_rounded, 'search'),
      (Icons.add_rounded, 'add'),
      (Icons.chevron_right_rounded, 'chevron'),
      (Icons.refresh_rounded, 'refresh'),
      (Icons.share_rounded, 'share'),
      (Icons.delete_rounded, 'delete'),
    ];

    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: AppSpacing.sm,
        crossAxisSpacing: AppSpacing.sm,
      ),
      itemCount: icons.length,
      itemBuilder: (_, i) {
        final (icon, label) = icons[i];
        return GlassCard(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 28, color: AppColors.brand500),
              const SizedBox(height: 4),
              Text(
                label,
                style: Theme.of(context).textTheme.labelSmall,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        );
      },
    );
  }
}
