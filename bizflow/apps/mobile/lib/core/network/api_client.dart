/// BizFlow — Dio API Client
///
/// Centralized HTTP client with:
///  • Auth interceptor (auto-attaches JWT)
///  • Token refresh interceptor (auto-refreshes on 401)
///  • Error parser (maps HTTP errors → typed AppError)
///  • Pretty logging in dev mode
library;

import 'dart:io';
import 'package:dio/dio.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/env_config.dart';
import '../constants/app_constants.dart';
import '../storage/storage.dart';
import '../errors/app_error.dart';

// ══════════════════════════════════════════════════════
//  PROVIDER
// ══════════════════════════════════════════════════════

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: Env.current.apiBaseUrl,
    connectTimeout: Env.current.connectTimeout,
    receiveTimeout: Env.current.receiveTimeout,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  ));

  final storage = ref.read(secureStorageProvider);

  // ── Auth interceptor ──────────────────────────────────
  dio.interceptors.add(AuthInterceptor(dio: dio, storage: storage));

  // ── Logging (dev only) ────────────────────────────────
  if (Env.current.enableLogging) {
    dio.interceptors.add(PrettyDioLogger(
      requestHeader: true,
      requestBody: true,
      responseBody: true,
      compact: true,
    ));
  }

  return dio;
});

// ══════════════════════════════════════════════════════
//  AUTH INTERCEPTOR (with token refresh)
// ══════════════════════════════════════════════════════

class AuthInterceptor extends Interceptor {
  final Dio dio;
  final SecureStorage storage;
  bool _isRefreshing = false;
  final List<({RequestOptions options, ErrorInterceptorHandler handler})> _queue = [];

  AuthInterceptor({required this.dio, required this.storage});

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Skip auth header for login/refresh endpoints
    final path = options.path;
    if (path.contains(AppConstants.authToken) || path.contains(AppConstants.authRefresh)) {
      return handler.next(options);
    }

    final token = await storage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    return handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    // Only intercept 401 (not on login/refresh)
    if (err.response?.statusCode != 401 ||
        err.requestOptions.path.contains(AppConstants.authToken) ||
        err.requestOptions.path.contains(AppConstants.authRefresh)) {
      return handler.next(err);
    }

    // ── Queue retry or start refresh ──────────────────────
    if (_isRefreshing) {
      _queue.add((options: err.requestOptions, handler: handler));
      return;
    }

    _isRefreshing = true;

    try {
      final refreshToken = await storage.getRefreshToken();
      if (refreshToken == null) {
        await _forceLogout();
        return handler.next(err);
      }

      // Call refresh endpoint with a fresh Dio instance (no interceptors)
      final freshDio = Dio(BaseOptions(
        baseUrl: Env.current.apiBaseUrl,
        connectTimeout: Env.current.connectTimeout,
        receiveTimeout: Env.current.receiveTimeout,
      ));

      final response = await freshDio.post(
        AppConstants.authRefresh,
        data: {'refresh_token': refreshToken},
      );

      final newAccess  = response.data['data']['access_token']?.toString() ?? '';
      final newRefresh = response.data['data']['refresh_token']?.toString() ?? '';

      await Future.wait([
        storage.setAccessToken(newAccess),
        storage.setRefreshToken(newRefresh),
      ]);

      // Retry original request
      err.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
      final retryResponse = await freshDio.fetch(err.requestOptions);
      handler.resolve(retryResponse);

      // Retry queued requests
      for (final queued in _queue) {
        queued.options.headers['Authorization'] = 'Bearer $newAccess';
        freshDio.fetch(queued.options).then(
          (r) => queued.handler.resolve(r),
          onError: (e) => queued.handler.reject(e as DioException),
        );
      }
    } on DioException {
      await _forceLogout();
      handler.next(err);
    } finally {
      _isRefreshing = false;
      _queue.clear();
    }
  }

  Future<void> _forceLogout() async {
    await storage.clearAll();
    // Navigation to login is handled by the auth state listener in GoRouter
  }
}

// ══════════════════════════════════════════════════════
//  ERROR PARSER — maps DioException → typed AppError
// ══════════════════════════════════════════════════════

AppError parseError(Object error) {
  if (error is DioException) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const TimeoutError();

      case DioExceptionType.connectionError:
        return const NetworkError();

      case DioExceptionType.badResponse:
        final statusCode = error.response?.statusCode;
        final data = error.response?.data;
        String message = 'Request failed';
        String? code;

        if (data is Map) {
          if (data['error'] is Map) {
            final errObj = data['error'] as Map;
            message = errObj['message']?.toString() ?? 'Request failed';
            code = errObj['code']?.toString();
          } else {
            message = data['message']?.toString() ?? data['error']?.toString() ?? 'Request failed';
            code = data['error']?.toString();
          }
        }

        if (statusCode == null) {
          return ApiError(message, code: code, statusCode: statusCode);
        }
        return switch (statusCode) {
          401 => UnauthorizedError(message),
          403 => ForbiddenError(message),
          404 => NotFoundError(message),
          422 => ValidationError(
                message,
                issues: data is Map && data['issues'] is List
                    ? (data['issues'] as List).cast<Map<String, dynamic>>()
                    : [],
              ),
          429 => RateLimitError(message),
          >= 500 => ServerError(message),
          _   => ApiError(message, code: code, statusCode: statusCode),
        };

      case DioExceptionType.cancel:
        return const UnknownError('Request cancelled');

      default:
        if (error.error is SocketException) {
          return const NetworkError();
        }
        return UnknownError('Network error', error.error);
    }
  }

  if (error is AppError) return error;

  return UnknownError('Unexpected error', error);
}
