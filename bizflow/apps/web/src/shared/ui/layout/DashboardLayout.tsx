"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

// ── SSR completely disabled for the layout shell ─────────────────────────────
// Browser extensions like Retriever inject custom attributes (rtrvr-ls, rtrvr-ro)
// into DOM nodes before React hydrates server-rendered HTML, causing hydration
// mismatches. By importing the inner layout with { ssr: false }, Next.js never
// server-renders it — React builds the DOM directly on the client, so there is
// no server/client HTML diff for the extension to create.
const InnerLayout = dynamic(() => import("./_DashboardLayoutInner"), { ssr: false });

export default function DashboardLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Minimal skeleton — same dimensions, no interactive elements
    return (
      <div className="flex h-screen bg-app text-primary overflow-hidden" suppressHydrationWarning>
        <div className="w-64 shrink-0" style={{ background: "var(--bg-surface)", borderRight: "1px solid var(--border)" }} suppressHydrationWarning />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" suppressHydrationWarning>
          <div className="h-14 shrink-0" style={{ borderBottom: "1px solid var(--border)" }} suppressHydrationWarning />
          <main className="flex-1 overflow-y-auto" suppressHydrationWarning>
            <div className="p-3 sm:p-4 lg:p-6 pb-20 lg:pb-6 animate-pulse space-y-6" suppressHydrationWarning>
              <div className="h-8 w-56 rounded-xl" style={{ background: "var(--bg-surface)" }} suppressHydrationWarning />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" suppressHydrationWarning>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--bg-surface)" }} suppressHydrationWarning />
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" suppressHydrationWarning>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-40 rounded-2xl" style={{ background: "var(--bg-surface)" }} suppressHydrationWarning />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return <InnerLayout title={title}>{children}</InnerLayout>;
}
