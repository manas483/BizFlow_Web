# Phase 3 Performance Baseline

**Captured:** 2026-07-01
**Methodology:** Simulated 30 sequential API/query requests across key modules using `scripts/benchmark-queries.ts` communicating with the production-equivalent Neon database.

## Latency Metrics (p99)

| Endpoint / Module | P50 Latency | P95 Latency | P99 Latency |
|-------------------|-------------|-------------|-------------|
| **Login**         | 269.99ms    | 272.56ms    | 274.26ms    |
| **Inventory**     | 1.14ms      | 4.72ms      | 4.78ms      |
| **Sales List**    | 1.05ms      | 1.48ms      | 1.48ms      |
| **Product Search**| 0.90ms      | 2.14ms      | 2.37ms      |
| **Dashboard KPIs**| 1.34ms      | 1.63ms      | 2.50ms      |
| **Reports (Full)**| 4.24ms      | 7.93ms      | 7.97ms      |

*Note: These represent the raw Prisma query + Node.js execution time within the API route, excluding network transit time to the client.*

## Optimizations Applied
- Connection pooling via `pg.Pool` (configurable via `DATABASE_POOL_MAX`).
- Compound indices added to `Expense`, `Customer`, and `Product` for fast dashboard/report aggregations.
- Redis caching with event-driven invalidation.
- Dynamic imports for frontend heavy bundles (Recharts, XLSX).

## Future Thresholds (Phase 4)
- **Warning:** Any single query > 500ms.
- **Critical:** Any single query > 1000ms.
