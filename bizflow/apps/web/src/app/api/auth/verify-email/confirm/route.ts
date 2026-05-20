import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";
import { authRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/verify-email/confirm
 * Body: { email: string; otp: string }
 *
 * Verifies the submitted OTP. On success, marks the user as emailVerified.
 * The frontend then triggers a NextAuth sign-in.
 */
export async function POST(req: Request) {
  try {
    // Rate limit: max 10 confirm attempts per 15 min per IP
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await authRateLimit.limit(`otp-confirm:${ip}`);
    if (!success) {
      return NextResponse.json(
        { message: "Too many attempts. Please wait before trying again.", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const email = (body.email ?? "").toLowerCase().trim();
    const otp = (body.otp ?? "").trim();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and verification code are required.", code: "MISSING_FIELDS" }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ message: "Please enter the 6-digit code from your email.", code: "INVALID_FORMAT" }, { status: 400 });
    }

    const result = await verifyOtp(email, otp);

    if (!result.success) {
      const messages: Record<string, string> = {
        NOT_FOUND: "No verification code found. Please request a new one.",
        EXPIRED: "Your code has expired. Please request a new one.",
        MAX_ATTEMPTS: "Too many incorrect attempts. Please request a new code.",
        INVALID: "Incorrect code. Please check and try again.",
      };
      const httpStatus = result.code === "MAX_ATTEMPTS" ? 429 : 400;
      return NextResponse.json(
        { message: messages[result.code] ?? "Verification failed.", code: result.code },
        { status: httpStatus }
      );
    }

    return NextResponse.json({ message: "Email verified successfully!", code: "SUCCESS" }, { status: 200 });
  } catch (error) {
    console.error("[verify-email/confirm]", error);
    return NextResponse.json({ message: "An unexpected error occurred.", code: "SERVER_ERROR" }, { status: 500 });
  }
}
