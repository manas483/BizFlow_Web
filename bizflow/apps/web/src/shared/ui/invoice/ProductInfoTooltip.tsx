"use client";

import React, { useState, useRef, useEffect } from "react";
import type { Product } from "@/shared/ui/ProductPicker/types";
import { formatCurrency } from "@/shared/lib/utils";

interface ProductInfoTooltipProps {
  product: Product;
  children: React.ReactNode;
}

/**
 * Product info popup — hover on desktop, tap on mobile.
 * Shows SKU, HSN, GST, stock, supplier, cost, and selling price.
 */
export default function ProductInfoTooltip({ product, children }: ProductInfoTooltipProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const open = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Position above the trigger by default, adjust if too close to top
      const top = rect.top > 200 ? rect.top - 8 : rect.bottom + 8;
      const left = Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth - 260 : rect.left));
      setPosition({ top, left });
    }
    setShow(true);
  };

  const close = () => {
    clearTimeout(timeoutRef.current);
    setShow(false);
  };

  // Desktop: hover with delay
  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(open, 300);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(close, 200);
  };

  // Mobile: tap toggle
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (show) close();
    else open();
  };

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show]);

  // Cleanup timeout on unmount
  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const available = product.stock - (product.reservedStock || 0);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="inline-flex cursor-pointer"
      >
        {children}
      </span>

      {show && position && (
        <div
          ref={panelRef}
          onMouseEnter={() => clearTimeout(timeoutRef.current)}
          onMouseLeave={handleMouseLeave}
          style={{
            position: "fixed",
            top: position.top > 200 ? "auto" : position.top,
            bottom: position.top > 200 ? `calc(100vh - ${position.top}px)` : "auto",
            left: position.left,
            zIndex: 99999,
            width: "240px",
          }}
          className="rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-white/5 bg-white/5">
            <p className="text-xs font-semibold text-white truncate">{product.name}</p>
            <p className="text-[10px] text-white/40 font-mono">{product.sku}</p>
          </div>

          {/* Details grid */}
          <div className="px-3 py-2 space-y-1.5 text-[11px]">
            <Row label="HSN" value={product.hsnCode || "—"} />
            <Row label="GST" value={`${product.gstRate}%`} />
            <Row label="Unit" value={product.unit} />
            <div className="h-px bg-white/5 !my-2" />
            <Row label="Total Stock" value={`${product.stock} ${product.unit}`} />
            {(product.reservedStock || 0) > 0 && (
              <>
                <Row label="Reserved" value={`${product.reservedStock} ${product.unit}`} muted />
                <Row label="Available" value={`${available} ${product.unit}`} highlight />
              </>
            )}
            <div className="h-px bg-white/5 !my-2" />
            <Row label="Selling" value={formatCurrency(product.sellingPrice)} highlight />
            {product.standardCost > 0 && (
              <Row label="Cost" value={formatCurrency(product.standardCost)} muted />
            )}
            {product.supplier && (
              <Row label="Supplier" value={product.supplier} muted />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, highlight, muted }: { label: string; value: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/40">{label}</span>
      <span
        className={`font-medium ${
          highlight ? "text-violet-300" : muted ? "text-white/40" : "text-white/70"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
