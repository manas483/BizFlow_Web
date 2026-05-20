/// BizFlow — Environment Configuration
///
/// Never hardcode URLs, keys, or Firebase configs.
/// Use [Env.current] to access environment-specific values.
library;

enum Environment { dev, staging, production }

class EnvConfig {
  final Environment env;
  final String apiBaseUrl;
  final String appName;
  final bool enableLogging;
  final Duration connectTimeout;
  final Duration receiveTimeout;

  const EnvConfig({
    required this.env,
    required this.apiBaseUrl,
    required this.appName,
    this.enableLogging = false,
    this.connectTimeout = const Duration(seconds: 15),
    this.receiveTimeout = const Duration(seconds: 15),
  });
}

abstract final class Env {
  static EnvConfig _current = _dev;

  static EnvConfig get current => _current;

  static void init(Environment env) {
    switch (env) {
      case Environment.dev:
        _current = _dev;
      case Environment.staging:
        _current = _staging;
      case Environment.production:
        _current = _production;
    }
  }

  // ── Dev ───────────────────────────────────────────────
  static const _dev = EnvConfig(
    env: Environment.dev,
    apiBaseUrl: 'http://192.168.0.135:3000/api/v1', // LAN IP for physical device
    appName: 'BizFlow Dev',
    enableLogging: true,
    connectTimeout: Duration(seconds: 30),
    receiveTimeout: Duration(seconds: 30),
  );

  // ── Staging ───────────────────────────────────────────
  static const _staging = EnvConfig(
    env: Environment.staging,
    apiBaseUrl: 'https://staging.bizflow.app/api/v1',
    appName: 'BizFlow Staging',
    enableLogging: true,
  );

  // ── Production ────────────────────────────────────────
  static const _production = EnvConfig(
    env: Environment.production,
    apiBaseUrl: 'https://bizflow.app/api/v1',
    appName: 'BizFlow',
    enableLogging: false,
  );

  static bool get isDev => _current.env == Environment.dev;
  static bool get isStaging => _current.env == Environment.staging;
  static bool get isProduction => _current.env == Environment.production;
}
