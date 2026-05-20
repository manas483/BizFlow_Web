/// BizFlow — Sales Screen (Live API)
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/spacing.dart';
import '../../core/network/api_client.dart';
import '../../shared/models/sale.dart';
import '../../shared/services/api_service.dart';
import '../../shared/widgets/shared_widgets.dart';

class SalesScreen extends ConsumerStatefulWidget {
  const SalesScreen({super.key});
  @override
  ConsumerState<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends ConsumerState<SalesScreen> {
  final _scrollCtrl = ScrollController();
  List<Sale> _sales = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _page = 1;
  String? _error;
  String? _statusFilter;

  @override
  void initState() {
    super.initState();
    _load();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() { _scrollCtrl.dispose(); super.dispose(); }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) _loadMore();
  }

  Future<void> _load({bool reset = true}) async {
    if (reset) setState(() { _isLoading = true; _error = null; _page = 1; });
    try {
      final result = await ref.read(apiServiceProvider).getSales(page: _page, status: _statusFilter);
      if (!mounted) return;
      setState(() {
        _sales = reset ? result.items : [..._sales, ...result.items];
        _hasMore = result.hasMore;
        _isLoading = false;
        _isLoadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = parseError(e).message; _isLoading = false; _isLoadingMore = false; });
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMore) return;
    setState(() => _isLoadingMore = true);
    _page++;
    await _load(reset: false);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(title: const Text('Sales'), actions: [
        IconButton(onPressed: () {}, icon: const Icon(Icons.add_rounded)),
      ]),
      body: RefreshIndicator(
        color: AppColors.brand500,
        onRefresh: () => _load(),
        child: Column(
          children: [
            // Status filter chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePaddingH, vertical: AppSpacing.sm),
              child: Row(
                children: [null, 'PAID', 'PARTIAL', 'UNPAID'].map((status) {
                  final isSelected = _statusFilter == status;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      selected: isSelected,
                      label: Text(status ?? 'All'),
                      onSelected: (_) { setState(() => _statusFilter = status); _load(); },
                    ),
                  );
                }).toList(),
              ),
            ),
            Expanded(
              child: _error != null && _sales.isEmpty
                  ? ErrorDisplay(message: _error!, onRetry: _load)
                  : _isLoading
                      ? const ShimmerList()
                      : _sales.isEmpty
                          ? const EmptyState(icon: Icons.receipt_long_rounded, title: 'No sales found')
                          : ListView.builder(
                              controller: _scrollCtrl,
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePaddingH),
                              itemCount: _sales.length + (_isLoadingMore ? 1 : 0),
                              itemBuilder: (ctx, i) {
                                if (i == _sales.length) return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(strokeWidth: 2)));
                                final sale = _sales[i];
                                final statusColor = switch (sale.status) { 'PAID' => AppColors.success, 'PARTIAL' => AppColors.warning, _ => AppColors.error };
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: AppSpacing.itemGap),
                                  child: GlassCard(
                                    onTap: () {},
                                    child: Row(children: [
                                      Container(
                                        width: 44, height: 44,
                                        decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                                        child: Icon(Icons.receipt_rounded, size: 18, color: statusColor),
                                      ),
                                      const SizedBox(width: AppSpacing.md),
                                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text(sale.invoiceNo, style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                                        Text(sale.customer?.name ?? 'Walk-in', style: Theme.of(ctx).textTheme.bodySmall?.copyWith(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary)),
                                      ])),
                                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                        Text('₹${sale.total.toStringAsFixed(0)}', style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                                          child: Text(sale.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusColor)),
                                        ),
                                      ]),
                                    ]),
                                  ),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.qr_code_scanner_rounded)),
    );
  }
}
