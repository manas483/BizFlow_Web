# ADR 0006: Authentication Observability

## Context
Authentication failures ("Sign-in failed") were silently returning `null` via NextAuth, making production login issues incredibly difficult to debug. We had zero visibility into whether the issue was a database connection, wrong password, or environment misconfiguration.

## Decision
We implemented comprehensive **Authentication Observability**:
1. Custom error classes (`AuthError`) with `AUTH-XXX` codes.
2. A protected `/api/admin/auth-health` diagnostics endpoint.
3. A failure ring buffer tracking recent login attempts and their exact error codes.
4. Correlation IDs spanning the full NextAuth lifecycle.

## Consequences
- **Pros:** Massively reduced mean time to resolution (MTTR) for authentication bugs. Support teams can now view exact failure reasons.
- **Cons:** Requires rigorous sanitization of logs to prevent leaking sensitive PII (passwords, JWT tokens) into our observability dashboard.
