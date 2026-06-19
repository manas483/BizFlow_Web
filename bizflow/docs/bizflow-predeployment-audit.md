# BizFlow — Pre-Deployment Audit Checklist

> Run this before every production deployment.  
> Each section is ordered by severity — fix blockers first.

---

## How to Use This

| Symbol | Meaning |
|---|---|
| 🔴 BLOCKER | Do not deploy. Fix immediately. |
| 🟡 WARNING | Fix before next sprint. |
| 🟢 GOOD | No action needed. |

---

## 1. Security Audit 🔴

### Authentication
- [ ] All API routes are protected by `auth.middleware.ts`
- [ ] Public routes are explicitly whitelisted — not just "everything else"
- [ ] JWT secret is a minimum 32-character random string (not `"secret"` or `"bizflow"`)
- [ ] Session tokens expire — access token ≤ 15 min, refresh token ≤ 7 days
- [ ] Password reset tokens expire within 1 hour
- [ ] Email verification is enforced before dashboard access
- [ ] `accept-invitation` tokens are single-use and expire

### Multi-Tenant Isolation
- [ ] Every API route injects `business_id` from session — never from request body
- [ ] `tenant.middleware.ts` is applied to ALL authenticated routes
- [ ] Every Prisma query filters by `businessId` — no exceptions
- [ ] A user from Business A cannot access Business B data (manual test: create two businesses, cross-test endpoints)
- [ ] File uploads are scoped to `business_id` in storage path

### Authorization (RBAC)
- [ ] `rbac.middleware.ts` is applied to every mutation endpoint
- [ ] No permission strings are hardcoded in routes — all use the Permission enum
- [ ] Employee role cannot access accounting or settings endpoints
- [ ] Sales Executive cannot delete invoices (if that is the business rule)
- [ ] Admin-only routes return 403, not 404, for unauthorized users

### Input Validation
- [ ] Every API route validates input with Zod before any service call
- [ ] No `req.body` is passed directly to Prisma without validation
- [ ] File upload endpoints validate MIME type and file size server-side
- [ ] GST number, PAN, IFSC are validated using `shared/validations/` — not just regex inline

### Sensitive Data
- [ ] No API keys or secrets in source code or `.env.example` with real values
- [ ] `.env` is in `.gitignore` — verify with `git status`
- [ ] Database URL is not logged anywhere
- [ ] Passwords are hashed with bcrypt (minimum 10 rounds) — never stored plain
- [ ] API responses never return `passwordHash`, internal IDs, or system metadata

### HTTP Security Headers
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Content-Security-Policy` configured in `next.config.js`
- [ ] HTTPS enforced — no HTTP in production

---

## 2. Multi-Tenant Data Integrity 🔴

Run these SQL queries directly against your production DB before go-live.

```sql
-- Check for records without business_id (data isolation gap)
SELECT COUNT(*) FROM customers   WHERE business_id IS NULL;
SELECT COUNT(*) FROM products    WHERE business_id IS NULL;
SELECT COUNT(*) FROM invoices    WHERE business_id IS NULL;
SELECT COUNT(*) FROM employees   WHERE business_id IS NULL;
SELECT COUNT(*) FROM expenses    WHERE business_id IS NULL;
SELECT COUNT(*) FROM loans       WHERE business_id IS NULL;
SELECT COUNT(*) FROM transactions WHERE business_id IS NULL;

-- All counts must be 0 before deployment
```

```sql
-- Verify indexes exist on business_id for performance
SELECT indexname FROM pg_indexes
WHERE tablename IN ('customers','products','invoices','employees')
AND indexdef LIKE '%business_id%';
```

- [ ] All counts above return 0
- [ ] `business_id` index exists on every tenant-scoped table
- [ ] Composite indexes exist on `(business_id, created_at)` for paginated list queries

---

## 3. Environment Configuration 🔴

```bash
# Run this — every variable must resolve without error
npx ts-node src/config/env.ts
```

- [ ] `DATABASE_URL` — points to production DB, not local or staging
- [ ] `NEXTAUTH_SECRET` — minimum 32 characters, randomly generated
- [ ] `NEXTAUTH_URL` — production domain, not localhost
- [ ] `RESEND_API_KEY` — live key, not test key
- [ ] All optional integrations (WhatsApp, GST API) either configured or feature-flagged off
- [ ] `NODE_ENV=production` is set
- [ ] No `console.log(env)` anywhere in startup code

---

## 4. Database 🔴

```bash
# Verify all migrations are applied
npx prisma migrate status

