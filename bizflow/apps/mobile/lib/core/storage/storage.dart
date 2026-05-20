/// BizFlow — Secure Token Storage
///
/// Uses flutter_secure_storage for JWT tokens and
/// shared_preferences for non-sensitive data.
library;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../constants/app_constants.dart';

// ══════════════════════════════════════════════════════
//  SECURE STORAGE (tokens, sensitive data)
// ══════════════════════════════════════════════════════

final secureStorageProvider = Provider<SecureStorage>((_) => SecureStorage());

class SecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // ── Access Token ──────────────────────────────────────
  Future<String?> getAccessToken() =>
      _storage.read(key: AppConstants.accessTokenKey);

  Future<void> setAccessToken(String token) =>
      _storage.write(key: AppConstants.accessTokenKey, value: token);

  Future<void> deleteAccessToken() =>
      _storage.delete(key: AppConstants.accessTokenKey);

  // ── Refresh Token ─────────────────────────────────────
  Future<String?> getRefreshToken() =>
      _storage.read(key: AppConstants.refreshTokenKey);

  Future<void> setRefreshToken(String token) =>
      _storage.write(key: AppConstants.refreshTokenKey, value: token);

  Future<void> deleteRefreshToken() =>
      _storage.delete(key: AppConstants.refreshTokenKey);

  // ── User Data (JSON string) ───────────────────────────
  Future<String?> getUserData() =>
      _storage.read(key: AppConstants.userDataKey);

  Future<void> setUserData(String jsonString) =>
      _storage.write(key: AppConstants.userDataKey, value: jsonString);

  Future<void> deleteUserData() =>
      _storage.delete(key: AppConstants.userDataKey);

  // ── Clear all on logout ───────────────────────────────
  Future<void> clearAll() async {
    await Future.wait([
      deleteAccessToken(),
      deleteRefreshToken(),
      deleteUserData(),
    ]);
  }
}

// ══════════════════════════════════════════════════════
//  LOCAL PREFERENCES (non-sensitive settings)
// ══════════════════════════════════════════════════════

final localStorageProvider = Provider<LocalStorage>((ref) {
  throw UnimplementedError('Must override with SharedPreferences instance');
});

class LocalStorage {
  final SharedPreferences _prefs;

  const LocalStorage(this._prefs);

  // ── Theme mode ────────────────────────────────────────
  String? get themeMode => _prefs.getString(AppConstants.themeKey);
  Future<bool> setThemeMode(String mode) =>
      _prefs.setString(AppConstants.themeKey, mode);

  // ── Onboarding ────────────────────────────────────────
  bool get onboardingComplete =>
      _prefs.getBool(AppConstants.onboardingKey) ?? false;
  Future<bool> setOnboardingComplete(bool value) =>
      _prefs.setBool(AppConstants.onboardingKey, value);

  // ── Generic ───────────────────────────────────────────
  Future<bool> setString(String key, String value) =>
      _prefs.setString(key, value);
  String? getString(String key) => _prefs.getString(key);

  Future<bool> clear() => _prefs.clear();
}
