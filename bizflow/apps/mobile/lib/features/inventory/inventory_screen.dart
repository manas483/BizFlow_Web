/// BizFlow — Inventory Screen (Phase 5)
///
/// Spec compliance:
///  - AppSearchBar (300ms debounce)
///  - FilterChipRow: All | Low Stock | Out of Stock | [category chips]
///  - Paginated list with PressableCard rows
///  - StockBadge + StatusBadge.brand category chip
///  - BrandSpinner for load-more (not CircularProgressIndicator)
///  - Product Detail 92% DraggableScrollableSheet:
///      stock progress bar, price/margin, adjust stock sub-sheet
///  - Hero animation from list → sheet icon
///  - Tablet: 2-column grid
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/colors.dart';
import '../../core/theme/radius.dart';
import '../../core/theme/spacing.dart';
import '../../core/network/api_client.dart';
import '../../shared/models/product.dart';
import '../../shared/services/api_service.dart';
import '../../shared/widgets/shared_widgets.dart';
import '../../shared/widgets/scanner_screen.dart';
import '../../shared/widgets/brand_spinner.dart';
import '../../shared/widgets/filter_chip_row.dart';
import '../../shared/widgets/pressable_card.dart';
import '../../shared/widgets/status_badge.dart';
import '../../shared/widgets/app_bottom_sheet.dart';
import '../../shared/widgets/app_toast.dart';
import '../../shared/widgets/app_text_field.dart';

// ══════════════════════════════════════════════════════
//  FILTER ENUM
// ══════════════════════════════════════════════════════

enum _StockFilter { all, lowStock, outOfStock }

extension _StockFilterLabel on _StockFilter {
  String get label => switch (this) {
        _StockFilter.all => 'All',
        _StockFilter.lowStock => 'Low Stock',
        _StockFilter.outOfStock => 'Out of Stock',
      };
}

