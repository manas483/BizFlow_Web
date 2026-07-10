⚠️ ONE-TIME RECOVERY TOOL

Purpose:
Historical repair of orphan SaleItem records created during the July 2026 incident.

Do NOT execute these scripts against production unless performing a controlled historical recovery.

These scripts are NOT part of the normal BizFlow application workflow.

# Historical Data Recovery Tools

This directory contains the one-time data recovery scripts (v5) used to automatically rebuild historical `SaleItem` records for 71 orphan invoices.

## Context
Orphan invoices are sales records where `Sale.total > 0` but no corresponding `SaleItem` records existed. This pipeline automatically reconstructed the exact items from the merged original PDF, mapped them to products in the database, performed mathematical reconciliations, and applied the updates directly and transactionally using Prisma, effectively avoiding any secondary side-effects (e.g. inventory ledger updates).

## Pipeline Phases
- **00-audit-schema.ts**: Audits the Prisma schema and existing database records to determine required/computed fields and safe timestamp propagation.
- **01-discover.ts**: Queries the database to identify orphan invoices (`total > 0` and `items.length === 0`).
- **02-extract.ts**: Uses `pdf-parse` to extract line item structure from the PDF and validates mathematics line-by-line.
- **03-04-build-manifest.ts**: Matches the extracted products with DB products, evaluates a confidence score, and compiles an immutable `repair_manifest.json` matrix.
- **04b-reconcile.ts**: The critical pre-flight verification script to ensure totals and uniqueness constraints correctly reconcile against database state before allowing execution.
- **05-apply-repair.ts**: Applies the repairs transactionally and idempotently to the database using `$transaction` and `createMany`.

## Usage & Execution Records
The pipeline has successfully run in production. All 71 orphan invoices were successfully repaired, and 112 `SaleItem` records were inserted.

Execution artifacts and logs are stored externally to avoid committing sensitive financial payloads.
