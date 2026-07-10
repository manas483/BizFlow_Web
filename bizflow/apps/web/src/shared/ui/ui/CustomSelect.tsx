"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useDropdownKeyboard } from "@/shared/hooks/useDropdownKeyboard";
import type { DropdownItem } from "@/shared/hooks/useDropdownKeyboard";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard navigation
  const {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    listboxId,
    getOptionId,
    activeDescendantId,
    listRef,
  } = useDropdownKeyboard({
    items: options as DropdownItem[],
    isOpen: open,
    onSelect: (val) => {
      onChange(val);
    },
    onClose: () => {
      setOpen(false);
      // Return focus to the trigger when closing via keyboard
      triggerRef.current?.focus();
    },
    onOpen: () => setOpen(true),
    selectedValue: value,
    closeOnSelect: true,
  });

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeDescendantId}
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKeyDown}
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
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 w-full mt-1.5 rounded-xl overflow-y-auto shadow-2xl max-h-60 custom-scrollbar"
          style={{
            backgroundColor: "var(--bg-surface-2)",
            border: "1px solid var(--border)",
          }}
        >
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightedIndex;
            const isDisabled = !!opt.disabled;

            return (
              <button
                key={opt.value}
                id={getOptionId(index)}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled || undefined}
                data-option-index={index}
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    onChange(opt.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
                onMouseEnter={() => {
                  if (!isDisabled) setHighlightedIndex(index);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 text-sm text-left transition-colors",
                  isDisabled && "opacity-40 cursor-not-allowed",
                  !isDisabled && isHighlighted && "bg-white/10",
                  !isDisabled && !isHighlighted && "hover:bg-white/5",
                  isSelected && "text-violet-400",
                )}
                style={{
                  color: isSelected ? undefined : "var(--text-secondary)",
                }}
              >
                {opt.label}
                {isSelected && <Check size={13} className="text-violet-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
