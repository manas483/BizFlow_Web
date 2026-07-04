# ADR 002: Remove Dangerous Cascade Deletes

## Status
Accepted

## Context
In a previous migration (`20260509135931_add_cascade_deletes`), `ON DELETE CASCADE` was added to several critical relations, notably:
- `Sale.customer`
- `SaleItem.product`
- `CreditNote.sale`

This means that if a customer is deleted, the database automatically deletes every sale, payment, and credit note associated with that customer. In an ERP system, financial history must be immutable. Deleting a master record must never retroactively erase accounting ledgers.

## Decision
We will enforce `onDelete: Restrict` at the database level for the following relations:
- `Customer` to `Sale`
- `Product` to `SaleItem`
- `Sale` to `CreditNote`
- `Sale` to `DebitNote`

We will preserve `Cascade` only for true composition relations where the child cannot exist without the parent and has no financial independence:
- `Sale` to `SaleItem`
- `Sale` to `SalePayment`

## Consequences
- **Positive:** It is now physically impossible to accidentally delete sales by deleting a customer or product. The database will reject the operation with a foreign key violation.
- **Negative:** Developers must manually handle cleanup or soft-deletion of related records if a genuine deletion is ever required.
- **Negative:** Requires a Prisma migration that modifies existing constraints, which could require brief downtime during deployment.
