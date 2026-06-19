"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ value, onChange, options, placeholder, className }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none"
        style={{
          backgroundColor: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span>{selected?.label ?? placeholder ?? "Select..."}</span>
        <ChevronDown
          size={14}
          className={cn("flex-shrink-0 transition-transform duration-200", open && "rotate-180")}
          style={{ color: "var(--text-muted)" }}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 w-full mt-1.5 rounded-xl overflow-y-auto shadow-2xl max-h-60 custom-scrollbar"
          style={{
            backgroundColor: "var(--bg-surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-left transition-colors",
                opt.value === value
                  ? "text-violet-400"
                  : "hover:bg-white/5"
              )}
              style={{ color: opt.value === value ? undefined : "var(--text-secondary)" }}
            >
              {opt.label}
              {opt.value === value && <Check size={13} className="text-violet-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
