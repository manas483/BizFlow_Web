# BizFlow Engineering Standards

This document outlines the core engineering guardrails, performance budgets, and operational philosophies that govern the development of the BizFlow ERP platform.

## 1. Engineering Guardrails (PR Checklist)
For every pull request or major feature, engineers must answer the following questions:

- **Performance:** Did P95 latency regress for any affected endpoints?
- **Database:** Did this introduce a new N+1 query or significantly increase total DB time?
- **Cache:** If data is cacheable, has the invalidation logic been correctly implemented in the `CacheInvalidation` service?
- **Observability:** Will a production failure within this feature be diagnosable from logs, error codes, and metrics?
- **Multi-tenancy:** Is every database query explicitly scoped to the `businessId`?
- **Security:** Are Role-Based Access Controls (RBAC) and data permissions enforced server-side?
- **Testing:** Has the primary user workflow for this feature been exercised?

## 2. Performance Budgets
We treat performance budgets as engineering standards, not optional suggestions. A feature that pushes an endpoint beyond its budget should trigger an architectural review.

| Area | Target |
| :--- | :--- |
| Login / Authentication | P95 < 300 ms |
| Admin / Dashboard Stats | P95 < 500 ms |
| Sales Search | P95 < 300 ms |
| Inventory Search | P95 < 300 ms |
| General Product Lookup | P95 < 100 ms |
| Global API Error Rate | < 0.5% |

## 3. Engineering Effort Allocation
To keep the platform moving forward while preventing technical debt from accumulating, we aim for the following rough allocation of engineering effort per quarter:

- **60% — Business Features:** ERP capabilities that directly benefit end-users.
- **25% — Reliability & Performance:** Technical debt repayment, slow query optimization, and latency improvements driven by telemetry.
- **15% — Platform Improvements:** Developer tooling, CI/CD pipelines, automated deployments, and documentation (like ADRs).

## 4. Architecture Decision Records (ADRs)
Significant technical choices are documented in the `docs/adr/` directory. When adding major architectural components, replacing core libraries, or establishing new patterns, you must create a new ADR.

An ADR should answer:
- **Context:** What problem were you solving?
- **Decision:** What approach did you choose?
- **Consequences:** What trade-offs does it introduce?
