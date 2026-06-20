import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/db";
import bcrypt from "bcryptjs";
import { authRateLimit } from "@/shared/lib/rate-limit";
import { SignJWT } from "jose";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit the re-auth attempts
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const rateLimitResult = await authRateLimit.limit(`reauth_${ip}_${session.user.id}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many re-authentication attempts. Try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { password, otpToken } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Check MFA if enabled
    if (user.twoFactorEnabled) {
      if (!otpToken) {
        return NextResponse.json({ error: "MFA code is required", requires2FA: true }, { status: 401 });
      }

      if (!user.twoFactorSecret) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const { decryptSecret, verifyBackupCode, verifyTOTPToken } = require("@/shared/lib/two-factor");
      const secret = decryptSecret(user.twoFactorSecret);

      let is2faValid = false;

      if (otpToken.length === 6) {
        is2faValid = verifyTOTPToken(secret, otpToken);
      } else {
        const codeIndex = await verifyBackupCode(user.backupCodes, otpToken);
        if (codeIndex !== -1) {
          is2faValid = true;
          // Remove used backup code
          const updatedCodes = [...user.backupCodes];
          updatedCodes.splice(codeIndex, 1);
          await prisma.user.update({
            where: { id: user.id },
            data: { backupCodes: updatedCodes },
          });
        }
      }

      if (!is2faValid) {
        return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
      }
    }

    // Sign a short-lived ReAuth Token
    const REAUTH_SECRET = new TextEncoder().encode(
      process.env.NEXTAUTH_SECRET ?? "bizflow-dev-secret"
    );

    const reAuthToken = await new SignJWT({ sub: user.id, type: "reauth" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("5m") // Valid for 5 minutes
      .setIssuer("bizflow")
      .sign(REAUTH_SECRET);

    return NextResponse.json({ success: true, reAuthToken });
  } catch (error: any) {
    console.error("[ReAuth Error]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
