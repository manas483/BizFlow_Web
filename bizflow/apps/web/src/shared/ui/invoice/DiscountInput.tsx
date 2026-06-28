"use client";

import React from "react";

interface DiscountInputProps {
  value: number | string;
  type: "flat" | "percent";
  onValueChange: (value: number | string) => void;
  onTypeChange: (type: "flat" | "percent") => void;
  disabled?: boolean;
}

/**
 * Compact discount input with a % ↔ ₹ toggle button.
 * Emits the raw user input; parent computes the flat amount.
 */
export default function DiscountInput({
  value,
  type,
  onValueChange,
  onTypeChange,
  disabled = false,
}: DiscountInputProps) {
  return (
    <div className="flex items-center gap-0">
      <input
        type="number"
        min="0"
        step="0.01"
        disabled={disabled}
        className="w-full bg-white/5 border border-white/10 rounded-l-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-40"
        style={{ borderRight: "none" }}
        value={value}
        placeholder="0"
        onFocus={(e) => e.target.select()}
        onChange={(e) => onValueChange(e.target.value === "" ? "" : e.target.value)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onTypeChange(type === "flat" ? "percent" : "flat")}
        className="flex-shrink-0 px-2 py-1.5 text-xs font-bold rounded-r-lg border border-white/10 transition-all select-none disabled:opacity-40"
        style={{
          backgroundColor: type === "percent" ? "rgba(139, 92, 246, 0.2)" : "rgba(255,255,255,0.05)",
          color: type === "percent" ? "#a78bfa" : "rgba(255,255,255,0.5)",
          minWidth: "28px",
        }}
        title={type === "percent" ? "Switch to flat ₹ discount" : "Switch to % discount"}
      >
        {type === "percent" ? "%" : "₹"}
      </button>
    </div>
  );
}
