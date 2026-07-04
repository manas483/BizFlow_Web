"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { hasPermission, Permission } from "@/shared/lib/permissions";
import {
  LayoutDashboard, Package, ShoppingCart, Users, UserCheck,
  ReceiptIndianRupee, BarChart3, Bell, Settings, LogOut, ChevronLeft, ChevronRight, Store,
  CalendarCheck, Calculator, Landmark, Shield, FileText, Activity,
} from "lucide-react";
import { cn, getInitials } from "@/shared/lib/utils";
import { useApp } from "@/context/AppContext";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";

const navItems: { href: string; icon: any; label: string; permission: Permission; adminOnly?: boolean; section?: string }[] = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard", permission: "view_dashboard" },
  { href: "/inventory", icon: Package, label: "Inventory", permission: "manage_inventory" },
  { href: "/sales", icon: ShoppingCart, label: "Sales & Billing", permission: "manage_sales" },
  { href: "/customers", icon: Users, label: "Customers", permission: "manage_customers" },
  { href: "/employees", icon: UserCheck, label: "Employees", permission: "manage_employees", adminOnly: true },
  { href: "/expenses", icon: ReceiptIndianRupee, label: "Expenses", permission: "manage_billing" },
  { href: "/reports", icon: BarChart3, label: "Reports", permission: "view_reports" },
  { href: "/my-attendance", icon: CalendarCheck, label: "My Attendance", permission: "view_dashboard", adminOnly: false },
  { href: "/accounting", icon: Calculator, label: "Accounting", permission: "manage_accounting" },
  { href: "/loans", icon: Landmark, label: "Loans", permission: "manage_loans" },
  { href: "/notifications", icon: Bell, label: "Notifications", permission: "view_dashboard" },
  { href: "/settings", icon: Settings, label: "Settings", permission: "manage_settings" },
  // ── Administration ──
  { href: "/admin/audit-trail", icon: FileText, label: "Audit Trail", permission: "view_audit_trail", section: "Admin" },
  { href: "/admin/activity-logs", icon: Activity, label: "Activity Logs", permission: "view_audit_trail", section: "Admin" },
  { href: "/admin/roles", icon: Shield, label: "Roles & Permissions", permission: "manage_roles", section: "Admin" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useApp();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const userName = session?.user?.name ?? "User";
  const userRole = (session?.user as any)?.role ?? "Staff";

  useEffect(() => { setMounted(true); }, []);

  // Close sidebar on mobile when navigating
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [pathname]);



  return (
    <>
      {/* Mobile overlay — only visible on small screens when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Base: fixed on mobile, relative on lg+
          "fixed left-0 top-0 z-30 h-full flex flex-col transition-all duration-300 ease-in-out",
          "bg-surface border-r border-theme",
          // Mobile: slide in/out from left (always w-64 when open, -translate-x-full when closed)
          "lg:relative lg:z-auto lg:translate-x-0",
          // Mobile width is always full sidebar, just toggled via translate
          sidebarOpen
            ? "w-64 translate-x-0"
            : "-translate-x-full lg:translate-x-0 lg:w-16"
        )}
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        {/* Logo */}
        <div className={cn("flex items-center py-5 relative", sidebarOpen ? "justify-between px-4" : "justify-center")} style={{ borderBottom: "1px solid var(--border)", height: "73px" }}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 min-w-[32px] min-h-[32px] flex-shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
                <Store className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>BizFlow</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>Business Suite</p>
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-8 h-8 min-w-[32px] min-h-[32px] flex-shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Store className="w-4 h-4 text-white" />
            </div>
          )}
          {/* L-2: perfectly centered overlap button on the border */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border shadow-sm transition-colors hover:bg-primary/5 hidden lg:flex items-center justify-center"
            style={{ 
              color: "var(--text-muted)", 
              backgroundColor: "var(--bg-surface)", 
              borderColor: "var(--border)",
              zIndex: 50 
            }}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto scrollbar-hide">
          {mounted && (() => {
            const filtered = navItems.filter(item => {
              // Extract role and permissions, falling back to STAFF if session is partially loaded
              const role = (session?.user as any)?.role || "STAFF";
              const userPermissions = (session?.user as any)?.permissions as string[] | undefined;

              // adminOnly=true: only show to SUPER_ADMIN or ADMIN
              if (item.adminOnly === true && role !== 'SUPER_ADMIN' && role !== 'ADMIN') return false;
              // adminOnly=false: hide from SUPER_ADMIN (employee-only pages)
              if (item.adminOnly === false && role === 'SUPER_ADMIN') return false;
              
              // If custom permissions are loaded, use them directly
              if (userPermissions && userPermissions.length > 0) {
                return userPermissions.includes(item.permission);
              }
              
              // Fallback: use static role defaults
              return hasPermission(role as any, item.permission);
            });
            let lastSection: string | undefined;
            return filtered.map((item) => {
              const { href, icon: Icon, label, section } = item;
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              const showDivider = section && section !== lastSection;
              lastSection = section;
              return (
                <div key={href}>
                  {showDivider && sidebarOpen && (
                    <div className="pt-3 pb-1 px-3">
                      <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: "var(--text-muted)" }}>
                        {section}
                      </p>
                      <div className="mt-1 h-px" style={{ background: "var(--border)" }} />
                    </div>
                  )}
                  {showDivider && !sidebarOpen && (
                    <div className="my-2 mx-3 h-px" style={{ background: "var(--border)" }} />
                  )}
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                      active
                        ? "bg-gradient-to-r from-violet-600/30 to-purple-600/10 text-violet-400 border border-violet-500/20"
                        : "hover:bg-primary/5 text-white/50"
                    )}
                    title={!sidebarOpen ? label : undefined}
                    suppressHydrationWarning={false}
                  >
                    <Icon size={18} className={cn("flex-shrink-0", active ? "text-violet-400" : "")} />
                    {sidebarOpen && (
                      <span className={cn("text-sm font-medium truncate", !active && "text-white/60")}>
                        {label}
                      </span>
                    )}
                    {active && sidebarOpen && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                    )}
                    {/* Tooltip for icon-only desktop mode */}
                    {!sidebarOpen && (
                      <div
                        className="absolute left-full ml-2 px-2 py-1 text-white text-xs rounded-lg
                          opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border transition-opacity hidden lg:block"
                        style={{ backgroundColor: "var(--bg-surface-2)", borderColor: "var(--border)" }}
                      >
                        {label}
                      </div>
                    )}
                  </Link>
                </div>
              );
            });
          })()}
        </nav>

        {/* M-6: Bottom logout / user area */}
        <div
          className="flex-shrink-0 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5 px-4 py-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700
                flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {mounted ? getInitials(userName) : "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{mounted ? userName : ""}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{mounted ? userRole : ""}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Link
                  href="/settings"
                  className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  title="Settings"
                >
                  <Settings size={15} />
                </Link>
                <button
                  onClick={() => setLogoutOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400/60 hover:text-rose-400 transition-colors"
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2 gap-1">
              <Link
                href="/settings"
                title="Settings"
                className="w-full flex items-center justify-center py-2 transition-colors hover:bg-primary/5"
                style={{ color: "var(--text-muted)" }}
              >
                <Settings size={16} />
              </Link>
              <button
                onClick={() => setLogoutOpen(true)}
                title="Sign out"
                className="w-full flex items-center justify-center py-2 text-rose-400/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <ConfirmDialog
        open={logoutOpen}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => signOut({ callbackUrl: "/login" })}
      />
    </>
  );
}
