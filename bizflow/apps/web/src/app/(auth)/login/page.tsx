"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Store, Eye, EyeOff, ArrowRight,
  BarChart2, Package, Users, Receipt,
  AlertCircle, ShieldAlert, Clock, CheckCircle,
}  from "lucide-react";

const features = [
  { icon: BarChart2, label: "Real-time Analytics", desc: "Track revenue, profit & trends" },
  { icon: Package, label: "Inventory Control", desc: "Smart stock management & alerts" },
  { icon: Users, label: "CRM & Billing", desc: "Manage customers & invoices" },
  { icon: Receipt, label: "GST Reports", desc: "Auto-generate P&L statements" },
];

// Maps NextAuth error codes → user-friendly messages
function getLoginError(error: string): { message: string; icon: typeof AlertCircle; isVerification?: boolean } {
  if (error.includes("RATE_LIMIT")) {
    return {
      message: "Too many login attempts. Please wait 15 minutes and try again.",
      icon: Clock,
    };
  }
  if (error.includes("EMAIL_NOT_VERIFIED")) {
    return {
      message: "Your email address has not been verified yet. Please check your inbox for the verification code.",
      icon: ShieldAlert,
      isVerification: true,
    };
  }
  if (error.includes("INVALID_CREDENTIALS")) {
    return {
      message: "The email or password you entered is incorrect. Please try again.",
      icon: AlertCircle,
    };
  }
  if (error.includes("EMAIL_PASSWORD_REQUIRED")) {
    return {
      message: "Please enter both your email address and password.",
      icon: AlertCircle,
    };
  }
  return {
    message: "Sign-in failed. Please check your credentials and try again.",
    icon: ShieldAlert,
  };
}

import { Suspense } from "react";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Pre-fill email and show success banner if redirected from verify-email
  useEffect(() => {
    const emailParam = searchParams.get("email");
    const verifiedParam = searchParams.get("verified");
    const resetParam = searchParams.get("reset");
    
    if (verifiedParam === "1") {
      setVerified(true);
      if (emailParam) setForm((f) => ({ ...f, email: decodeURIComponent(emailParam) }));
    }
    
    if (resetParam === "1") {
      setResetSuccess(true);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const errInfo = error ? getLoginError(error) : null;

  return (
    <div className="min-h-screen flex bg-app overflow-hidden">
      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-[#0d0d1a] to-purple-950" />
        <div className="orb-1 absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="orb-2 absolute top-1/2 right-0 w-80 h-80 rounded-full bg-purple-600/15 blur-3xl" />
        <div className="orb-3 absolute -bottom-20 left-1/4 w-72 h-72 rounded-full bg-violet-800/20 blur-3xl" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-xl">BizFlow</span>
              <p className="text-white/40 text-xs">Business Suite</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Run your business
            <br />
            <span className="gradient-text">smarter, faster.</span>
          </h1>
          <p className="text-white/40 text-base mb-10 leading-relaxed">
            The all-in-one platform for kirana stores, FMCG shops, fertilizer dealers, and hardware businesses.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {features.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="p-4 rounded-2xl border"
                style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
              >
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center mb-3">
                  <Icon size={15} className="text-violet-400" />
                </div>
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-white/40 text-xs mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative z-10 p-5 rounded-2xl border"
          style={{ backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-white/40 text-sm leading-relaxed italic">
            &ldquo;Managing stock, invoices, and expenses used to take hours. BizFlow brings it all into one clean dashboard.&rdquo;
          </p>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
              BF
            </div>
            <div>
              <p className="text-white text-sm font-medium">BizFlow User</p>
              <p className="text-white/40 text-xs">Small Business Owner</p>
            </div>
            <div className="ml-auto flex gap-0.5">
              {[...Array(5)].map((_, i) => <span key={i} className="text-amber-400 text-xs">★</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel — Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg" style={{ color: "var(--text-white)" }}>BizFlow</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-white)" }}>
              Welcome back
            </h2>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Sign in to your BizFlow account
            </p>
          </div>

          {/* ── Verified success banner ── */}
          {verified && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-5 border"
              style={{ backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)" }}
              role="status"
            >
              <CheckCircle size={17} className="flex-shrink-0 mt-0.5" style={{ color: "#10b981" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#10b981" }}>Email verified!</p>
                <p className="text-xs mt-0.5" style={{ color: "#6ee7b7" }}>
                  Your account is ready. Sign in to get started.
                </p>
              </div>
            </div>
          )}

          {/* ── Reset success banner ── */}
          {resetSuccess && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-5 border"
              style={{ backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)" }}
              role="status"
            >
              <CheckCircle size={17} className="flex-shrink-0 mt-0.5" style={{ color: "#10b981" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#10b981" }}>Password Reset!</p>
                <p className="text-xs mt-0.5" style={{ color: "#6ee7b7" }}>
                  Your password has been changed successfully. You can now sign in.
                </p>
              </div>
            </div>
          )}

          {/* ── Inline error banner ── */}
          {errInfo && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-5 border"
              style={{
                backgroundColor: errInfo.isVerification ? "rgba(139,92,246,0.08)" : "rgba(239,68,68,0.08)",
                borderColor: errInfo.isVerification ? "rgba(139,92,246,0.3)" : "rgba(239,68,68,0.25)",
              }}
              role="alert"
              aria-live="polite"
            >
              <errInfo.icon
                size={17}
                className="flex-shrink-0 mt-0.5"
                style={{ color: errInfo.isVerification ? "#a78bfa" : "#f87171" }}
              />
              <div>
                <p className="text-sm leading-snug" style={{ color: errInfo.isVerification ? "#a78bfa" : "#f87171" }}>
                  {errInfo.message}
                </p>
                {errInfo.isVerification && (
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(form.email)}`}
                    className="inline-block mt-2 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors underline"
                  >
                    Go to verification page →
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="text-xs font-medium mb-1.5 block"
                style={{ color: "var(--text-secondary)" }}
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={form.email}
                onChange={(e) => { setError(null); setForm({ ...form, email: e.target.value }); }}
                className="input-themed"
                placeholder="you@business.com"
                required
                autoComplete="email"
                inputMode="email"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="text-xs font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => { setError(null); setForm({ ...form, password: e.target.value }); }}
                  className="input-themed pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>


            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-violet-600 to-purple-700 text-white
                hover:from-violet-500 hover:to-purple-600 transition-all duration-200
                shadow-lg shadow-violet-500/25 disabled:opacity-60 disabled:cursor-not-allowed
                hover:shadow-violet-500/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-violet-400 font-semibold hover:text-violet-300 transition-colors">
              Create one free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-app">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
