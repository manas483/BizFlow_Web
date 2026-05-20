/// BizFlow — API Service
///
/// Single service for all business API calls.
/// Uses Dio client with auth interceptor from core/network.
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_constants.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_response.dart';
import '../models/dashboard_stats.dart';
import '../models/product.dart';
import '../models/sale.dart';
import '../models/customer.dart';

final apiServiceProvider = Provider<ApiService>((ref) {
  return ApiService(ref.read(dioProvider));
});

class ApiService {
  final Dio _dio;
  ApiService(this._dio);

  // ══════════════════════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════════════════════

  Future<DashboardStats> getDashboardStats() async {
    final res = await _dio.get(AppConstants.dashboard);
    return DashboardStats.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  // ══════════════════════════════════════════════════════
  //  PRODUCTS
  // ══════════════════════════════════════════════════════

  Future<PaginatedResponse<Product>> getProducts({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    bool lowStock = false,
    String sortBy = 'createdAt',
    String sortDir = 'desc',
  }) async {
    final res = await _dio.get(AppConstants.products, queryParameters: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (category != null && category.isNotEmpty) 'category': category,
      if (lowStock) 'lowStock': 'true',
      'sortBy': sortBy,
      'sortDir': sortDir,
    });
    final data = res.data;
    final items = (data['data'] as List)
        .map((e) => Product.fromJson(e as Map<String, dynamic>))
        .toList();
    final pagination = data['pagination'] as Map<String, dynamic>?;
    return PaginatedResponse(
      items: items,
      total: (pagination?['total'] as num?)?.toInt() ?? items.length,
      page: (pagination?['page'] as num?)?.toInt() ?? page,
      pageSize: (pagination?['limit'] as num?)?.toInt() ?? limit,
      hasMore: pagination?['hasNext'] as bool? ?? false,
    );
  }

  Future<Product?> getProductBySku(String sku) async {
    try {
      final res = await _dio.get(AppConstants.products,
          queryParameters: {'sku': sku});
      if (res.data['success'] == true && res.data['data'] != null) {
        return Product.fromJson(res.data['data'] as Map<String, dynamic>);
      }
      return null;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  /// Adjusts stock for a product (positive = add, negative = remove).
  /// Rule 13: PATCH is idempotent — safe to retry.
  Future<Product> adjustStock(
    String productId, {
    required int adjustment,
    required String reason,
  }) async {
    final res = await _dio.patch(
      '${AppConstants.products}/$productId/stock',
      data: {'adjustment': adjustment, 'reason': reason},
    );
    return Product.fromJson(res.data['data'] as Map<String, dynamic>);
  }

  // ══════════════════════════════════════════════════════
  //  SALES
  // ══════════════════════════════════════════════════════

  Future<PaginatedResponse<Sale>> getSales({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? from,
    String? to,
  }) async {
    final res = await _dio.get(AppConstants.sales, queryParameters: {
      'page': page,
      'limit': limit,
      'summary': 'true', // lightweight mode for mobile
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty) 'status': status,
      if (from != null) 'from': from,
      if (to != null) 'to': to,
      'sortBy': 'createdAt',
      'sortDir': 'desc',
    });
    final data = res.data;
    final items = (data['data'] as List)
        .map((e) => Sale.fromJson(e as Map<String, dynamic>))
        .toList();
    final pagination = data['pagination'] as Map<String, dynamic>?;
    return PaginatedResponse(
      items: items,
      total: (pagination?['total'] as num?)?.toInt() ?? items.length,
      page: (pagination?['page'] as num?)?.toInt() ?? page,
      pageSize: (pagination?['limit'] as num?)?.toInt() ?? limit,
      hasMore: pagination?['hasNext'] as bool? ?? false,
    );
  }

  // ══════════════════════════════════════════════════════
  //  CUSTOMERS
  // ══════════════════════════════════════════════════════

  Future<PaginatedResponse<Customer>> getCustomers({
    int page = 1,
    int limit = 20,
    String? search,
    String sortBy = 'createdAt',
    String sortDir = 'desc',
  }) async {
    final res = await _dio.get(AppConstants.customers, queryParameters: {
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      'sortBy': sortBy,
      'sortDir': sortDir,
    });
    final data = res.data;
    final items = (data['data'] as List)
        .map((e) => Customer.fromJson(e as Map<String, dynamic>))
        .toList();
    final pagination = data['pagination'] as Map<String, dynamic>?;
    return PaginatedResponse(
      items: items,
      total: (pagination?['total'] as num?)?.toInt() ?? items.length,
      page: (pagination?['page'] as num?)?.toInt() ?? page,
      pageSize: (pagination?['limit'] as num?)?.toInt() ?? limit,
      hasMore: pagination?['hasNext'] as bool? ?? false,
    );
  }
}
