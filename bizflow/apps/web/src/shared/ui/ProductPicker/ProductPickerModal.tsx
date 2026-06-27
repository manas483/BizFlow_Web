import React, { useReducer, useEffect, useMemo, useState, useRef } from "react";
import Modal from "@/shared/ui/ui/Modal";
import { SearchBar } from "./SearchBar";
import { BarcodeInput } from "./BarcodeInput";
import { CategorySidebar } from "./CategorySidebar";
import { ProductGrid } from "./ProductGrid";
import { Footer } from "./Footer";
import { BarcodeService } from "./services/BarcodeService";
import { SearchEngine } from "./services/SearchEngine";
import {
  productPickerReducer,
  initialState,
  ProductPickerState,
} from "./state/ProductPickerReducer";
import { Product, Customer, SelectedProduct, PickerAddResult } from "./types";
import {
  PRODUCT_PICKER_MAX_CACHE,
  PRODUCT_PICKER_STORAGE,
  PRODUCT_PICKER_SHORTCUTS,
} from "./constants";
import { useProducts } from "@/shared/hooks/useProducts";
import { RefreshCw, LayoutGrid, List, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/shared/lib/utils";

interface ProductPickerModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (result: PickerAddResult) => void;
  customer?: Customer;
  mode: "sale" | "purchase" | "adjustment" | "transfer";
  pricingResolver?: (product: Product, customer?: Customer) => number;
  stockValidator?: (product: Product, requestedQty: number) => { valid: boolean; reason?: string };
  initialItems?: Array<{ productId: string; qty: number }>;
  headerActions?: React.ReactNode;
  footerActions?: React.ReactNode;
  singleSelectIndex?: number | null;
}

