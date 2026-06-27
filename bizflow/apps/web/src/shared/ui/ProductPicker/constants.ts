export const PRODUCT_PICKER_SHORTCUTS = {
  SEARCH: "Ctrl+F",
  SELECT_ALL: "Ctrl+A",
  BARCODE: "F2",
  SUBMIT: "Enter",
  CLEAR: "Delete",
  CLOSE: "Escape",
};

export const PRODUCT_PICKER_STORAGE = {
  RECENTS: "bizflow_picker_recents",
  FAVORITES: "bizflow_picker_favorites",
  VIEW_MODE: "bizflow_picker_view_mode",
  FILTERS: "bizflow_picker_filters",
  FREQUENCIES: "bizflow_picker_frequencies",
};

export const PRODUCT_PICKER_MAX_CACHE = 5000;
export const SEARCH_DEBOUNCE_MS = 200;
export const LOW_STOCK_THRESHOLD = 5;

// Web Audio API beep frequencies
export const BEEP_FREQ_SUCCESS = 880; // A5
export const BEEP_FREQ_ERROR = 150; // Low buzz
