"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface CustomMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function CustomMultiSelect({ value = [], onChange, options, placeholder, className }: CustomMultiSelectProps) {
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

  const handleToggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter(v => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none min-h-[42px]"
        style={{
          backgroundColor: "var(--input-bg)",
          border: "1px solid var(--input-border)",
          color: value.length > 0 ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <div className="flex flex-wrap gap-1 items-center text-left">
          {value.length === 0 ? (
            <span>{placeholder ?? "Select invoices..."}</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {options
                .filter(o => value.includes(o.value))
                .map(opt => (
                  <span
                    key={opt.value}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  >
                    {opt.label}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(value.filter(v => v !== opt.value));
                      }}
                      className="cursor-pointer hover:text-white"
                    >
                      <X size={10} />
                    </span>
                  </span>
                ))}
            </div>
          )}
        </div>
        <ChevronDown
          size={14}
          className={cn("flex-shrink-0 ml-2 transition-transform duration-200", open && "rotate-180")}
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
          {options.length === 0 ? (
            <div className="px-3.5 py-2.5 text-sm text-center" style={{ color: "var(--text-muted)" }}>
              No invoices available
            </div>
          ) : (
            options.map(opt => {
              const isSelected = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleToggle(opt.value)}
                  className={cn(
                    "w-full flex items-center px-3.5 py-2.5 text-sm text-left transition-colors hover:bg-white/5",
                    isSelected && "text-violet-400 font-medium"
                  )}
                  style={{ color: isSelected ? undefined : "var(--text-secondary)" }}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-all mr-3 flex-shrink-0",
                    isSelected
                      ? "border-violet-500 bg-violet-500/20 text-violet-400"
                      : "border-white/20 bg-white/5 text-transparent"
                  )}>
                    <Check size={10} strokeWidth={3} className={cn("transition-transform duration-200", isSelected ? "scale-100" : "scale-0")} />
                  </div>
                  <span>{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
