/// Phase 1 — EnvConfig and Env unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/core/config/env_config.dart';

void main() {
  // Always reset to dev before and after every test to prevent
  // cross-file state pollution when running the full test suite.
  setUp(() => Env.init(Environment.dev));
  tearDown(() => Env.init(Environment.dev));

  group('Env.init', () {
    test('dev environment has logging enabled', () {
      Env.init(Environment.dev);
      expect(Env.current.env, Environment.dev);
      expect(Env.current.enableLogging, isTrue);
      expect(Env.current.appName, 'BizFlow Dev');
    });

    test('staging environment has logging enabled', () {
      Env.init(Environment.staging);
      expect(Env.current.env, Environment.staging);
      expect(Env.current.enableLogging, isTrue);
      expect(Env.current.appName, 'BizFlow Staging');
    });

    test('production environment has logging disabled', () {
      Env.init(Environment.production);
      expect(Env.current.env, Environment.production);
      expect(Env.current.enableLogging, isFalse);
      expect(Env.current.appName, 'BizFlow');
    });

    test('dev apiBaseUrl contains /api/v1', () {
      Env.init(Environment.dev);
      expect(Env.current.apiBaseUrl, contains('/api/v1'));
    });

    test('production apiBaseUrl is HTTPS', () {
      Env.init(Environment.production);
      expect(Env.current.apiBaseUrl, startsWith('https://'));
    });

    test('staging apiBaseUrl is HTTPS', () {
      Env.init(Environment.staging);
      expect(Env.current.apiBaseUrl, startsWith('https://'));
    });
  });

  group('Env convenience getters', () {
    test('isDev is true only in dev', () {
      Env.init(Environment.dev);
      expect(Env.isDev, isTrue);
      expect(Env.isStaging, isFalse);
      expect(Env.isProduction, isFalse);
    });

    test('isStaging is true only in staging', () {
      Env.init(Environment.staging);
      expect(Env.isStaging, isTrue);
      expect(Env.isDev, isFalse);
      expect(Env.isProduction, isFalse);
    });

    test('isProduction is true only in production', () {
      Env.init(Environment.production);
      expect(Env.isProduction, isTrue);
      expect(Env.isDev, isFalse);
      expect(Env.isStaging, isFalse);
    });
  });

  group('EnvConfig timeouts', () {
    test('dev has extended timeouts', () {
      Env.init(Environment.dev);
      expect(Env.current.connectTimeout.inSeconds, greaterThan(14));
    });

    test('production uses default 15s timeout', () {
      Env.init(Environment.production);
      expect(Env.current.connectTimeout.inSeconds, 15);
      expect(Env.current.receiveTimeout.inSeconds, 15);
    });
  });
}
