"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Menu, LogOut, Settings, Check, User, Sun, Moon } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getInitials } from "@/shared/lib/utils";
import { useSession, signOut } from "next-auth/react";
import { useNotifications, useMarkAllNotificationsRead, useNotificationCount } from "@/shared/hooks/useNotifications";
import Link from "next/link";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";

export default function Topbar({ title }: { title: string }) {
  const { setSidebarOpen, sidebarOpen } = useApp();
  const { data: session } = useSession();
  const { data: notifications = [] } = useNotifications();
  const { data: notifCount } = useNotificationCount();
  const markRead = useMarkAllNotificationsRead();
  const unread = notifCount?.count ?? notifications.filter((n: any) => !n.read).length;

  const userName = session?.user?.name ?? "User";
  const userRole = (session?.user as any)?.role ?? "Staff";

  const [notifOpen, setNotifOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    // Read saved theme preference
    const saved = localStorage.getItem("bizflow-theme");
    const preferLight = saved === "light";
    if (preferLight) {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    if (unread > 0) {
      await markRead.mutateAsync(undefined);
    }
  };

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 backdrop-blur-xl"
      style={{
        backgroundColor: "color-mix(in srgb, var(--bg-app) 85%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl transition-all hover:bg-primary/5"
          style={{ color: "var(--text-secondary)" }}
          suppressHydrationWarning
        >
          <Menu size={20} />
        </button>
        <h1 className="font-semibold text-base sm:text-lg" style={{ color: "var(--text-primary)" }}>
          {title}
        </h1>
      </div>



      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-xl transition-all hover:bg-primary/5" 
            style={{ color: "var(--text-secondary)" }}
            suppressHydrationWarning
          >
            <Bell size={18} />
            {mounted && unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full ring-2"
                style={{ boxShadow: "0 0 0 2px var(--bg-app)" }} />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-1rem)] sm:w-80 max-w-sm rounded-xl shadow-lg border overflow-hidden z-50"
                 style={{ backgroundColor: "var(--bg-app)", borderColor: "var(--border)" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Notifications</h3>
                {unread > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-violet-500 hover:text-violet-400 flex items-center gap-1">
                    <Check size={14} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!mounted || notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    {mounted ? "No notifications yet." : "Loading..."}
                  </div>
                ) : (
                  notifications.map((notif: any) => (
                    <div key={notif.id} className={`p-4 border-b last:border-b-0 ${notif.read ? 'opacity-60' : 'bg-primary/5'}`} style={{ borderColor: "var(--border)" }}>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>{notif.title}</p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{notif.message}</p>
                      <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}
