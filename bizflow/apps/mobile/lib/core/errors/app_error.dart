/// BizFlow — API Error Types
///
/// Typed error hierarchy for clean error handling throughout the app.
library;

sealed class AppError implements Exception {
  final String message;
  final String? code;
  final int? statusCode;

  const AppError(this.message, {this.code, this.statusCode});

  @override
  String toString() => 'AppError($code): $message';
}

/// Server returned an error response (4xx/5xx)
class ApiError extends AppError {
  final Map<String, dynamic>? errors;

  const ApiError(
    super.message, {
    super.code,
    super.statusCode,
    this.errors,
  });
}

/// No internet or server unreachable
class NetworkError extends AppError {
  const NetworkError([super.message = 'No internet connection']);
}

/// Request timed out
class TimeoutError extends AppError {
  const TimeoutError([super.message = 'Request timed out. Please try again.']);
}

/// Token expired / unauthorized
class UnauthorizedError extends AppError {
  const UnauthorizedError([super.message = 'Session expired. Please log in again.']);
}

/// Permission denied (403)
class ForbiddenError extends AppError {
  const ForbiddenError([super.message = 'You don\'t have permission to do this.']);
}

/// Resource not found (404)
class NotFoundError extends AppError {
  const NotFoundError([super.message = 'Resource not found.']);
}

/// Validation error (422)
class ValidationError extends AppError {
  final List<Map<String, dynamic>> issues;

  const ValidationError(
    super.message, {
    this.issues = const [],
  }) : super(code: 'VALIDATION_ERROR', statusCode: 422);
}

/// Rate limited (429)
class RateLimitError extends AppError {
  const RateLimitError([super.message = 'Too many requests. Please wait.']);
}

/// Server error (500)
class ServerError extends AppError {
  const ServerError([super.message = 'Something went wrong. Please try again later.']);
}

/// Unknown / catch-all
class UnknownError extends AppError {
  final Object? originalError;

  const UnknownError([
    super.message = 'An unexpected error occurred.',
    this.originalError,
  ]);
}
