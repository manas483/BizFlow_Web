import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Mobile API v1 — always pass through ─────────────────────────────────────
  // Authentication for /api/v1/* is handled at the route level via
  // requireAuth() which supports both Bearer tokens and cookie sessions.
  // The middleware must NOT redirect these requests — mobile clients
  // don't carry cookies.
  if (pathname.startsWith('/api/v1/')) {
    return NextResponse.next();
  }

  // ── Legacy public API routes — always allow ──────────────────────────────────
  // I-5 FIX: Removed pathname.endsWith('/pdf') — PDF routes now require auth
  // to prevent unauthenticated access to invoices and financial documents.
  const isPublicApi =
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/api/register') ||
    pathname === '/api/health';
  if (isPublicApi) return NextResponse.next();

  // ── Public page routes — always allow ───────────────────────────────────────
  const publicRoutes = [
    '/login', '/register', '/verify-email',
    '/forgot-password', '/reset-password',
    '/onboarding', '/accept-invitation',
  ];
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));

  // ── Extremely lightweight cookie-presence check ──────────────────────────────
  // Full cryptographic verification happens inside Server Components / API routes
  // via auth(). This check purely decides whether to redirect to /login.
  const isLoggedIn =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token") ||
    req.cookies.has("next-auth.session-token") ||
    req.cookies.has("__Secure-next-auth.session-token");

  if (isPublic) {
    // I-8 FIX: Do not redirect authenticated users away from auth pages at the edge.
    // Let the client/server components handle it to prevent infinite redirect loops
    // when cookies are present but invalid.
    return NextResponse.next();
  }

  // ── Protected routes — require session cookie ────────────────────────────────
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
};
