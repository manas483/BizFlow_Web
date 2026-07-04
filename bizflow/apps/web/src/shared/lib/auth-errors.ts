export const AUTH_ERROR_CODES: Record<string, string> = {
  EMAIL_PASSWORD_REQUIRED: 'AUTH-001',
  USER_NOT_FOUND: 'AUTH-002',
  INVALID_CREDENTIALS: 'AUTH-003',
  USER_DISABLED: 'AUTH-004',
  INVALID_USER_DATA: 'AUTH-005', // E.g., missing role, missing businessId
  ROLE_MISSING: 'AUTH-006',
  JWT_CALLBACK_FAILED: 'AUTH-007',
  SESSION_CALLBACK_FAILED: 'AUTH-008',
  DATABASE_ERROR: 'AUTH-009',
  RATE_LIMIT_IP: 'AUTH-010',
  RATE_LIMIT_EMAIL: 'AUTH-010', // Treat both limits similarly or distinguish if needed
  EMAIL_NOT_VERIFIED: 'AUTH-011',
  REQUIRES_2FA: 'AUTH-012',
  INVALID_2FA_CODE: 'AUTH-013',
  SESSION_EXPIRED: 'AUTH-014',
  SESSION_REVOKED: 'AUTH-015',
  INTERNAL_ERROR: 'AUTH-500',
};

export function getAuthErrorCode(reason: string): string {
  return AUTH_ERROR_CODES[reason] || 'AUTH-000'; // AUTH-000 for unknown
}
