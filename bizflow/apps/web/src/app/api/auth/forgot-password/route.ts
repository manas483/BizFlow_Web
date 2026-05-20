import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { authRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    // ── Rate limit: max 5 forgot-password requests per 15 min per IP ────────
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await authRateLimit.limit(`forgot:${ip}`);
    if (!success) {
      return NextResponse.json(
        { message: "Too many requests. Please wait 15 minutes and try again." },
        { status: 429 }
      );
    }

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "A valid email address is required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return 200 to prevent email enumeration
      return NextResponse.json({ message: "If an account exists, a reset link will be sent." }, { status: 200 });
    }

    // Generate a secure, stateless reset token using HMAC
    // Format: email.expires.signature
    const secret = process.env.NEXTAUTH_SECRET || "fallback_secret";
    const expires = Date.now() + 3600000; // 1 hour from now
    const dataToSign = `${email}.${expires}`;
    
    const signature = crypto
      .createHmac("sha256", secret)
      .update(dataToSign)
      .digest("hex");
      
    const token = Buffer.from(`${dataToSign}.${signature}`).toString("base64");

    // Send the email
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    
    await sendPasswordResetEmail(email, resetLink);

    return NextResponse.json(
      { message: "If an account exists, a reset link will be sent." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