// ══════════════════════════════════════════════════════
//  INVENTORY SCREEN
// ══════════════════════════════════════════════════════

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  final _searchCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  Timer? _debounce;

  List<Product> _products = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  int _page = 1;
  String? _error;
  _StockFilter _filter = _StockFilter.all;

  static const _filters = _StockFilter.values;

  @override
  void initState() {
    super.initState();
    _loadProducts();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _loadProducts({bool reset = true}) async {
    if (reset) {
      setState(() {
        _isLoading = true;
        _error = null;
        _page = 1;
      });
    }
    try {
      final api = ref.read(apiServiceProvider);
      final result = await api.getProducts(
        page: _page,
        search: _searchCtrl.text,
        lowStock: _filter == _StockFilter.lowStock,
      );
      if (!mounted) return;
      // Client-side out-of-stock filter (API may not support it)
      var items = result.items;
      if (_filter == _StockFilter.outOfStock) {
        items = items.where((p) => p.isOutOfStock).toList();
      }
      setState(() {
        if (reset) {
          _products = items;
        } else {
          _products.addAll(items);
        }
        _hasMore = result.hasMore;
        _isLoading = false;
        _isLoadingMore = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = parseError(e).message;
        _isLoading = false;
        _isLoadingMore = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (_isLoadingMore || !_hasMore) return;
    setState(() => _isLoadingMore = true);
    _page++;
    await _loadProducts(reset: false);
  }

  void _onSearch(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _loadProducts);
  }

  void _onFilterChange(_StockFilter f) {
    setState(() => _filter = f);
    _loadProducts();
  }

  void _openScanner() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ScannerScreen(
          title: 'Scan Product',
          onDetect: (code) {
            Navigator.pop(context);
            _searchCtrl.text = code;
            _loadProducts();
          },
        ),
      ),
    );
  }

  void _openDetail(Product product) {
    showAppSheet(
      context: context,
      initialSize: 0.65,
      maxSize: 0.92,
      builder: (ctx, scroll) => _ProductDetailSheet(
        product: product,
        scrollController: scroll,
        onStockAdjusted: (updated) {
          setState(() {
            final idx = _products.indexWhere((p) => p.id == updated.id);
            if (idx != -1) _products[idx] = updated;
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isTablet = width >= 600;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          IconButton(
            onPressed: _openScanner,
            icon: const Icon(Icons.qr_code_scanner_rounded),
            tooltip: 'Scan Barcode',
          ),
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.add_rounded),
            tooltip: 'Add Product',
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.brand500,
        onRefresh: _loadProducts,
        child: Column(
          children: [
            // ── Search ──────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.pagePaddingH,
                AppSpacing.pagePaddingV,
                AppSpacing.pagePaddingH,
                AppSpacing.sm,
              ),
              child: AppSearchBar(
                controller: _searchCtrl,
                hintText: 'Search products...',
                onChanged: _onSearch,
              ),
            ),

            // ── Filter chips ────────────────────────────
            FilterChipRow<_StockFilter>(
              options: _filters,
              selected: _filter,
              labelOf: (f) => f.label,
              onSelected: _onFilterChange,
            ),

            const SizedBox(height: AppSpacing.sm),

            // ── List / Grid ─────────────────────────────
            Expanded(
              child: _error != null && _products.isEmpty
                  ? ErrorDisplay(
                      message: _error!, onRetry: _loadProducts)
                  : _isLoading
                      ? ShimmerList(
                          itemCount: isTablet ? 6 : 8, itemHeight: 76)
                      : _products.isEmpty
                          ? EmptyState(
                              icon: Icons.inventory_2_rounded,
                              title: _searchCtrl.text.isNotEmpty
                                  ? 'No results for "${_searchCtrl.text}"'
                                  : 'No products found',
                              subtitle: _searchCtrl.text.isNotEmpty
                                  ? 'Try a different search term'
                                  : 'Add your first product to get started',
                            )
                          : isTablet
                              ? _buildTabletGrid()
                              : _buildPhoneList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhoneList() {
    return ListView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.pagePaddingH),
      itemCount: _products.length + (_isLoadingMore ? 1 : 0),
      itemBuilder: (_, i) {
        if (i == _products.length) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.lg),
            child: Center(child: BrandSpinner()),
          );
        }
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.itemGap),
          child: _ProductTile(
            product: _products[i],
            onTap: () => _openDetail(_products[i]),
          ),
        );
      },
    );
  }

  Widget _buildTabletGrid() {
    return GridView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.pagePaddingH),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: AppSpacing.itemGap,
        crossAxisSpacing: AppSpacing.itemGap,
        childAspectRatio: 2.6,
      ),
      itemCount: _products.length + (_isLoadingMore ? 1 : 0),
      itemBuilder: (_, i) {
        if (i == _products.length) {
          return const Center(child: BrandSpinner());
        }
        return _ProductTile(
          product: _products[i],
          onTap: () => _openDetail(_products[i]),
        );
      },
    );
  }
}

// ══════════════════════════════════════════════════════
//  PRODUCT TILE
// ══════════════════════════════════════════════════════

class _ProductTile extends StatelessWidget {
  final Product product;
  final VoidCallback onTap;

  const _ProductTile({required this.product, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PressableCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.base,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          // Hero stock icon container
          Hero(
            tag: 'product-icon-${product.id}',
            child: _StockIcon(product: product),
          ),
          const SizedBox(width: AppSpacing.md),

          // Name + SKU + category
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    Text(
                      product.sku,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isDark
                                ? AppColors.darkTextMuted
                                : AppColors.lightTextMuted,
                          ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    StatusBadge.brand(label: product.category),
                  ],
                ),
              ],
            ),
          ),

          // Price + stock badge
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${product.sellingPrice.toStringAsFixed(0)}',
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 3),
              StockBadge(
                  quantity: product.stock,
                  lowStockThreshold: product.minStock),
            ],
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  STOCK ICON (also used in Detail sheet via Hero)
// ══════════════════════════════════════════════════════

class _StockIcon extends StatelessWidget {
  final Product product;

  const _StockIcon({required this.product});

  Color get _color {
    if (product.isOutOfStock) return AppColors.stockOut;
    if (product.isLowStock) return AppColors.stockLow;
    if (product.stock <= product.minStock * 2) return AppColors.stockMedium;
    return AppColors.stockHigh;
  }

