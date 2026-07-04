# Disaster Recovery Runbook

This document describes the procedures for recovering the BizFlow ERP database in the event of catastrophic data loss, corruption, or a failed migration.

## Objective
- **RPO (Recovery Point Objective):** < 24 hours for daily backups, < 5 minutes for pre-migration snapshots.
- **RTO (Recovery Time Objective):** < 15 minutes to restore a Neon branch.

## 1. Neon Branch Restoration (Fastest)
Neon's branching feature allows us to instantly restore to a point-in-time snapshot. This is the primary recovery method.

### How to Restore
1. Log in to the [Neon Console](https://console.neon.tech).
2. Select the BizFlow project.
3. Go to **Branches**.
4. Locate the `pre-migration-YYYYMMDD-HHMMSS` branch (or any previous branch).
5. If the main branch is corrupted, you can:
   - **Option A:** Promote the snapshot branch to be the new primary branch (if Neon supports this in the UI).
   - **Option B:** Copy the connection string of the snapshot branch and update the `DATABASE_URL` in Vercel.
6. Verify the application is functioning correctly.

## 2. SQL Rollback (For bad migrations)
If a recent migration introduced an issue but no data was lost, you can run the rollback SQL.

### How to Rollback
```bash
npm run rollback <migration_folder_name>
```
*Note: This executes the raw SQL in `prisma/rollbacks/<migration_name>/rollback.sql`. It does not modify the `_prisma_migrations` table automatically.*

## 3. Post-Recovery Verification
After restoring, run the snapshot verification script to ensure counts match expectations:
```bash
npm run verify-snapshot backups/<snapshot_file>.json
```

## Emergency Contacts
- **DevOps/Infrastructure:** [Name / Phone]
- **Platform Engineering:** [Name / Phone]