# Should output: "All migrations have been applied"
```

- [ ] `prisma migrate status` shows no pending migrations
- [ ] `prisma generate` has been run after the latest schema change
- [ ] Database has a backup strategy configured
- [ ] Connection pooling is configured (PgBouncer or Prisma Accelerate) for production load
- [ ] No raw SQL strings in code that bypass Prisma type safety
- [ ] `seed.ts` does NOT run in production (check your start scripts)

---

## 5. API Correctness 🟡

### Manual Smoke Tests
Run these with Postman, curl, or your API docs app:

```
Auth
  POST /api/auth/register          → 201, returns user (no password)
  POST /api/auth/login             → 200, returns session token
  POST /api/auth/login (wrong pw)  → 401
  GET  /api/dashboard (no token)   → 401

Tenant Isolation
  GET /api/customers (Business A token) → only Business A customers
  GET /api/customers (Business B token) → only Business B customers

RBAC
  DELETE /api/invoices/:id (Employee role) → 403
  GET    /api/reports       (Sales role)   → 200 or 403 per your rules

Inventory
  POST /api/inventory/products          → 201
  GET  /api/inventory/products          → 200, paginated
  POST /api/inventory/stock/adjust      → stock level changes correctly
  POST /api/inventory/stock/adjust (-1 below zero) → 422 BusinessRuleError

Sales
  POST /api/sales/invoices              → 201, GST calculated correctly
  POST /api/sales/invoices (bad GST no) → 422 validation error
  POST /api/sales/payments              → invoice status updates

Accounting
  POST /api/accounting/transactions     → ledger entry created
  GET  /api/reports/profit-loss         → correct figures

Audit Trail
  Any POST/PUT/DELETE                   → audit record written
  GET  /api/audit-trail (Employee role) → 403
```

---

## 6. Business Logic Correctness 🔴

These are ERP-critical. A wrong GST calculation is a legal problem.

```ts
// Run these in a test file or Node REPL

import { calculateGST } from '@bizflow/business-rules/gst'
import { calculateEMI } from '@bizflow/business-rules/loans'
import { calculateInvoiceTotal } from '@bizflow/business-rules/invoice'

// GST Tests
calculateGST(1000, 18)   // → { cgst: 90, sgst: 90, total: 1180 }
calculateGST(1000, 5)    // → { cgst: 25, sgst: 25, total: 1050 }
calculateGST(500,  12)   // → { cgst: 30, sgst: 30, total:  560 }

// IGST (inter-state)
calculateIGST(1000, 18)  // → { igst: 180, total: 1180 }

// EMI
calculateEMI(100000, 12, 12)  // → ₹8884.88 (standard formula)
calculateEMI(500000, 10, 60)  // → ₹10624.40

// Invoice Total (multi-line, discount, GST)
calculateInvoiceTotal([
  { qty: 2, rate: 500, discount: 10, gstRate: 18 },
  { qty: 1, rate: 1000, discount: 0, gstRate: 12 },
])
// → verify subtotal, discount, GST, and grand total manually
```

- [ ] All GST calculations match Indian tax rules
- [ ] IGST applies for inter-state transactions (different state codes)
- [ ] CGST + SGST applies for intra-state transactions
- [ ] EMI formula matches standard reducing balance method
- [ ] Invoice total = subtotal - discount + GST (not GST on discounted amount incorrectly)
- [ ] Stock deduction happens atomically with invoice creation (no partial saves)

---

## 7. Error Handling 🟡

- [ ] Every API route has a try/catch that returns structured error responses
- [ ] Error responses follow a consistent shape:
  ```json
  {
    "success": false,
    "error": {
      "code": "BUSINESS_RULE_VIOLATION",
      "message": "Cannot delete invoice with linked payments"
    }
  }
  ```
- [ ] 500 errors do NOT expose stack traces in production responses
- [ ] Validation errors return 422 with field-level detail
- [ ] Not found returns 404, not 500
- [ ] Unauthorized returns 401, forbidden returns 403 (not both as 401)

---

## 8. Performance Baseline 🟡

```bash
# Run Lighthouse on your dashboard page
npx lighthouse https://yourdomain.com/dashboard --output html

