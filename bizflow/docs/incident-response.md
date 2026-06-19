# Runbook: Incident Response

> **Use when:** Production is down, degraded, or users are reporting data issues.  
> **Goal:** Restore service fast, communicate clearly, prevent recurrence.

---

## Severity Levels

| Level | Definition | Response Time | Example |
|---|---|---|---|
| SEV-1 | Full outage — no users can use the app | Immediate | Login broken, DB down, app 500ing |
| SEV-2 | Major feature broken — significant user impact | 30 minutes | Invoice creation failing, payments not saving |
| SEV-3 | Minor issue — workaround exists | Next business day | Report export slow, email delay |

---

## SEV-1 Response (Full Outage)

### Minute 0–5: Detect and Declare

```bash
# Confirm the outage
curl https://yourdomain.com/api/health

# Check error volume
# → Open Sentry — is error rate spiking?
# → Open hosting dashboard — is the app running?
# → Check database — is it reachable?
```

Post in Slack immediately:
```
🔴 SEV-1 INCIDENT DECLARED
Time: HH:MM IST
Issue: [what is broken]
Impact: [who is affected]
IC (Incident Commander): [your name]
Status page updated: yes/no
```

### Minute 5–15: Triage

Answer these in order:

1. **Was there a recent deploy?** → If yes, rollback first. See `rollback.md`
2. **Is the database reachable?**
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```
3. **Is it a code error or infrastructure?**
   - Code error → Sentry will show the stack trace
   - Infrastructure → Check hosting dashboard, DB dashboard
4. **Is it affecting all users or a subset?**
   - All users → likely infra or auth
   - Specific business → likely tenant data issue

### Minute 15–60: Fix or Rollback

- If a bad deploy caused it → rollback (5 min, see rollback runbook)
- If DB is down → contact hosting support + start recovery runbook
- If code bug → hotfix branch, deploy fix, monitor

### Resolution

```
Post in Slack:
✅ INCIDENT RESOLVED
Duration: X minutes
Root cause: [brief description]
Fix applied: [what was done]
Follow-up: [what will be done to prevent recurrence]
```

---

## SEV-2 Response (Major Feature Broken)

1. Confirm the issue with at least one reproduction step
2. Check Sentry for the exact error and stack trace
3. Determine if it's a regression (check recent deploys)
4. Fix on a hotfix branch — test on staging — deploy
5. If fix takes > 2 hours, consider rolling back

---

## Common Incidents and Quick Fixes

### App returns 500 on all routes
```bash
# Check application logs
# Vercel: Dashboard → Functions → View logs
# Railway: Dashboard → Logs

# Most common causes:
# 1. DATABASE_URL env var missing or wrong after deploy
# 2. Prisma client not generated (run: npx prisma generate)
# 3. Missing required env var (check env.ts validation output)
```

### Database connection refused
```bash
# Check DB status on hosting dashboard
# Check connection pool — may be exhausted
# Check DATABASE_URL is correct and DB allows connections from app IP

# Temporary: restart the application (releases connection pool)
```

### Users getting 401 on valid sessions
```bash
# Most likely: NEXTAUTH_SECRET changed between deploys
# Fix: ensure NEXTAUTH_SECRET is consistent across all deployments
# Do NOT rotate this secret without invalidating all sessions intentionally
```

### Invoice creation failing silently
```bash
# Check Sentry for the exact error
# Common causes:
# 1. Missing business_id on invoice — tenant isolation/auth check not applied to route
# 2. GST calculation returning NaN — check product HSN/tax rate
# 3. Stock went negative — missing transaction lock
# 4. Duplicate invoice number — sequence conflict under load
```

### Emails not delivering
```bash
# Check Resend dashboard for bounce/failure logs
# Verify RESEND_API_KEY is the live key (not test)
# Check from-address is a verified domain
# Test manually: curl Resend API directly
```

### Audit logs missing
```bash
# Check if logAudit() / logActivity() from src/shared/lib/audit.ts is applied to the route
# Check if the audit logger is silently catching and swallowing errors
# Audit failures should NOT block the main operation — but should log to Sentry
```

---

## Communication Templates

### Status Page Update (during incident)
```
[HH:MM IST] We are currently investigating an issue affecting [feature].
Our team is actively working on a fix. We will update in 30 minutes.
```

### Status Page Update (resolved)
```
[HH:MM IST] This incident has been resolved.
[Feature] is operating normally.
Total duration: X minutes. We apologize for the disruption.
```

### User-facing email (for SEV-1 > 1 hour)
```
Subject: Service disruption — BizFlow

We experienced a service disruption from HH:MM to HH:MM IST on [date].

Impact: [what was affected]
Your data: [was data affected? be specific and honest]
What we did: [brief non-technical explanation]
What we're doing to prevent this: [action items]

We apologize for the disruption.
— BizFlow Team
```

---

## Post-Incident Review

File within 48 hours of every SEV-1 and SEV-2:

```markdown
## Incident Report — [Date]

**Severity:** SEV-1 / SEV-2
**Duration:** X minutes
**Users affected:** X businesses / all users

### Timeline
- HH:MM — First alert / user report
- HH:MM — Root cause identified
- HH:MM — Fix deployed
- HH:MM — Incident resolved

### Root Cause
[What actually caused this]

### What Went Well
[Detection was fast, rollback worked, etc.]

### What Went Wrong
[Alert was too slow, no staging test, etc.]

### Action Items
| Action | Owner | Due Date |
|---|---|---|
| Add test for X | | |
| Configure alert for Y | | |
```

Save to: `docs/incident-reports/YYYY-MM-DD-[brief-title].md`

---

## Contacts

| Role | Name | Phone / Slack |
|---|---|---|
| Incident Commander | | |
| Database Admin | | |
| Hosting Support (Supabase/Railway) | Support chat | dashboard |
| Payment Gateway Support | | |
