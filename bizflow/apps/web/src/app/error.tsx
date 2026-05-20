"use client";

import { useEffect } from "react";
import { Store, RefreshCw, Home, AlertTriangle } from "lucide-react";
import Link from "next/link";

/**
 * Global error boundary — catches unhandled React runtime errors
 * and displays a polished recovery UI instead of a blank page.
 *
 * Next.js automatically wraps every route segment in an ErrorBoundary
 * and will render this component when an error propagates.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in dev; in production this is where Sentry would go
    console.error("[BizFlow Error Boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-app relative overflow-hidden">
      {/* Animated orbs — same style as not-found.tsx */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-red-600/10 blur-3xl pointer-events-none orb-1" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl pointer-events-none orb-2" />

      <div className="relative z-10 text-center px-6 max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="text-primary font-bold text-lg">BizFlow</span>
        </div>

        {/* Error icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-primary mb-3">
          Something went wrong
        </h1>
        <p className="text-primary/40 text-sm leading-relaxed mb-2">
          An unexpected error occurred. Your data is safe — try refreshing or
          head back to the dashboard.
        </p>

        {/* Error digest (non-sensitive, useful for support) */}
        {error.digest && (
          <p className="text-primary/20 text-xs font-mono mb-6">
            Error reference: {error.digest}
          </p>
        )}

        {!error.digest && <div className="mb-6" />}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-violet-600 to-purple-700 text-white
              hover:from-violet-500 hover:to-purple-600 transition-all duration-200
              shadow-lg shadow-violet-500/25 hover:-translate-y-0.5 cursor-pointer"
          >
            <RefreshCw size={15} />
            Try Again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
              text-primary/40 hover:text-primary transition-colors"
          >
            <Home size={15} />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
