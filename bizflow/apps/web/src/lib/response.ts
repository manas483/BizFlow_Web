/**
 * Standardized API response helpers for all v1 endpoints.
 *
 * Every response follows the envelope:
 *   Success:  { success: true,  data, message?, pagination?, meta? }
 *   Error:    { success: false, error: { code, message, details? } }
 *
 * HTTP status conventions:
 *   200  OK (GET / PUT)
 *   201  Created (POST)
 *   400  Business rule violation
 *   401  Unauthenticated
 *   403  Forbidden (wrong role / permission)
 *   404  Not found
 *   409  Conflict (duplicate)
 *   422  Validation error (malformed payload)
 *   429  Rate limited
 *   500  Internal server error
 */

import { NextResponse } from 'next/server';

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}

export function buildPagination(
  total: number,
  page:  number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

/** Parse ?page, ?limit, ?sortBy, ?sortDir from a URLSearchParams object. */
export function parsePagination(sp: URLSearchParams) {
  const page    = Math.max(1, parseInt(sp.get('page')  ?? '1',  10));
  const limit   = Math.min(100, parseInt(sp.get('limit') ?? '25', 10));
  const skip    = (page - 1) * limit;
  const sortBy  = sp.get('sortBy')  ?? 'createdAt';
  const sortDir = (sp.get('sortDir') ?? 'desc') as 'asc' | 'desc';
  return { page, limit, skip, sortBy, sortDir };
}

// ── Success responses ─────────────────────────────────────────────────────────

export function ok(
  data:       unknown,
  options?: {
    message?:    string;
    pagination?: PaginationMeta;
    meta?:       Record<string, unknown>;
    status?:     number;
  }
): NextResponse {
  const body: Record<string, unknown> = { success: true, data };
  if (options?.message)    body.message    = options.message;
  if (options?.pagination) body.pagination = options.pagination;
  if (options?.meta)       body.meta       = options.meta;
  return NextResponse.json(body, { status: options?.status ?? 200 });
}

export function created(data: unknown, message?: string): NextResponse {
  return ok(data, { message, status: 201 });
}

export function deleted(id?: string): NextResponse {
  return ok({ deleted: true, ...(id ? { id } : {}) }, { message: 'Deleted successfully' });
}

// ── Error responses ───────────────────────────────────────────────────────────

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED';

export function err(
  code:    ErrorCode,
  message: string,
  status:  number,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

// Convenience shorthands
export const notFound       = (msg = 'Resource not found')  => err('NOT_FOUND',        msg, 404);
export const unauthorized   = (msg = 'Unauthorized')         => err('UNAUTHORIZED',     msg, 401);
export const forbidden      = (msg = 'Forbidden')            => err('FORBIDDEN',        msg, 403);
export const conflict       = (msg: string)                  => err('CONFLICT',         msg, 409);
export const businessRule   = (msg: string)                  => err('BUSINESS_RULE',    msg, 400);
export const rateLimited    = ()                             => err('RATE_LIMITED',     'Too Many Requests', 429);
export const internalError  = (msg = 'Internal Server Error') => err('INTERNAL_ERROR', msg, 500);
export const validationError = (details: unknown)            =>
  err('VALIDATION_ERROR', 'Validation failed', 422, details);
