/// BizFlow — User Model
///
/// Matches the user object returned by POST /api/v1/auth/token
library;

import 'dart:convert';

class User {
  final String id;
  final String email;
  final String name;
  final String role;
  final String businessId;
  final String? businessType;
  final List<String> permissions;

  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    required this.businessId,
    this.businessType,
    this.permissions = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      role: json['role']?.toString() ?? 'EMPLOYEE',
      businessId: json['businessId']?.toString() ?? '',
      businessType: json['businessType']?.toString(),
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'role': role,
        'businessId': businessId,
        'businessType': businessType,
        'permissions': permissions,
      };

  String toJsonString() => jsonEncode(toJson());

  factory User.fromJsonString(String jsonString) =>
      User.fromJson(jsonDecode(jsonString) as Map<String, dynamic>);

  /// Check if user has a specific permission
  bool hasPermission(String permission) => permissions.contains(permission);

  /// Check if user is an admin/owner
  bool get isAdmin => role == 'ADMIN' || role == 'OWNER';

  @override
  String toString() => 'User(id: $id, name: $name, role: $role)';
}
