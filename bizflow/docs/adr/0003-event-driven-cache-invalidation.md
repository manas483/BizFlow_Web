# ADR 0003: Event-Driven Cache Invalidation

## Context
Data served via the cache (Dashboards, Product Lists) updates frequently. Standard TTL-based caching causes unacceptable staleness, where a user edits a product but sees the old name for 15 minutes.

## Decision
We implemented **Event-Driven Cache Invalidation**. Using Prisma's `$allOperations` interceptor, any `create`, `update`, or `delete` mutation to a trigger table (e.g. `Product`, `Sale`, `Purchase`) routes through the `CacheInvalidation` service, which immediately evicts the corresponding business-scoped keys from the cache.

## Consequences
- **Pros:** Near real-time cache consistency. Users instantly see their changes while still benefiting from 90%+ hit rates on read-heavy paths.
- **Cons:** Tying cache rules to database intercepts requires diligent maintenance of `CacheInvalidation`. Multi-tenant isolation is critical—bugs here could accidentally purge cache for all businesses.
