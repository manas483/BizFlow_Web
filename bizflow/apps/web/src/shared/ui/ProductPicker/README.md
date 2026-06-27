# BizFlow Product Picker Component

A generic, highly performant, accessible, and extensible **Product Picker Modal / Drawer** designed for enterprise-grade POS and ERP flows inside the BizFlow suite.

---

## Folder Architecture

```
ProductPicker/
├── ProductPickerModal.tsx   # Root coordinator and keyboard listener
├── SearchBar.tsx            # Input bar with Ctrl+F hotkeys
├── BarcodeInput.tsx         # Barcode scanned input with F2 hotkeys
├── CategorySidebar.tsx      # Vertical/horizontal categorized tabs
├── ProductGrid.tsx          # Observer-based infinite scroll grid/list
├── ProductCard.tsx          # Card elements with search highlighted terms
├── QuantityEditor.tsx       # Qty edit controls
├── constants.ts             # Shortcuts, Storage keys and limits
├── types.ts                 # Domain models and callback types
├── services/
│   ├── BarcodeService.ts    # Audio Synth beep and scanner parser
│   └── SearchEngine.ts      # Local cache filters and sorting engine
└── state/
    └── ProductPickerReducer.ts # Reducer state machine
```

---

## Props Definition

```typescript
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
```

---

## Keyboard Shortcuts

| Shortcut | Description |
| --- | --- |
| **Ctrl + F** | Focus Search Input |
| **F2** | Focus Barcode Scanner Input |
| **ArrowUp / ArrowDown** | Highlight products in the list |
| **Space** | Toggle selection checkbox of the highlighted product |
| **Enter** | Add all checked selections |
| **Delete** | Clear all current selections |
| **Escape** | Request Close (warning pops up if items are selected) |
