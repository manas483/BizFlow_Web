"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef } from "react";

export default function SessionTimeoutWatcher() {
  const { data: session, status } = useSession();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.role) return;

    const role = session.user.role as string;
    const isAdminOrFinance = ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"].includes(role);
    
    // Match the server-side idleLimit from auth.ts
    const idleLimitMs = isAdminOrFinance ? 15 * 60 * 1000 : 60 * 60 * 1000;

    const resetTimer = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        // Automatically logout and redirect to login page
        signOut({ callbackUrl: "/login" });
      }, idleLimitMs);
    };

    resetTimer();

    // Setup event listeners for user activity
    const events = ["mousemove", "keydown", "wheel", "click", "scroll", "touchstart"];
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [session, status]);

  return null;
}
