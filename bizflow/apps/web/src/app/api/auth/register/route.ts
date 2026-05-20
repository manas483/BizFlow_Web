/**
 * Legacy route: /api/auth/register
 * The canonical registration endpoint is /api/register.
 * This route exists only to avoid 404s if old clients call this path.
 * It proxies the request to the canonical route.
 */
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Forward to the canonical endpoint
  const body = await req.text();
  const url = new URL(req.url);
  const canonicalUrl = `${url.origin}/api/register`;

  const res = await fetch(canonicalUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "127.0.0.1" },
    body,
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
