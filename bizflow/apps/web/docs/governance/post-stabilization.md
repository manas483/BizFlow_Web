# Post-Stabilization Governance

With the completion of Phase 5, the core stabilization program for BizFlow is considered complete. 
To maintain this operational excellence, the engineering team must adhere to the following lightweight governance process.

## 1. Recurring Reviews
- **Quarterly Architecture Review:** Review major structural changes, evaluate the performance of Optimistic Concurrency Control (OCC) and cache telemetry, and identify any new technical debt.
- **Monthly Dependency & Security Review:** Audit npm dependencies, apply security patches, and update framework versions (Next.js, Prisma, etc.).
- **Backup Restore Drills:** Periodically test restoring the database from `BackupRecord` to ensure the DR strategy remains viable.
- **Annual Review of ADRs and Feature Flags:** Review architecture decisions and remove stale feature flags.

## 2. Feature Flag Lifecycle
Feature flags allow for decoupled deployments and risk mitigation, but they must not become permanent technical debt.
For every feature flag introduced in `src/shared/lib/feature-flags.ts`:
- **Owner:** Identify the engineering owner.
- **Purpose:** Document why the flag exists (e.g. "dark launch new reports engine").
- **Default State:** Document whether it's enabled or disabled by default.
- **Planned Removal Date:** Assign a sprint or date to remove the flag and merge the code path permanently.

## 3. Audit Log Exclusions
The `AuditLog` table serves as an immutable business trail. To prevent noisy audit logs, do NOT track or generate audit entries for the following operational or low-level fields:
- `updatedAt` (or `createdAt`)
- `version` (used for Optimistic Concurrency)
- Cache metadata (e.g. cache invalidation timestamps)
- Last viewed timestamps
- Telemetry counters and latency metrics

*Rule of Thumb:* If the change does not represent a user intent or a business transaction, do not log it to `AuditLog`. Use `logger.ts` for operational telemetry instead.
