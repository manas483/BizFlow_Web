export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/shared/lib/db";
import { registerSchema } from "@/shared/lib/validations";
import { isDisposableEmail } from "@/shared/lib/disposable-emails";
import { registerRateLimit } from "@/shared/lib/rate-limit";
import { sendOtpEmail } from "@/shared/lib/email";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    // ── 1. IP-level rate limiting: max 5 registrations/hour per IP ──────────
    const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const { success: ipOk } = await registerRateLimit.limit(ip);
    if (!ipOk) {
      return NextResponse.json(
        { message: "Too many registration attempts. Please try again later." },
        { status: 429 }
      );
    }

    // ── 2. Parse and validate body ───────────────────────────────────────────
    const body = await req.json();
    let validatedData: z.infer<typeof registerSchema>;
    try {
      validatedData = registerSchema.parse(body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Zod v4 uses .issues; .errors is an alias but not typed in v4
        const issues = err.issues;
        const firstIssue = issues[0];
        return NextResponse.json(
          {
            message: firstIssue.message,
            field: firstIssue.path[0] ?? "unknown",
            details: issues.map((e: z.core.$ZodIssue) => ({ field: e.path[0], message: e.message })),
          },
          { status: 422 }
        );
      }
      throw err;
    }

    const { email, name, password, businessName, businessType, phone } = validatedData;
    // M-1 / N-2: read plan from body (not part of registerSchema — optional field)
    const rawPlan = (body.plan as string | undefined)?.toUpperCase();
    const plan = (["STARTER", "PRO", "ENTERPRISE"].includes(rawPlan ?? "") ? rawPlan : "STARTER") as "STARTER" | "PRO" | "ENTERPRISE";

    // ── 3. Block disposable / temp email domains ─────────────────────────────
    if (isDisposableEmail(email)) {
      return NextResponse.json(
        {
          message: "Disposable or temporary email addresses are not allowed. Please use your real business email.",
          field: "email",
        },
        { status: 422 }
      );
    }

    // ── 4. Check for duplicate account ──────────────────────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, createdAt: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          message: "An account with this email address already exists. Please sign in instead.",
          field: "email",
          code: "EMAIL_TAKEN",
        },
        { status: 409 } // 409 Conflict — semantically correct for duplicate resource
      );
    }

    // ── 5. Hash password with bcrypt (cost factor 12 for production) ─────────
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── 6. Create Business + User atomically ─────────────────────────────────
    await prisma.$transaction(async (tx: any) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          ownerName: name,
          phone: phone || "0000000000",
          businessType: businessType || "Other",
          plan,
        },
      });

      await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: "SUPER_ADMIN",
          businessId: business.id,
        },
      });
    });

    // ── 7. Send OTP verification email ──────────────────────────────────────
    // Import lazily to avoid circular dependencies
    const { createOtpRecord } = await import("@/shared/lib/otp");
    const otp = await createOtpRecord(email);
    // Non-blocking: if email fails, user can use "Resend" on the verify page
    sendOtpEmail(email, name, otp).catch((err) =>
      console.error("[register] OTP email failed:", err)
    );

    return NextResponse.json(
      {
        message: "Account created! Please check your email for a verification code.",
        email,               // returned so the frontend can pre-fill the verify page
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[register] Unhandled error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