# Check bundle size
npx next build
# Review the output — flag any route over 500kb
```

- [ ] Dashboard initial load < 3 seconds on a 4G connection
- [ ] No route bundle exceeds 500kb (check `next build` output)
- [ ] List endpoints are paginated — no endpoint returns unbounded results
- [ ] Paginated queries use cursor-based or offset pagination consistently
- [ ] Heavy report queries have DB-level indexes verified

---

## 9. Build and Type Safety 🔴

```bash
# From monorepo root
pnpm install
turbo run typecheck   # zero TypeScript errors
turbo run lint        # zero ESLint errors
turbo run build       # clean build, no warnings treated as errors
```

- [ ] `turbo run typecheck` exits 0 — no TypeScript errors
- [ ] `turbo run lint` exits 0 — no ESLint errors
- [ ] `turbo run build` exits 0 — no build failures
- [ ] No `@ts-ignore` or `as any` in business-critical code paths
- [ ] No unused imports in module `index.ts` files

---

## 10. Audit Trail Verification 🟡

Manually verify in the database after performing test actions:

```sql
-- After creating an invoice via API
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;

-- Should show:
-- action:     CREATED
-- module:     sales
-- entity:     Invoice
-- new_value:  JSON of invoice
-- user_id:    your test user
-- ip_address: your IP
-- business_id: your test business
```

- [ ] Every POST writes a CREATED audit record
- [ ] Every PUT writes an UPDATED record with old and new values
- [ ] Every DELETE writes a DELETED record with old value snapshot
- [ ] Audit logs cannot be deleted via any API (no DELETE /audit-trail endpoint)
- [ ] Audit logs are scoped to `business_id` correctly

---

## 11. Email and Notifications 🟡

- [ ] Invoice email sends and renders correctly (test with a real inbox)
- [ ] Password reset email delivers within 60 seconds
- [ ] Email verification link works end-to-end
- [ ] Invitation email delivers and accept flow works
- [ ] Emails do not expose internal user IDs or system paths in links
- [ ] From address is a verified domain (not a free Gmail)

---

## 12. Final Pre-Deploy Checks 🟡

```bash
# Confirm you are deploying from the right branch
git branch --show-current     # should be main or release/*

# Confirm no debug code
grep -r "console.log" src/    # review and remove non-essential logs
grep -r "TODO\|FIXME\|HACK" src/ --include="*.ts"  # review all

# Confirm no test credentials
grep -r "test@\|password123\|admin123" src/
```

- [ ] Deploying from `main` or a release branch
- [ ] No `console.log` in production code paths
- [ ] No hardcoded test credentials anywhere in source
- [ ] Database backup taken before migration runs
- [ ] Rollback plan documented — know how to revert if deploy fails
- [ ] Staging environment tested with production data shape (not just local dev)

---

## Quick Command Reference

```bash
# Full audit run from monorepo root
turbo run typecheck && turbo run lint && turbo run build

# Database
cd apps/web
npx prisma migrate status
npx prisma validate

# Security headers check (after deploy)
curl -I https://yourdomain.com | grep -i "x-frame\|x-content\|referrer\|csp"

# Environment validation
npx ts-node src/config/env.ts
```

---

## 13. Financial Integrity 🔴

These are ERP-specific correctness checks. A wrong ledger balance or an overpaid invoice is a legal and trust problem, not just a bug.

```sql
-- Invoice total must equal sum of its line items
SELECT i.id, i.total, SUM(il.amount) AS line_total
FROM invoices i
JOIN invoice_lines il ON il.invoice_id = i.id
GROUP BY i.id, i.total
HAVING i.total != SUM(il.amount);
-- Must return 0 rows

