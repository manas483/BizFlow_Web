export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth, AuthError } from "@/shared/lib/api-guard";
import { prisma } from "@/shared/lib/db";
import {
  getImportTemplate,
  validateImportData,
  mapColumns,
} from "@/shared/lib/inventory-import";
import { recalculateTransportCosts } from "@/shared/lib/expense-calculations";
import { findProductIntelligence } from "@/shared/lib/business-intelligence";
import { createLayerSafe } from "@/shared/lib/layer-engine";

import { parseInvoicePdfLocally } from "@/shared/lib/pdf-parser";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;
    const contentType = req.headers.get("content-type") || "";

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { businessType: true },
    });
    const businessType = business?.businessType ?? "Other";

    /* ── 1. JSON body → Confirmed Import (from invoice review or Excel review) ── */
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const { products: verifiedProducts, totalTransportCost: invoiceTransportCost } = body;

      if (!Array.isArray(verifiedProducts) || verifiedProducts.length === 0) {
        return NextResponse.json({ error: "No products provided for import." }, { status: 400 });
      }

      // ── Distribute invoice-level transport cost by value ──
      // If the invoice has a total transport cost and individual products don't
      // have their own transport costs, distribute proportionally by base value.
      const totalTransport = Number(invoiceTransportCost ?? 0);
      if (totalTransport > 0) {
        const totalBaseValue = verifiedProducts.reduce(
          (sum: number, p: any) => sum + (Number(p.basePurchasePrice ?? p.purchasePrice ?? 0) * Number(p.stock ?? 0)),
          0
        );
        if (totalBaseValue > 0) {
          verifiedProducts.forEach((p: any) => {
            const qty = Number(p.stock ?? 0);
            if (qty > 0) {
              const baseValue = Number(p.basePurchasePrice ?? p.purchasePrice ?? 0) * qty;
              const share = baseValue / totalBaseValue;
              p.transportCost = Number((Number(p.transportCost ?? 0) + ((totalTransport * share) / qty)).toFixed(4));
              p.purchasePrice = Number(p.basePurchasePrice ?? p.purchasePrice ?? 0) + p.transportCost;
            }
          });
        }
      }

      const results = { created: 0, updated: 0, failed: 0 };

      const existingProducts = await prisma.product.findMany({
        where: { businessId },
        select: { id: true, sku: true, name: true },
      });
      const existingSkuMap = new Map(existingProducts.map((p) => [p.sku?.toLowerCase() ?? "", p.id]));
      const existingNameMap = new Map(existingProducts.map((p) => [p.name.toLowerCase(), p.id]));

      for (const p of verifiedProducts) {
        try {
          const sku = p.sku ? String(p.sku) : "";
          const name = String(p.name ?? "");

          // Lookup business intelligence default settings
          const intel = findProductIntelligence(businessType, name, sku);

          const productData = {
            name,
            sku,
            category: String(p.category || intel?.category || "Other"),
            stock: Number(p.stock ?? 0),
            minStock: Number(p.minStock ?? intel?.minStock ?? 5),
            unitsPerBag: Number(p.unitsPerBag || intel?.unitsPerBag || 1),
            basePurchasePrice: Number(p.basePurchasePrice ?? 0),
            transportCost: Number(p.transportCost ?? 0),
            purchasePrice: Number(p.purchasePrice ?? 0),
            sellingPrice: Number(p.sellingPrice ?? 0),
            unit: String(p.unit || intel?.unit || "pcs"),
            supplier: p.supplier ? String(p.supplier) : null,
            purchaseFrom: p.supplier ? String(p.supplier) : null,
            purchaseDate: p.purchaseDate ? new Date(p.purchaseDate) : null,
            purchaseInvoiceNo: p.purchaseInvoiceNo ? String(p.purchaseInvoiceNo) : null,
            hsnCode: p.hsnCode || intel?.hsnCode || null,
            gstRate: Number(p.gstRate ?? intel?.gstRate ?? 0),
          };

          // Match by SKU first, then by name
          const existingId = (sku ? existingSkuMap.get(sku.toLowerCase()) : null)
            ?? existingNameMap.get(productData.name.toLowerCase())
            ?? null;

          if (existingId) {
            const existingProduct = await prisma.product.findUnique({ where: { id: existingId } });
            
            const incomingQuantity = productData.stock;
            let newTotalStock = existingProduct?.stock || 0;
            let shouldAddStock = true;
            
            // Check if we already added stock for this exact invoice
            if (productData.purchaseInvoiceNo) {
              const duplicateMovement = await prisma.stockMovement.findFirst({
                where: {
                  productId: existingId,
                  referenceId: productData.purchaseInvoiceNo,
                  businessId,
                }
              });
              if (duplicateMovement) {
                shouldAddStock = false;
              }
            }
            
            if (shouldAddStock) {
              newTotalStock += incomingQuantity;
            }

            const updateData: any = {
              ...productData,
              stock: newTotalStock,
              basePurchasePrice: productData.basePurchasePrice > 0 ? productData.basePurchasePrice : existingProduct?.basePurchasePrice,
              transportCost: productData.transportCost > 0 ? productData.transportCost : existingProduct?.transportCost,
              purchasePrice: productData.purchasePrice > 0 ? productData.purchasePrice : existingProduct?.purchasePrice,
              sellingPrice: productData.sellingPrice > 0 ? productData.sellingPrice : existingProduct?.sellingPrice,
            };
            
            await prisma.product.update({ 
              where: { id: existingId }, 
              data: updateData 
            });
            
            if (shouldAddStock && incomingQuantity > 0) {
              await prisma.stockMovement.create({
                data: {
                  productId: existingId,
                  type: 'IN',
                  quantity: incomingQuantity,
                  notes: productData.purchaseFrom || productData.supplier || 'Restock from import',
                  referenceId: productData.purchaseInvoiceNo || null,
                  createdAt: productData.purchaseDate || undefined,
                  businessId,
                }
              });

              // Create Inventory Layer for LIFO/FIFO Costing
              await createLayerSafe({
                itemId: existingId,
                quantity: incomingQuantity,
                purchaseCost: productData.basePurchasePrice * incomingQuantity,
                expenses: productData.transportCost > 0 ? [{ expenseType: 'transport', amount: productData.transportCost * incomingQuantity }] : [],
                receiptNo: productData.purchaseInvoiceNo || undefined,
                purchaseInvoiceId: productData.purchaseInvoiceNo || undefined,
                receiptDate: productData.purchaseDate || new Date(),
                supplierId: productData.purchaseFrom || productData.supplier || undefined,
                sourceTransactionType: 'purchase',
                businessId,
              });
            }
            results.updated++;
          } else {
            const newProduct = await prisma.product.create({ data: { ...productData, businessId } });
            if (newProduct.stock > 0) {
              await prisma.stockMovement.create({
                data: {
                  productId: newProduct.id,
                  type: 'IN',
                  quantity: newProduct.stock,
                  notes: newProduct.purchaseFrom || newProduct.supplier || 'Initial stock from import',
                  referenceId: newProduct.purchaseInvoiceNo || null,
                  createdAt: newProduct.purchaseDate || undefined,
                  businessId,
                }
              });

              // Create Inventory Layer for LIFO/FIFO Costing
              await createLayerSafe({
                itemId: newProduct.id,
                quantity: newProduct.stock,
                purchaseCost: productData.basePurchasePrice * newProduct.stock,
                expenses: productData.transportCost > 0 ? [{ expenseType: 'transport', amount: productData.transportCost * newProduct.stock }] : [],
                receiptNo: productData.purchaseInvoiceNo || undefined,
                purchaseInvoiceId: productData.purchaseInvoiceNo || undefined,
                receiptDate: productData.purchaseDate || new Date(),
                supplierId: productData.purchaseFrom || productData.supplier || undefined,
                sourceTransactionType: 'purchase',
                businessId,
              });
            }
            results.created++;
          }
        } catch (err) {
          results.failed++;
          console.error("Failed to import product:", err);
        }
      }

      // Recalculate transport costs after import
      await recalculateTransportCosts(businessId).catch(() => {});

      return NextResponse.json({
        success: true,
        results,
        summary: { total: verifiedProducts.length, created: results.created, updated: results.updated, skipped: 0, failed: results.failed },
      });
    }

    /* ── 2. FormData → File upload (PDF invoice or Excel/CSV) ── */
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) ?? "validate";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    /* ── 2a. PDF Invoice Parsing (ML-Trained Template Extraction) ── */
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // ML-trained parser — uses templates learned from sample PDFs
        const detectedInvoice = await parseInvoicePdfLocally(buffer, businessId);


        if (detectedInvoice.error || !detectedInvoice.products || !Array.isArray(detectedInvoice.products)) {
          return NextResponse.json({
            error: detectedInvoice.error || "Could not recognise this invoice PDF or failed to extract products.",
          }, { status: 400 });
        }

        // Check mathematical validation
        if (detectedInvoice.validationPassed === false) {
          console.warn("PDF validation warning:", detectedInvoice.validationDetails);
        }

        const parseNum = (val: any) => {
          if (typeof val === 'number') return val;
          if (!val && val !== 0) return 0;
          const cleaned = String(val).replace(/[^0-9.-]/g, '');
          return Number(cleaned) || 0;
        };

        const { computeStringSimilarity, cleanProductName, generateFallbackSku } = await import("@/shared/lib/product-matcher");

        const existingProducts = await prisma.product.findMany({
          where: { businessId },
          select: { name: true, sku: true, category: true, hsnCode: true, unit: true, unitsPerBag: true, gstRate: true }
        });

        const processedRows = detectedInvoice.products.map((p: any, idx: number) => {
          let matchedDbProduct = null;
          let bestScore = 0.55; // similarity threshold
          
          for (const dbP of existingProducts) {
            if (p.sku && dbP.sku && p.sku.toLowerCase() === dbP.sku.toLowerCase()) {
              matchedDbProduct = dbP;
              break;
            }
            const score = computeStringSimilarity(p.name, dbP.name);
            if (score > bestScore) {
              bestScore = score;
              matchedDbProduct = dbP;
            }
          }

          // Find intelligence properties
          const intel = findProductIntelligence(businessType, p.name, p.sku);
          
          let finalName = p.name;
          let finalSku = matchedDbProduct?.sku || p.sku || "";
          
          if (matchedDbProduct) {
            finalName = matchedDbProduct.name;
          } else {
            finalName = cleanProductName(p.name);
            if (!finalSku) {
              finalSku = generateFallbackSku(finalName);
            }
          }

          return {
            rowIndex: idx + 1,
            action: "create" as const,
            errors: [] as { row: number; column: string; message: string; severity: "error" }[],
            warnings: [] as { row: number; column: string; message: string; severity: "warning" }[],
            data: {
              name: finalName || `Extracted Item ${idx + 1}`,
              sku: finalSku,
              category: matchedDbProduct?.category || p.category || intel?.category || "Other",
              stock: parseNum(p.quantity ?? p.stock),
              unitsPerBag: matchedDbProduct?.unitsPerBag || parseNum(p.unitsPerBag) || intel?.unitsPerBag || 1,
              basePurchasePrice: parseNum(p.basePurchasePrice) || parseNum(p.purchasePrice),
              transportCost: parseNum(p.transportCost),
              purchasePrice: (parseNum(p.basePurchasePrice) || parseNum(p.purchasePrice)) + parseNum(p.transportCost),
              sellingPrice: parseNum(p.sellingPrice),
              unit: matchedDbProduct?.unit || p.unit || intel?.unit || "pcs",
              supplier: detectedInvoice.supplier || "Unknown Supplier",
              purchaseInvoiceNo: detectedInvoice.invoiceNumber || "UNKNOWN",
              purchaseDate: detectedInvoice.purchaseDate || new Date().toISOString(),
              gstRate: matchedDbProduct?.gstRate || parseNum(p.gstRate) || intel?.gstRate || 0,
              hsnCode: String(p.hsnCode || intel?.hsnCode || ""),
            },
          };
        });

        return NextResponse.json({
          mode: "validate",
          isInvoicePdf: true,
          invoiceInfo: {
            invoiceNumber: detectedInvoice.invoiceNumber || "Unknown",
            supplier: detectedInvoice.supplier || "Unknown Supplier",
            supplierGstin: detectedInvoice.supplierGstin || "",
            purchaseDate: detectedInvoice.purchaseDate || new Date().toISOString(),
            eWayBillNo: detectedInvoice.eWayBillNo || "",
            format: detectedInvoice.format || "unknown",
            templateName: detectedInvoice.templateName || "",
            grandTotal: detectedInvoice.grandTotal || 0,
            validationPassed: detectedInvoice.validationPassed ?? true,
            validationDetails: detectedInvoice.validationDetails || "",
          },
          validation: {
            valid: true,
            summary: { total: processedRows.length, valid: processedRows.length, errors: 0, warnings: 0, duplicates: 0 },
            processedRows,
            errors: [],
            warnings: [],
          },
        });
      } catch (err: any) {
        console.error("PDF Parsing Error:", err);
        return NextResponse.json({
          error: "Failed: " + err.message,
          details: err.message
        }, { status: 400 });
      }
    }



    /* ── 2b. Excel / CSV Parsing ── */
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload .xlsx, .xls, .csv, or a PDF invoice." },
        { status: 400 },
      );
    }

    const template = getImportTemplate(businessType);

    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "buffer", cellText: true, cellDates: true });
    const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("import")) ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    if (!ws) {
      return NextResponse.json({ error: "No valid sheet found in the uploaded file." }, { status: 400 });
    }

    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
    if (rawRows.length === 0) {
      return NextResponse.json({ error: "The uploaded file appears to be empty." }, { status: 400 });
    }

    const uploadedHeaders = Object.keys(rawRows[0] ?? {});
    const columnMapping = mapColumns(uploadedHeaders, template.columns);

    const normalizedRows = rawRows.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const [templateHeader, uploadedHeader] of Object.entries(columnMapping)) {
        if (uploadedHeader) {
          const colDef = template.columns.find((c) => c.header.toLowerCase() === templateHeader);
          if (colDef) mapped[colDef.header] = row[uploadedHeader] ?? "";
        }
      }
      for (const [key, val] of Object.entries(row)) {
        if (!Object.values(columnMapping).includes(key)) mapped[key] = val;
      }
      return mapped;
    });

    const existingProducts = await prisma.product.findMany({ where: { businessId }, select: { id: true, sku: true } });
    const existingSkus = existingProducts.map((p) => p.sku).filter((s): s is string => !!s);

    const validationResult = validateImportData(normalizedRows, template, existingSkus, []);

    const unmappedHeaders = uploadedHeaders.filter((h) => !Object.values(columnMapping).includes(h));
    const mappingSuggestions: Record<string, string> = {};
    for (const uh of unmappedHeaders) {
      for (const col of template.columns) {
        const allNames = [col.header.toLowerCase(), col.key.toLowerCase(), ...(col.aliases ?? [])];
        if (allNames.some((n) => n.includes(uh.toLowerCase()) || uh.toLowerCase().includes(n.split(" ")[0]))) {
          mappingSuggestions[uh] = col.header;
          break;
        }
      }
    }

    if (mode === "validate") {
      return NextResponse.json({
        mode: "validate",
        columnMapping,
        unmappedHeaders,
        mappingSuggestions,
        validation: validationResult,
        uploadedHeaders,
        templateHeaders: template.columns.map((c) => c.header),
      });
    }

    /* ── Excel import mode ── */
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: "File contains validation errors. Please fix them before importing.", validation: validationResult },
        { status: 422 },
      );
    }

    const results = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] as { row: number; message: string }[] };
    const existingSkuMap = new Map(existingProducts.map((p) => [p.sku?.toLowerCase() ?? "", p.id]));

    for (const processedRow of validationResult.processedRows) {
      if (processedRow.errors.length > 0) { results.skipped++; continue; }
      try {
        const d = processedRow.data as Record<string, unknown>;
        const sku = d.sku ? String(d.sku) : "";
        const name = String(d.name ?? "");

        // Find intelligence properties
        const intel = findProductIntelligence(businessType, name, sku);

        const productData = {
          name,
          sku,
          category: String(d.category || intel?.category || "Other"),
          stock: Number(d.stock ?? 0),
          minStock: Number(d.minStock ?? intel?.minStock ?? 5),
          unitsPerBag: Number(d.unitsPerBag || intel?.unitsPerBag || 1),
          basePurchasePrice: Number(d.basePurchasePrice ?? d.purchasePrice ?? intel?.purchasePrice ?? 0),
          transportCost: Number(d.transportCost ?? 0),
          purchasePrice: Number(d.purchasePrice ?? intel?.purchasePrice ?? 0),
          sellingPrice: Number(d.sellingPrice ?? 0),
          unit: String(d.unit || intel?.unit || "pcs"),
          supplier: d.supplier ? String(d.supplier) : null,
          purchaseFrom: d.supplier ? String(d.supplier) : null,
          purchaseInvoiceNo: d.purchaseInvoiceNo ? String(d.purchaseInvoiceNo) : null,
          hsnCode: d.hsnCode ? String(d.hsnCode) : (intel?.hsnCode ?? null),
          gstRate: Number(d.gstRate ?? intel?.gstRate ?? 0),
        };

        if (processedRow.action === "update" && sku) {
          const existingId = existingSkuMap.get(sku.toLowerCase());
          if (existingId) { 
            const existingProduct = await prisma.product.findUnique({ where: { id: existingId } });
            const stockDiff = productData.stock - (existingProduct?.stock || 0);
            
            const updateData: any = {
              ...productData,
              basePurchasePrice: productData.basePurchasePrice > 0 ? productData.basePurchasePrice : existingProduct?.basePurchasePrice,
              transportCost: productData.transportCost > 0 ? productData.transportCost : existingProduct?.transportCost,
              purchasePrice: productData.purchasePrice > 0 ? productData.purchasePrice : existingProduct?.purchasePrice,
              sellingPrice: productData.sellingPrice > 0 ? productData.sellingPrice : existingProduct?.sellingPrice,
            };

            await prisma.product.update({ where: { id: existingId }, data: updateData });
            
            if (stockDiff > 0) {
              await prisma.stockMovement.create({
                data: {
                  productId: existingId,
                  type: 'IN',
                  quantity: stockDiff,
                  notes: productData.supplier || 'Restock from import',
                  referenceId: productData.purchaseInvoiceNo || null,
                  createdAt: undefined,
                  businessId,
                }
              });

              await createLayerSafe({
                itemId: existingId,
                quantity: stockDiff,
                purchaseCost: productData.basePurchasePrice * stockDiff,
                expenses: productData.transportCost > 0 ? [{ expenseType: 'transport', amount: productData.transportCost * stockDiff }] : [],
                receiptNo: productData.purchaseInvoiceNo || undefined,
                purchaseInvoiceId: productData.purchaseInvoiceNo || undefined,
                receiptDate: new Date(),
                supplierId: productData.purchaseFrom || undefined,
                sourceTransactionType: 'purchase',
                businessId,
              });
            }
            results.updated++; 
          }
          else { 
            const newProduct = await prisma.product.create({ data: { ...productData, businessId } }); 
            if (newProduct.stock > 0) {
              await prisma.stockMovement.create({
                data: {
                  productId: newProduct.id,
                  type: 'IN',
                  quantity: newProduct.stock,
                  notes: newProduct.purchaseFrom || newProduct.supplier || 'Initial stock from import',
                  referenceId: newProduct.purchaseInvoiceNo || null,
                  createdAt: undefined,
                  businessId,
                }
              });

              await createLayerSafe({
                itemId: newProduct.id,
                quantity: newProduct.stock,
                purchaseCost: productData.basePurchasePrice * newProduct.stock,
                expenses: productData.transportCost > 0 ? [{ expenseType: 'transport', amount: productData.transportCost * newProduct.stock }] : [],
                receiptNo: productData.purchaseInvoiceNo || undefined,
                purchaseInvoiceId: productData.purchaseInvoiceNo || undefined,
                receiptDate: new Date(),
                supplierId: productData.purchaseFrom || undefined,
                sourceTransactionType: 'purchase',
                businessId,
              });
            }
            results.created++; 
          }
        } else {
          const newProduct = await prisma.product.create({ data: { ...productData, businessId } });
          if (newProduct.stock > 0) {
            await prisma.stockMovement.create({
              data: {
                productId: newProduct.id,
                type: 'IN',
                quantity: newProduct.stock,
                notes: newProduct.purchaseFrom || newProduct.supplier || 'Initial stock from import',
                referenceId: newProduct.purchaseInvoiceNo || null,
                createdAt: undefined,
                businessId,
              }
            });

            await createLayerSafe({
              itemId: newProduct.id,
              quantity: newProduct.stock,
              purchaseCost: productData.basePurchasePrice * newProduct.stock,
              expenses: productData.transportCost > 0 ? [{ expenseType: 'transport', amount: productData.transportCost * newProduct.stock }] : [],
              receiptNo: productData.purchaseInvoiceNo || undefined,
              purchaseInvoiceId: productData.purchaseInvoiceNo || undefined,
              receiptDate: new Date(),
              supplierId: productData.purchaseFrom || undefined,
              sourceTransactionType: 'purchase',
              businessId,
            });
          }
          results.created++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ row: processedRow.rowIndex, message: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    await (prisma as any).userActivity.create({
      data: {
        businessId, userId: session.user.id ?? "unknown", eventType: "inventory_bulk_import",
        metadata: { filename: file.name, totalRows: validationResult.summary.total, created: results.created, updated: results.updated, failed: results.failed },
      },
    }).catch(() => {});

    return NextResponse.json({
      mode: "import", success: true, results,
      summary: { total: validationResult.summary.total, created: results.created, updated: results.updated, skipped: results.skipped, failed: results.failed },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error("Inventory import error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

