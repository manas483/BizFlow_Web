"use client";

import Link from "next/link";
import { Store, Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app relative overflow-hidden">
      {/* Animated orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 text-center px-6 max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="text-primary font-bold text-lg">BizFlow</span>
        </div>

        {/* 404 */}
        <p className="text-8xl font-black text-violet-500/20 leading-none select-none mb-2">404</p>
        <h1 className="text-2xl font-bold text-primary mb-3">Page not found</h1>
        <p className="text-primary/40 text-sm leading-relaxed mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-violet-600 to-purple-700 text-white
              hover:from-violet-500 hover:to-purple-600 transition-all duration-200
              shadow-lg shadow-violet-500/25 hover:-translate-y-0.5"
          >
            <Home size={15} />
            Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
              text-primary/40 hover:text-primary transition-colors"
          >
            <ArrowLeft size={15} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
