import { PRODUCT_PICKER_STORAGE } from "../constants";

export interface ProductPickerState {
  searchQuery: string;
  selectedCategory: string;
  sortBy: string;
  inStockOnly: boolean;
  lowStockOnly: boolean;
  viewMode: "grid" | "list";
  selections: Record<string, number>; // productId -> quantity
  favorites: string[];
  recents: string[];
  frequencies: Record<string, number>;
}

export type ProductPickerAction =
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_CATEGORY"; payload: string }
  | { type: "SET_SORT_BY"; payload: string }
  | { type: "SET_STOCK_FILTER"; payload: { inStockOnly?: boolean; lowStockOnly?: boolean } }
  | { type: "SET_VIEW_MODE"; payload: "grid" | "list" }
  | { type: "TOGGLE_PRODUCT"; payload: { productId: string; maxStock?: number } }
  | { type: "UPDATE_QTY"; payload: { productId: string; qty: number; maxStock?: number } }
  | { type: "CLEAR_SELECTIONS" }
  | { type: "SELECT_ALL_VISIBLE"; payload: string[] } // list of visible product IDs
  | { type: "INITIALIZE_SELECTIONS"; payload: Record<string, number> }
  | { type: "TOGGLE_FAVORITE"; payload: string }
  | { type: "LOAD_STORAGE"; payload: { favorites: string[]; recents: string[]; frequencies: Record<string, number>; viewMode: "grid" | "list" } };

export const initialState: ProductPickerState = {
  searchQuery: "",
  selectedCategory: "All",
  sortBy: "name",
  inStockOnly: false,
  lowStockOnly: false,
  viewMode: "grid",
  selections: {},
  favorites: [],
  recents: [],
  frequencies: {},
};

export function productPickerReducer(
  state: ProductPickerState,
  action: ProductPickerAction
): ProductPickerState {
  switch (action.type) {
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.payload };

    case "SET_CATEGORY":
      return { ...state, selectedCategory: action.payload };

    case "SET_SORT_BY":
      return { ...state, sortBy: action.payload };

    case "SET_STOCK_FILTER":
      return {
        ...state,
        inStockOnly: action.payload.inStockOnly !== undefined ? action.payload.inStockOnly : state.inStockOnly,
        lowStockOnly: action.payload.lowStockOnly !== undefined ? action.payload.lowStockOnly : state.lowStockOnly,
      };

    case "SET_VIEW_MODE":
      // Persist view mode selection
      if (typeof window !== "undefined") {
        localStorage.setItem(PRODUCT_PICKER_STORAGE.VIEW_MODE, action.payload);
      }
      return { ...state, viewMode: action.payload };

    case "TOGGLE_PRODUCT": {
      const { productId } = action.payload;
      const exists = state.selections[productId] !== undefined;
      const newSelections = { ...state.selections };
      if (exists) {
        delete newSelections[productId];
      } else {
        newSelections[productId] = 1; // Default quantity is 1
      }
      return { ...state, selections: newSelections };
    }

    case "UPDATE_QTY": {
      const { productId, qty } = action.payload;
      const newSelections = { ...state.selections };
      if (qty <= 0) {
        delete newSelections[productId];
      } else {
        newSelections[productId] = qty;
      }
      return { ...state, selections: newSelections };
    }

    case "CLEAR_SELECTIONS":
      return { ...state, selections: {} };

    case "SELECT_ALL_VISIBLE": {
      const newSelections = { ...state.selections };
      action.payload.forEach((id) => {
        if (newSelections[id] === undefined) {
          newSelections[id] = 1;
        }
      });
      return { ...state, selections: newSelections };
    }

    case "INITIALIZE_SELECTIONS":
      return { ...state, selections: action.payload };

    case "TOGGLE_FAVORITE": {
      const id = action.payload;
      const isFav = state.favorites.includes(id);
      const newFavs = isFav ? state.favorites.filter((f) => f !== id) : [...state.favorites, id];

      if (typeof window !== "undefined") {
        localStorage.setItem(PRODUCT_PICKER_STORAGE.FAVORITES, JSON.stringify(newFavs));
      }
      return { ...state, favorites: newFavs };
    }

    case "LOAD_STORAGE":
      return {
        ...state,
        favorites: action.payload.favorites,
        recents: action.payload.recents,
        frequencies: action.payload.frequencies,
        viewMode: action.payload.viewMode,
      };

    default:
      return state;
  }
}
