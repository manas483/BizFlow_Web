# ADR 0004: Lazy Cache Expiration

## Context
When using an In-Memory cache provider, items technically stay in memory until explicitly removed. Setting background `setInterval` sweepers to purge expired keys burns CPU cycles unnecessarily, especially when scaling across multiple Node processes.

## Decision
We opted for **Lazy Cache Expiration**. The `InMemoryCache` provider checks the TTL on-read. If the item is expired, it deletes it from the `Map` and returns a cache miss. Explicitly invalidated keys are aggressively removed via the `CacheInvalidation` service.

## Consequences
- **Pros:** Zero background timer overhead. Simple to implement and debug.
- **Cons:** Memory footprint could theoretically grow if thousands of unique keys are created, naturally expire, and are never read again. If memory bloat becomes an issue, we will transition to Upstash Redis rather than building complex LRU sweepers locally.
