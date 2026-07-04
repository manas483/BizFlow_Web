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

function mapExpenseType(cat: string): string {
  const c = cat.toLowerCase().trim();
  if (c === 'transport' || c === 'freight') return 'transport';
  if (c === 'loading') return 'loading';
  if (c === 'unloading') return 'unloading';
  if (c === 'insurance') return 'insurance';
  if (c === 'customs') return 'customs';
  if (c === 'freight') return 'freight';
  return 'other';
}

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
      const { products: verifiedProducts, totalTransportCost: invoiceTransportCost, invoices } = body;

      // Handle the older Excel array format by wrapping it in a dummy invoice
      let invoicesToProcess = invoices;
      if (!invoicesToProcess && verifiedProducts) {
         invoicesToProcess = [{
           invoiceInfo: {
             supplier: null,
             invoiceNumber: null,
             purchaseDate: new Date().toISOString(),
             grandTotal: 0,
             totalTransportCost: invoiceTransportCost || 0
           },
           products: verifiedProducts
         }];
      }

      if (!Array.isArray(invoicesToProcess) || invoicesToProcess.length === 0) {
        return NextResponse.json({ error: "No products provided for import." }, { status: 400 });
      }

      const results = { created: 0, updated: 0, failed: 0 };
      let totalProductsProcessed = 0;

      const existingProducts = await prisma.product.findMany({
        where: { businessId },
        select: { id: true, sku: true, name: true, stock: true, standardCost: true, sellingPrice: true, supplierId: true },
      });
      const existingSkuMap = new Map(existingProducts.map((p) => [p.sku?.toLowerCase() ?? "", p.id]));
      const existingNameMap = new Map(existingProducts.map((p) => [p.name.toLowerCase(), p.id]));

      const uniqueSupplierNames = new Set<string>();
      for (const inv of invoicesToProcess) {
        if (inv.invoiceInfo?.supplier && inv.invoiceInfo.supplier !== "Unknown Supplier") {
          uniqueSupplierNames.add(inv.invoiceInfo.supplier.toLowerCase());
        }
      }

      const existingSuppliers = await prisma.supplier.findMany({
        where: { businessId }
      });
      const supplierMap = new Map<string, any>();
      for (const s of existingSuppliers) {
        supplierMap.set(s.name.toLowerCase(), s);
      }

      const invoiceNumbersInPayload = invoicesToProcess
        .map((inv: any) => inv.invoiceInfo?.invoiceNumber)
        .filter(Boolean);
        
      const existingMovements = await prisma.stockMovement.findMany({
        where: {
          businessId,
          referenceId: { in: invoiceNumbersInPayload as string[] }
        },
        select: { productId: true, referenceId: true }
      });
      const movementMap = new Set<string>();
      for (const m of existingMovements) {
        if (m.referenceId) {
          movementMap.add(`${m.productId}-${m.referenceId}`);
        }
      }

      for (const invoice of invoicesToProcess) {
        const { invoiceInfo, products } = invoice;
        if (!products || products.length === 0) continue;
        
        // ── Distribute invoice-level transport cost by value ──
        const totalTransport = Number(invoiceInfo?.totalTransportCost ?? invoiceTransportCost ?? 0);
        if (totalTransport > 0) {
          const totalBaseValue = products.reduce(
            (sum: number, p: any) => sum + (Number(p.basePurchasePrice ?? p.purchasePrice ?? 0) * Number(p.stock ?? 0)),
            0
          );
          if (totalBaseValue > 0) {
            products.forEach((p: any) => {
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

        // ── Resolve Supplier ──
        let supplierId: string | null = null;
        let supplierName = invoiceInfo?.supplier;
        if (supplierName && supplierName !== "Unknown Supplier") {
          let supplier = supplierMap.get(supplierName.toLowerCase());
          if (!supplier) {
             supplier = await prisma.supplier.create({
                data: {
                   businessId,
                   name: supplierName,
                }
             });
             supplierMap.set(supplierName.toLowerCase(), supplier);
          }
          supplierId = supplier.id;
        }

        // ── Create Purchase Header ──
        let purchaseId: string | null = null;
        if (invoiceInfo?.invoiceNumber && supplierId) {
           const parsedInvoiceDate = invoiceInfo.purchaseDate ? new Date(invoiceInfo.purchaseDate) : new Date();
           const safeInvoiceDate = isNaN(parsedInvoiceDate.getTime()) ? new Date() : parsedInvoiceDate;
           const purchase = await prisma.purchase.create({
              data: {
                 businessId,
                 supplierId: supplierId,
                 purchaseNo: `PUR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                 invoiceNo: invoiceInfo.invoiceNumber,
                 purchaseDate: safeInvoiceDate,
                 status: 'CONFIRMED',
                 totalAmount: Number(invoiceInfo.grandTotal) || 0,
                 notes: 'Imported via API/AI',
              }
           });
           purchaseId = purchase.id;

           if (invoiceInfo.attachment) {
             try {
               await prisma.purchaseAttachment.create({
                 data: {
                   purchaseId: purchase.id,
                   fileUrl: invoiceInfo.attachment.url,
                   fileName: invoiceInfo.attachment.fileName,
                   fileSize: invoiceInfo.attachment.fileSize,
                   mimeType: invoiceInfo.attachment.mimeType,
                 }
               });
             } catch (attErr) {
               console.error("Failed to create purchase attachment record:", attErr);
             }
           }
        }

        for (const p of products) {
          try {
            totalProductsProcessed++;
            const sku = p.sku ? String(p.sku) : "";
            const name = String(p.name ?? "");
            const intel = findProductIntelligence(businessType, name, sku);

            const totalExpensesPerUnit = Array.isArray(p.expenses)
              ? p.expenses.reduce((sum: number, e: any) => sum + Number(e.amount ?? 0), 0)
              : Number(p.transportCost ?? 0);

            const productData = {
              name,
              sku,
              category: String(p.category || intel?.category || "Other"),
              stock: Math.round(Number(p.stock ?? 0)),
              minStock: Math.round(Number(p.minStock ?? intel?.minStock ?? 5)),
              unitsPerBag: Math.round(Number(p.unitsPerBag || intel?.unitsPerBag || 1)),
              standardCost: p.purchasePrice ? Number(p.purchasePrice) : Number(p.basePurchasePrice ?? p.purchasePrice ?? 0) + totalExpensesPerUnit,
              sellingPrice: Number(p.sellingPrice ?? 0),
              unit: String(p.unit || intel?.unit || "pcs"),
              supplier: supplierName ? String(supplierName) : (p.supplier ? String(p.supplier) : null),
              purchaseFrom: supplierName ? String(supplierName) : (p.supplier ? String(p.supplier) : null),
              supplierId: supplierId,
              purchaseDate: (p.purchaseDate && !isNaN(new Date(p.purchaseDate).getTime())) ? new Date(p.purchaseDate) : (invoiceInfo.purchaseDate && !isNaN(new Date(invoiceInfo.purchaseDate).getTime()) ? new Date(invoiceInfo.purchaseDate) : null),
              purchaseInvoiceNo: invoiceInfo.invoiceNumber ? String(invoiceInfo.invoiceNumber) : (p.purchaseInvoiceNo ? String(p.purchaseInvoiceNo) : null),
              hsnCode: p.hsnCode || intel?.hsnCode || null,
              gstRate: Number(p.gstRate ?? intel?.gstRate ?? 0),
            };

            const existingId = (sku ? existingSkuMap.get(sku.toLowerCase()) : null)
              ?? existingNameMap.get(productData.name.toLowerCase())
              ?? null;

            let finalProductId = existingId;

            if (existingId) {
              const existingProduct = existingProducts.find(p => p.id === existingId);
              
              const incomingQuantity = productData.stock;
              let newTotalStock = existingProduct?.stock || 0;
              let shouldAddStock = true;
              
              if (productData.purchaseInvoiceNo) {
                const duplicateMovement = movementMap.has(`${existingId}-${productData.purchaseInvoiceNo}`);
                if (duplicateMovement) shouldAddStock = false;
              }
              
              if (shouldAddStock) newTotalStock += incomingQuantity;

              const updateData: any = {
                stock: newTotalStock,
                standardCost: productData.standardCost > 0 ? productData.standardCost : existingProduct?.standardCost,
                sellingPrice: productData.sellingPrice > 0 ? productData.sellingPrice : existingProduct?.sellingPrice,
                purchaseDate: productData.purchaseDate || undefined,
                purchaseFrom: productData.purchaseFrom || productData.supplier || undefined,
                purchaseInvoiceNo: productData.purchaseInvoiceNo || undefined,
                supplierId: productData.supplierId || existingProduct?.supplierId || undefined,
              };
              
              await prisma.product.update({ where: { id: existingId }, data: updateData });
              
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

                const layerExpenses = Array.isArray(p.expenses)
                  ? p.expenses.map((e: any) => ({
                      expenseType: mapExpenseType(e.expenseType),
                      amount: Number(e.amount ?? 0) * incomingQuantity,
                      remarks: e.remarks || null,
                    })).filter((e: any) => e.amount > 0)
                  : (p.transportCost && Number(p.transportCost) > 0
                      ? [{ expenseType: 'transport', amount: Number(p.transportCost) * incomingQuantity }]
                      : []);

                await createLayerSafe({
                  itemId: existingId,
                  quantity: incomingQuantity,
                  purchaseCost: p.basePurchasePrice ? (Number(p.basePurchasePrice) * incomingQuantity) : ((productData.standardCost - totalExpensesPerUnit) * incomingQuantity),
                  expenses: layerExpenses,
                  receiptNo: productData.purchaseInvoiceNo || undefined,
                  purchaseInvoiceId: purchaseId || undefined,
                  receiptDate: productData.purchaseDate || new Date(),
                  supplierId: supplierId || productData.purchaseFrom || productData.supplier || undefined,
                  sourceTransactionType: 'purchase',
                  businessId,
                });
              }
              results.updated++;
            } else {
              const newProduct = await prisma.product.create({ data: { ...productData, businessId } });
              finalProductId = newProduct.id;
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

                const layerExpenses = Array.isArray(p.expenses)
                  ? p.expenses.map((e: any) => ({
                      expenseType: mapExpenseType(e.expenseType),
                      amount: Number(e.amount ?? 0) * newProduct.stock,
                      remarks: e.remarks || null,
                    })).filter((e: any) => e.amount > 0)
                  : (p.transportCost && Number(p.transportCost) > 0
                      ? [{ expenseType: 'transport', amount: Number(p.transportCost) * newProduct.stock }]
                      : []);

                await createLayerSafe({
                  itemId: newProduct.id,
                  quantity: newProduct.stock,
                  purchaseCost: p.basePurchasePrice ? (Number(p.basePurchasePrice) * newProduct.stock) : ((productData.standardCost - totalExpensesPerUnit) * newProduct.stock),
                  expenses: layerExpenses,
                  receiptNo: productData.purchaseInvoiceNo || undefined,
                  purchaseInvoiceId: purchaseId || undefined,
                  receiptDate: productData.purchaseDate || new Date(),
                  supplierId: supplierId || productData.purchaseFrom || productData.supplier || undefined,
                  sourceTransactionType: 'purchase',
                  businessId,
                });
              }
              results.created++;
            }

            if (purchaseId && finalProductId) {
              await prisma.purchaseItem.create({
                data: {
                  purchaseId: purchaseId,
                  productId: finalProductId,
                  quantity: productData.stock,
                  unitPrice: p.basePurchasePrice ? Number(p.basePurchasePrice) : (productData.standardCost - totalExpensesPerUnit),
                  totalAmount: productData.stock * (p.basePurchasePrice ? Number(p.basePurchasePrice) : (productData.standardCost - totalExpensesPerUnit)),
                }
              });
            }
          } catch (err) {
            results.failed++;
            console.error("Failed to import product:", err);
          }
        }
      }

      await recalculateTransportCosts(businessId).catch(() => {});

      return NextResponse.json({
        success: true,
        results,
        summary: { total: totalProductsProcessed, created: results.created, updated: results.updated, skipped: 0, failed: results.failed },
      });
    }

    /* ── 2. FormData → File upload (PDF invoice or Excel/CSV) ── */
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) ?? "validate";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    // ── Hardening: Enforce 5MB limit ──
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds the 5MB limit." }, { status: 400 });
    }

    /* ── 2a. PDF Invoice Parsing (ML-Trained Template Extraction) ── */
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());

        // ── Hardening: Magic Bytes Check (%PDF) ──
        if (buffer.length < 4 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
          return NextResponse.json({ error: "Invalid PDF file: Missing %PDF magic bytes." }, { status: 400 });
        }

        // Invoice Extraction Service — uses Gemini with graceful fallback to local parser
        const { extractInvoiceWithAI } = await import("@/shared/lib/ai/invoice-extractor");
        const detectedInvoice = await extractInvoiceWithAI(buffer, businessId);

        if (detectedInvoice.error || !detectedInvoice.products || !Array.isArray(detectedInvoice.products) || detectedInvoice.products.length === 0) {
          return NextResponse.json({
            error: detectedInvoice.error || "No products could be extracted from this PDF. Please check the template or try a different file.",
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
          select: { name: true, sku: true, category: true, hsnCode: true, unit: true, unitsPerBag: true, gstRate: true, supplier: true, purchaseFrom: true }
        });

        // Supplier Auto-Matching
        const uniqueSuppliers = new Set<string>();
        existingProducts.forEach(p => {
          if (p.supplier) uniqueSuppliers.add(p.supplier);
          if (p.purchaseFrom) uniqueSuppliers.add(p.purchaseFrom);
        });

        let supplierMatchType = "new-supplier";
        let supplierMatchScore = 0;
        let finalSupplier = detectedInvoice.supplier || "Unknown Supplier";

        if (detectedInvoice.supplierConfidence !== undefined && detectedInvoice.supplierConfidence < 0.7) {
          finalSupplier = "Unknown Supplier";
        }

        if (finalSupplier !== "Unknown Supplier") {
          for (const s of Array.from(uniqueSuppliers)) {
            const score = computeStringSimilarity(finalSupplier, s);
            if (score > supplierMatchScore) {
              supplierMatchScore = score;
              if (score > 0.8) {
                supplierMatchType = "auto-matched";
                finalSupplier = s;
              }
            }
          }
        }
        
        const supplierMatch = {
          matchType: supplierMatchType,
          score: supplierMatchScore,
          originalName: detectedInvoice.supplier || "Unknown Supplier"
        };


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
          const intel = findProductIntelligence(businessType, p.name, p.sku, String(p.hsnCode || ""));
          
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

          let matchType = "manual";
          if (matchedDbProduct) {
             if (bestScore >= 0.9 || (p.sku && matchedDbProduct.sku && p.sku.toLowerCase() === matchedDbProduct.sku.toLowerCase())) {
               matchType = "auto-matched";
             } else if (bestScore >= 0.6) {
               matchType = "needs-review";
             }
          }

          const warnings: { row: number; column: string; message: string; severity: "warning" }[] = [];
          if (!parseNum(p.gstRate) && !matchedDbProduct?.gstRate && !intel?.gstRate) {
            warnings.push({ row: idx + 1, column: 'gstRate', message: 'Missing GST', severity: 'warning' });
          }
          if (!p.hsnCode && !matchedDbProduct?.hsnCode && !intel?.hsnCode) {
            warnings.push({ row: idx + 1, column: 'hsnCode', message: 'Missing HSN', severity: 'warning' });
          }
          if (parseNum(p.quantity ?? p.stock) === 0) {
            warnings.push({ row: idx + 1, column: 'stock', message: 'Quantity is 0', severity: 'warning' });
          }
          
          const finalGstRate = matchedDbProduct?.gstRate || parseNum(p.gstRate) || intel?.gstRate || 0;
          const exclusivePrice = parseNum(p.basePurchasePrice) || parseNum(p.purchasePrice);
          const inclusiveBasePrice = Number((exclusivePrice * (1 + finalGstRate / 100)).toFixed(2));
          const transport = parseNum(p.transportCost);

          return {
            rowIndex: idx + 1,
            action: "create" as const,
            errors: [] as { row: number; column: string; message: string; severity: "error" }[],
            warnings,
            data: {
              name: finalName || `Extracted Item ${idx + 1}`,
              sku: finalSku,
              category: matchedDbProduct?.category || p.category || intel?.category || "Other",
              stock: parseNum(p.quantity ?? p.stock),
              unitsPerBag: matchedDbProduct?.unitsPerBag || parseNum(p.unitsPerBag) || intel?.unitsPerBag || 1,
              basePurchasePrice: inclusiveBasePrice,
              transportCost: transport,
              purchasePrice: inclusiveBasePrice + transport,
              sellingPrice: parseNum(p.sellingPrice),
              unit: matchedDbProduct?.unit || p.unit || intel?.unit || "pcs",
              supplier: finalSupplier,
              purchaseInvoiceNo: detectedInvoice.invoiceNumber || "UNKNOWN",
              purchaseDate: detectedInvoice.purchaseDate || new Date().toISOString(),
              gstRate: finalGstRate,
              hsnCode: String(p.hsnCode || intel?.hsnCode || ""),
              matchScore: bestScore,
              matchType,
            },
          };
        });

        return NextResponse.json({
          mode: "validate",
          isInvoicePdf: true,
          invoiceInfo: {
            invoiceNumber: detectedInvoice.invoiceNumber || "Unknown",
            supplier: finalSupplier,
            supplierGstin: detectedInvoice.supplierGstin || "",
            purchaseDate: detectedInvoice.purchaseDate || new Date().toISOString(),
            eWayBillNo: detectedInvoice.eWayBillNo || "",
            format: detectedInvoice.format || "unknown",
            templateName: detectedInvoice.templateName || "",
            grandTotal: detectedInvoice.grandTotal || 0,
            validationPassed: detectedInvoice.validationPassed ?? true,
            validationDetails: detectedInvoice.validationDetails || "",
            supplierMatch,
          },
          validation: {
            valid: true,
            summary: { 
              total: processedRows.length, 
              valid: processedRows.length, 
              errors: processedRows.reduce((sum: number, r: any) => sum + r.errors.length, 0), 
              warnings: processedRows.reduce((sum: number, r: any) => sum + r.warnings.length, 0), 
              duplicates: 0 
            },
            processedRows,
            errors: processedRows.flatMap((r: any) => r.errors),
            warnings: processedRows.flatMap((r: any) => r.warnings),
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

    const existingProducts = await prisma.product.findMany({ where: { businessId }, select: { id: true, sku: true, stock: true, standardCost: true, sellingPrice: true, supplierId: true } });
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

        const basePrice = Number(d.basePurchasePrice ?? d.purchasePrice ?? intel?.standardCost ?? 0);
        const transportCost = Number(d.transportCost ?? 0);

        const productData = {
          name,
          sku,
          category: String(d.category || intel?.category || "Other"),
          stock: Number(d.stock ?? 0),
          minStock: Number(d.minStock ?? intel?.minStock ?? 5),
          unitsPerBag: Number(d.unitsPerBag || intel?.unitsPerBag || 1),
          standardCost: basePrice + transportCost,
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
            const existingProduct = existingProducts.find(p => p.id === existingId);
            const stockDiff = productData.stock - (existingProduct?.stock || 0);
            
            const updateData: any = {
              ...productData,
              standardCost: productData.standardCost > 0 ? productData.standardCost : existingProduct?.standardCost,
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
                purchaseCost: basePrice * stockDiff,
                expenses: transportCost > 0 ? [{ expenseType: 'transport', amount: transportCost * stockDiff }] : [],
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
                purchaseCost: basePrice * newProduct.stock,
                expenses: transportCost > 0 ? [{ expenseType: 'transport', amount: transportCost * newProduct.stock }] : [],
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
              purchaseCost: basePrice * newProduct.stock,
              expenses: transportCost > 0 ? [{ expenseType: 'transport', amount: transportCost * newProduct.stock }] : [],
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