export const ProductPickerModal: React.FC<ProductPickerModalProps> = ({
  open,
  onClose,
  onAdd,
  customer,
  mode,
  pricingResolver = (p) => p.sellingPrice,
  stockValidator = (p, qty) => ({ valid: qty <= p.stock, reason: qty > p.stock ? "Insufficient Stock" : undefined }),
  initialItems = [],
  headerActions,
  footerActions,
  singleSelectIndex = null,
}) => {
  const [state, dispatch] = useReducer(productPickerReducer, initialState);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // 1. TanStack Query to load all catalog products
  const { data: pagedData, isLoading, refetch, isFetching } = useProducts(
    undefined,
    undefined,
    1,
    PRODUCT_PICKER_MAX_CACHE,
    true // isPicker flag
  );

  const rawProducts: Product[] = useMemo(() => pagedData?.data ?? [], [pagedData]);

  // 2. Load settings, favorites, and recents from localStorage on mount
  useEffect(() => {
    if (open) {
      try {
        const favs = JSON.parse(localStorage.getItem(PRODUCT_PICKER_STORAGE.FAVORITES) || "[]");
        const recs = JSON.parse(localStorage.getItem(PRODUCT_PICKER_STORAGE.RECENTS) || "[]");
        const freqs = JSON.parse(localStorage.getItem(PRODUCT_PICKER_STORAGE.FREQUENCIES) || "{}");
        const vMode = (localStorage.getItem(PRODUCT_PICKER_STORAGE.VIEW_MODE) as "grid" | "list") || "grid";

        dispatch({
          type: "LOAD_STORAGE",
          payload: { favorites: favs, recents: recs, frequencies: freqs, viewMode: vMode },
        });

        // Initialize selections from already added items
        const selectionsMap: Record<string, number> = {};
        if (singleSelectIndex === null) {
          initialItems.forEach((item) => {
            if (item.productId) {
              selectionsMap[item.productId] = item.qty;
            }
          });
        }
        dispatch({ type: "INITIALIZE_SELECTIONS", payload: selectionsMap });
      } catch (e) {
        console.error("Failed to load local storage configurations", e);
      }
      setFocusedIndex(null);
    }
  }, [open, initialItems, singleSelectIndex]);

  // 3. Compute distinct categories dynamically from the loaded catalog
  const categoriesList = useMemo(() => {
    const list = Array.from(new Set(rawProducts.map((p) => p.category).filter(Boolean)));
    return list.sort();
  }, [rawProducts]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rawProducts.forEach((p) => {
      if (p.category) {
        counts[p.category] = (counts[p.category] || 0) + 1;
      }
    });
    return counts;
  }, [rawProducts]);

  // 4. Resolve the lists based on Category Sidebar tabs
  const filteredProducts = useMemo(() => {
    let baseList = rawProducts;

    if (state.selectedCategory === "Favorites") {
      baseList = rawProducts.filter((p) => state.favorites.includes(p.id));
    } else if (state.selectedCategory === "Recent") {
      baseList = rawProducts.filter((p) => state.recents.includes(p.id));
    } else if (state.selectedCategory === "Frequently Sold") {
      baseList = rawProducts.filter((p) => (state.frequencies[p.id] || 0) > 0);
    }

    return SearchEngine.search(
      baseList,
      state.searchQuery,
      state.selectedCategory, // Passes tab filter
      { inStockOnly: state.inStockOnly, lowStockOnly: state.lowStockOnly },
      state.sortBy,
      state.frequencies
    );
  }, [
    rawProducts,
    state.selectedCategory,
    state.searchQuery,
    state.inStockOnly,
    state.lowStockOnly,
    state.sortBy,
    state.favorites,
    state.recents,
    state.frequencies,
  ]);

  // 5. Smart Keyboard Shortcuts inside Modal
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid shortcuts if typing inside inputs unless it's a specific key modifier
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        e.preventDefault();
        handleCloseRequest();
      } else if (e.key === "Enter" && !isTyping) {
        e.preventDefault();
        const selectedCount = Object.keys(state.selections).length;
        if (selectedCount > 0) {
          handleAddSelections();
        }
      } else if (e.key === "Delete" && !isTyping) {
        e.preventDefault();
        dispatch({ type: "CLEAR_SELECTIONS" });
        toast.success("Selections cleared");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !isTyping) {
        e.preventDefault();
        const visibleIds = filteredProducts.map((p) => p.id);
        dispatch({ type: "SELECT_ALL_VISIBLE", payload: visibleIds });
        toast.success(`Selected all visible (${visibleIds.length})`);
      } else if (e.key === "ArrowDown" && !isTyping) {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev === null) return 0;
          return Math.min(prev + 1, filteredProducts.length - 1);
        });
      } else if (e.key === "ArrowUp" && !isTyping) {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev === null) return 0;
          return Math.max(prev - 1, 0);
        });
      } else if (e.key === " " && !isTyping && focusedIndex !== null) {
        e.preventDefault();
        const focusedProduct = filteredProducts[focusedIndex];
        if (focusedProduct && focusedProduct.stock > 0) {
          dispatch({
            type: "TOGGLE_PRODUCT",
            payload: { productId: focusedProduct.id },
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredProducts, focusedIndex, state.selections]);

  // Reset focus index when filtered lists change
  useEffect(() => {
    setFocusedIndex(null);
  }, [state.searchQuery, state.selectedCategory]);

  // 6. Barcode Scanner lookup logic
  const handleBarcodeScan = (barcode: string) => {
    const matched = rawProducts.find(
      (p) =>
        p.sku.toLowerCase() === barcode.toLowerCase() ||
        p.id.toLowerCase() === barcode.toLowerCase() ||
        (p.hsnCode && p.hsnCode.toLowerCase() === barcode.toLowerCase())
    );

    if (matched) {
      if (matched.stock <= 0) {
        BarcodeService.playBeep("error");
        toast.error(`${matched.name} is Out of Stock`);
        return;
      }

      // Check current selection qty
      const currentQty = state.selections[matched.id] || 0;
      const nextQty = currentQty + 1;

      // Validate stock
      const stockCheck = stockValidator(matched, nextQty);
      if (!stockCheck.valid) {
        BarcodeService.playBeep("error");
        toast.error(stockCheck.reason || `Stock limit reached for ${matched.name}`);
        return;
      }

      dispatch({
        type: "UPDATE_QTY",
        payload: { productId: matched.id, qty: nextQty },
      });

      BarcodeService.playBeep("success");
      toast.success(`Scanned: ${matched.name} (Qty: ${nextQty})`);

      // Highlight scan in active search or view
      dispatch({ type: "SET_SEARCH_QUERY", payload: "" });
      dispatch({ type: "SET_CATEGORY", payload: "All" });
    } else {
      BarcodeService.playBeep("error");
      toast.error(`Barcode "${barcode}" not matched in inventory`);
    }
  };

  // 7. Core selection helpers
  const handleToggleProduct = (product: Product) => {
    if (product.stock <= 0) {
      toast.error("Cannot select out of stock products");
      return;
    }
    dispatch({ type: "TOGGLE_PRODUCT", payload: { productId: product.id } });
  };

  const handleQtyChange = (productId: string, qty: number) => {
    const matched = rawProducts.find((p) => p.id === productId);
    if (!matched) return;

    if (qty > 0) {
      const stockCheck = stockValidator(matched, qty);
      if (!stockCheck.valid) {
        toast.error(stockCheck.reason || "Maximum stock level exceeded");
        return;
      }
    }
    dispatch({ type: "UPDATE_QTY", payload: { productId, qty } });
  };

  const handleToggleFavorite = (productId: string) => {
    dispatch({ type: "TOGGLE_FAVORITE", payload: productId });
  };

  // 8. Submit Selections to Parent Screen
  const handleAddSelections = () => {
    const selectedKeys = Object.keys(state.selections);
    if (selectedKeys.length === 0) return;

    const selectionsList: SelectedProduct[] = [];
    let hasStockIssue = false;

    for (const key of selectedKeys) {
      const qty = state.selections[key];
      const product = rawProducts.find((p) => p.id === key);

      if (product) {
        // Final stock check locking verification
        const stockCheck = stockValidator(product, qty);
        if (!stockCheck.valid) {
          toast.error(`Stock discrepancy: ${product.name} (Stock: ${product.stock}, Requested: ${qty})`);
          hasStockIssue = true;
          break;
        }

        selectionsList.push({
          product,
          qty,
          resolvedPrice: pricingResolver(product, customer),
        });
      }
    }

    if (hasStockIssue) return;

    // Record selections in Local Storage frequencies & recents lists
    try {
      const newRecents = Array.from(new Set([
        ...selectedKeys,
        ...state.recents,
      ])).slice(0, 15);
      localStorage.setItem(PRODUCT_PICKER_STORAGE.RECENTS, JSON.stringify(newRecents));

      const newFrequencies = { ...state.frequencies };
      selectedKeys.forEach((key) => {
        newFrequencies[key] = (newFrequencies[key] || 0) + 1;
      });
      localStorage.setItem(PRODUCT_PICKER_STORAGE.FREQUENCIES, JSON.stringify(newFrequencies));
    } catch (e) {
      console.warn("Could not save picker statistics:", e);
    }

    onAdd({
      selections: selectionsList,
      source: state.searchQuery ? "search" : "quick-add",
      timestamp: new Date().toISOString(),
      mergeStrategy: "merge",
    });

    dispatch({ type: "CLEAR_SELECTIONS" });
    onClose();
  };

  // 9. Close Modal Validation
  const handleCloseRequest = () => {
    const selectedCount = Object.keys(state.selections).length;
    if (selectedCount > 0) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    dispatch({ type: "CLEAR_SELECTIONS" });
    setShowDiscardConfirm(false);
    onClose();
  };

  const selectedCount = Object.keys(state.selections).length;

  return (
    <>
      <Modal
        open={open}
        onClose={handleCloseRequest}
        title="Select Products"
        subtitle="Manage product selection, search tags, filter by categories or barcodes"
        size="4xl"
      >
        <div ref={modalRef} className="flex flex-col h-[65vh] text-white overflow-hidden -mx-4 -mt-4 -mb-8 sm:-mx-5 sm:-mt-5">
          {/* ── Sub-header Actions (Search + Barcode) ── */}
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 border-b flex-shrink-0"
            style={{ borderColor: "var(--border)" }}
          >
            <SearchBar
              value={state.searchQuery}
              onChange={(val) => dispatch({ type: "SET_SEARCH_QUERY", payload: val })}
            />
            <div className="flex items-center gap-3">
              <BarcodeInput onScan={handleBarcodeScan} />
              
              {/* Layout view controls */}
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden p-0.5 flex-shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SET_VIEW_MODE", payload: "grid" })}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    state.viewMode === "grid" ? "bg-white/10 text-violet-300" : "text-primary/50 hover:text-white"
                  )}
                  title="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SET_VIEW_MODE", payload: "list" })}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    state.viewMode === "list" ? "bg-white/10 text-violet-300" : "text-primary/50 hover:text-white"
                  )}
                  title="List view"
                >
                  <List size={15} />
                </button>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-primary/70 hover:text-white flex-shrink-0 transition-all disabled:opacity-50"
                title="Refresh product cache catalog"
              >
                <RefreshCw size={15} className={cn(isFetching && "animate-spin")} />
              </button>
            </div>
            {headerActions}
          </div>

          {/* ── Main body split ── */}
          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
            {/* Left sidebar categories */}
            <CategorySidebar
              categories={categoriesList}
              categoryCounts={categoryCounts}
              activeCategory={state.selectedCategory}
              onSelectCategory={(cat) => dispatch({ type: "SET_CATEGORY", payload: cat })}
              totalCount={rawProducts.length}
              favoritesCount={state.favorites.length}
              recentsCount={state.recents.length}
              frequentlySoldCount={Object.keys(state.frequencies).length}
            />

            {/* Right main grid with loader */}
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-primary/40 py-20">
                <RefreshCw size={24} className="animate-spin mb-3 text-violet-400" />
                <p className="text-xs">Caching product catalog...</p>
              </div>
            ) : (
              <ProductGrid
                products={filteredProducts}
                selections={state.selections}
                favorites={state.favorites}
                viewMode={state.viewMode}
                searchQuery={state.searchQuery}
                onToggleSelect={handleToggleProduct}
                onQtyChange={handleQtyChange}
                onToggleFavorite={handleToggleFavorite}
                focusedIndex={focusedIndex}
              />
            )}
          </div>

          {/* ── Footer ── */}
          <Footer
            selectedCount={selectedCount}
            onCancel={handleCloseRequest}
            onAdd={handleAddSelections}
            footerActions={footerActions}
          />
        </div>
      </Modal>

      {/* Discard confirmation sub-modal dialog */}
      <Modal
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard Selections?"
        size="sm"
      >
        <div className="text-center p-2 text-white">
          <AlertTriangle size={36} className="text-amber-500 mx-auto mb-3 animate-bounce" />
          <p className="text-sm">You have selected <strong className="text-violet-300 font-bold">{selectedCount}</strong> items.</p>
          <p className="text-xs text-primary/50 mt-1">Are you sure you want to close without adding them to the invoice?</p>
          
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(false)}
              className="flex-1 py-2 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-primary hover:bg-white/10"
            >
              Keep Selection
            </button>
            <button
              type="button"
              onClick={handleConfirmDiscard}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/10"
            >
              Discard
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
export default ProductPickerModal;
