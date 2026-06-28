"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  icon?: React.ReactNode;
  iconColor?: string;
}

const sizeClasses = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-3xl",
  "3xl": "sm:max-w-4xl",
  "4xl": "sm:max-w-5xl",
  "5xl": "sm:max-w-7xl",
};

export default function Modal({ open, onClose, title, subtitle, children, size = "md", icon, iconColor = "bg-violet-500/20 text-violet-400" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !mounted) return null;

  const content = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={cn(
          // Mobile & Desktop: perfectly centered
          "w-full rounded-2xl shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
          // Desktop: max-width constraint
          "sm:max-w-sm sm:w-auto",
          size === "sm" && "sm:max-w-sm",
          size === "md" && "sm:max-w-md",
          size === "lg" && "sm:max-w-lg",
          size === "xl" && "sm:max-w-2xl",
          size === "2xl" && "sm:max-w-3xl",
          size === "3xl" && "sm:max-w-4xl",
          size === "4xl" && "sm:max-w-5xl",
          size === "5xl" && "sm:max-w-7xl",
          // Always full width on mobile, constrained on sm+
          "sm:w-full",
          // Max height with scrollable body
          "flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[90vh]"
        )}
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Drag handle — visible only on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "var(--border-hover)" }} />
        </div>

        {/* Header — fixed, never scrolls */}
        <div className="flex items-center gap-3 px-4 py-3 sm:p-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          {icon && (
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", iconColor)}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{title}</h3>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-primary/5 flex-shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="px-4 pt-4 pb-8 sm:p-5 overflow-y-auto overscroll-contain scroll-smooth flex-1 min-h-0 custom-scrollbar">{children}</div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/* ── Reusable form field ── */
export function FormField({
  label, required, children, hint,
}: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}

/* ── Reusable themed input ── */
export function ModalInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("w-full rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none", className)}
      style={{
        backgroundColor: "var(--input-bg)",
        border: "1px solid var(--input-border)",
        color: "var(--text-primary)",
      }}
      {...props}
    />
  );
}

/* ── Reusable themed select ── */
export function ModalSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn("w-full rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none cursor-pointer", className)}
      style={{
        backgroundColor: "var(--input-bg)",
        border: "1px solid var(--input-border)",
        color: "var(--text-secondary)",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

/* ── Reusable themed textarea ── */
export function ModalTextarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn("w-full rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none resize-none", className)}
      style={{
        backgroundColor: "var(--input-bg)",
        border: "1px solid var(--input-border)",
        color: "var(--text-primary)",
      }}
      rows={3}
      {...props}
    />
  );
}

/* ── Modal footer with action buttons ── */
export function ModalFooter({ onClose, onSubmit, submitLabel = "Save", loading = false }: {
  onClose: () => void; onSubmit?: () => void; submitLabel?: string; loading?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-6">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{
          backgroundColor: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: "var(--text-secondary)",
        }}
      >
        Cancel
      </button>
      <button
        type="submit"
        onClick={onSubmit}
        disabled={loading}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all
          bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600
          shadow-lg shadow-violet-500/20 disabled:opacity-60 hover:-translate-y-0.5"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-primary/10 border-t-white rounded-full animate-spin" />
            Saving...
          </span>
        ) : submitLabel}
      </button>
    </div>
  );
}
