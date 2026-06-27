import React from "react";
import { Star, AlertTriangle } from "lucide-react";
import { Product } from "./types";
import { QuantityEditor } from "./QuantityEditor";
import { formatCurrency } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";

interface ProductCardProps {
  product: Product;
  selectedQty: number;
  isFavorite: boolean;
  viewMode: "grid" | "list";
  searchQuery: string;
  onToggleSelect: () => void;
  onQtyChange: (qty: number) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  isFocused?: boolean;
}

// Subcomponent to highlight matched characters in search
const HighlightText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query || !query.trim()) return <span>{text}</span>;
  try {
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
    return (
      <span>
        {parts.map((part, index) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-amber-500/30 text-amber-300 rounded px-0.5 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  } catch (e) {
    return <span>{text}</span>;
  }
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  selectedQty,
  isFavorite,
  viewMode,
  searchQuery,
  onToggleSelect,
  onQtyChange,
  onToggleFavorite,
  isFocused = false,
}) => {
  const isSelected = selectedQty > 0;
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= product.minStock;

  // Generate a premium dynamic background gradient using product ID
  const getGradient = (id: string) => {
    const charCodeSum = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hues = [240, 260, 280, 300, 320, 340];
    const baseHue = hues[charCodeSum % hues.length];
    return `linear-gradient(135deg, hsl(${baseHue}, 50%, 40%) 0%, hsl(${(baseHue + 40) % 360}, 50%, 20%) 100%)`;
  };

  const nameInitials = product.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (viewMode === "list") {
    // List View Row
    return (
      <div
        onClick={isOutOfStock ? undefined : onToggleSelect}
        className={cn(
          "w-full flex items-center justify-between p-3 border-b border-white/5 transition-all cursor-pointer group text-xs",
          isSelected ? "bg-violet-500/5" : "hover:bg-white/5",
          isFocused && "ring-2 ring-violet-500/40 bg-violet-500/5",
          isOutOfStock && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isOutOfStock}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="w-4 h-4 rounded border-white/10 text-violet-500 focus:ring-violet-500/20 bg-white/5 cursor-pointer disabled:cursor-not-allowed"
          />

          <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
            {/* Product Name */}
            <div className="font-semibold text-white truncate text-sm">
              <HighlightText text={product.name} query={searchQuery} />
            </div>

            {/* SKU & HSN */}
            <div className="flex gap-2">
              <span className="font-mono text-primary/40">
                SKU: <HighlightText text={product.sku} query={searchQuery} />
              </span>
              {product.hsnCode && (
                <span className="text-primary/30">HSN: {product.hsnCode}</span>
              )}
            </div>

            {/* Stock Level */}
            <div>
              {isOutOfStock ? (
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  🔴 Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  🟡 {product.stock} {product.unit} (Low Stock)
                </span>
              ) : (
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  🟢 {product.stock} {product.unit} Available
                </span>
              )}
            </div>

            {/* Pricing & Tax */}
            <div className="flex items-center gap-2">
              <span className="text-white font-medium text-sm">
                {formatCurrency(product.sellingPrice)}
              </span>
              <span className="bg-white/5 px-1 rounded text-[10px] text-primary/50">
                GST {product.gstRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Favorite & Qty Adjusters */}
        <div className="flex items-center gap-3 ml-4" onClick={(e) => e.stopPropagation()}>
          {isSelected && (
            <QuantityEditor
              value={selectedQty}
              onChange={onQtyChange}
              maxStock={product.stock}
            />
          )}

          <button
            type="button"
            onClick={onToggleFavorite}
            className={cn(
              "p-1.5 rounded-lg hover:bg-white/5 transition-all",
              isFavorite ? "text-amber-400" : "text-primary/30 hover:text-primary/70"
            )}
          >
            <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>
    );
  }

  // Grid View Card
  return (
    <div
      onClick={isOutOfStock ? undefined : onToggleSelect}
      className={cn(
        "relative rounded-xl border p-4 flex flex-col justify-between transition-all select-none cursor-pointer group h-52 min-w-0",
        isSelected
          ? "bg-violet-500/5 border-violet-500/30 ring-1 ring-violet-500/30"
          : "bg-primary/5 hover:bg-white/5 border-primary/10",
        isFocused && "ring-2 ring-violet-500/50 border-violet-500/30 bg-violet-500/5",
        isOutOfStock && "opacity-50 cursor-not-allowed border-dashed border-red-500/20"
      )}
    >
      {/* Dynamic Image / Placeholder & Star */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold font-mono shadow-md flex-shrink-0"
          style={{ background: getGradient(product.id) }}
        >
          {nameInitials}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onToggleFavorite}
            className={cn(
              "p-1 rounded-lg hover:bg-white/5 transition-all",
              isFavorite ? "text-amber-400" : "text-primary/30 hover:text-amber-400/50"
            )}
          >
            <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isOutOfStock}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="w-4 h-4 rounded border-white/10 text-violet-500 focus:ring-violet-500/20 bg-white/5 cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Main product metadata */}
      <div className="mt-3 flex-1 min-w-0">
        <h4 className="font-semibold text-white text-sm truncate leading-tight">
          <HighlightText text={product.name} query={searchQuery} />
        </h4>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[10px] text-primary/50">
          <span className="bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[120px]">
            <HighlightText text={product.sku} query={searchQuery} />
          </span>
          {product.hsnCode && (
            <span className="bg-white/5 px-1.5 py-0.5 rounded">HSN {product.hsnCode}</span>
          )}
        </div>
      </div>

      {/* Footer (Price + stock indicator & Qty Selector) */}
      <div className="mt-3 flex items-end justify-between border-t border-primary/10 pt-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-bold text-sm">
              {formatCurrency(product.sellingPrice)}
            </span>
            <span className="text-[9px] opacity-40">GST {product.gstRate}%</span>
          </div>

          <div>
            {isOutOfStock ? (
              <span className="text-[10px] text-rose-400 font-medium">Out of Stock</span>
            ) : isLowStock ? (
              <span className="text-[10px] text-amber-400 font-medium">
                🟡 {product.stock} left ({product.unit})
              </span>
            ) : (
              <span className="text-[10px] text-emerald-400 font-medium">
                🟢 {product.stock} {product.unit}
              </span>
            )}
          </div>
        </div>

        {/* Qty adjustments */}
        <div onClick={(e) => e.stopPropagation()}>
          {isSelected && (
            <QuantityEditor
              value={selectedQty}
              onChange={onQtyChange}
              maxStock={product.stock}
            />
          )}
        </div>
      </div>

      {/* Out of Stock Ribbon / Overlay indicator */}
      {isOutOfStock && (
        <div className="absolute inset-x-0 bottom-0 bg-red-500/10 border-t border-red-500/20 text-center py-1 rounded-b-xl flex items-center justify-center gap-1 text-[10px] text-red-400 font-semibold uppercase tracking-wider">
          <AlertTriangle size={10} /> Out of Stock
        </div>
      )}
    </div>
  );
};
