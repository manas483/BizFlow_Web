"use server";

import { signIn } from "@/shared/lib/auth";
import { CredentialsSignin } from "next-auth";

export async function loginAction(formData: {
  email: string;
  password: string;
  otpToken?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await signIn("credentials", {
      email: formData.email,
      password: formData.password,
      otpToken: formData.otpToken ?? "",
      redirect: false,
    });

    return { success: true };
  } catch (error: any) {
    // NextAuth v5 wraps CredentialsSignin errors — extract the custom code
    if (error instanceof CredentialsSignin) {
      return { success: false, error: error.code || "INVALID_CREDENTIALS" };
    }

    // NextAuth v5 may also wrap the error in a CallbackRouteError
    if (error?.cause?.err instanceof CredentialsSignin) {
      return { success: false, error: error.cause.err.code || "INVALID_CREDENTIALS" };
    }

    // NEXT_REDIRECT is thrown by NextAuth on success — re-throw it
    if (error?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw error;
    }

    // Fallback: try to extract code from error message
    const msg = error?.message ?? error?.code ?? "";
    const knownCodes = [
      "RATE_LIMIT_IP", "RATE_LIMIT_EMAIL", "EMAIL_NOT_VERIFIED",
      "INVALID_CREDENTIALS", "EMAIL_PASSWORD_REQUIRED",
      "REQUIRES_2FA", "INVALID_2FA_CODE",
    ];
    for (const code of knownCodes) {
      if (msg.includes(code)) {
        return { success: false, error: code };
      }
    }

    return { success: false, error: "UNKNOWN_ERROR" };
  }
}
