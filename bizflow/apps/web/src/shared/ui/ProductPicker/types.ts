export interface PackagingOption {
  id: string;
  label: string;
  unit: string;
  conversionFactor: number;
  defaultPrice?: number | null;
  isPurchaseUnit: boolean;
  isLoose: boolean;
  isDefault: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  reservedStock?: number;
  sellingPrice: number;
  standardCost: number;
  gstRate: number;
  hsnCode?: string | null;
  unit: string;
  supplier?: string | null;
  active?: boolean;
  // ── Loose Sale Fields ──
  allowLooseSale?: boolean;
  baseUnit?: string | null;
  baseStock?: number | null;
  packagingOptions?: PackagingOption[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  state?: string | null;
  gstNumber?: string | null;
}

export interface SelectedProduct {
  product: Product;
  qty: number;
  batch?: string;
  serial?: string;
  resolvedPrice: number;
}

export interface PickerAddResult {
  selections: SelectedProduct[];
  source: "search" | "barcode" | "favorites" | "recent" | "quick-add";
  timestamp: string;
  mergeStrategy: "merge" | "new-row";
}
