# ADR 0005: Performance Budgets

## Context
Performance degradation typically happens gradually. Without defined thresholds, developers merge slightly slower queries until the platform becomes sluggish.

## Decision
We established strict **Performance Budgets** (e.g. Login P95 < 300ms, API Error Rate < 0.5%) and baked them directly into our engineering standards and telemetry layer (`PERF_BUDGETS` in `src/shared/lib/telemetry.ts`). The performance dashboard actively flags endpoints that exceed their budget.

## Consequences
- **Pros:** Transforms subjective performance debates into objective, evidence-based rules. Prevents slow regressions from slipping into production.
- **Cons:** May occasionally block feature merges if they cannot be implemented within the strict latency budgets, forcing upfront architectural redesigns.
