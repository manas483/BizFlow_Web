# ADR 0001: Inventory Layer Costing vs Product-Level Costing

## Context
When calculating the valuation of inventory, we need an accurate method to trace costs over time. Storing an average cost per product (Product-Level Costing) is simple but loses the historical accuracy of when distinct batches were purchased at different prices (e.g. FIFO valuation).

## Decision
We chose to implement **Inventory Layer Costing** (FIFO/LIFO/Specific ID compatible) via an `InventoryLayer` model, rather than keeping a rolling average cost strictly on the `Product` table. Every incoming stock movement creates or adds to a distinct valuation layer.

## Consequences
- **Pros:** Highly accurate financial reporting. Clear audit trail of exact costs applied to each sale.
- **Cons:** Increases database complexity and query volume (fetching multiple layers per product). Requires careful performance tuning (such as explicit `select` statements to avoid over-fetching large layer history).
