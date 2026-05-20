/// BizFlow — Customers Screen (Live API)
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/spacing.dart';
import '../../core/network/api_client.dart';
import '../../shared/models/customer.dart';
import '../../shared/services/api_service.dart';
import '../../shared/widgets/shared_widgets.dart';

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});
  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  Timer? _debounce;
  List<Customer> _customers = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _page = 1;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() { _searchCtrl.dispose(); _scrollCtrl.dispose(); _debounce?.cancel(); super.dispose(); }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) _loadMore();
  }

  Future<void> _load({bool reset = true}) async {
    if (reset) setState(() { _isLoading = true; _error = null; _page = 1; });
    try {
      final result = await ref.read(apiServiceProvider).getCustomers(page: _page, search: _searchCtrl.text);
      if (!mounted) return;
      setState(() {
        _customers = reset ? result.items : [..._customers, ...result.items];
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

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _load());
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(title: const Text('Customers'), actions: [
        IconButton(onPressed: () {}, icon: const Icon(Icons.person_add_rounded)),
      ]),
      body: RefreshIndicator(
        color: AppColors.brand500,
        onRefresh: () => _load(),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.pagePaddingH),
              child: AppSearchBar(controller: _searchCtrl, hintText: 'Search customers...', onChanged: _onSearch),
            ),
            Expanded(
              child: _error != null && _customers.isEmpty
                  ? ErrorDisplay(message: _error!, onRetry: _load)
                  : _isLoading
                      ? const ShimmerList()
                      : _customers.isEmpty
                          ? const EmptyState(icon: Icons.people_rounded, title: 'No customers found')
                          : ListView.builder(
                              controller: _scrollCtrl,
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePaddingH),
                              itemCount: _customers.length + (_isLoadingMore ? 1 : 0),
                              itemBuilder: (ctx, i) {
                                if (i == _customers.length) return const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator(strokeWidth: 2)));
                                final c = _customers[i];
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: AppSpacing.itemGap),
                                  child: GlassCard(
                                    onTap: () {},
                                    child: Row(children: [
                                      CircleAvatar(
                                        radius: 22,
                                        backgroundColor: AppColors.brand500.withValues(alpha: 0.12),
                                        child: Text(c.initials, style: const TextStyle(color: AppColors.brand500, fontWeight: FontWeight.w700, fontSize: 16)),
                                      ),
                                      const SizedBox(width: AppSpacing.md),
                                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                        Text(c.name, style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                                        Text(c.phone, style: Theme.of(ctx).textTheme.bodySmall?.copyWith(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary)),
                                      ])),
                                      if (c.hasDues)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(color: AppColors.error.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                                          child: Text('₹${c.dues.toStringAsFixed(0)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.error)),
                                        )
                                      else
                                        Text('₹${c.totalPurchases.toStringAsFixed(0)}', style: Theme.of(ctx).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600, color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary)),
                                    ]),
                                  ),
                                );
                              },
                            ),
            ),
          ],
        ),
      ),
    );
  }
}
