import bcrypt from "bcryptjs";
import { prisma } from "./db";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

/** Generate a cryptographically random 6-digit OTP string. */
export function generateOtp(): string {
  // Use crypto.getRandomValues for true randomness (no Math.random)
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const num = array[0] % 1_000_000;
  return num.toString().padStart(OTP_LENGTH, "0");
}

/**
 * Create (or replace) an EmailVerification record for the given email.
 * Deletes any existing record first, hashes the OTP, then inserts.
 * Returns the plaintext OTP to be emailed.
 */
export async function createOtpRecord(email: string): Promise<string> {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Delete existing record for this email (one active OTP per email at a time)
  await prisma.emailVerification.deleteMany({ where: { email } });

  await prisma.emailVerification.create({
    data: { email, otpHash, expiresAt },
  });

  return otp;
}

export type VerifyOtpResult =
  | { success: true }
  | { success: false; code: "NOT_FOUND" | "EXPIRED" | "MAX_ATTEMPTS" | "INVALID" };

/**
 * Verify a submitted OTP against the stored hash.
 * Increments the attempt counter on failure.
 * Deletes the record on success.
 */
export async function verifyOtp(email: string, submittedOtp: string): Promise<VerifyOtpResult> {
  const record = await prisma.emailVerification.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return { success: false, code: "NOT_FOUND" };
  if (new Date() > record.expiresAt) {
    await prisma.emailVerification.delete({ where: { id: record.id } });
    return { success: false, code: "EXPIRED" };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return { success: false, code: "MAX_ATTEMPTS" };
  }

  const isValid = await bcrypt.compare(submittedOtp, record.otpHash);

  if (!isValid) {
    // Increment attempt counter
    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { success: false, code: "INVALID" };
  }

  // ── Success: clean up record and mark user as verified ─────────────────────
  await prisma.$transaction([
    prisma.emailVerification.delete({ where: { id: record.id } }),
    prisma.user.updateMany({
      where: { email },
      data: { emailVerified: true },
    }),
  ]);

  return { success: true };
}