-- No invoice should be overpaid
SELECT id, total, amount_paid
FROM invoices
WHERE amount_paid > total;
-- Must return 0 rows

-- No product should have negative stock
SELECT id, name, stock_quantity
FROM products
WHERE stock_quantity < 0;
-- Must return 0 rows

-- Journal entries must balance (debit = credit per entry)
SELECT journal_id, SUM(debit) AS total_debit, SUM(credit) AS total_credit
FROM journal_lines
GROUP BY journal_id
HAVING SUM(debit) != SUM(credit);
-- Must return 0 rows
```

- [ ] Invoice totals match sum of line items (query above returns 0 rows)
- [ ] No invoice has `amount_paid` exceeding `total`
- [ ] No product has negative `stock_quantity`
- [ ] All journal entries balance — debit equals credit per entry
- [ ] Deleted invoices are soft-deleted only — audit history preserved
- [ ] Payment cannot be created for an already fully paid invoice (422 returned)
- [ ] Stock deduction and invoice creation are wrapped in a single DB transaction

---

## 14. Concurrency and Race Conditions 🔴

The most common silent failure in inventory systems.

**Manual concurrency test:**

```bash
# Simulate two simultaneous sales of the last stock item
# Run both curl commands at exactly the same time in two terminals

# Terminal 1
curl -X POST https://yourdomain.com/api/sales/invoices \
  -H "Authorization: Bearer $TOKEN_USER_A" \
  -d '{"items": [{"productId": "last-item-id", "qty": 1}]}'

# Terminal 2
curl -X POST https://yourdomain.com/api/sales/invoices \
  -H "Authorization: Bearer $TOKEN_USER_B" \
  -d '{"items": [{"productId": "last-item-id", "qty": 1}]}'