  @override
  Widget build(BuildContext context) {
    final color = _color;
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadius.sm),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '${product.stock}',
            style: TextStyle(
                fontSize: 15, fontWeight: FontWeight.w700, color: color),
          ),
          Text(
            product.unit,
            style: TextStyle(
                fontSize: 8, color: color, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  PRODUCT DETAIL BOTTOM SHEET
// ══════════════════════════════════════════════════════

class _ProductDetailSheet extends ConsumerStatefulWidget {
  final Product product;
  final ScrollController scrollController;
  final ValueChanged<Product> onStockAdjusted;

  const _ProductDetailSheet({
    required this.product,
    required this.scrollController,
    required this.onStockAdjusted,
  });

  @override
  ConsumerState<_ProductDetailSheet> createState() =>
      _ProductDetailSheetState();
}

class _ProductDetailSheetState extends ConsumerState<_ProductDetailSheet> {
  late Product _product;
  bool _isAdjusting = false;

  @override
  void initState() {
    super.initState();
    _product = widget.product;
  }

  void _openAdjustStock() {
    showAppSheet(
      context: context,
      initialSize: 0.45,
      maxSize: 0.6,
      builder: (ctx, scroll) => _AdjustStockSheet(
        product: _product,
        onConfirm: (adjustment, reason) async {
          Navigator.of(ctx).pop();
          setState(() => _isAdjusting = true);
          try {
            final updated = await ref.read(apiServiceProvider).adjustStock(
                  _product.id,
                  adjustment: adjustment,
                  reason: reason,
                );
            if (!mounted) return;
            setState(() {
              _product = updated;
              _isAdjusting = false;
            });
            widget.onStockAdjusted(updated);
            if (mounted) AppToast.success(context, 'Stock updated');
          } catch (e) {
            if (!mounted) return;
            setState(() => _isAdjusting = false);
            AppToast.error(context, parseError(e).message);
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final stockMax = (_product.stock * 1.5).clamp(1, 9999).toDouble();
    final stockProgress =
        (_product.stock / stockMax).clamp(0.0, 1.0);
    final stockColor = _product.isOutOfStock
        ? AppColors.stockOut
        : _product.isLowStock
            ? AppColors.stockLow
            : AppColors.stockHigh;

    return SingleChildScrollView(
      controller: widget.scrollController,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.base,
        0,
        AppSpacing.base,
        AppSpacing.mega,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header: Hero icon + name ─────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Hero(
                tag: 'product-icon-${_product.id}',
                child: _StockIcon(product: _product),
              ),
              const SizedBox(width: AppSpacing.base),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _product.name,
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Wrap(
                      spacing: AppSpacing.sm,
                      children: [
                        StatusBadge(
                          label: _product.sku,
                          variant: BadgeVariant.neutral,
                        ),
                        StatusBadge.brand(label: _product.category),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.xl),

          // ── Stock level progress bar ─────────────────
          Text(
            'Stock Level',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.lightTextSecondary,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: AppRadius.radiusFull,
                  child: LinearProgressIndicator(
                    value: stockProgress,
                    backgroundColor: isDark
                        ? AppColors.darkSurface2
                        : AppColors.lightSurface2,
                    valueColor:
                        AlwaysStoppedAnimation<Color>(stockColor),
                    minHeight: 8,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              _isAdjusting
                  ? const BrandSpinner.small()
                  : Text(
                      '${_product.stock} ${_product.unit}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: stockColor,
                          ),
                    ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Min stock: ${_product.minStock} ${_product.unit}',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: isDark
                      ? AppColors.darkTextMuted
                      : AppColors.lightTextMuted,
                ),
          ),

          const SizedBox(height: AppSpacing.xl),

          // ── Price / Margin ───────────────────────────
          Text(
            'Pricing',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : AppColors.lightTextSecondary,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                  child: _PriceTile(
                label: 'Cost',
                value: '₹${_product.purchasePrice.toStringAsFixed(2)}',
                color: AppColors.error,
              )),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                  child: _PriceTile(
                label: 'Selling',
                value: '₹${_product.sellingPrice.toStringAsFixed(2)}',
                color: AppColors.success,
              )),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                  child: _PriceTile(
                label: 'Margin',
                value: '${_product.margin.toStringAsFixed(1)}%',
                color: _product.margin > 0
                    ? AppColors.info
                    : AppColors.error,
              )),
            ],
          ),

          // ── GST + HSN ────────────────────────────────
          if (_product.hsnCode != null || _product.gstRate > 0) ...[
            const SizedBox(height: AppSpacing.base),
            Row(
              children: [
                if (_product.hsnCode != null)
                  StatusBadge(
                      label: 'HSN: ${_product.hsnCode}',
                      variant: BadgeVariant.neutral),
                if (_product.hsnCode != null && _product.gstRate > 0)
                  const SizedBox(width: AppSpacing.sm),
                if (_product.gstRate > 0)
                  StatusBadge(
                      label: 'GST ${_product.gstRate.toStringAsFixed(0)}%',
                      variant: BadgeVariant.info),
              ],
            ),
          ],

          const SizedBox(height: AppSpacing.xxl),

          // ── Actions ──────────────────────────────────
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.edit_rounded, size: 16),
                  label: const Text('Edit'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(AppSpacing.huge),
                    shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.button),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                flex: 2,
                child: FilledButton.icon(
                  onPressed: _isAdjusting ? null : _openAdjustStock,
                  icon: const Icon(Icons.tune_rounded, size: 16),
                  label: const Text('Adjust Stock'),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.brand500,
                    minimumSize: const Size.fromHeight(AppSpacing.huge),
                    shape: RoundedRectangleBorder(
                        borderRadius: AppRadius.button),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  PRICE TILE
// ══════════════════════════════════════════════════════

class _PriceTile extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _PriceTile(
      {required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm, vertical: AppSpacing.md),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? AppColors.darkTextMuted
                  : AppColors.lightTextMuted,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
                fontSize: 13, fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}

// ══════════════════════════════════════════════════════
//  ADJUST STOCK SUB-SHEET
// ══════════════════════════════════════════════════════

class _AdjustStockSheet extends StatefulWidget {
  final Product product;
  final void Function(int adjustment, String reason) onConfirm;

  const _AdjustStockSheet(
      {required this.product, required this.onConfirm});

  @override
  State<_AdjustStockSheet> createState() => _AdjustStockSheetState();
}

class _AdjustStockSheetState extends State<_AdjustStockSheet> {
  int _adjustment = 0;
  final _reasonCtrl = TextEditingController();

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final newStock = widget.product.stock + _adjustment;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.base,
        0,
        AppSpacing.base,
        MediaQuery.of(context).viewInsets.bottom + AppSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Adjust Stock',
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Current: ${widget.product.stock} ${widget.product.unit}  →  New: $newStock',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.darkTextSecondary,
                ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // +/- stepper
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _StepButton(
                icon: Icons.remove_rounded,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _adjustment--);
                },
              ),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 150),
                transitionBuilder: (child, anim) => ScaleTransition(
                  scale: anim,
                  child: child,
                ),
                child: Text(
                  _adjustment >= 0 ? '+$_adjustment' : '$_adjustment',
                  key: ValueKey(_adjustment),
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: _adjustment > 0
                            ? AppColors.success
                            : _adjustment < 0
                                ? AppColors.error
                                : null,
                      ),
                  textAlign: TextAlign.center,
                ),
              ),
              _StepButton(
                icon: Icons.add_rounded,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _adjustment++);
                },
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.base),

          AppTextField(
            controller: _reasonCtrl,
            label: 'Reason',
            hint: 'e.g. Stock received, damaged, correction...',
            textInputAction: TextInputAction.done,
          ),

          const SizedBox(height: AppSpacing.base),

          SizedBox(
            width: double.infinity,
            height: AppSpacing.huge,
            child: FilledButton(
              onPressed: _adjustment == 0
                  ? null
                  : () => widget.onConfirm(
                      _adjustment, _reasonCtrl.text.trim()),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.brand500,
                shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.button),
              ),
              child: Text(_adjustment == 0
                  ? 'No change'
                  : 'Apply ${_adjustment > 0 ? "+$_adjustment" : "$_adjustment"}'),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _StepButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 52,
        height: 52,
        margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
        decoration: BoxDecoration(
          color: AppColors.brand500.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
              color: AppColors.brand500.withValues(alpha: 0.25)),
        ),
        child: Icon(icon, size: 24, color: AppColors.brand500),
      ),
    );
  }
}
