"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Store, Package, CheckCircle2, ArrowRight, Sparkles,
  ChevronRight, Loader2, Zap, LayoutDashboard, Star,
} from "lucide-react";
import { getBusinessProfile } from "@/lib/business-intelligence";

type Step = "welcome" | "seeding" | "categories" | "done";

const CONFETTI_COLORS = ["#8b5cf6", "#a78bfa", "#10b981", "#3b82f6", "#f59e0b", "#ec4899"];

function ConfettiPiece({ style }: { style: React.CSSProperties }) {
  return <div className="confetti-piece absolute rounded-sm" style={style} />;
}

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [seedResult, setSeedResult] = useState<{ displayName: string; emoji: string; seedCount: number } | null>(null);
  const [confetti, setConfetti] = useState<React.CSSProperties[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Get business type from session (injected by next-auth)
  const businessType = (session?.user as any)?.businessType ?? "Other";
  const profile = getBusinessProfile(businessType);

  async function runSeeding() {
    setStep("seeding");
    try {
      const res = await fetch("/api/onboarding/seed", { method: "POST" });
      const data = await res.json();
      if (data.skipped) {
        setSeedResult({ displayName: profile.displayName, emoji: profile.emoji, seedCount: 0 });
      } else {
        setSeedResult(data.profile);
      }
      setTimeout(() => setStep("categories"), 1800);
    } catch {
      setTimeout(() => setStep("categories"), 1800);
    }
  }

  function handleContinue() {
    // Generate confetti
    const pieces = Array.from({ length: 40 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      top: `${-10 - Math.random() * 20}px`,
      width: `${6 + Math.random() * 8}px`,
      height: `${10 + Math.random() * 14}px`,
      backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      transform: `rotate(${Math.random() * 360}deg)`,
      animation: `confettiFall ${1.5 + Math.random()}s ease-in forwards`,
      animationDelay: `${Math.random() * 0.6}s`,
    }));
    setConfetti(pieces);
    setStep("done");
    setTimeout(() => router.push("/"), 2500);
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-app)" }}>
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 0.2; }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to { background-position: 200% center; }
        }
        .animate-float-in { animation: floatIn 0.5s ease-out forwards; }
        .pulse-ring { animation: pulseRing 2s infinite; }
        .shimmer-text {
          background: linear-gradient(90deg, #8b5cf6, #a78bfa, #c4b5fd, #8b5cf6);
          background-size: 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      {/* Confetti layer */}
      {confetti.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confetti.map((style, i) => <ConfettiPiece key={i} style={style} />)}
        </div>
      )}

      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
        style={{ background: "var(--bg-app)" }}>
        {/* Background orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-purple-600/8 blur-3xl" />

        <div className="w-full max-w-lg animate-float-in">

          {/* ── STEP: WELCOME ── */}
          {step === "welcome" && (
            <div className="text-center space-y-8">
              {/* Logo */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="pulse-ring absolute inset-0 rounded-3xl bg-violet-500/20" />
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-purple-700
                    flex items-center justify-center shadow-2xl shadow-violet-500/30 relative">
                    <span className="text-3xl">{profile.emoji}</span>
                  </div>
                </div>
              </div>

              <div>
                <h1 className="text-3xl font-bold text-white mb-3">
                  Your <span className="shimmer-text">{profile.displayName}</span> is ready!
                </h1>
                <p className="text-white/50 text-base">{profile.tagline}</p>
              </div>

              {/* What we'll set up */}
              <div className="rounded-2xl p-5 text-left space-y-3"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-4">
                  We'll automatically set up
                </p>
                {[
                  { icon: "✨", label: `A completely clean slate for your actual inventory` },
                  { icon: "📊", label: `${profile.productCategories.length} product categories tailored by Business Intelligence` },
                  { icon: "💡", label: `Personalized dashboard with ${profile.dashboardWidgets.length} key metrics` },
                  { icon: "📋", label: `${profile.reportTypes.length} industry-specific report templates` },
                  { icon: "🤖", label: "Smart ML engine to improve recommendations over time" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                    <p className="text-sm text-white/60">{item.label}</p>
                  </div>
                ))}
              </div>

              <button onClick={runSeeding}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base
                  bg-gradient-to-r from-violet-600 to-purple-700 text-white
                  hover:from-violet-500 hover:to-purple-600 transition-all duration-200
                  shadow-xl shadow-violet-500/30 hover:-translate-y-0.5">
                <Zap size={18} />
                Set Up My {profile.displayName}
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* ── STEP: SEEDING ── */}
          {step === "seeding" && (
            <div className="text-center space-y-8 py-8">
              <div className="flex justify-center">
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 rounded-full border-4 border-violet-600/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-violet-400" />
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Configuring your workspace…</h2>
                <p className="text-white/40 text-sm">Adding products, categories, and insights</p>
              </div>
              <div className="space-y-2 text-left rounded-2xl p-5"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                {[
                  "Analyzing business type & GST requirements",
                  "Configuring intelligent dashboard widgets",
                  "Training ML recommendation engine",
                  "Setting up smart expense categories",
                ].map((task, i) => (
                  <div key={task} className="flex items-center gap-3 py-1.5"
                    style={{ opacity: 1, animation: `floatIn 0.3s ease-out ${i * 0.15}s both` }}>
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={12} className="text-violet-400" />
                    </div>
                    <p className="text-sm text-white/50">{task}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: CATEGORIES PREVIEW ── */}
          {step === "categories" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                  bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">Setup Complete!</h2>
                <p className="text-white/40 text-sm">Here's what's ready for your {profile.displayName}</p>
              </div>

              {/* Categories grid */}
              <div className="rounded-2xl p-5 space-y-4"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Product Categories</p>
                <div className="flex flex-wrap gap-2">
                  {profile.productCategories.map((cat) => (
                    <span key={cat} className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}>
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Removed starter products UI */}

              {/* Dashboard preview */}
              <div className="rounded-2xl p-5 space-y-3"
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Dashboard Widgets</p>
                <div className="grid grid-cols-2 gap-2">
                  {profile.dashboardWidgets.map((w) => (
                    <div key={w.id} className="flex items-center gap-2 p-2.5 rounded-xl"
                      style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}>
                      <LayoutDashboard size={12} className="text-violet-400" />
                      <span className="text-xs text-white/60">{w.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleContinue}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-base
                  bg-gradient-to-r from-violet-600 to-purple-700 text-white
                  hover:from-violet-500 hover:to-purple-600 transition-all duration-200
                  shadow-xl shadow-violet-500/30 hover:-translate-y-0.5">
                <Star size={18} />
                Go to My Dashboard
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === "done" && (
            <div className="text-center space-y-6 py-8">
              <div className="flex justify-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600
                  flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                  <Store className="w-10 h-10 text-white" />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">You're all set! 🎉</h2>
                <p className="text-white/40">Redirecting to your personalized dashboard…</p>
              </div>
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
