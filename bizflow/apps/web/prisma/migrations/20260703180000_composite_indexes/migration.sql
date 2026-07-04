-- DropIndex
DROP INDEX "Customer_businessId_createdAt_idx";

-- DropIndex
DROP INDEX "Sale_businessId_createdAt_idx";

-- DropIndex
DROP INDEX "Expense_businessId_date_idx";

-- CreateIndex
CREATE INDEX "Customer_businessId_createdAt_idx" ON "Customer"("businessId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Sale_businessId_createdAt_idx" ON "Sale"("businessId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Expense_businessId_date_idx" ON "Expense"("businessId", "date" DESC);
