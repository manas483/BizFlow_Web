/// BizFlow — Sale Model
library;

class Sale {
  final String id;
  final String invoiceNo;
  final String customerId;
  final double total;
  final double paid;
  final String status;
  final String? notes;
  final DateTime createdAt;
  final SaleCustomer? customer;

  const Sale({
    required this.id,
    required this.invoiceNo,
    required this.customerId,
    required this.total,
    required this.paid,
    required this.status,
    this.notes,
    required this.createdAt,
    this.customer,
  });

  factory Sale.fromJson(Map<String, dynamic> json) => Sale(
        id: json['id'] as String,
        invoiceNo: json['invoiceNo'] as String,
        customerId: json['customerId'] as String,
        total: (json['total'] as num).toDouble(),
        paid: (json['paid'] as num? ?? 0).toDouble(),
        status: (json['status'] as String).toUpperCase(),
        notes: json['notes'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        customer: json['customer'] != null
            ? SaleCustomer.fromJson(json['customer'] as Map<String, dynamic>)
            : null,
      );

  double get due => total - paid;
  bool get isPaid => status == 'PAID';
  bool get isPartial => status == 'PARTIAL';
  bool get isUnpaid => status == 'UNPAID';
}

class SaleCustomer {
  final String id;
  final String name;
  final String? phone;

  const SaleCustomer({required this.id, required this.name, this.phone});

  factory SaleCustomer.fromJson(Map<String, dynamic> json) => SaleCustomer(
        id: json['id'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String?,
      );
}
