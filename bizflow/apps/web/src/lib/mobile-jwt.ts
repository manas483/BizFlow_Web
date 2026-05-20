/**
 * Mobile JWT utilities — issue short-lived access tokens and long-lived
 * refresh tokens for Flutter / native mobile clients.
 *
 * Access tokens:  HS256 JWT, 15 minutes, verified stateless on every request.
 * Refresh tokens: 64-byte random hex, stored in DB (RefreshToken table),
 *                 valid for 30 days, revoked on logout.
 *
 * Uses `jose` which ships as a dependency of next-auth v5 — no extra install.
 */

import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';

// ── Secrets ──────────────────────────────────────────────────────────────────
function getSecret(envKey: string) {
  const raw = process.env[envKey] ?? process.env.NEXTAUTH_SECRET ?? 'bizflow-dev-secret';
  return new TextEncoder().encode(raw);
}

const ACCESS_SECRET  = () => getSecret('MOBILE_JWT_SECRET');
const REFRESH_SECRET = () => getSecret('MOBILE_REFRESH_SECRET');

// ── Constants ─────────────────────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL_SECONDS  = 15 * 60;       // 15 min
export const REFRESH_TOKEN_TTL_DAYS    = 30;
export const REFRESH_TOKEN_TTL_MS      = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

// ── Payload type ──────────────────────────────────────────────────────────────
export interface MobileJWTPayload {
  sub: string;           // userId
  bid: string;           // businessId
  role: string;
  permissions: string[];
  businessType?: string;
  email: string;
  name: string;
  type: 'access';
}

// ── Access token ──────────────────────────────────────────────────────────────
export async function signAccessToken(
  payload: Omit<MobileJWTPayload, 'type'>
): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .setIssuer('bizflow')
    .setAudience('bizflow-mobile')
    .sign(ACCESS_SECRET());
}

export async function verifyAccessToken(
  token: string
): Promise<MobileJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET(), {
      issuer:   'bizflow',
      audience: 'bizflow-mobile',
    });
    if ((payload as any).type !== 'access') return null;
    return payload as unknown as MobileJWTPayload;
  } catch {
    return null;
  }
}

// ── Refresh token ─────────────────────────────────────────────────────────────
export function generateRefreshToken(): string {
  return randomBytes(64).toString('hex');
}

export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}
