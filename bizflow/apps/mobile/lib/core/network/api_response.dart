/// BizFlow — Base API Response Wrapper
///
/// Mirrors the web API's standard response envelope:
///   { "success": bool, "message": "...", "data": {...}, "error": "..." }
library;

class ApiResponse<T> {
  final bool success;
  final String? message;
  final T? data;
  final String? error;

  const ApiResponse({
    required this.success,
    this.message,
    this.data,
    this.error,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Object? json)? fromJsonT,
  ) {
    return ApiResponse(
      success: json['success'] as bool? ?? false,
      message: json['message'] as String?,
      data: json['data'] != null && fromJsonT != null
          ? fromJsonT(json['data'])
          : json['data'] as T?,
      error: json['error'] as String?,
    );
  }
}

/// Paginated list response
class PaginatedResponse<T> {
  final List<T> items;
  final int total;
  final int page;
  final int pageSize;
  final bool hasMore;

  const PaginatedResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.pageSize,
    required this.hasMore,
  });

  factory PaginatedResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) fromJsonT,
  ) {
    final items = (json['items'] as List?)
            ?.map((e) => fromJsonT(e as Map<String, dynamic>))
            .toList() ??
        [];
    final total = json['total'] as int? ?? items.length;
    final page = json['page'] as int? ?? 1;
    final pageSize = json['pageSize'] as int? ?? 20;

    return PaginatedResponse(
      items: items,
      total: total,
      page: page,
      pageSize: pageSize,
      hasMore: (page * pageSize) < total,
    );
  }
}
