/// BizFlow — Auth Service
///
/// Handles login, refresh, logout, and session restore
/// via the /api/v1/auth/* endpoints.
library;

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_constants.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/storage.dart';
import '../models/user.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(
    dio: ref.read(dioProvider),
    storage: ref.read(secureStorageProvider),
  );
});

class AuthService {
  final Dio _dio;
  final SecureStorage _storage;

  AuthService({required Dio dio, required SecureStorage storage})
      : _dio = dio,
        _storage = storage;

  /// Login with email/password → returns User
  Future<User> login(String email, String password) async {
    try {
      final response = await _dio.post(
        AppConstants.authToken,
        data: {'email': email.trim().toLowerCase(), 'password': password},
      );

      final data = response.data['data'] as Map<String, dynamic>;

      // Store tokens
      await Future.wait([
        _storage.setAccessToken(data['access_token']?.toString() ?? ''),
        _storage.setRefreshToken(data['refresh_token']?.toString() ?? ''),
      ]);

      // Parse and store user
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      await _storage.setUserData(user.toJsonString());

      return user;
    } catch (e) {
      throw parseError(e);
    }
  }

  /// Try to restore session from stored tokens
  Future<User?> tryRestoreSession() async {
    final accessToken = await _storage.getAccessToken();
    if (accessToken == null) return null;

    // First try cached user data
    final cachedUser = await _storage.getUserData();
    if (cachedUser != null) {
      try {
        return User.fromJsonString(cachedUser);
      } catch (_) {
        // Corrupted cache, try API
      }
    }

    // Validate token by calling /auth/me
    try {
      final response = await _dio.get(AppConstants.authMe);
      final userData = response.data['data'] as Map<String, dynamic>;
      final user = User.fromJson(userData);
      await _storage.setUserData(user.toJsonString());
      return user;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        // Token expired — try refresh
        return _tryRefreshAndRestore();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<User?> _tryRefreshAndRestore() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken == null) {
      await _storage.clearAll();
      return null;
    }

    try {
      final response = await _dio.post(
        AppConstants.authRefresh,
        data: {'refresh_token': refreshToken},
      );

      final data = response.data['data'] as Map<String, dynamic>;
      await Future.wait([
        _storage.setAccessToken(data['access_token']?.toString() ?? ''),
        _storage.setRefreshToken(data['refresh_token']?.toString() ?? ''),
      ]);

      // Fetch user profile
      final meResponse = await _dio.get(AppConstants.authMe);
      final userData = meResponse.data['data'] as Map<String, dynamic>;
      final user = User.fromJson(userData);
      await _storage.setUserData(user.toJsonString());
      return user;
    } catch (_) {
      await _storage.clearAll();
      return null;
    }
  }

  /// Logout — revoke refresh token and clear local storage
  Future<void> logout() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken != null) {
        await _dio.post(
          AppConstants.authLogout,
          data: {'refresh_token': refreshToken},
        );
      }
    } catch (_) {
      // Best-effort server-side revocation
    } finally {
      await _storage.clearAll();
    }
  }
}
