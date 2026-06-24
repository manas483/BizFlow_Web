# BizFlow Inventory Costing Rules

This document outlines the core principles of the BizFlow Layer Costing Architecture.

It serves as the definitive guide for developers, accountants, auditors, and support staff for understanding how inventory valuation, landed costs, and COGS are tracked inside the system.

## 1. How Costs Are Calculated

**Product Master Must Never Store Valuation.**
Inventory costs are NEVER determined by checking a `product.purchasePrice`. Instead, every purchase invoice creates a specific, immutable `InventoryLayer` record.
- **Purchase Cost**: The raw supplier price at the time of purchase.
- **Landed Cost**: The total amount paid after all freight, transport, insurance, loading, and miscellaneous expenses are added.
- **Unit Cost**: The final `landedCost / originalQty` stored permanently against the layer.

## 2. How Landed Costs Are Allocated

Landed costs are distributed proportionally to inventory layers.
- When an `Expense` is created and mapped to an invoice, the system identifies all active layers tied to that invoice.
- The expense amount is allocated based on the total purchase value of the layers (e.g., if Layer A is 80% of the invoice value, it receives 80% of the transport expense).
- This allocation permanently increases the layer's `landedCost` and `unitCost` and creates an `ExpenseAllocationHistory` trail.

## 3. FIFO vs LIFO Behavior

When a sale occurs, the system consumes inventory from active layers based on the business's selected costing method.
- **FIFO (First-In-First-Out)**: Consumes the oldest layer first (based on `createdAt` / `receiptDate`).
- **LIFO (Last-In-First-Out)**: Consumes the newest layer first.
- As layers are consumed, an `InventoryLayerConsumption` record is created tying the Sale directly to the specific layer.
- COGS is mathematically derived as exactly `Consumed Qty * Layer's Unit Cost`.

## 4. How Returns Affect Layers

- **Purchase Returns (Debit Notes)**: Reduces the `remainingQty` of the specific layer. Crucially, it proportionally reduces the `landedCost` and creates negative `ExpenseAllocationHistory` entries so that the `unitCost` does not artificially inflate.
- **Sales Returns (Credit Notes)**: Deletes the `InventoryLayerConsumption` record and puts the exact `consumedQty` back into the original layer's `remainingQty`. It restores the historical layer to its exact pre-sale state, retaining its original `unitCost`.

## 5. How Transfers Affect Layers

When stock is transferred between warehouses:
- A new `InventoryLayer` is cloned in the destination warehouse.
- The exact `unitCost` of the source layer is preserved in the new layer.
- The source layer's `remainingQty` is reduced. 
- Transfers do NOT reset costs to WAC; the original valuation is perfectly preserved.

## 6. How WAC is Calculated

Weighted Average Cost (WAC) is recalculated dynamically for convenience across the system (e.g., for reporting margins), but it is NOT the source of truth.
- `WAC = Sum(remainingQty * unitCost across all active layers for a product) / Sum(remainingQty across all active layers)`
- It updates on every layer creation, consumption, or landed cost adjustment.

## 7. How Expense Reversals Work

If a user edits or deletes an expense that was previously allocated to layers:
- The system reads the `ExpenseAllocationHistory` for that expense.
- It deducts the previously allocated amounts from the respective layers (`landedCost` and `unitCost` drop back to their original states).
- It deletes the old Journal Entries, re-computes the new allocation (if edited), and generates fresh Journal Entries for the exact new cost.

## 8. What the Inventory Health Widget Means

The **Inventory Integrity Health Widget** on the admin dashboard monitors data consistency in real-time.
- **Negative Layers**: Should always be 0. If > 0, stock has been oversold beyond DB constraints.
- **Orphan Consumptions**: Should always be 0. Indicates a sale consumed a layer that was subsequently manually deleted or corrupted.
- **Drift Products**: Should always be 0. Indicates `Product.stock` desynced from `Sum(Layer.remainingQty)` or `Product.purchasePrice` desynced from `Calculated WAC`. If drift is detected, the `rebuild-inventory-valuation.ts` script must be run.

---

### Migration Sign-Off Checklist (Reference)

Before Go-Live, the following must have been fully verified:

1. **Pre-Migration:**
   - Full database backup completed and restore tested.
2. **Migration:**
   - `seed-inventory-layers.ts` executed successfully.
   - All legacy stock converted to layers tagged `OPENING_STOCK`.
3. **Validation:**
   - `validate-inventory-integrity.ts` returns 0 Drift, 0 Negative, 0 Orphans.
4. **UAT Flows Confirmed:**
   - Multi-invoice landed costs.
   - FIFO/LIFO consumption.
   - Purchase/Sales returns.
   - Expense add/edit/delete tracking.
