# ADR 001: Implement Soft Deletes for Master Data

## Status
Accepted

## Context
Currently, when a user deletes a master record (e.g., Customer, Product, Employee), the API issues a hard `DELETE` command to the database. This causes two major issues:
1. Due to cascading rules, deleting a customer deletes all historical sales and financial data associated with them, resulting in massive data loss.
2. Even if cascades are removed (see ADR 002), foreign key constraints would prevent deletion, causing an error and confusing the user.

## Decision
We will implement soft deletes for core master data entities:
- `Customer`
- `Employee`
- `Account` (Accounting ledgers)

*Note: `Product` already uses an `active` boolean flag. Financial transactions (Sales, Expenses, Loans) will use a workflow-state-based cancellation/voiding mechanism rather than soft deletes.*

For entities using soft deletes, we will add:
```prisma
deletedAt DateTime?
deletedBy String?
```

All API GET handlers will be updated to append `{ where: { deletedAt: null } }` by default.

## Consequences
- **Positive:** Data loss is prevented. Foreign key integrity is maintained. Audit history is preserved.
- **Negative:** Queries must be updated to always check `deletedAt: null`. Accidental omissions of this filter might expose deleted data in the UI.
- **Negative:** Unique constraints (e.g., email addresses) might prevent creating a new employee with the same email as a deleted one unless the unique index is updated to include `deletedAt`. We will handle this gracefully at the application level.
