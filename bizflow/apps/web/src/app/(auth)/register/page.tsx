"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Eye, EyeOff, ArrowRight, Check, AlertCircle, X } from "lucide-react";

const businessTypes = [
  "Kirana Store", "Fertilizer Dealer", "Hardware Store",
  "Construction Materials", "Pharmacy", "Electronics Shop", "Other",
];

const plans = [
  { id: "starter", name: "Starter", price: "Free", desc: "1 user, basic features", recommended: false },
  { id: "pro", name: "Pro", price: "₹499/mo", desc: "5 users, full features", recommended: true },
  { id: "enterprise", name: "Enterprise", price: "₹999/mo", desc: "Unlimited, priority support", recommended: false },
];

// Password strength: returns 0-4
function getPasswordStrength(p: string) {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return score;
}

const strengthColors = ["", "#ef4444", "#f59e0b", "#3b82f6", "#10b981"];
const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];

const passwordRules = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  businessName?: string;
  businessType?: string;
  phone?: string;
  general?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    name: "", email: "", password: "",
    businessName: "", businessType: "", customBusinessType: "", phone: "", plan: "starter",
  });

  const clearError = (field: keyof FieldErrors) =>
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });

  // ── Client-side step-1 validation ───────────────────────────────────────────
  const validateStep1 = (): boolean => {
    const errs: FieldErrors = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = "Please enter your full name (at least 2 characters).";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Please enter a valid email address.";
    const strength = getPasswordStrength(form.password);
    if (strength < 4)
      errs.password = "Password does not meet the requirements below.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: FieldErrors = {};
    if (!form.businessName.trim() || form.businessName.trim().length < 2)
      errs.businessName = "Please enter your business name (at least 2 characters).";
    if (!form.businessType)
      errs.businessType = "Please select a business type.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => { setErrors({}); setStep((s) => Math.max(s - 1, 1)); };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) { handleNext(); return; }
    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          businessName: form.businessName.trim(),
          businessType: form.businessType === "Other" ? form.customBusinessType : form.businessType,
          phone: form.phone,
          plan: form.plan.toUpperCase(), // M-1: send selected plan
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // ── 409: duplicate account ──
        if (res.status === 409) {
          setErrors({
            email: data.message || "An account with this email already exists. Please sign in.",
            general: "DUPLICATE",
          });
          setStep(1); // bring them back to step 1 to see the email error
          setLoading(false);
          return;
        }
        // ── 422: validation error with field info ──
        if (res.status === 422 && data.field) {
          const fieldMap: Record<string, keyof FieldErrors> = {
            email: "email", password: "password", name: "name",
            businessName: "businessName", phone: "phone",
          };
          const field = fieldMap[data.field as string] ?? "general";
          setErrors({ [field]: data.message });
          if (["name", "email", "password"].includes(data.field)) setStep(1);
          setLoading(false);
          return;
        }
        // ── 429: rate limited ──
        if (res.status === 429) {
          setErrors({ general: data.message || "Too many requests. Please wait and try again." });
          setLoading(false);
          return;
        }
        // ── generic ──
        setErrors({ general: data.message || "Registration failed. Please try again." });
        setLoading(false);
        return;
      }

      // ── Success: redirect to email verification ──────────────────────────
      if (data.requiresVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
        return;
      }
      // Fallback (should not happen): go to onboarding
      router.push("/onboarding");
    } catch {
      setErrors({ general: "A network error occurred. Please check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength(form.password);

  return (
    <div className="min-h-screen flex bg-app overflow-hidden">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-[#0d0d1a] to-purple-950" />
        <div className="orb-1 absolute -top-20 -left-20 w-80 h-80 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="orb-2 absolute bottom-0 right-0 w-96 h-96 rounded-full bg-purple-600/15 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">BizFlow</span>
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-6">
            Start managing your
            <br />
            <span className="gradient-text">business today.</span>
          </h1>

          {/* Steps indicator */}
          <div className="space-y-4">
            {["Create Account", "Business Details", "Choose Plan"].map((s, i) => {
              const idx = i + 1;
              const done = step > idx;
              const active = step === idx;
              return (
                <div key={s} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    done ? "bg-violet-600 text-white"
                    : active ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30"
                    : "text-white/40 border border-white/20"
                  }`}>
                    {done ? <Check size={14} /> : idx}
                  </div>
                  <span className={`text-sm font-medium ${active ? "text-white" : done ? "text-violet-400" : "text-white/40"}`}>
                    {s}
                  </span>
                  {done && <Check size={14} className="text-violet-400 ml-auto" />}
                </div>
              );
            })}
          </div>

          <div className="mt-12 space-y-3">
            {[
              { icon: "✓", label: "GST invoicing & billing" },
              { icon: "✓", label: "Inventory & stock alerts" },
              { icon: "✓", label: "Expense tracking & reports" },
              { icon: "✓", label: "Employee & leave management" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2.5">
                <span className="text-violet-400 font-bold text-sm">{f.icon}</span>
                <span className="text-white/60 text-sm">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg" style={{ color: "var(--text-white)" }}>BizFlow</span>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Step {step} of 3</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {step === 1 ? "Account Details" : step === 2 ? "Business Info" : "Choose Plan"}
              </p>
            </div>
            <div className="h-1 rounded-full" style={{ backgroundColor: "var(--border)" }}>
              <div
                className="h-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 transition-all duration-500"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold" style={{ color: "var(--text-white)" }}>
              {step === 1 ? "Create your account" : step === 2 ? "Tell us about your business" : "Select a plan"}
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {step === 1 ? "Fill in your personal details to get started"
                : step === 2 ? "Help us personalise your BizFlow experience"
                : "Start free, upgrade anytime"}
            </p>
          </div>

          {/* ── General error banner ── */}
          {errors.general && errors.general !== "DUPLICATE" && (
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-5 border"
              style={{ backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}
              role="alert"
            >
              <AlertCircle size={17} className="flex-shrink-0 mt-0.5" style={{ color: "#f87171" }} />
              <p className="text-sm" style={{ color: "#f87171" }}>{errors.general}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            {/* ── Step 1: Account ── */}
            {step === 1 && (
              <>
                {/* Full Name */}
                <div>
                  <label htmlFor="reg-name" className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Full Name</label>
                  <input
                    id="reg-name"
                    type="text"
                    value={form.name}
                    placeholder="Vikram Patel"
                    onChange={(e) => { clearError("name"); setForm({ ...form, name: e.target.value }); }}
                    className={`input-themed ${errors.name ? "border-red-500/60" : ""}`}
                    autoComplete="name"
                  />
                  {errors.name && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#f87171" }}>
                      <AlertCircle size={12} />{errors.name}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="reg-email" className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Email Address</label>
                  <input
                    id="reg-email"
                    type="email"
                    value={form.email}
                    placeholder="you@business.com"
                    onChange={(e) => { clearError("email"); setForm({ ...form, email: e.target.value }); }}
                    className={`input-themed ${errors.email ? "border-red-500/60" : ""}`}
                    autoComplete="email"
                    inputMode="email"
                  />
                  {errors.email && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#f87171" }}>
                      <AlertCircle size={12} />{errors.email}
                    </p>
                  )}
                  {errors.general === "DUPLICATE" && (
                    <div
                      className="mt-2 p-3 rounded-lg border text-xs"
                      style={{ backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", color: "#f87171" }}
                    >
                      Already have an account?{" "}
                      <Link href="/login" className="font-semibold underline text-violet-400">Sign in here →</Link>
                    </div>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="reg-password" className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Password</label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      placeholder="Min 8 chars with A-Z, 0-9, @#$"
                      onChange={(e) => { clearError("password"); setForm({ ...form, password: e.target.value }); setShowRules(true); }}
                      onFocus={() => setShowRules(true)}
                      className={`input-themed pr-10 ${errors.password ? "border-red-500/60" : ""}`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "var(--text-muted)" }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#f87171" }}>
                      <AlertCircle size={12} />{errors.password}
                    </p>
                  )}

                  {/* Strength meter */}
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all"
                            style={{ backgroundColor: i <= passwordStrength ? strengthColors[passwordStrength] : "var(--border)" }} />
                        ))}
                      </div>
                      <p className="text-[11px]" style={{ color: strengthColors[passwordStrength] || "var(--text-muted)" }}>
                        {strengthLabels[passwordStrength]} password
                      </p>
                    </div>
                  )}

                  {/* Rules checklist */}
                  {showRules && (
                    <div className="mt-2.5 space-y-1">
                      {passwordRules.map((rule) => {
                        const ok = rule.test(form.password);
                        return (
                          <div key={rule.label} className="flex items-center gap-2">
                            {ok
                              ? <Check size={11} style={{ color: "#10b981" }} />
                              : <X size={11} style={{ color: "var(--text-muted)" }} />}
                            <span className="text-[11px]" style={{ color: ok ? "#10b981" : "var(--text-muted)" }}>
                              {rule.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Step 2: Business ── */}
            {step === 2 && (
              <>
                <div>
                  <label htmlFor="reg-biz" className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Business Name</label>
                  <input
                    id="reg-biz"
                    type="text"
                    value={form.businessName}
                    placeholder="My Kirana Store"
                    onChange={(e) => { clearError("businessName"); setForm({ ...form, businessName: e.target.value }); }}
                    className={`input-themed ${errors.businessName ? "border-red-500/60" : ""}`}
                  />
                  {errors.businessName && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#f87171" }}>
                      <AlertCircle size={12} />{errors.businessName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>Business Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {businessTypes.map((type) => (
                      <button type="button" key={type}
                        onClick={() => { clearError("businessType"); setForm({ ...form, businessType: type }); }}
                        className="py-2 px-3 rounded-xl text-xs font-medium text-left transition-all"
                        style={{
                          backgroundColor: form.businessType === type ? "rgba(139,92,246,0.2)" : "var(--input-bg)",
                          border: `1px solid ${form.businessType === type ? "rgba(139,92,246,0.5)" : errors.businessType ? "rgba(239,68,68,0.4)" : "var(--input-border)"}`,
                          color: form.businessType === type ? "#a78bfa" : "var(--text-secondary)",
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {errors.businessType && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#f87171" }}>
                      <AlertCircle size={12} />{errors.businessType}
                    </p>
                  )}
                  {form.businessType === "Other" && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={form.customBusinessType}
                        placeholder="Please specify your business type"
                        onChange={(e) => setForm({ ...form, customBusinessType: e.target.value })}
                        className="input-themed"
                      />
                      <p className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                        This helps our ML engine set up the right templates and predictions for your specific store.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-phone" className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                    Phone Number
                    <span className="text-[10px] font-normal opacity-50">(optional)</span>
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={form.phone}
                    placeholder="+91 98765 43210"
                    onChange={(e) => { clearError("phone"); setForm({ ...form, phone: e.target.value }); }}
                    className={`input-themed ${errors.phone ? "border-red-500/60" : ""}`}
                    autoComplete="tel"
                    inputMode="tel"
                  />
                  {errors.phone && (
                    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#f87171" }}>
                      <AlertCircle size={12} />{errors.phone}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ── Step 3: Plan ── */}
            {step === 3 && (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button type="button" key={plan.id}
                    onClick={() => setForm({ ...form, plan: plan.id })}
                    className="w-full p-4 rounded-2xl text-left transition-all relative"
                    style={{
                      backgroundColor: form.plan === plan.id ? "rgba(139,92,246,0.15)" : "var(--input-bg)",
                      border: `1px solid ${form.plan === plan.id ? "rgba(139,92,246,0.5)" : "var(--input-border)"}`,
                    }}
                  >
                    {plan.recommended && (
                      <span className="absolute top-3 right-3 text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-medium">
                        Recommended
                      </span>
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 ${
                        form.plan === plan.id ? "border-violet-500 bg-violet-500" : "border-white/30"
                      }`}>
                        {form.plan === plan.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: "var(--text-white)" }}>{plan.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{plan.desc}</p>
                        <p className="text-violet-400 font-bold text-sm mt-1">{plan.price}</p>
                      </div>
                    </div>
                  </button>
                ))}
                <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                  No credit card required for Starter plan
                </p>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <button type="button" onClick={handleBack}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ backgroundColor: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text-secondary)" }}
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm
                  bg-gradient-to-r from-violet-600 to-purple-700 text-white
                  hover:from-violet-500 hover:to-purple-600 transition-all duration-200
                  shadow-lg shadow-violet-500/25 disabled:opacity-60 hover:-translate-y-0.5"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating Account...</>
                ) : step < 3 ? (
                  <>Continue <ArrowRight size={16} /></>
                ) : (
                  <>Create Account <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text-secondary)" }}>
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 font-semibold hover:text-violet-300 transition-colors">
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
