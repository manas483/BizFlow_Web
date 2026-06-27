export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  minStock: number;
  sellingPrice: number;
  gstRate: number;
  hsnCode?: string | null;
  unit: string;
  active?: boolean;
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
