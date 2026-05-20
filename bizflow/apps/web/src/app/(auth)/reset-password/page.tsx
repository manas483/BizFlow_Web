"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Store, ArrowLeft, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setErrorMsg("Invalid or missing reset token. Please request a new password reset link.");
      return;
    }
    
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }
    
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setState("success");
        setTimeout(() => {
          router.push("/login?reset=1");
        }, 3000);
      } else {
        const data = await res.json();
        setErrorMsg(data.message || "Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setErrorMsg("A network error occurred. Please check your connection.");
      setState("error");
    }
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10 justify-center">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
          <Store className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-xl" style={{ color: "var(--text-white)" }}>BizFlow</span>
      </div>

      {state === "success" ? (
        /* ── Success state ── */
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/25 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={28} style={{ color: "#10b981" }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-white)" }}>Password Reset!</h2>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Your password has been changed successfully. You can now sign in with your new password.
          </p>
          <p className="text-xs mb-8 flex justify-center">
            <span className="w-5 h-5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>Redirecting to sign in...</p>
        </div>
      ) : (
        /* ── Form state ── */
        <>
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-white)" }}>
              Create new password
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Please enter your new password below.
            </p>
          </div>

          {/* Error banner */}
          {state === "error" && errorMsg && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-5 border"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
              role="alert"
            >
              <AlertCircle size={17} className="flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
              <p className="text-sm" style={{ color: "#f87171" }}>{errorMsg}</p>
            </div>
          )}

          {!token && state === "idle" && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-5 border"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
            >
              <AlertCircle size={17} className="flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
              <p className="text-sm" style={{ color: "#f87171" }}>
                Missing reset token. Please use the exact link sent to your email.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="new-password"
                className="text-xs font-medium mb-1.5 block"
                style={{ color: "var(--text-secondary)" }}
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setState("idle"); setErrorMsg(""); }}
                  className="input-themed"
                  placeholder="At least 8 characters"
                  required
                  disabled={!token}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/5 rounded-md transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff size={15} style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <Eye size={15} style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="text-xs font-medium mb-1.5 block"
                style={{ color: "var(--text-secondary)" }}
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setState("idle"); setErrorMsg(""); }}
                  className="input-themed"
                  placeholder="Re-enter new password"
                  required
                  disabled={!token}
                />
                <Lock
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-muted)" }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={state === "loading" || !token}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-violet-600 to-purple-700 text-white
                hover:from-violet-500 hover:to-purple-600 transition-all duration-200
                shadow-lg shadow-violet-500/25 disabled:opacity-60"
            >
              {state === "loading" ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating...</>
              ) : "Reset Password"}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary)" }}>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-violet-400 font-semibold hover:text-violet-300 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app p-6">
      <Suspense fallback={<div className="w-8 h-8 border-4 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
