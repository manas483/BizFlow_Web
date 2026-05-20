"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff,
  Clock, User, Building2, Shield, Lock, Loader2
} from "lucide-react";
import Link from "next/link";

// ── Password strength ─────────────────────────────────────────────────────────
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 4) return { score, label: "Fair", color: "bg-amber-500" };
  if (score <= 5) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  STAFF: "Staff",
  CUSTOM_ROLE: "Custom Role",
};

// ── Main form (inside Suspense for useSearchParams) ───────────────────────────
function AcceptInvitationForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [inviteInfo, setInviteInfo] = useState<{
    email: string;
    role: string;
    businessName: string;
    expiresInHours: number;
  } | null>(null);

  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing invitation token. Please use the link from your email.");
      setValidating(false);
      return;
    }
    fetch(`/api/auth/accept-invitation?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invalid invitation");
        setInviteInfo(data);
      })
      .catch((err: Error) => {
        setError(err.message || "This invitation link is invalid or has expired.");
      })
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (passwordStrength.score < 3) { setError("Please use a stronger password."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details?.[0]?.message || "Failed to activate account");
      setSuccess(true);
      setTimeout(() => router.push("/login"), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to activate account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Validating ──
  if (validating) {
    return (
      <div className="text-center py-12">
        <div className="w-10 h-10 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Validating your invitation…</p>
      </div>
    );
  }

  // ── Success ──
  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Account Activated!</h2>
        <p className="text-slate-500 mb-2 text-sm">
          Your account has been successfully set up. Redirecting to login…
        </p>
        {inviteInfo && (
          <p className="text-xs text-slate-400 mb-6">
            Role: <strong className="text-violet-600">{ROLE_LABELS[inviteInfo.role] || inviteInfo.role}</strong>
            {" "}at <strong className="text-slate-600">{inviteInfo.businessName}</strong>
          </p>
        )}
        <button
          onClick={() => router.push("/login")}
          className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-colors"
        >
          Go to Login →
        </button>
      </div>
    );
  }

  // ── Invalid token ──
  if (!token || (!inviteInfo && error)) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Invalid Invitation</h2>
        <p className="text-slate-500 text-sm mb-6">{error}</p>
        <Link href="/login" className="text-sm text-violet-600 hover:text-violet-500 underline underline-offset-2 transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  // ── Main Form ──
  return (
    <div>
      {/* Heading */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Accept Invitation</h2>
        <p className="text-slate-500 text-sm">Set your password to activate your account.</p>
      </div>

      {/* Invitation info card */}
      {inviteInfo && (
        <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <User size={13} className="text-violet-500 shrink-0" />
            <span className="text-slate-400">Account:</span>
            <span className="font-medium text-slate-700">{inviteInfo.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Shield size={13} className="text-violet-500 shrink-0" />
            <span className="text-slate-400">Role:</span>
            <span className="font-semibold text-violet-600">{ROLE_LABELS[inviteInfo.role] || inviteInfo.role}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Building2 size={13} className="text-violet-500 shrink-0" />
            <span className="text-slate-400">Organization:</span>
            <span className="font-medium text-slate-700">{inviteInfo.businessName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock size={13} className={inviteInfo.expiresInHours <= 24 ? "text-amber-500 shrink-0" : "text-emerald-500 shrink-0"} />
            <span className="text-slate-400">Expires in:</span>
            <span className={`font-semibold ${inviteInfo.expiresInHours <= 24 ? "text-amber-600" : "text-emerald-600"}`}>
              {inviteInfo.expiresInHours}h
            </span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Lock size={13} className="inline mr-1.5 text-slate-400" />
            New Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong password"
              disabled={!token || !inviteInfo}
              className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 pr-10 text-sm
                text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400
                focus:bg-white disabled:opacity-50 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Strength meter */}
          {password && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-all ${
                      i <= passwordStrength.score ? passwordStrength.color : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-400">
                Strength:{" "}
                <span className={`font-semibold ${
                  passwordStrength.score <= 2 ? "text-red-500"
                  : passwordStrength.score <= 4 ? "text-amber-600"
                  : "text-emerald-600"
                }`}>
                  {passwordStrength.label}
                </span>
              </p>
            </div>
          )}
          {!password && (
            <p className="text-xs text-slate-400 mt-1.5">
              Min 8 chars · uppercase · lowercase · number · special character
            </p>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <Lock size={13} className="inline mr-1.5 text-slate-400" />
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              disabled={!token || !inviteInfo}
              className={`w-full border rounded-xl px-3 py-2.5 pr-10 text-sm text-slate-800
                placeholder:text-slate-400 focus:outline-none transition-colors bg-slate-50 focus:bg-white disabled:opacity-50
                ${confirmPassword && confirmPassword !== password
                  ? "border-red-300 focus:border-red-400"
                  : confirmPassword && confirmPassword === password
                  ? "border-emerald-300 focus:border-emerald-400"
                  : "border-slate-200 focus:border-violet-400"
                }`}
            />
            {confirmPassword && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {confirmPassword === password
                  ? <CheckCircle2 size={15} className="text-emerald-500" />
                  : <AlertCircle size={15} className="text-red-400" />
                }
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!token || !inviteInfo || loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
              bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Activating…" : "Activate My Account"}
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        By activating, you agree to our{" "}
        <Link href="#" className="text-violet-600 hover:text-violet-500 transition-colors">Terms of Service</Link>
        {" "}and{" "}
        <Link href="#" className="text-violet-600 hover:text-violet-500 transition-colors">Privacy Policy</Link>.
      </p>
    </div>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────
export default function AcceptInvitationPage() {
  return (
    // Force light mode for this standalone page — overrides the global dark class
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8"
      style={{ backgroundColor: "#f1f5f9" }}>
      <div className="w-full max-w-[960px] rounded-3xl overflow-hidden flex shadow-2xl"
        style={{ backgroundColor: "#ffffff" }}>

        {/* Left — Branding */}
        <div className="hidden lg:flex w-[45%] shrink-0 flex-col justify-between p-12 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #7c3aed 0%, #4338ca 100%)" }}>
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-20"
            style={{ background: "rgba(255,255,255,0.3)" }} />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full opacity-10"
            style={{ background: "rgba(255,255,255,0.4)" }} />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">BizFlow</span>
          </div>

          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Welcome to<br />the Team! 🎉
            </h1>
            <p className="text-white/70 text-sm mb-8 leading-relaxed">
              Your organization has invited you to their business management platform. Set up your credentials securely to get started.
            </p>
            <div className="space-y-3">
              {[
                { icon: "🔐", text: "Secure, tokenized invitation link" },
                { icon: "🛡️", text: "Role-based access control (RBAC)" },
                { icon: "✅", text: "Email verified automatically" },
                { icon: "🔒", text: "End-to-end encrypted credentials" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                  <span>{item.icon}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            © 2026 BizFlow SaaS. All rights reserved.
          </p>
        </div>

        {/* Right — Form */}
        <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-14"
          style={{ backgroundColor: "#ffffff" }}>
          <div className="w-full max-w-[400px]">
            <Suspense fallback={
              <div className="text-center py-10">
                <div className="w-8 h-8 rounded-full border-2 border-violet-300 border-t-violet-600 animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Loading…</p>
              </div>
            }>
              <AcceptInvitationForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
