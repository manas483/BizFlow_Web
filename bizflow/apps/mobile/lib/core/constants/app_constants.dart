/// BizFlow — App Constants
///
/// Global constants used throughout the app.
/// Never hardcode magic strings/numbers in feature code.
library;

abstract final class AppConstants {
  // ── App ───────────────────────────────────────────────
  static const String appName = 'BizFlow';
  static const String packageId = 'com.bizflow.app';

  // ── Auth ──────────────────────────────────────────────
  static const String accessTokenKey = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userDataKey = 'user_data';
  static const String themeKey = 'theme_mode';
  static const String onboardingKey = 'onboarding_complete';

  // ── API paths ─────────────────────────────────────────
  static const String authToken    = '/auth/token';
  static const String authRefresh  = '/auth/refresh';
  static const String authLogout   = '/auth/logout';
  static const String authMe       = '/auth/me';
  static const String dashboard    = '/dashboard/stats';
  static const String products     = '/products';
  static const String sales        = '/sales';
  static const String customers    = '/customers';
  static const String expenses     = '/expenses';
  static const String quotations   = '/quotations';
  static const String reports      = '/reports';
  static const String notifications = '/notifications';
  static const String deviceTokens = '/device-tokens';
  static const String leaves       = '/leaves';
  static const String employees    = '/employees';

  // ── Pagination ────────────────────────────────────────
  static const int defaultPageSize = 20;

  // ── Timeouts ──────────────────────────────────────────
  static const Duration splashDelay = Duration(seconds: 2);
  static const Duration debounceDelay = Duration(milliseconds: 400);
  static const Duration animationDuration = Duration(milliseconds: 300);
  static const Duration snackbarDuration = Duration(seconds: 3);
}
