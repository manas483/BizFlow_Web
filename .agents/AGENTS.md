# Project Rules

> **BizFlow exists to provide businesses with reliable, trustworthy operational data. Every engineering decision should reinforce that trust.**

## Authentication Safety Policy (Mandatory)

**CRITICAL RULE: The authentication system is completely frozen.**

Never modify, refactor, optimize, replace, upgrade, or touch any part of the authentication system unless explicitly requested by the user.

This includes:
* Authentication configuration (NextAuth/Auth.js)
* Login flow and session handling
* JWT callbacks, cookies, and middleware
* Authentication providers and password verification
* User lookup and Prisma authentication models
* Environment variables related to authentication
* Authorization logic and RBAC implementation
* Route protection and API authentication wrappers

**Before Every Code Change:**
Perform an impact analysis to ensure the planned changes cannot affect authentication, login, sessions, cookies, middleware, authorization, user identity, or role permissions. If there is even a small possibility of impact, stop and redesign the implementation to isolate the change.

**Required Verification:**
Before completing any implementation, verify that:
* Existing users can successfully sign in and sessions are created/persist correctly.
* Logout works and protected routes remain accessible after login.
* Role-based permissions continue working.
* No authentication-related files were modified unless explicitly requested.

**Protect authentication above everything else.** Never allow the project to encounter the "Sign-in failed. Please check your credentials and try again." error due to unrelated development work.

## Data Protection (Highest Priority)

**ABSOLUTE RULE (NON-NEGOTIABLE): NEVER EVER perform any action that can delete, reset, overwrite, truncate, recreate, migrate, seed, or modify existing production/business data unless explicitly asked.**

This includes but is not limited to:
* Inventory, Sales, Purchase, Customers, Employees, Suppliers, Payments, Expenses, Quotations, Invoices, Ledger, Accounts, Transactions, Reports, Settings, Users, Roles & Permissions, Business Configuration, and any other business records.

### STRICTLY FORBIDDEN
Never automatically:
* Delete database records
* Run destructive Prisma migrations (e.g., `prisma db push`, `prisma migrate reset`, `prisma db reset`)
* Drop, truncate, or recreate tables
* Modify production schema without approval
* Delete seed data or clear caches if it may remove persistent business data
* Replace or overwrite historical records
* Remove foreign keys or constraints without review
* Perform cascading deletes or run cleanup scripts
* Generate code that may erase data
* Suggest "resetting the database" as a solution

### REQUIRED BEFORE ANY DATABASE CHANGE
Before changing anything related to Prisma Schema, Database, Inventory, Sales, Purchase, Customer Module, Employee Module, Authentication, Business Logic, or Data Models, you MUST verify:
1. Will this change modify existing data?
2. Can any record be deleted or historical data be lost?
3. Can relationships break or migrations become destructive?
4. Can production data become inconsistent?

If the answer to ANY of these is YES or POSSIBLY, STOP immediately. Do NOT proceed.
Instead: Explain the risk, ask for explicit approval, provide a safe alternative, and recommend a backup/testing on a copy.

### SAFE DEVELOPMENT POLICY
Every implementation must follow these principles:
* Data Preservation First, Backward Compatibility, Zero Data Loss
* Non-Destructive Migrations, Idempotent Operations
* Preserve Existing APIs, Features, Business Logic, Permissions, Historical Records, and Inventory Costing History

New features should only extend the system—not replace or destroy existing functionality.

### MANDATORY VERIFICATION
Before completing any task involving the database, confirm:
✅ Existing data remains untouched and accessible.
✅ Historical transactions, inventory quantities, and sales history remain correct/intact.
✅ Customers, employees, purchases, and suppliers remain unchanged.
✅ No accidental deletes occurred, and no hidden migration can remove data.

### IF THERE IS ANY RISK
If there is even a 1% possibility of data loss: STOP. Do not continue. Explain exactly why it is risky and wait for approval before making any destructive or irreversible change.

This is a permanent rule for this ERP project. Treat all business data as production data, even during development. Every future implementation, refactoring, optimization, migration, bug fix, or feature addition must prioritize **100% data safety** over speed or convenience. Under no circumstances should an implementation cause accidental deletion or corruption of any business data.

## Inventory Costing Protection Rule (Highest Priority)

**ABSOLUTE RULE (NON-NEGOTIABLE): The Inventory Costing Engine is complete, verified, and production-critical.**

**NEVER EVER modify, replace, simplify, refactor, optimize, or rewrite the inventory costing logic without explicit approval.**

This includes every component related to inventory valuation and stock consumption.

