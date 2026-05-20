/// BizFlow — Customer Model
library;

class Customer {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String? city;
  final double dues;
  final double totalPurchases;
  final String status;
  final String? address;
  final String? gstNumber;
  final String? state;
  final DateTime createdAt;

  const Customer({
    required this.id,
    required this.name,
    required this.phone,
    this.email,
    this.city,
    required this.dues,
    required this.totalPurchases,
    required this.status,
    this.address,
    this.gstNumber,
    this.state,
    required this.createdAt,
  });

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: json['id'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String,
        email: json['email'] as String?,
        city: json['city'] as String?,
        dues: (json['dues'] as num? ?? 0).toDouble(),
        totalPurchases: (json['totalPurchases'] as num? ?? 0).toDouble(),
        status: json['status'] as String? ?? 'active',
        address: json['address'] as String?,
        gstNumber: json['gstNumber'] as String?,
        state: json['state'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  bool get hasDues => dues > 0;
  String get initials => name.isNotEmpty ? name[0].toUpperCase() : '?';
}
