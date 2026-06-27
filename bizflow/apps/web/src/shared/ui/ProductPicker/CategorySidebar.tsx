import React from "react";
import { Folder, Star, History, Sparkles } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface CategorySidebarProps {
  categories: string[];
  categoryCounts: Record<string, number>;
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  totalCount: number;
  favoritesCount: number;
  recentsCount: number;
  frequentlySoldCount: number;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  categoryCounts,
  activeCategory,
  onSelectCategory,
  totalCount,
  favoritesCount,
  recentsCount,
  frequentlySoldCount,
}) => {
  return (
    <div
      className="w-full sm:w-64 border-b sm:border-b-0 sm:border-r flex flex-row sm:flex-col overflow-x-auto sm:overflow-y-auto sm:h-full p-2 gap-1 flex-shrink-0 select-none scrollbar-none"
      style={{ borderColor: "var(--border)" }}
    >
      {/* ── All products ── */}
      <button
        type="button"
        onClick={() => onSelectCategory("All")}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition-all flex-shrink-0 sm:w-full",
          activeCategory === "All"
            ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
            : "text-primary/60 hover:bg-white/5 hover:text-white border border-transparent"
        )}
      >
        <Folder size={14} className="flex-shrink-0" />
        <span className="flex-1 truncate">All Products</span>
        <span className="text-[10px] opacity-60 bg-white/5 px-1.5 py-0.5 rounded-full font-mono">{totalCount}</span>
      </button>

      {/* ── Favorites ── */}
      <button
        type="button"
        onClick={() => onSelectCategory("Favorites")}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition-all flex-shrink-0 sm:w-full",
          activeCategory === "Favorites"
            ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
            : "text-primary/60 hover:bg-white/5 hover:text-white border border-transparent"
        )}
      >
        <Star size={14} className="flex-shrink-0" />
        <span className="flex-1 truncate">Favorites</span>
        <span className="text-[10px] opacity-60 bg-white/5 px-1.5 py-0.5 rounded-full font-mono">{favoritesCount}</span>
      </button>

      {/* ── Recent ── */}
      <button
        type="button"
        onClick={() => onSelectCategory("Recent")}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition-all flex-shrink-0 sm:w-full",
          activeCategory === "Recent"
            ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
            : "text-primary/60 hover:bg-white/5 hover:text-white border border-transparent"
        )}
      >
        <History size={14} className="flex-shrink-0" />
        <span className="flex-1 truncate">Recent</span>
        <span className="text-[10px] opacity-60 bg-white/5 px-1.5 py-0.5 rounded-full font-mono">{recentsCount}</span>
      </button>

      {/* ── Frequently Sold ── */}
      <button
        type="button"
        onClick={() => onSelectCategory("Frequently Sold")}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition-all flex-shrink-0 sm:w-full",
          activeCategory === "Frequently Sold"
            ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
            : "text-primary/60 hover:bg-white/5 hover:text-white border border-transparent"
        )}
      >
        <Sparkles size={14} className="flex-shrink-0" />
        <span className="flex-1 truncate">Frequently Sold</span>
        <span className="text-[10px] opacity-60 bg-white/5 px-1.5 py-0.5 rounded-full font-mono">{frequentlySoldCount}</span>
      </button>

      {/* Divider */}
      <div className="hidden sm:block h-px bg-primary/10 my-2" />

      {/* ── Categories compiled ── */}
      {categories.map((cat) => {
        const count = categoryCounts[cat] || 0;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onSelectCategory(cat)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition-all flex-shrink-0 sm:w-full",
              activeCategory === cat
                ? "bg-violet-500/10 text-violet-300 border border-violet-500/20"
                : "text-primary/60 hover:bg-white/5 hover:text-white border border-transparent"
            )}
          >
            <span className="flex-1 truncate">{cat}</span>
            <span className="text-[10px] opacity-60 bg-white/5 px-1.5 py-0.5 rounded-full font-mono">{count}</span>
          </button>
        );
      })}
    </div>
  );
};
