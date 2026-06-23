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

import { parseInvoicePdf } from "@/shared/lib/gemini";

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
      const { products: verifiedProducts } = body;

      if (!Array.isArray(verifiedProducts) || verifiedProducts.length === 0) {
        return NextResponse.json({ error: "No products provided for import." }, { status: 400 });
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
            const stockDiff = productData.stock - (existingProduct?.stock || 0);
            
            await prisma.product.update({ where: { id: existingId }, data: productData });
            
            if (stockDiff > 0) {
              await prisma.stockMovement.create({
                data: {
                  productId: existingId,
                  type: 'IN',
                  quantity: stockDiff,
                  notes: productData.purchaseFrom || productData.supplier || 'Restock from import',
                  referenceId: productData.purchaseInvoiceNo || null,
                  createdAt: productData.purchaseDate || undefined,
                  businessId,
                }
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

    /* ── 2a. PDF Invoice Parsing (AI Extraction) ── */
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Pdf = buffer.toString("base64");

        const detectedInvoice = await parseInvoicePdf(base64Pdf);

        if (detectedInvoice.error || !detectedInvoice.products || !Array.isArray(detectedInvoice.products)) {
          return NextResponse.json({
            error: detectedInvoice.error || "Could not recognise this invoice PDF or failed to extract products.",
          }, { status: 400 });
        }

        const processedRows = detectedInvoice.products.map((p: any, idx: number) => {
          // Find intelligence properties
          const intel = findProductIntelligence(businessType, p.name, p.sku);
          return {
            rowIndex: idx + 1,
            action: "create" as const,
            errors: [] as { row: number; column: string; message: string; severity: "error" }[],
            warnings: [] as { row: number; column: string; message: string; severity: "warning" }[],
            data: {
              name: p.name || `Extracted Item ${idx + 1}`,
              sku: p.sku || "",
              category: p.category || intel?.category || "Other",
              stock: Number(p.stock) || 0,
              unitsPerBag: Number(p.unitsPerBag) || intel?.unitsPerBag || 1,
              basePurchasePrice: Number(p.basePurchasePrice) || 0,
              transportCost: 0,
              purchasePrice: Number(p.purchasePrice) || 0,
              sellingPrice: Number(p.sellingPrice) || 0,
              unit: p.unit || intel?.unit || "pcs",
              supplier: detectedInvoice.supplier || "Unknown Supplier",
              purchaseInvoiceNo: detectedInvoice.invoiceNumber || "UNKNOWN",
              purchaseDate: detectedInvoice.purchaseDate || new Date().toISOString(),
              gstRate: Number(p.gstRate) || intel?.gstRate || 0,
              hsnCode: p.hsnCode || intel?.hsnCode || null,
            },
          };
        });

        return NextResponse.json({
          mode: "validate",
          isInvoicePdf: true,
          invoiceInfo: {
            invoiceNumber: detectedInvoice.invoiceNumber || "Unknown",
            supplier: detectedInvoice.supplier || "Unknown Supplier",
            purchaseDate: detectedInvoice.purchaseDate || new Date().toISOString(),
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
          purchasePrice: Number(d.purchasePrice ?? intel?.purchasePrice ?? 0),
          sellingPrice: Number(d.sellingPrice ?? 0),
          unit: String(d.unit || intel?.unit || "pcs"),
          supplier: d.supplier ? String(d.supplier) : null,
          hsnCode: d.hsnCode ? String(d.hsnCode) : (intel?.hsnCode ?? null),
          gstRate: Number(d.gstRate ?? intel?.gstRate ?? 0),
        };

        if (processedRow.action === "update" && sku) {
          const existingId = existingSkuMap.get(sku.toLowerCase());
          if (existingId) { 
            const existingProduct = await prisma.product.findUnique({ where: { id: existingId } });
            const stockDiff = productData.stock - (existingProduct?.stock || 0);
            
            await prisma.product.update({ where: { id: existingId }, data: productData }); 
            
            if (stockDiff > 0) {
              await prisma.stockMovement.create({
                data: {
                  productId: existingId,
                  type: 'IN',
                  quantity: stockDiff,
                  notes: productData.supplier || 'Restock from import',
                  referenceId: null, // excel imports usually don't have invoice no unless added
                  createdAt: undefined,
                  businessId,
                }
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
                  notes: newProduct.supplier || 'Initial stock from import',
                  businessId,
                }
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
                notes: newProduct.supplier || 'Initial stock from import',
                businessId,
              }
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

