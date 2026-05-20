/// BizFlow — Product Model
library;

class Product {
  final String id;
  final String name;
  final String sku;
  final String category;
  final int stock;
  final int minStock;
  final double purchasePrice;
  final double sellingPrice;
  final String? supplier;
  final double gstRate;
  final String? hsnCode;
  final String unit;
  final DateTime createdAt;

  const Product({
    required this.id,
    required this.name,
    required this.sku,
    required this.category,
    required this.stock,
    required this.minStock,
    required this.purchasePrice,
    required this.sellingPrice,
    this.supplier,
    required this.gstRate,
    this.hsnCode,
    required this.unit,
    required this.createdAt,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as String,
        name: json['name'] as String,
        sku: json['sku'] as String,
        category: json['category'] as String,
        stock: (json['stock'] as num).toInt(),
        minStock: (json['minStock'] as num? ?? 5).toInt(),
        purchasePrice: (json['purchasePrice'] as num).toDouble(),
        sellingPrice: (json['sellingPrice'] as num).toDouble(),
        supplier: json['supplier'] as String?,
        gstRate: (json['gstRate'] as num? ?? 0).toDouble(),
        hsnCode: json['hsnCode'] as String?,
        unit: json['unit'] as String? ?? 'pcs',
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  bool get isLowStock => stock <= minStock;
  bool get isOutOfStock => stock <= 0;
  double get profit => sellingPrice - purchasePrice;
  double get margin => purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;
}