# Expected: one succeeds (201), one fails (422 - insufficient stock)
# Bad result: both succeed and stock goes to -1
```

- [ ] Simultaneous sale of last stock item — only one succeeds, stock never goes negative
- [ ] Simultaneous invoice creation does not produce duplicate invoice numbers
- [ ] Prisma transactions (`prisma.$transaction`) used for any multi-table write
- [ ] Stock adjustment uses a DB-level lock or atomic update:
  ```ts
  // Correct — atomic, prevents race condition
  await prisma.product.update({
    where: { id: productId, stockQuantity: { gte: quantity } },
    data: { stockQuantity: { decrement: quantity } }
  })
  // If update affects 0 rows → stock was insufficient
  ```
- [ ] Loan repayment cannot be applied twice for the same installment
- [ ] Attendance cannot be marked twice for the same employee on the same day

---

## 15. Disaster Recovery 🔴

Many teams have backups. Very few have tested restoring them. An untested backup is not a backup.

- [ ] Automated daily database backups are enabled on the hosting provider
- [ ] Backup retention is minimum 30 days
- [ ] A backup restoration has been tested end-to-end in the last 30 days:
  - Restore to a separate staging DB
  - Verify row counts match
  - Verify a known invoice/customer record exists
- [ ] Point-in-time recovery (PITR) is configured if supported by host (Supabase, Railway, RDS all support this)
- [ ] Recovery time objective (RTO) is documented — "we can restore in X hours"
- [ ] Recovery point objective (RPO) is documented — "we can lose at most X hours of data"
- [ ] `docs/runbooks/database-recovery.md` exists and has been followed at least once
- [ ] At least one team member other than the primary dev can execute the recovery procedure

---

## 16. Monitoring and Alerting 🔴

Without monitoring, your users find outages before you do.

### Error Monitoring
- [ ] Sentry (or equivalent) installed and receiving events
- [ ] Test error triggered and confirmed visible in Sentry dashboard
- [ ] Sentry alerts configured to send to Slack or email within 5 minutes
- [ ] Source maps uploaded to Sentry so stack traces show original TypeScript

### Uptime Monitoring
- [ ] Uptime monitor configured (BetterUptime, UptimeRobot, or host-provided)
- [ ] Monitored endpoints: `/api/health`, login page, dashboard page
- [ ] Alert fires within 2 minutes of downtime
- [ ] On-call contact is configured — someone gets the alert at 2am

### Infrastructure Monitoring
- [ ] Database CPU alert at > 80% for 5 minutes
- [ ] Database disk space alert at > 75% used
- [ ] Application memory alert configured
- [ ] Slow query logging enabled in PostgreSQL (`log_min_duration_statement = 1000`)

### Health Check Endpoint
```ts
// app/api/health/route.ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: 'ok', db: 'connected', ts: new Date() })
  } catch {
    return Response.json({ status: 'error', db: 'disconnected' }, { status: 503 })
  }
}
```
- [ ] `/api/health` endpoint exists and returns DB connection status
- [ ] Health check is excluded from auth middleware
- [ ] Uptime monitor pings `/api/health` every 60 seconds

---

## 17. Production Logging 🟡

- [ ] Structured JSON logging enabled (not plain `console.log` strings)
- [ ] Every log entry includes a `requestId` for tracing a full request lifecycle
- [ ] Log levels used correctly — `error` for failures, `warn` for degraded state, `info` for key events
- [ ] No passwords appear in any log output
- [ ] No API keys or tokens appear in any log output
- [ ] No personally identifiable information (PAN, Aadhaar, phone) in logs
- [ ] Logs are shipped to a log aggregator (Logtail, Datadog, CloudWatch) — not just stdout
- [ ] Log retention policy set — minimum 90 days for ERP audit compliance

---

## 18. Branch Isolation 🟡

Applies once BizFlow supports multi-branch businesses.

```sql
-- Verify branch_id exists on branch-scoped tables
SELECT COUNT(*) FROM products  WHERE branch_id IS NULL AND business_id IS NOT NULL;
SELECT COUNT(*) FROM invoices  WHERE branch_id IS NULL AND business_id IS NOT NULL;
SELECT COUNT(*) FROM inventory WHERE branch_id IS NULL AND business_id IS NOT NULL;
-- All must return 0 once branch support is live
```

- [ ] Users are restricted to their assigned branches — cannot view other branch data
- [ ] Inventory reports respect `branch_id` scope — Branch A cannot see Branch B stock
- [ ] Invoice creation stamps the correct `branch_id` from session
- [ ] Cross-branch transfers have explicit approval workflow
- [ ] Admin and Owner roles can view all branches — Branch Manager only their own
- [ ] Branch filtering verified with a two-branch test business

---

## Quick Command Reference

```bash
# Full build audit
turbo run typecheck && turbo run lint && turbo run build

# Database health
cd apps/web
npx prisma migrate status
npx prisma validate

# Financial integrity queries (run against production DB)
psql $DATABASE_URL -f scripts/integrity-check.sql

# Security headers (after deploy)
curl -I https://yourdomain.com | grep -i "x-frame\|x-content\|referrer\|csp"

# Environment validation
npx ts-node src/config/env.ts

# Health check
curl https://yourdomain.com/api/health
```

---

## Audit Sign-Off

| Area | Status | Notes |
|---|---|---|
| Security | | |
| Multi-Tenant Isolation | | |
| Environment Config | | |
| Database Migrations | | |
| API Smoke Tests | | |
| Business Logic (GST/EMI) | | |
| Error Handling | | |
| Build / TypeCheck | | |
| Audit Trail | | |
| Email Delivery | | |
| Performance Baseline | | |
| Financial Integrity | | |
| Concurrency | | |
| Disaster Recovery | | |
| Monitoring and Alerting | | |
| Production Logging | | |
| Branch Isolation | | |

**Deployer:** _________________ **Date:** _____________ **Version:** _____________

> All 🔴 BLOCKER items must be ✅ before deployment.  
> All 🟡 WARNING items must have a scheduled fix date.
