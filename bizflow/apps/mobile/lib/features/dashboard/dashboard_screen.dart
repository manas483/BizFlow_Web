/// BizFlow — Dashboard Screen (Phase 4)
///
/// Spec compliance:
///  - Glassmorphic SliverAppBar (floating + snap)
///  - Role-based KPI grid (STAFF/MANAGER/ACCOUNTANT/SUPER_ADMIN/OWNER/ADMIN)
///  - Staggered KPI card animation (60ms per card)
///  - StatusBadge on sale rows
///  - PressableCard on quick actions
///  - Shimmer → data transition
///  - Tablet: 4-col KPI grid
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/radius.dart';
import '../../core/theme/spacing.dart';
import '../../core/routing/app_router.dart';
import '../../core/network/api_client.dart';
import '../../shared/models/dashboard_stats.dart';
import '../../shared/models/sale.dart';
import '../../shared/providers/auth_provider.dart';
import '../../shared/services/api_service.dart';
import '../../shared/widgets/shared_widgets.dart';
import '../../shared/widgets/pressable_card.dart';
import '../../shared/widgets/status_badge.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with TickerProviderStateMixin {
  DashboardStats? _stats;
  List<Sale> _recentSales = [];
  bool _isLoading = true;
  String? _error;

  // Stagger animation controllers — one per KPI card (max 4)
  final List<AnimationController> _kpiControllers = [];
  final List<Animation<double>> _kpiFades = [];
  final List<Animation<Offset>> _kpiSlides = [];

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  // ── Build stagger animations after KPI count is known ──
  void _setupKpiAnimations(int count) {
    // Dispose existing
    for (final c in _kpiControllers) {
      c.dispose();
    }
    _kpiControllers.clear();
    _kpiFades.clear();
    _kpiSlides.clear();

    for (int i = 0; i < count; i++) {
      final ctrl = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 250),
      );
      _kpiControllers.add(ctrl);
      _kpiFades.add(CurvedAnimation(parent: ctrl, curve: Curves.easeOut));
      _kpiSlides.add(
        Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero).animate(
          CurvedAnimation(parent: ctrl, curve: Curves.easeOutCubic),
        ),
      );
      // Stagger: 60ms per card
      Future.delayed(Duration(milliseconds: 60 * i), () {
        if (mounted) ctrl.forward();
      });
    }
  }

  Future<void> _loadDashboard() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final results = await Future.wait([
        api.getDashboardStats(),
        api.getSales(page: 1, limit: 5),
      ]);
      if (!mounted) return;
      final stats = results[0] as DashboardStats;
      final sales = (results[1] as dynamic).items as List<Sale>;
      setState(() {
        _stats = stats;
        _recentSales = sales;
        _isLoading = false;
      });
      // Trigger stagger animations
      final kpiCount = _kpiCardsFor(ref.read(authProvider).user?.role).length;
      _setupKpiAnimations(kpiCount);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = parseError(e).message;
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    for (final c in _kpiControllers) {
      c.dispose();
    }
    super.dispose();
  }

  // ── Role-based KPI card definitions ────────────────
  List<_KpiCardData> _kpiCardsFor(String? role) {
    final stats = _stats;

    final revenueCard = _KpiCardData(
      title: 'Revenue Today',
      value: _fmt(stats?.revenue ?? 0),
      icon: Icons.trending_up_rounded,
      iconColor: AppColors.success,
      delta: _fmtDelta(stats?.changes.revenue ?? 0),
    );
    final salesCard = _KpiCardData(
      title: 'Active Sales',
      value: '${stats?.salesCount ?? 0}',
      icon: Icons.receipt_long_rounded,
      iconColor: AppColors.info,
      delta: _fmtDelta(stats?.changes.sales ?? 0),
    );
    final duesCard = _KpiCardData(
      title: 'Dues',
      value: _fmt(stats?.dues ?? 0),
      icon: Icons.account_balance_wallet_rounded,
      iconColor: AppColors.warning,
      delta: null,
    );
    final stockCard = _KpiCardData(
      title: 'Low Stock',
      value: '${stats?.lowStockCount ?? 0}',
      icon: Icons.inventory_2_rounded,
      iconColor: stats?.lowStockCount != null && stats!.lowStockCount > 0
          ? AppColors.error
          : AppColors.success,
      delta: null,
    );
    final customersCard = _KpiCardData(
      title: 'Customers',
      value: '${stats?.customerCount ?? 0}',
      icon: Icons.people_rounded,
      iconColor: AppColors.brand400,
      delta: _fmtDelta(stats?.changes.customers ?? 0),
    );
    final expensesCard = _KpiCardData(
      title: 'Expenses',
      value: _fmt(stats?.expenses ?? 0),
      icon: Icons.trending_down_rounded,
      iconColor: AppColors.error,
      delta: _fmtDelta(stats?.changes.expenses ?? 0),
    );

    switch (role) {
      case 'STAFF':
      case 'EMPLOYEE':
        // Staff: inventory + quick scan only — no financials
        return [salesCard, stockCard];
      case 'ACCOUNTANT':
        // Accountant: financials + dues
        return [revenueCard, expensesCard, duesCard, stockCard];
      case 'MANAGER':
        return [revenueCard, salesCard, duesCard, customersCard];
      case 'ADMIN':
      case 'OWNER':
      case 'SUPER_ADMIN':
      default:
        // Full view
        return [revenueCard, salesCard, duesCard, stockCard];
    }
  }

  // ── Greeting ───────────────────────────────────────
  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }

  // ── Formatters ─────────────────────────────────────
  String _fmt(double v) {
    if (v >= 10000000) return '₹${(v / 10000000).toStringAsFixed(1)}Cr';
    if (v >= 100000) return '₹${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '₹${(v / 1000).toStringAsFixed(1)}K';
    return '₹${v.toStringAsFixed(0)}';
  }

  String _fmtDelta(double d) {
    if (d > 0) return '+${d.toStringAsFixed(1)}%';
    if (d < 0) return '${d.toStringAsFixed(1)}%';
    return '0%';
  }

  // ── Role badge label ───────────────────────────────
  String _roleBadgeLabel(String? role) => switch (role) {
        'SUPER_ADMIN' => '⚡ Super Admin',
        'ADMIN' => 'Admin',
        'OWNER' => 'Owner',
        'MANAGER' => 'Manager',
        'ACCOUNTANT' => 'Accountant',
        'STAFF' => 'Staff',
        _ => 'Employee',
      };

  // ── Whether user can see financials ───────────────
  bool _canSeeFinancials(String? role) =>
      role == 'ADMIN' ||
      role == 'OWNER' ||
      role == 'SUPER_ADMIN' ||
      role == 'MANAGER' ||
      role == 'ACCOUNTANT';

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final kpiCards = _kpiCardsFor(user?.role);
    final width = MediaQuery.of(context).size.width;
    final isTablet = width >= 600;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: const Alignment(0, -0.4),
            colors: [
              AppColors.brand500.withValues(alpha: isDark ? 0.15 : 0.08),
              AppColors.brand500.withValues(alpha: 0.0),
            ],
          ),
        ),
        child: RefreshIndicator(
          color: AppColors.brand500,
          onRefresh: _loadDashboard,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // ── Glassmorphic SliverAppBar ─────────────
              SliverAppBar(
                floating: true,
                snap: true,
                toolbarHeight: 68,
                backgroundColor: Colors.transparent,
                surfaceTintColor: Colors.transparent,
              title: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Good $_greeting',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.lightTextSecondary,
                              ),
                        ),
                        Text(
                          user?.name ?? 'User',
                          style: Theme.of(context)
                              .textTheme
                              .titleLarge
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              actions: [
                // Role badge
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm, vertical: 4),
                  margin: const EdgeInsets.only(right: AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: AppColors.brand500.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                    border: Border.all(
                      color: AppColors.brand500.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Text(
                    _roleBadgeLabel(user?.role),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.brand500,
                    ),
                  ),
                ),
                // Notification bell
                Stack(
                  children: [
                    IconButton(
                      onPressed: () {},
                      icon: const Icon(Icons.notifications_rounded),
                    ),
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                            color: AppColors.error, shape: BoxShape.circle),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 4),
              ],
            ),

            // ── Error state ───────────────────────────
            if (_error != null && !_isLoading)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.pagePaddingH),
                  child: ErrorDisplay(
                      message: _error!, onRetry: _loadDashboard),
                ),
              ),

            // ── KPI Cards ─────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.pagePaddingH,
                AppSpacing.md,
                AppSpacing.pagePaddingH,
                0,
              ),
              sliver: SliverGrid.count(
                // Tablet: 4 cols, phone: 2 cols
                crossAxisCount: isTablet ? 4 : 2,
                mainAxisSpacing: AppSpacing.itemGap,
                crossAxisSpacing: AppSpacing.itemGap,
                childAspectRatio: isTablet ? 1.15 : 1.3,
                children: _isLoading
                    ? List.generate(
                        4,
                        (_) => const ShimmerCard(height: 120),
                      )
                    : List.generate(kpiCards.length, (i) {
                        final card = kpiCards[i];
                        final hasFade = i < _kpiFades.length;
                        final kpi = KpiCard(
                          title: card.title,
                          value: card.value,
                          icon: card.icon,
                          iconColor: card.iconColor,
                          subtitle: card.delta,
                        );
                        if (!hasFade) return kpi;
                        return FadeTransition(
                          opacity: _kpiFades[i],
                          child: SlideTransition(
                            position: _kpiSlides[i],
                            child: kpi,
                          ),
                        );
                      }),
              ),
            ),

            // ── Quick Actions ─────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.pagePaddingH,
                  AppSpacing.sectionGap,
                  AppSpacing.pagePaddingH,
                  0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SectionHeader(title: 'Quick Actions'),
                    const SizedBox(height: AppSpacing.md),
                    Row(
                      children: [
                        _QuickAction(
                          icon: Icons.qr_code_scanner_rounded,
                          label: 'Scan',
                          color: AppColors.brand500,
                          onTap: () {},
                        ),
                        const SizedBox(width: AppSpacing.itemGap),
                        _QuickAction(
                          icon: Icons.receipt_long_rounded,
                          label: 'New Sale',
                          color: AppColors.success,
                          onTap: () => context.go(Routes.sales),
                        ),
                        const SizedBox(width: AppSpacing.itemGap),
                        _QuickAction(
                          icon: Icons.add_box_rounded,
                          label: 'Inventory',
                          color: AppColors.info,
                          onTap: () => context.go(Routes.inventory),
                        ),
                        const SizedBox(width: AppSpacing.itemGap),
                        _QuickAction(
                          icon: Icons.person_add_rounded,
                          label: 'Customer',
                          color: AppColors.warning,
                          onTap: () => context.go(Routes.customers),
                        ),
                      ].map((e) => Expanded(child: e)).toList(),
                    ),
                  ],
                ),
              ),
            ),

            // ── Recent Sales section header ────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.pagePaddingH,
                  AppSpacing.sectionGap,
                  AppSpacing.pagePaddingH,
                  AppSpacing.md,
                ),
                child: SectionHeader(
                  title: 'Recent Sales',
                  actionLabel: _canSeeFinancials(user?.role) ? 'See All' : null,
                  onAction: _canSeeFinancials(user?.role)
                      ? () => context.go(Routes.sales)
                      : null,
                ),
              ),
            ),

            // ── Recent Sales list ─────────────────────
            if (_isLoading)
              SliverPadding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.pagePaddingH),
                sliver: SliverList.builder(
                  itemCount: 3,
                  itemBuilder: (_, __) => const Padding(
                    padding: EdgeInsets.only(bottom: AppSpacing.itemGap),
                    child: ShimmerCard(height: 72),
                  ),
                ),
              )
            else if (_recentSales.isEmpty)
              const SliverToBoxAdapter(
                child: EmptyState(
                  icon: Icons.receipt_long_rounded,
                  title: 'No recent sales',
                  subtitle: 'Create your first invoice to see it here',
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.pagePaddingH),
                sliver: SliverList.builder(
                  itemCount: _recentSales.length,
                  itemBuilder: (_, i) => _SaleRow(sale: _recentSales[i]),
                ),
              ),

            const SliverToBoxAdapter(
              child: SizedBox(height: AppSpacing.fabOffset),
            ),
          ],
        ),
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  KPI CARD DATA MODEL
// ══════════════════════════════════════════════════════

