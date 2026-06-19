/**
 * API Authentication Guard
 *
 * Supports two authentication strategies:
 *
 * 1. Mobile (Bearer token) — Flutter / native apps
 *    Authorization: Bearer <access_token>
 *    Verifies the HS256 JWT issued by POST /api/v1/auth/token.
 *
 * 2. Web (NextAuth session cookie) — browser-based web app
 *    Falls back to auth() from next-auth when no Bearer header is present.
 *    Preserves full backward compatibility with all existing web routes.
 */

import { NextResponse }       from 'next/server';
import { auth }               from './auth';
import { apiRateLimit }       from './rate-limit';
import { headers }            from 'next/headers';
import { verifyAccessToken }  from './mobile-jwt';
import { prisma }             from './db';
import { ROLE_PERMISSIONS, Permission } from './permissions';

export class AuthError extends Error {
  response: NextResponse;
  constructor(response: NextResponse) {
    super('Unauthorized');
    this.response = response;
  }
}

// ── Shared session shape ──────────────────────────────────────────────────────

export interface AuthSession {
  user: {
    id:           string;
    email:        string;
    name:         string;
    role:         string;
    businessId:   string;
    businessType: string;
    permissions:  string[];
  };
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

async function applyRateLimit() {
  try {
    const hdrs = await headers();
    const ip   = hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip') ?? '127.0.0.1';
    const res  = await apiRateLimit.limit(ip);
    if (!res.success) {
      throw new AuthError(
        NextResponse.json(
          { success: false, error: { code: 'RATE_LIMITED', message: 'Too Many Requests' } },
          { status: 429 }
        )
      );
    }
  } catch (e) {
    if (e instanceof AuthError) throw e;
    // Redis unavailable — fail open (dummyLimiter returns success:true)
  }
}

// ── Bearer token path ─────────────────────────────────────────────────────────

// I-4 FIX: In-memory LRU-style cache for bearer-authenticated user lookups.
// Mobile clients often fire multiple API requests at once on app startup;
// without caching, each one would independently query the DB.
// Hard-capped at 500 entries to prevent unbounded memory growth.
const bearerCache = new Map<string, { session: AuthSession; expiresAt: number }>();
const BEARER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const BEARER_CACHE_MAX_SIZE = 500;

async function sessionFromBearer(bearerToken: string): Promise<AuthSession | null> {
  const payload = await verifyAccessToken(bearerToken);
  if (!payload) return null;

  // Check in-memory cache first
  const cached = bearerCache.get(payload.sub);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.session;
  }

  // Refresh live permissions + role from DB (throttled by cache above).
  try {
    const dbUser = await prisma.user.findUnique({
      where:   { id: payload.sub },
      include: { employee: { select: { permissions: true } }, business: { select: { businessType: true } } },
    });
    if (!dbUser || dbUser.businessId !== payload.bid) return null;

    const roleDefaults: string[] = (ROLE_PERMISSIONS as any)[dbUser.role] ?? [];
    const empPerms               = dbUser.employee?.permissions;
    const effectivePermissions   =
      Array.isArray(empPerms) && empPerms.length > 0 ? (empPerms as string[]) : roleDefaults;

    const session: AuthSession = {
      user: {
        id:           dbUser.id,
        email:        dbUser.email,
        name:         dbUser.name,
        role:         dbUser.role,
        businessId:   dbUser.businessId,
        businessType: dbUser.business?.businessType ?? '',
        permissions:  effectivePermissions,
      },
    };

    // Store in cache
    bearerCache.set(payload.sub, { session, expiresAt: Date.now() + BEARER_CACHE_TTL_MS });

    // I-4 FIX: Evict stale entries and enforce hard size cap
    if (bearerCache.size > 50) {
      const now = Date.now();
      for (const [key, val] of bearerCache) {
        if (now >= val.expiresAt) bearerCache.delete(key);
      }
    }
    // Hard cap: if still over limit, clear entire cache (LRU would be ideal but Map is FIFO)
    if (bearerCache.size > BEARER_CACHE_MAX_SIZE) {
      bearerCache.clear();
    }

    return session;
  } catch {
    // DB temporarily unavailable — use cached payload from JWT
    return {
      user: {
        id:           payload.sub,
        email:        payload.email,
        name:         payload.name,
        role:         payload.role,
        businessId:   payload.bid,
        businessType: payload.businessType ?? '',
        permissions:  payload.permissions,
      },
    };
  }
}

