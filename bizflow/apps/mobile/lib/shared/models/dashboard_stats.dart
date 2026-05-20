/// BizFlow — Dashboard Stats Model (Phase 4 upgrade)
///
/// Added: dues, lowStockCount for role-aware KPI cards.
library;

class DashboardStats {
  final double revenue;
  final int salesCount;
  final int customerCount;
  final double expenses;
  final double dues;
  final int lowStockCount;
  final DashboardChanges changes;

  const DashboardStats({
    required this.revenue,
    required this.salesCount,
    required this.customerCount,
    required this.expenses,
    this.dues = 0,
    this.lowStockCount = 0,
    required this.changes,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) => DashboardStats(
        revenue: (json['revenue'] as num? ?? 0).toDouble(),
        salesCount: (json['salesCount'] as num? ?? 0).toInt(),
        customerCount: (json['customerCount'] as num? ?? 0).toInt(),
        expenses: (json['expenses'] as num? ?? 0).toDouble(),
        dues: (json['dues'] as num? ?? 0).toDouble(),
        lowStockCount: (json['lowStockCount'] as num? ?? 0).toInt(),
        changes: DashboardChanges.fromJson(
            (json['changes'] as Map?)?.cast<String, dynamic>() ?? {}),
      );

  double get profit => revenue - expenses;
}

class DashboardChanges {
  final double revenue;
  final double sales;
  final double expenses;
  final double customers;

  const DashboardChanges({
    required this.revenue,
    required this.sales,
    required this.expenses,
    required this.customers,
  });

  factory DashboardChanges.fromJson(Map<String, dynamic> json) =>
      DashboardChanges(
        revenue: (json['revenue'] as num? ?? 0).toDouble(),
        sales: (json['sales'] as num? ?? 0).toDouble(),
        expenses: (json['expenses'] as num? ?? 0).toDouble(),
        customers: (json['customers'] as num? ?? 0).toDouble(),
      );
}
