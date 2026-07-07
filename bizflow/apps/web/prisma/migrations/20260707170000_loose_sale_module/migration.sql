-- Migration: loose_sale_module
-- Adds the ProductPackaging model and loose sale fields to Product, SaleItem, StockMovement.
-- All changes are ADDITIVE ONLY. No existing columns are modified or dropped.
-- Existing products, inventory layers, sales, and all financial records remain untouched.

-- AlterTable: Add loose sale configuration to Product
ALTER TABLE "Product" ADD COLUMN     "allowLooseSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "baseStock" DECIMAL(65,30),
ADD COLUMN     "baseUnit" TEXT;

-- AlterTable: Add packaging metadata to SaleItem for loose sale reporting
ALTER TABLE "SaleItem" ADD COLUMN     "isLoose" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packagingId" TEXT,
ADD COLUMN     "packagingLabel" TEXT,
ADD COLUMN     "saleQty" DECIMAL(65,30),
ADD COLUMN     "saleUnit" TEXT;

-- AlterTable: Add base-unit tracking to StockMovement for audit trail
ALTER TABLE "StockMovement" ADD COLUMN     "baseQty" DECIMAL(65,30),
ADD COLUMN     "baseUnit" TEXT,
ADD COLUMN     "movementSubtype" TEXT;

-- CreateTable: ProductPackaging — multi-pack variant definitions per product
CREATE TABLE "ProductPackaging" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "conversionFactor" DECIMAL(65,30) NOT NULL,
    "defaultPrice" DECIMAL(65,30),
    "isPurchaseUnit" BOOLEAN NOT NULL DEFAULT false,
    "isLoose" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPackaging_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPackaging_productId_idx" ON "ProductPackaging"("productId");

-- CreateIndex
CREATE INDEX "ProductPackaging_productId_active_idx" ON "ProductPackaging"("productId", "active");

-- AddForeignKey: ProductPackaging → Product (cascade delete)
ALTER TABLE "ProductPackaging" ADD CONSTRAINT "ProductPackaging_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SaleItem → ProductPackaging (set null on delete)
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "ProductPackaging"("id") ON DELETE SET NULL ON UPDATE CASCADE;
