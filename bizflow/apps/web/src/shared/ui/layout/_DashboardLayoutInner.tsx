"use client";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingCart, Users,
  BarChart3, Settings,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const mobileNav = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/inventory", icon: Package, label: "Stock" },
  { href: "/sales", icon: ShoppingCart, label: "Sales" },
  { href: "/customers", icon: Users, label: "Customers" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

// This component is imported with { ssr: false } via DashboardLayout.tsx
// — it is never server-rendered, so browser extension attribute injection
// cannot cause a hydration mismatch.
export default function DashboardLayoutInner({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex h-screen bg-app items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-app text-primary overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto scrollbar-thin flex flex-col">
          <div className="p-3 sm:p-4 lg:p-6 flex-1 flex flex-col">
            {children}
          </div>
          {/* Safe spacer to guarantee bottom padding even when content overflows heavily */}
          <div className="shrink-0 h-24 lg:h-10 w-full" />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t flex items-center justify-around px-1"
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border)",
          backdropFilter: "blur(20px)",
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
          paddingTop: "6px",
        }}
      >
        {mobileNav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all duration-200 min-w-0 flex-1",
                active ? "text-violet-400" : "text-white/40"
              )}
            >
              <Icon size={20} className={active ? "text-violet-400" : ""} />
              <span className="text-[10px] font-medium truncate">{label}</span>
              {active && (
                <div className="w-1 h-1 rounded-full bg-violet-400 mt-0.5" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
