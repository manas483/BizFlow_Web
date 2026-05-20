"use client";

import { useState } from "react";
import Link from "next/link";
import { Store, ArrowLeft, Mail, CheckCircle, AlertCircle } from "lucide-react";

type State = "idle" | "loading" | "success" | "error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.ok) {
        setState("success");
      } else {
        const data = await res.json();
        if (res.status === 429) {
          setErrorMsg("Too many requests. Please wait a few minutes before trying again.");
        } else {
          setErrorMsg(data.message || "Something went wrong. Please try again.");
        }
        setState("error");
      }
    } catch {
      setErrorMsg("A network error occurred. Please check your connection.");
      setState("error");
    }
  };

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

        {state === "success" ? (
          /* ── Success state ── */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/25 flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={28} style={{ color: "#10b981" }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-white)" }}>Check your inbox</h2>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              If an account exists for <span className="font-semibold text-violet-400">{email}</span>,
              you will receive a password reset link shortly.
            </p>
            <p className="text-xs mb-8" style={{ color: "var(--text-muted)" }}>
              Didn&apos;t receive it? Check your spam folder or wait a few minutes.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-violet-400 font-semibold hover:text-violet-300 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-white)" }}>
                Reset your password
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Enter your account email and we&apos;ll send you a secure reset link.
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

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="forgot-email"
                  className="text-xs font-medium mb-1.5 block"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setState("idle"); setErrorMsg(""); }}
                    className="input-themed"
                    placeholder="you@business.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                  />
                  <Mail
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  />
                </div>
                {errorMsg && state === "idle" && (
                  <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#f87171" }}>
                    <AlertCircle size={12} />{errorMsg}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={state === "loading"}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm
                  bg-gradient-to-r from-violet-600 to-purple-700 text-white
                  hover:from-violet-500 hover:to-purple-600 transition-all duration-200
                  shadow-lg shadow-violet-500/25 disabled:opacity-60"
              >
                {state === "loading" ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                ) : "Send Reset Link"}
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
    </div>
  );
}
