import React, { useState, useEffect, useRef } from "react";
import { Product } from "./types";
import { ProductCard } from "./ProductCard";
import { cn } from "@/shared/lib/utils";

interface ProductGridProps {
  products: Product[];
  selections: Record<string, number>;
  favorites: string[];
  viewMode: "grid" | "list";
  searchQuery: string;
  onToggleSelect: (product: Product) => void;
  onQtyChange: (productId: string, qty: number) => void;
  onToggleFavorite: (productId: string) => void;
  focusedIndex: number | null;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  selections,
  favorites,
  viewMode,
  searchQuery,
  onToggleSelect,
  onQtyChange,
  onToggleFavorite,
  focusedIndex,
}) => {
  const [visibleCount, setVisibleCount] = useState(50);
  const observerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset list length on product changes
  useEffect(() => {
    setVisibleCount(50);
    // Scroll container back to top
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [products]);

  // Load next chunk of products on scroll intersection
  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 50, products.length));
        }
      },
      { root: containerRef.current, threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [products, visibleCount]);

  // Handle scrolling focused item into view
  useEffect(() => {
    if (focusedIndex !== null && containerRef.current) {
      const container = containerRef.current;
      const focusedElement = container.querySelector(`[data-index="${focusedIndex}"]`);
      if (focusedElement) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = focusedElement.getBoundingClientRect();

        if (elementRect.bottom > containerRect.bottom) {
          focusedElement.scrollIntoView({ block: "end", behavior: "smooth" });
        } else if (elementRect.top < containerRect.top) {
          focusedElement.scrollIntoView({ block: "start", behavior: "smooth" });
        }
      }
    }
  }, [focusedIndex]);

  const visibleProducts = products.slice(0, visibleCount);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 min-h-0 relative select-none scroll-smooth"
    >
      {visibleProducts.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center text-primary/40 py-20">
          <p className="text-sm">No products found</p>
          <p className="text-xs mt-1">Try refining your search terms or filters</p>
        </div>
      ) : (
        <div
          className={cn(
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4"
              : "flex flex-col border border-white/5 rounded-xl bg-white/5 divide-y divide-white/5 overflow-hidden"
          )}
        >
          {visibleProducts.map((p, idx) => (
            <div key={p.id} data-index={idx}>
              <ProductCard
                product={p}
                selectedQty={selections[p.id] || 0}
                isFavorite={favorites.includes(p.id)}
                viewMode={viewMode}
                searchQuery={searchQuery}
                onToggleSelect={() => onToggleSelect(p)}
                onQtyChange={(qty) => onQtyChange(p.id, qty)}
                onToggleFavorite={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(p.id);
                }}
                isFocused={focusedIndex === idx}
              />
            </div>
          ))}
        </div>
      )}

      {/* Spacer target for infinite scroll trigger */}
      {visibleCount < products.length && (
        <div ref={observerRef} className="w-full h-10 flex items-center justify-center text-xs text-primary/30 mt-4">
          Loading more items...
        </div>
      )}
    </div>
  );
};
