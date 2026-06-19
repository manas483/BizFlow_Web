# Runbook: Production Rollback

> **Use when:** A deployment causes errors, data issues, or user-facing failures.  
> **Decision rule:** If any 🔴 issue appears within 30 minutes of deploy — rollback first, investigate second.  
> **Time to rollback:** 5–15 minutes

---

## When to Rollback (Don't Debate — Just Do It)

- Error rate in Sentry increases > 10x after deploy
- `/api/health` returns 503
- Users cannot log in
- Invoice creation is failing
- Any data corruption detected
- Database migration caused table lock or performance degradation

---

## Step 1 — Notify the Team

```
Post in Slack immediately:
"🔴 Rolling back vX.X.X — issue detected. ETA X minutes."
```

---

## Step 2 — Rollback Application Code

### Vercel
```bash
# In Vercel dashboard:
# Deployments → find the last working deployment → click "..." → Promote to Production

# Or via CLI:
vercel rollback
```

### Railway / Render
```bash
# Dashboard → Deployments → select previous deployment → Redeploy
```

### Docker / VPS
```bash
# Roll back to previous image tag
docker-compose down
docker-compose up -d --no-deps bizflow:previous-tag
```

### Git-based (if deploy = git push)
```bash
# Revert the merge commit
git revert -m 1 <merge_commit_hash>
git push origin main
```

- [ ] Previous version is live
- [ ] `/api/health` returns 200
- [ ] Login works

---

## Step 3 — Rollback Database Migration (If Needed)

**Only do this if the migration itself caused the issue.**

```bash
# Check what the last migration was
npx prisma migrate status

# Prisma does not support automatic down migrations.
# You must manually reverse the change.

# Option A: If migration only added a column (safe to remove)
psql $DATABASE_URL -c "ALTER TABLE table_name DROP COLUMN column_name;"

# Option B: If migration was destructive (dropped column, changed type)
# Restore from the pre-deploy backup taken in Step 2 of production-deploy.md
# See: runbooks/database-recovery.md
```

⚠️ Never run `prisma migrate reset` in production. It wipes the database.

- [ ] Database is in a consistent state
- [ ] `prisma migrate status` reflects reality

---

## Step 4 — Verify Rollback

```bash
curl https://yourdomain.com/api/health
# Must return: {"status":"ok","db":"connected"}
```

- [ ] Health check passes
- [ ] Core flows work (login, dashboard, invoice creation)
- [ ] Error rate in Sentry is back to baseline
- [ ] Notify team: "✅ Rollback complete. On vX.X.X (previous stable)"

---

## Step 5 — Incident Investigation

Do not redeploy until root cause is found.

```
Questions to answer:
1. What exactly failed? (error message, stack trace from Sentry)
2. Which commit introduced the regression?
3. Was it code, migration, or config?
4. Was it caught by tests? If not, why not?
5. What test should be added to prevent recurrence?
```

---

## Step 6 — Safe Redeploy

Once root cause is fixed and tested on staging:

- [ ] Fix applied and tested on staging
- [ ] New test added covering the regression
- [ ] Pre-deployment audit re-run
- [ ] Follow `runbooks/production-deploy.md` again

---

## Rollback Log

| Date | Version Rolled Back | Reason | Time to Rollback | Fix Version |
|---|---|---|---|---|
| | | | | |
