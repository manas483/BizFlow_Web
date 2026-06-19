# Runbook: Production Deployment

> **Use for:** Every production release.  
> **Owner:** Deploying engineer  
> **Time required:** 20–45 minutes including verification

---

## Pre-Deploy Checklist (Do Not Skip)

- [ ] All items in `docs/pre-deployment-audit.md` are green
- [ ] PR has been reviewed and merged to `main`
- [ ] Staging environment tested with this build
- [ ] Database migration status checked — no unexpected pending migrations
- [ ] Team notified in Slack: "Deploying vX.X.X to production at HH:MM IST"

---

## Step 1 — Final Branch Check

```bash
git checkout main
git pull origin main
git log --oneline -5     # confirm the right commits are present
```

---

## Step 2 — Database Backup Before Migration

```bash
# Take a manual backup before running any migration
# Supabase: Dashboard → Settings → Backups → Create backup
# Railway:  Dashboard → Database → Backup now
# Manual:
pg_dump $DATABASE_URL -Fc -f "backup_pre_deploy_$(date +%Y%m%d_%H%M%S).dump"
```

- [ ] Backup confirmed successful with timestamp noted: _____________

---

## Step 3 — Run Database Migrations

```bash
cd apps/web

# Verify what will run
npx prisma migrate status

# Apply migrations
npx prisma migrate deploy

# Confirm
npx prisma migrate status
# Should show: "All migrations have been applied"
```

- [ ] Migrations applied without error
- [ ] `prisma migrate status` shows clean

---

## Step 4 — Deploy Application

### Vercel
```bash
# Automatic on push to main, or manual:
vercel --prod
```

### Railway / Render
```bash
# Push triggers auto-deploy, or use dashboard "Deploy" button
git push origin main
```

### Docker / VPS
```bash
docker build -t bizflow:latest .
docker push registry/bizflow:latest
# On server:
docker pull registry/bizflow:latest
docker-compose up -d --no-deps --build web
```

- [ ] Deploy triggered
- [ ] Build completed without errors
- [ ] New version is live (check version endpoint or deployment timestamp)

---

## Step 5 — Post-Deploy Smoke Tests

Run within 10 minutes of deploy:

```bash
# Health check
curl https://yourdomain.com/api/health
# Expected: {"status":"ok","db":"connected"}

# Auth works
curl -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@yourdomain.com","password":"testpass"}'
# Expected: 200 with session token

# Dashboard loads
curl -I https://yourdomain.com/dashboard
# Expected: 200 or 302 (redirect to login)
```

- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Login works
- [ ] Dashboard loads without JS errors (open browser console)
- [ ] Create one test invoice end-to-end
- [ ] Check Sentry — no new error spike in first 5 minutes

---

## Step 6 — Monitor for 15 Minutes

After every deploy, actively watch for 15 minutes:

- [ ] Sentry error rate is normal (not spiking)
- [ ] Response times are normal (check uptime monitor or host metrics)
- [ ] No user reports of issues in support channels
- [ ] Database CPU is normal

---

## If Something Goes Wrong → Rollback

See `runbooks/rollback.md`

---

## Post-Deploy

- [ ] Post in Slack: "vX.X.X deployed successfully ✅"
- [ ] Update `CHANGELOG.md` if not already done
- [ ] Close the release milestone in GitHub

---

## Deployment Log

| Date | Version | Deployer | Duration | Issues |
|---|---|---|---|---|
| | | | | |
