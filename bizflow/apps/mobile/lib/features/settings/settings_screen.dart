/// BizFlow — Settings Screen
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/spacing.dart';
import '../../core/theme/radius.dart';
import '../../shared/providers/auth_provider.dart';
import '../../shared/providers/theme_provider.dart';
import '../../shared/widgets/shared_widgets.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final themeMode = ref.watch(themeProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.pagePaddingH),
        children: [
          // User profile card
          GlassCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.brand500.withValues(alpha: 0.15),
                  child: Text(
                    (user?.name ?? 'U')[0].toUpperCase(),
                    style: const TextStyle(
                      color: AppColors.brand500,
                      fontWeight: FontWeight.w700,
                      fontSize: 18,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(user?.name ?? 'User',
                          style: Theme.of(context).textTheme.titleMedium),
                      Text(user?.email ?? '',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.lightTextSecondary,
                              )),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.brand500.withValues(alpha: 0.12),
                    borderRadius: AppRadius.radiusFull,
                  ),
                  child: Text(user?.role ?? '', style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: AppColors.brand500,
                  )),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.sectionGap),

          // Theme toggle
          _SettingsTile(
            icon: Icons.palette_rounded,
            title: 'Theme',
            subtitle: switch (themeMode) {
              ThemeMode.dark => 'Dark',
              ThemeMode.light => 'Light',
              ThemeMode.system => 'System',
            },
            trailing: SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_rounded, size: 16)),
                ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.auto_mode_rounded, size: 16)),
                ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_rounded, size: 16)),
              ],
              selected: {themeMode},
              onSelectionChanged: (v) =>
                  ref.read(themeProvider.notifier).setThemeMode(v.first),
              style: const ButtonStyle(
                visualDensity: VisualDensity.compact,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.itemGap),

          _SettingsTile(
            icon: Icons.business_rounded,
            title: 'Business',
            subtitle: user?.businessType ?? 'Not set',
            onTap: () {},
          ),

          const SizedBox(height: AppSpacing.itemGap),

          _SettingsTile(
            icon: Icons.info_outline_rounded,
            title: 'About',
            subtitle: 'Version 1.0.0',
            onTap: () {},
          ),

          const SizedBox(height: AppSpacing.sectionGap),

          // Logout
          AppButton(
            label: 'Sign Out',
            isOutlined: true,
            icon: Icons.logout_rounded,
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Sign Out?'),
                  content: const Text('You will need to sign in again.'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Sign Out'),
                    ),
                  ],
                ),
              );
              if (confirm == true) {
                ref.read(authProvider.notifier).logout();
              }
            },
          ),

          const SizedBox(height: AppSpacing.fabOffset),
        ],
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GlassCard(
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, size: 22, color: AppColors.brand500),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.bodyLarge),
                if (subtitle != null)
                  Text(subtitle!, style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  )),
              ],
            ),
          ),
          if (trailing != null) trailing!
          else if (onTap != null)
            Icon(Icons.chevron_right_rounded, color: isDark
                ? AppColors.darkTextMuted : AppColors.lightTextMuted),
        ],
      ),
    );
  }
}