### PROTECTED COMPONENTS
The following are permanently protected:
* FIFO (First In, First Out) costing
* LIFO (Last In, First Out) costing
* Weighted Average Cost (WAC) calculations
* Inventory Layer architecture
* Layer creation logic
* Layer consumption logic
* Layer depletion logic
* Remaining quantity calculations
* Cost of Goods Sold (COGS) calculations
* Purchase cost calculations
* Landed cost calculations
* Expense allocation logic
* Inventory rebuild logic
* Inventory integrity validation
* Sales stock deduction engine
* Purchase return logic
* Sales return logic
* Historical inventory records
* Inventory movement history
* Batch and layer relationships
* Inventory health validation
* Any database schema or API used by the inventory costing engine

### STRICTLY FORBIDDEN
Never:
* Change FIFO behavior
* Change LIFO behavior
* Change WAC calculations
* Change layer selection order
* Merge inventory layers
* Delete inventory layers
* Recalculate historical costs
* Modify historical COGS
* Rewrite inventory algorithms
* Replace layer-based costing with product-level costing
* Reset inventory quantities
* Rebuild inventory automatically
* Change stock deduction order
* Modify expense allocation formulas
* Alter inventory history
* Optimize or refactor the costing engine simply for cleaner code or performance

### BEFORE MAKING ANY INVENTORY CHANGE
Before changing any inventory-related code, verify:
1. Will FIFO still behave exactly the same?
2. Will LIFO still behave exactly the same?
3. Will WAC still produce identical results?
4. Will historical inventory records remain unchanged?
5. Will historical COGS remain unchanged?
6. Will inventory layers remain intact?
7. Will previous sales continue using their original costing?
8. Will financial reports remain unchanged?

If the answer to ANY of these questions is NO or UNCERTAIN, STOP immediately. Do not continue. Explain the risk and wait for explicit approval.

### SAFE IMPLEMENTATION POLICY
When implementing new features:
* Build around the existing inventory engine.
* Extend functionality without changing costing behavior.
* Preserve all existing inventory calculations.
* Maintain backward compatibility.
* Keep all historical inventory and financial data intact.

New features must never alter how FIFO, LIFO, WAC, Inventory Layers, or COGS currently work.

### PERMANENT PROJECT RULE
The inventory costing engine is considered **frozen and production-approved**. Unless explicitly instructed otherwise, treat FIFO, LIFO, WAC, Inventory Layers, and all related costing logic as read-only. No future feature, optimization, bug fix, refactor, migration, or performance improvement may change or bypass this logic. If any requested implementation could affect the inventory costing engine in any way, stop, explain the impact, and obtain explicit approval before making any changes.

## Backup & Restore Subsystem Freeze Policy (Tier-0)

**ABSOLUTE RULE: The Backup & Restore subsystem is completely frozen and classified as a Tier-0 Protected Subsystem.**

Never modify, redesign, refactor, optimize, replace, or touch the core architecture of the Backup subsystem unless explicitly requested by the user.

This includes:
* `BackupRecord` Prisma models
* Encryption engine and keys
* Manifest generation topology
* Transactional Restore engine
* Restore validations (`validateBackupPreRestore`, `validateRestoreIntegrity`)

### Allowed Changes:
* Bug fixes
* Additional storage providers
* Performance optimizations that do NOT change the transactional behavior
* Adding additional logging or observability

### Forbidden Changes:
* Removing the topological dependency resolution during restore
* Removing the pre-restore or post-restore integrity validations
* Skipping transaction boundaries during restore
* Weakening RBAC on the API endpoints

## BizFlow Engineering Principles

### 1. Data Integrity First
No feature is worth risking business data. Protect inventory, accounting, customers, suppliers, and financial records above all else.

### 2. Preserve the Core
Core business engines (inventory costing, accounting, authentication, backups) should be **extended**, not rewritten, unless there is a compelling architectural reason.

### 3. Backwards Compatibility
Schema and API changes should avoid breaking existing production workflows whenever practical. Prefer additive, reversible changes.

### 4. Every Critical Change Must Be Recoverable
Before shipping a high-impact change:
* verified backup,
* rollback plan,
* deployment checklist,
* post-deployment verification.

### 5. Test Before Trust
Critical business logic should be covered by:
* unit tests,
* integration tests,
* concurrency tests where applicable,
* manual business workflow validation.

### 6. Observability is Part of the Feature
If a feature cannot be monitored or diagnosed, it is not complete.

### 7. Performance is Measured
Optimize only after measuring. Keep benchmarks and monitor regressions.

### 8. Security by Default
Protect authentication, authorization, secrets, and sensitive business data in every change.

### 9. Simplicity Over Cleverness
Prefer straightforward, maintainable designs over complex solutions that are difficult to reason about.

### 10. Earn User Trust Every Day
Every deployment should increase confidence in the system—not merely add functionality.

---

> **Good engineering is measured not by how quickly features are delivered, but by how confidently businesses can depend on the software every day.**
