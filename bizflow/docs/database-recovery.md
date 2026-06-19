# Runbook: Database Recovery

> **Use when:** Data loss, corruption, accidental deletion, or failed migration.  
> **Owner:** Lead Engineer  
> **Last tested:** _____________  
> **RTO Target:** 2 hours  
> **RPO Target:** 24 hours (daily backups) or minutes (if PITR enabled)

---

## Before You Start

- [ ] Confirm the scope — is this full DB loss or a specific table/record?
- [ ] Notify the team — post in Slack: "Database recovery in progress, app is down"
- [ ] Put the app in maintenance mode before restoring to prevent writes during recovery
- [ ] Take a snapshot of the current (corrupted) state before overwriting anything

---

## Step 1 — Enable Maintenance Mode

```bash
# Note: Since there is no built-in MAINTENANCE_MODE, you must either:
# 1. Shut down the application instances entirely
# 2. Deploy a static maintenance branch or redirect rule in your hosting provider
# 3. Temporarily block the database port/IP from the web server
```

---

## Step 2 — Identify the Backup to Restore

### If using Supabase
```
Supabase Dashboard → Project → Settings → Backups
Select the backup point just before the incident
```

### If using Railway / Render
```
Railway Dashboard → Database → Backups
Download the .sql dump file
```

### If using manual pg_dump backups
```bash
# List available backups in your storage
ls -lh /backups/bizflow/
# or in S3
aws s3 ls s3://bizflow-backups/db/
```

---

## Step 3 — Restore the Database

### Option A: Full restore from pg_dump

```bash
# 1. Create a new empty database (do NOT overwrite production directly)
createdb bizflow_restored

# 2. Restore into it
pg_restore -d bizflow_restored -v backup_file.dump
# or for plain SQL
psql bizflow_restored < backup_file.sql

# 3. Verify row counts match expected
psql bizflow_restored -c 'SELECT COUNT(*) FROM "Sale";'
psql bizflow_restored -c 'SELECT COUNT(*) FROM "Customer";'
psql bizflow_restored -c 'SELECT COUNT(*) FROM "Product";'

# 4. Once verified, swap connection strings
# Update DATABASE_URL in production environment to point to bizflow_restored
```

### Option B: Point-in-Time Recovery (Supabase / RDS)

```
1. Go to your hosting dashboard
2. Select "Restore to point in time"
3. Enter the timestamp just before the incident (UTC)
4. Restore to a NEW database instance — not the current one
5. Verify data in the new instance
6. Update DATABASE_URL to point to the restored instance
7. Run: cd apps/web && npx prisma migrate status (confirm migrations are current)
```

---

## Step 4 — Verify the Restored Database

```sql
-- Run these against the restored DB before switching traffic

-- Check record counts are reasonable
SELECT COUNT(*) FROM "Business";
SELECT COUNT(*) FROM "Sale";
SELECT COUNT(*) FROM "Customer";
SELECT COUNT(*) FROM "Product";
SELECT COUNT(*) FROM "Employee";

-- Check financial integrity
SELECT COUNT(*) FROM "Sale" WHERE "paid" > "total";
-- Must be 0

SELECT COUNT(*) FROM "Product" WHERE "stock" < 0;
-- Must be 0

-- Check most recent records exist
SELECT id, "createdAt" FROM "Sale" ORDER BY "createdAt" DESC LIMIT 5;
-- Verify the newest records match your expected recovery point
```

---

## Step 5 — Run Migrations on Restored DB

```bash
# Note: Ensure you run these commands from the apps/web directory
cd apps/web
DATABASE_URL=<restored_db_url> npx prisma migrate status
# If any migrations are pending, apply them
DATABASE_URL=<restored_db_url> npx prisma migrate deploy
```

---

## Step 6 — Switch Traffic

```bash
# Update DATABASE_URL in production environment to the restored database
# Redeploy the application or restart the server

# Restore normal application instances and remove any maintenance redirects
```

---

## Step 7 — Post-Recovery Verification

- [ ] Login works
- [ ] Dashboard loads
- [ ] Create a test invoice — verify it saves
- [ ] Check audit logs are writing
- [ ] Verify the most recently lost data (inform affected users if data was lost)
- [ ] Post recovery complete message to team Slack

---

## Step 8 — Incident Documentation

Fill this out after every recovery:

```
Date/Time of incident:
Root cause:
Data lost (rows/tables):
Recovery point used:
Time to restore:
Users affected:
Prevention steps:
```

---

## Contacts

| Role | Name | Contact |
|---|---|---|
| Lead Engineer | | |
| Database Admin | | |
| Hosting Support | | |