// ── Cookie session path ───────────────────────────────────────────────────────

async function sessionFromCookie(): Promise<AuthSession | null> {
  const session = await auth();
  if (!session?.user?.businessId) return null;

  return {
    user: {
      id:           (session.user as any).id           ?? '',
      email:        session.user.email                 ?? '',
      name:         session.user.name                  ?? '',
      role:         (session.user as any).role         ?? 'STAFF',
      businessId:   session.user.businessId,
      businessType: (session.user as any).businessType ?? '',
      permissions:  (session.user as any).permissions  ?? [],
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * requireAuth(allowedRoles?)
 *
 * 1. Applies IP rate limiting.
 * 2. Checks Authorization: Bearer <token> first (mobile path).
 * 3. Falls back to NextAuth cookie session (web path).
 * 4. Enforces role allow-list if provided.
 * 5. Returns a normalized AuthSession — same shape regardless of auth path.
 * 6. Throws AuthError (caught by withAuth wrapper) on failure.
 */
export async function requireAuth(allowedRoles?: string[]): Promise<AuthSession> {
  await applyRateLimit();

  // ── Try Bearer token ──────────────────────────────────────────────────────
  let session: AuthSession | null = null;

  try {
    const hdrs        = await headers();
    const authHeader  = hdrs.get('authorization') ?? '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      session = await sessionFromBearer(token);
      if (!session) {
        throw new AuthError(
          NextResponse.json(
            { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired access token' } },
            { status: 401 }
          )
        );
      }
    }
  } catch (e) {
    if (e instanceof AuthError) throw e;
  }

  // ── Fallback: NextAuth cookie ─────────────────────────────────────────────
  if (!session) {
    session = await sessionFromCookie();
    if (!session) {
      throw new AuthError(
        NextResponse.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
          { status: 401 }
        )
      );
    }
  }

  // ── Role check ────────────────────────────────────────────────────────────
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(session.user.role)) {
      throw new AuthError(
        NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 }
        )
      );
    }
  }

  return session;
}

/**
 * withAuth(handler)
 *
 * HOC that catches AuthError and returns its response cleanly,
 * and formats any uncaught error as a standardized 500.
 */
export function withAuth(
  handler: (req: Request, ctx?: any) => Promise<NextResponse>
) {
  return async (req: Request, ctx?: any) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof AuthError) return e.response;
      console.error(e);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } },
        { status: 500 }
      );
    }
  };
}

/**
 * requirePermission(permission)
 *
 * Convenience wrapper: authenticates then checks a specific permission.
 * Throws AuthError (403) if the user lacks the permission.
 */
export async function requirePermission(permission: Permission): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.user.role === 'SUPER_ADMIN') return session; // Super Admin bypasses all checks

  if (!session.user.permissions.includes(permission)) {
    throw new AuthError(
      NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: `Missing permission: ${permission}` } },
        { status: 403 }
      )
    );
  }
  return session;
}

/**
 * getRequestMeta()
 *
 * Extract IP address and User-Agent from the request headers.
 * Used for audit logging and activity tracking.
 */
export async function getRequestMeta(): Promise<{ ipAddress: string; userAgent: string }> {
  const hdrs = await headers();
  return {
    ipAddress: hdrs.get('x-forwarded-for') ?? hdrs.get('x-real-ip') ?? '127.0.0.1',
    userAgent: hdrs.get('user-agent') ?? 'unknown',
  };
}
