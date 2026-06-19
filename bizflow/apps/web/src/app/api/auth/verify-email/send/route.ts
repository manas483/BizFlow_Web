import { NextResponse } from "next/server";
import { prisma } from "@/shared/lib/db";
import { createOtpRecord } from "@/shared/lib/otp";
import { sendOtpEmail } from "@/shared/lib/email";
import { authRateLimit } from "@/shared/lib/rate-limit";

/**
 * POST /api/auth/verify-email/send
 * Body: { email: string }
 *
 * Generates a fresh OTP for the given email and sends it.
 * Used both immediately after registration and for "Resend OTP".
 */
export async function POST(req: Request) {
  try {
    // Rate limit: max 5 OTP sends per 15 min per IP
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await authRateLimit.limit(`otp-send:${ip}`);
    if (!success) {
      return NextResponse.json(
        { message: "Too many requests. Please wait before requesting a new code." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const email = (body.email ?? "").toLowerCase().trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "A valid email is required." }, { status: 400 });
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true },
    });

    if (!user) {
      // Return 200 to prevent email enumeration (same message regardless)
      return NextResponse.json({ message: "If an account exists, a code has been sent." }, { status: 200 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "This email address is already verified." }, { status: 200 });
    }

    // Generate and store OTP, then email it
    const otp = await createOtpRecord(email);
    await sendOtpEmail(email, user.name, otp);

    return NextResponse.json({ message: "Verification code sent. Please check your inbox." }, { status: 200 });
  } catch (error) {
    console.error("[verify-email/send]", error);
    return NextResponse.json({ message: "An unexpected error occurred." }, { status: 500 });
  }
}
