export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/shared/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authRateLimit } from "@/shared/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // Rate limit
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success } = await authRateLimit.limit(`reset:${ip}`);
    if (!success) {
      return NextResponse.json({ message: "Too many requests. Please wait." }, { status: 429 });
    }

    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Token and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters long." }, { status: 400 });
    }

    // Decode and verify token
    let email, expiresStr, providedSignature;
    try {
      const decodedToken = Buffer.from(token, "base64").toString("utf-8");
      const parts = decodedToken.split(".");
      providedSignature = parts.pop();
      expiresStr = parts.pop();
      email = parts.join(".");
    } catch {
      return NextResponse.json({ message: "Invalid token format." }, { status: 400 });
    }

    if (!email || !expiresStr || !providedSignature) {
      return NextResponse.json({ message: "Invalid token." }, { status: 400 });
    }

    // Check expiration
    if (Date.now() > parseInt(expiresStr)) {
      return NextResponse.json({ message: "This password reset link has expired. Please request a new one." }, { status: 400 });
    }

    // Verify signature
    const secret = process.env.NEXTAUTH_SECRET || "fallback_secret";
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${email}.${expiresStr}`)
      .digest("hex");

    if (providedSignature !== expectedSignature) {
      return NextResponse.json({ message: "Invalid or tampered token." }, { status: 400 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ message: "Password updated successfully." }, { status: 200 });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

