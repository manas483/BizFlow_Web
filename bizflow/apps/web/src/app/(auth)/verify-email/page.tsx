"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Store, CheckCircle, AlertCircle, RefreshCw, Mail } from "lucide-react";

type PageState = "idle" | "submitting" | "resending" | "success";

const RESEND_COOLDOWN_SECONDS = 60;

import { Suspense } from "react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email") ?? "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [state, setState] = useState<PageState>("idle");
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start cooldown timer on mount (OTP already sent during registration)
  useEffect(() => {
    startCooldown();
    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }

  // ── OTP input handlers ──────────────────────────────────────────────────────
  function handleOtpChange(index: number, value: string) {
    // Accept only digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError("");

    // Auto-advance to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newOtp = [...otp];
    pasted.split("").forEach((d, i) => { newOtp[i] = d; });
    setOtp(newOtp);
    setError("");
    // Focus last filled or last box
    const lastIdx = Math.min(pasted.length, 5);
    inputRefs.current[lastIdx]?.focus();
  }

  // ── Verify ──────────────────────────────────────────────────────────────────
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setState("submitting");
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailFromUrl, otp: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msgs: Record<string, string> = {
          EXPIRED: "Your code has expired. Please request a new one below.",
          MAX_ATTEMPTS: "Too many incorrect attempts. Please request a new code.",
          NOT_FOUND: "No code found. Please request a new one below.",
          INVALID: "Incorrect code. Please try again.",
          RATE_LIMIT: "Too many attempts. Please wait a moment.",
        };
        setError(msgs[data.code] ?? data.message ?? "Verification failed. Please try again.");
        setState("idle");

        // Auto-clear OTP on wrong code
        if (data.code === "INVALID") setOtp(["", "", "", "", "", ""]);
        return;
      }

      // ── Email verified! Show success then redirect ──────────────────────
      setState("success");
      // Auto-redirect after 4 seconds so user can read the message
      setTimeout(() => {
        router.push(`/login?verified=1&email=${encodeURIComponent(emailFromUrl)}`);
      }, 4000);
    } catch {
      setError("A network error occurred. Please try again.");
      setState("idle");
    }
  }

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendCooldown > 0 || state === "resending") return;
    setState("resending");
    setError("");

    try {
      const res = await fetch("/api/auth/verify-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailFromUrl }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setError("Too many requests. Please wait before requesting a new code.");
      } else if (!res.ok) {
        setError(data.message ?? "Failed to resend code. Please try again.");
      } else {
        setOtp(["", "", "", "", "", ""]);
        startCooldown();
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError("A network error occurred. Please try again.");
    } finally {
      setState("idle");
    }
  }

  const isComplete = otp.every((d) => d !== "");
  const maskedEmail = emailFromUrl
    ? emailFromUrl.replace(/^(.{2})(.+)(@.+)$/, (_, a, b, c) => a + b.replace(/./g, "•") + c)
    : "your email";

  // ── Success screen ────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app p-6">
        <div className="w-full max-w-sm text-center">
          {/* Success icon */}
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-2"
            style={{ backgroundColor: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.3)" }}
          >
            <CheckCircle size={44} style={{ color: "#10b981" }} />
          </div>

          {/* Logo */}
          <div className="flex items-center gap-2 justify-center mb-6">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Store className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-base" style={{ color: "var(--text-white)" }}>BizFlow</span>
          </div>

          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-white)" }}>
            Account created successfully!
          </h2>
          <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>
            Your email has been verified and your account is ready.
            <br />Welcome to BizFlow!
          </p>
          <p className="text-xs mb-8" style={{ color: "var(--text-muted)" }}>
            Redirecting you to sign in automatically…
          </p>

          {/* Manual sign-in button */}
          <Link
            href={`/login?verified=1&email=${encodeURIComponent(emailFromUrl)}`}
            className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm
              bg-gradient-to-r from-violet-600 to-purple-700 text-white
              hover:from-violet-500 hover:to-purple-600 transition-all duration-200
              shadow-lg shadow-violet-500/25 hover:-translate-y-0.5"
          >
            Sign In to Your Account →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl" style={{ color: "var(--text-white)" }}>BizFlow</span>
        </div>

        {/* Mail icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border"
          style={{ backgroundColor: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.25)" }}
        >
          <Mail size={28} style={{ color: "#a78bfa" }} />
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-white)" }}>
            Check your inbox
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            We sent a 6-digit verification code to
            <br />
            <span className="font-semibold" style={{ color: "var(--text-white)" }}>{maskedEmail}</span>
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="flex items-start gap-3 p-4 rounded-xl mb-5 border"
            style={{ backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
            role="alert"
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
            <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          {/* OTP boxes */}
          <div>
            <label className="text-xs font-medium mb-3 block text-center" style={{ color: "var(--text-secondary)" }}>
              Enter verification code
            </label>
            <div className="flex gap-3 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste}
                  className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all outline-none"
                  style={{
                    backgroundColor: "var(--input-bg)",
                    borderColor: error
                      ? "rgba(239,68,68,0.5)"
                      : digit
                      ? "rgba(139,92,246,0.6)"
                      : "var(--input-border)",
                    color: "var(--text-white)",
                    caretColor: "#7c3aed",
                  }}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>
            <p className="text-[11px] text-center mt-2" style={{ color: "var(--text-muted)" }}>
              Code expires in 10 minutes
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isComplete || state === "submitting"}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
              bg-gradient-to-r from-violet-600 to-purple-700 text-white
              hover:from-violet-500 hover:to-purple-600 transition-all duration-200
              shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed
              hover:-translate-y-0.5"
          >
            {state === "submitting" ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying…</>
            ) : "Verify Email"}
          </button>
        </form>

        {/* Resend */}
        <div className="mt-6 text-center">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Didn&apos;t receive the code?
          </p>
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || state === "resending"}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: resendCooldown > 0 ? "var(--text-muted)" : "#a78bfa" }}
          >
            <RefreshCw size={13} className={state === "resending" ? "animate-spin" : ""} />
            {state === "resending"
              ? "Sending…"
              : resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : "Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-app">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
