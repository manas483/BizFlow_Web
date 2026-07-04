# BizFlow Caching Strategy

This document defines the caching policies for the BizFlow application. To ensure multi-tenant isolation, caching is generally scoped to the `businessId`. All keys must be generated using the `CacheKeys` builder in `src/shared/lib/cache.ts`.

## 1. Never Cache (Live Transactional Data)
Data in this category is highly volatile, latency-sensitive in terms of consistency, or critical for correct financial/operational logic. It must always be queried directly from the primary database or replica.

**Examples:**
- POS Checkout generation
- Invoice generation
- Inventory Balances & Layer Engine costing calculations
- Real-time stock availability during order placement

## 2. Request Cache (Request-Scoped Memoization)
Data in this category doesn't change during the lifecycle of a single HTTP request, but may be queried repeatedly by different modules within the same transaction (classic N+1 scenario).

**Strategy:**
- Uses `AsyncLocalStorage`-based memoizer within Prisma interceptors (`src/shared/lib/db.ts`).
- Survives exactly as long as the HTTP request.

**Examples:**
- Looking up `Business` or `User` details.
- Resolving identical foreign keys repeatedly (`Product.findUnique(id)`).

## 3. Short Cache (Dashboard, Lists)
Data in this category updates frequently but can tolerate a few seconds or minutes of staleness, or can be proactively invalidated upon mutation.

**Strategy:**
- Backed by In-Memory or Upstash Redis.
- Typically 30 seconds to 5 minutes TTL.
- Relies on Event-Driven Invalidation via `CacheInvalidation` service for immediate updates when relevant underlying entities change.

**Examples:**
- Dashboards (`CacheKeys.dashboard`)
- Product catalogs (`CacheKeys.productList`)
- Customer lists (`CacheKeys.customerList`)

## 4. Long Cache (Settings, Configuration)
Data in this category changes rarely and has minimal impact if slightly stale. 

**Strategy:**
- Backed by In-Memory or Upstash Redis.
- Extended TTLs (e.g. 1 hour or more).
- Can still use Event-Driven Invalidation on deliberate configuration changes.

**Examples:**
- Automation Settings
- Business Settings (`CacheKeys.businessSettings`)
- Role permissions (`CacheKeys.permissions`)
- Historical / EOM Reports (`CacheKeys.reports`)

---

## Observing Cache Performance

BizFlow includes a cache observability layer that monitors efficiency. This data is available in the **Admin Diagnostics Dashboard**.

**Tracked Metrics:**
- **Hit Rate %**: The percentage of lookups served without querying the fallback function.
- **Estimated DB Time Saved**: Accumulated computation time (in milliseconds) averted due to cache hits.
- **Expired**: Items removed implicitly because their TTL elapsed before the next read.
- **Invalidated**: Items removed explicitly via the `CacheInvalidation` service.

*Note: We currently use **Lazy Eviction** for the In-Memory provider to reduce background CPU cycles. Evictions are processed on-read or during explicit invalidation.*
