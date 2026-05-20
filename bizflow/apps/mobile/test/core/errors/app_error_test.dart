/// Phase 1 — AppError hierarchy unit tests
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:bizflow_mobile/core/errors/app_error.dart';

void main() {
  group('AppError sealed class', () {
    test('NetworkError has correct default message', () {
      const e = NetworkError();
      expect(e.message, 'No internet connection');
      expect(e, isA<AppError>());
    });

    test('NetworkError accepts custom message', () {
      const e = NetworkError('Cannot reach server');
      expect(e.message, 'Cannot reach server');
    });

    test('TimeoutError has correct default message', () {
      const e = TimeoutError();
      expect(e.message, 'Request timed out. Please try again.');
    });

    test('UnauthorizedError has correct default message', () {
      const e = UnauthorizedError();
      expect(e.message, 'Session expired. Please log in again.');
    });

    test('ForbiddenError has correct default message', () {
      const e = ForbiddenError();
      expect(e.message, "You don't have permission to do this.");
    });

    test('NotFoundError has correct default message', () {
      const e = NotFoundError();
      expect(e.message, 'Resource not found.');
    });

    test('ValidationError carries statusCode 422 and code', () {
      const e = ValidationError('Invalid data');
      expect(e.statusCode, 422);
      expect(e.code, 'VALIDATION_ERROR');
    });

    test('ValidationError carries issues list', () {
      const e = ValidationError('Invalid', issues: [
        {'field': 'email', 'message': 'Invalid email'},
      ]);
      expect(e.issues.length, 1);
      expect(e.issues.first['field'], 'email');
    });

    test('RateLimitError has correct default message', () {
      const e = RateLimitError();
      expect(e.message, 'Too many requests. Please wait.');
    });

    test('ServerError has correct default message', () {
      const e = ServerError();
      expect(e.message, 'Something went wrong. Please try again later.');
    });

    test('ApiError carries code and statusCode', () {
      const e = ApiError('Bad request', code: 'BAD_REQUEST', statusCode: 400);
      expect(e.code, 'BAD_REQUEST');
      expect(e.statusCode, 400);
    });

    test('UnknownError preserves original error', () {
      final original = Exception('raw');
      final e = UnknownError('Unexpected', original);
      expect(e.originalError, same(original));
    });

    test('All errors implement Exception', () {
      const errors = <AppError>[
        NetworkError(),
        TimeoutError(),
        UnauthorizedError(),
        ForbiddenError(),
        NotFoundError(),
        RateLimitError(),
        ServerError(),
      ];
      for (final e in errors) {
        expect(e, isA<Exception>());
      }
    });
  });
}
