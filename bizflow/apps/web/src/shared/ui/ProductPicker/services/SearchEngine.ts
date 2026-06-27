import { Product } from "../types";
import { LOW_STOCK_THRESHOLD } from "../constants";

export class SearchEngine {
  /**
   * Real-time search filter and sorting handler for the local cache catalog.
   */
  static search(
    products: Product[],
    query: string,
    category: string,
    filters: { inStockOnly: boolean; lowStockOnly: boolean },
    sortBy: string,
    frequencies: Record<string, number> = {}
  ): Product[] {
    const cleanQuery = query.toLowerCase().trim();

    return products
      .filter((p) => {
        // 1. Category Filter
        if (category && category !== "All" && category !== "All Categories") {
          const cat = p.category || "Uncategorized";
          if (cat.toLowerCase() !== category.toLowerCase()) return false;
        }

        // 2. Stock Filters
        if (filters.inStockOnly && p.stock <= 0) return false;
        if (filters.lowStockOnly && p.stock > p.minStock) return false;

        // 3. Search Query Matcher
        if (cleanQuery) {
          const matchName = p.name.toLowerCase().includes(cleanQuery);
          const matchSku = p.sku.toLowerCase().includes(cleanQuery);
          const matchHsn = p.hsnCode ? p.hsnCode.toLowerCase().includes(cleanQuery) : false;
          const matchCat = p.category ? p.category.toLowerCase().includes(cleanQuery) : false;

          return matchName || matchSku || matchHsn || matchCat;
        }

        return true;
      })
      .sort((a, b) => {
        // 4. Sort calculations
        switch (sortBy) {
          case "name":
            return a.name.localeCompare(b.name);
          case "price-asc":
            return a.sellingPrice - b.sellingPrice;
          case "price-desc":
            return b.sellingPrice - a.sellingPrice;
          case "stock-asc":
            return a.stock - b.stock;
          case "stock-desc":
            return b.stock - a.stock;
          case "most-sold":
            const freqA = frequencies[a.id] || 0;
            const freqB = frequencies[b.id] || 0;
            return freqB - freqA; // High to Low frequency
          default:
            return 0; // Maintain default sort (usually createdAt desc)
        }
      });
  }
}
