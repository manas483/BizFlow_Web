# ADR 0002: Request-Scoped Memoization

## Context
In GraphQL and complex REST API operations, we often fetch the same entity multiple times in a single request (e.g., retrieving the `Business` object or resolving a `Customer` inside a loop of `Sales`). This causes textbook N+1 query problems and significantly inflates total database time.

## Decision
We implemented a **Request-Scoped Memoizer** inside `src/shared/lib/db.ts` using Node's `AsyncLocalStorage`. Prisma queries (specifically `findUnique` and `findFirst`) are intercepted. If the exact same query footprint (model, operation, where, select) has been executed already in the current HTTP request, we return the cached Promise.

## Consequences
- **Pros:** Completely eliminates accidental N+1 identical reads per request. Reduces Database connection pool contention.
- **Cons:** Increases memory usage slightly per request. Developers must remember that subsequent identical reads in the same tick will yield stale data if they mutate the record in-between (though we bypass memoization on mutations).