class _KpiCardData {
  final String title;
  final String value;
  final IconData icon;
  final Color iconColor;
  final String? delta;

  const _KpiCardData({
    required this.title,
    required this.value,
    required this.icon,
    required this.iconColor,
    this.delta,
  });
}

// ══════════════════════════════════════════════════════
//  QUICK ACTION BUTTON
// ══════════════════════════════════════════════════════

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PressableCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
          vertical: AppSpacing.md, horizontal: AppSpacing.sm),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.lightTextSecondary,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  SALE LIST ROW
// ══════════════════════════════════════════════════════

class _SaleRow extends StatelessWidget {
  final Sale sale;

  const _SaleRow({required this.sale});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusColor = switch (sale.status) {
      'PAID' => AppColors.success,
      'PARTIAL' => AppColors.warning,
      _ => AppColors.error,
    };
    final badge = switch (sale.status) {
      'PAID' => StatusBadge.success(label: sale.status),
      'PARTIAL' => StatusBadge.warning(label: sale.status),
      _ => StatusBadge.error(label: sale.status),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.itemGap),
      child: GlassCard(
        child: Row(
          children: [
            // Status icon container
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Icon(Icons.receipt_rounded, size: 18, color: statusColor),
            ),
            const SizedBox(width: AppSpacing.md),
            // Invoice + customer
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sale.invoiceNo,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  Text(
                    sale.customer?.name ?? 'Walk-in',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.lightTextSecondary,
                        ),
                  ),
                ],
              ),
            ),
            // Amount + StatusBadge
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '₹${sale.total.toStringAsFixed(0)}',
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                badge,
              ],
            ),
          ],
        ),
      ),
    );
  }
}
