"use client";

import React, { useRef, useEffect } from "react";
import { Trash2, ChevronDown, AlertTriangle, Info } from "lucide-react";
import type { LineItem } from "./types";
import type { Product } from "@/shared/ui/ProductPicker/types";
import { computeFlatDiscount } from "./types";
import { GST_RATE_OPTIONS, UNIT_OPTIONS, PRICE_OVERRIDE_REASONS } from "./constants";
import DiscountInput from "./DiscountInput";
import ProductInfoTooltip from "./ProductInfoTooltip";
import { formatCurrency } from "@/shared/lib/utils";

interface LineItemRowProps {
  item: LineItem;
  index: number;
  product?: Product;
  gstInclusive: boolean;
  canOverridePrice: boolean;
  canOverrideGst: boolean;
  onUpdate: (index: number, updates: Partial<LineItem>) => void;
  onRemove: (index: number) => void;
  onOpenPicker: (index: number) => void;
  isOnly: boolean;
  autoFocusQty?: boolean;
}

/**
 * A single row in the invoice line-items table.
 * Includes editable price (with override reason), discount toggle,
 * GST dropdown, unit selector, stock badge, margin warning, and product tooltip.
 */
export default function LineItemRow({
  item,
  index,
  product,
  gstInclusive,
  canOverridePrice,
  canOverrideGst,
  onUpdate,
  onRemove,
  onOpenPicker,
  isOnly,
  autoFocusQty = false,
}: LineItemRowProps) {
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusQty && qtyRef.current) {
      qtyRef.current.focus();
      qtyRef.current.select();
    }
  }, [autoFocusQty]);

  const qty = Number(item.qty) || 0;
  const lineAmount = qty * item.price;
  const grossAmt = lineAmount - item.discount;
  const rate = item.gstRate || 0;

  // Taxable / Tax computation
  let taxable: number, tax: number;
  if (gstInclusive && rate > 0) {
    taxable = grossAmt / (1 + rate / 100);
    tax = grossAmt - taxable;
  } else {
    taxable = grossAmt;
    tax = grossAmt * (rate / 100);
  }

  const lineTotal = taxable + tax;
  const priceChanged = item.price !== item.originalPrice && item.originalPrice > 0;
  const isBelowCost = product && product.standardCost > 0 && item.price < product.standardCost;
  const costMargin = product && product.standardCost > 0 ? item.price - product.standardCost : 0;
  const isLowStock = product && product.stock > 0 && product.stock <= product.minStock;
  const isOutOfStock = product && product.stock <= 0;

  // Handle discount input change → compute flat amount
  const handleDiscountInputChange = (val: number | string) => {
    const flat = computeFlatDiscount(item.discountType, val, lineAmount);
    onUpdate(index, { discountInput: val, discount: flat });
  };

  const handleDiscountTypeChange = (newType: "flat" | "percent") => {
    const flat = computeFlatDiscount(newType, item.discountInput, lineAmount);
    onUpdate(index, { discountType: newType, discount: flat });
  };

  const handlePriceChange = (newPrice: number) => {
    onUpdate(index, {
      price: newPrice,
      // Clear override reason if price matches original
      priceOverrideReason: newPrice === item.originalPrice ? "" : item.priceOverrideReason,
    });
  };

  return (
    <tr className="group">
      {/* Product */}
      <td className="p-2">
        <button
          type="button"
          onClick={() => onOpenPicker(index)}
          className="w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm text-left transition-all hover:border-violet-500/40"
          style={{
            background: "var(--input-bg)",
            border: "1px solid var(--input-border)",
            color: item.productId ? "var(--text-primary)" : "var(--text-muted)",
          }}
        >
          <span className="truncate">{product?.name || "Select product..."}</span>
          <ChevronDown size={12} className="flex-shrink-0" style={{ color: "var(--text-muted)" }} />
        </button>

        {/* Stock badge + info tooltip */}
        {product && (
          <div className="flex items-center gap-1.5 mt-1 px-1">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                isOutOfStock
                  ? "bg-rose-500/15 text-rose-400"
                  : isLowStock
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-emerald-500/10 text-emerald-400/70"
              }`}
            >
              {isOutOfStock ? "Out of Stock" : `${product.stock} ${product.unit}`}
              {isLowStock && !isOutOfStock && " ⚠"}
            </span>
            <ProductInfoTooltip product={product}>
              <Info size={11} className="text-white/25 hover:text-violet-400 transition-colors" />
            </ProductInfoTooltip>
          </div>
        )}
      </td>

      {/* HSN */}
      <td className="p-2 text-primary/40 text-xs text-center font-mono">{item.hsnCode || "—"}</td>

      {/* Qty + Unit */}
      <td className="p-2">
        <input
          ref={qtyRef}
          type="number"
          min="1"
          required
          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-sm focus:outline-none focus:border-violet-500/50"
          value={item.qty}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const val = e.target.value === "" ? "" : parseInt(e.target.value) || 0;
            onUpdate(index, { qty: val });
          }}
        />
        <select
          value={item.unit}
          onChange={(e) => onUpdate(index, { unit: e.target.value })}
          className="w-full mt-1 bg-white/5 border border-white/10 rounded-md px-1.5 py-0.5 text-[10px] text-white/50 focus:outline-none focus:border-violet-500/50 cursor-pointer"
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </td>

      {/* Rate (₹) */}
      <td className="p-2">
        {canOverridePrice ? (
          <input
            type="number"
            min="0"
            step="0.01"
            className={`w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none transition-colors ${
              isBelowCost
                ? "bg-rose-500/10 border-rose-500/30 text-rose-300 focus:border-rose-400/50"
                : priceChanged
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-200 focus:border-amber-400/50"
                  : "bg-white/5 border-white/10 text-white focus:border-violet-500/50"
            }`}
            value={item.price || ""}
            onFocus={(e) => e.target.select()}
            onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
          />
        ) : (
          <span className="text-sm text-primary/60">{formatCurrency(item.price)}</span>
        )}

        {/* Override indicator */}
        {priceChanged && (
          <p className="text-[10px] mt-0.5 px-0.5 text-amber-400/70">
            Was: {formatCurrency(item.originalPrice)}
          </p>
        )}

        {/* Below-cost warning */}
        {isBelowCost && (
          <div className="flex items-center gap-1 mt-0.5 px-0.5">
            <AlertTriangle size={10} className="text-rose-400" />
            <span className="text-[10px] text-rose-400 font-medium">
              Below cost {costMargin < 0 && `(${formatCurrency(costMargin)})`}
            </span>
          </div>
        )}

        {/* Override reason (shown when price changed and user has permission) */}
        {priceChanged && canOverridePrice && (
          <select
            value={item.priceOverrideReason}
            onChange={(e) => onUpdate(index, { priceOverrideReason: e.target.value })}
            className={`w-full mt-1 border rounded-md px-1.5 py-0.5 text-[10px] focus:outline-none cursor-pointer ${
              !item.priceOverrideReason
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-white/5 border-white/10 text-white/50"
            }`}
          >
            <option value="">Reason...</option>
            {PRICE_OVERRIDE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        )}
      </td>

      {/* Discount */}
      <td className="p-2">
        <DiscountInput
          value={item.discountInput}
          type={item.discountType}
          onValueChange={handleDiscountInputChange}
          onTypeChange={handleDiscountTypeChange}
        />
        {item.discountType === "percent" && item.discount > 0 && (
          <p className="text-[10px] mt-0.5 px-0.5 text-primary/30">
            = {formatCurrency(item.discount)}
          </p>
        )}
      </td>

      {/* GST */}
      <td className="p-2">
        {canOverrideGst ? (
          <select
            value={item.gstRate}
            onChange={(e) => {
              const newRate = parseFloat(e.target.value) || 0;
              onUpdate(index, {
                gstRate: newRate,
              });
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50 cursor-pointer"
          >
            {GST_RATE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        ) : (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            item.gstRate > 0 ? "bg-violet-500/15 text-violet-300" : "text-primary/30"
          }`}>
            {item.gstRate > 0 ? `${item.gstRate}%` : "Nil"}
          </span>
        )}
        {item.gstRate !== item.originalGstRate && item.originalGstRate > 0 && (
          <p className="text-[10px] mt-0.5 px-0.5 text-amber-400/50">
            Was: {item.originalGstRate}%
          </p>
        )}
      </td>

      {/* Line Total */}
      <td className="p-2">
        <div className="text-primary font-medium text-sm">{formatCurrency(lineTotal)}</div>
        {item.gstRate > 0 && (
          <div className="text-[10px] text-violet-400/60">
            {gstInclusive ? `(incl. ${formatCurrency(tax)} GST)` : `+${formatCurrency(tax)} GST`}
          </div>
        )}
      </td>

      {/* Delete */}
      <td className="p-2 text-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 text-primary/30 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
          disabled={isOnly}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
