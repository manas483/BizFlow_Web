import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth, AuthError } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import {
  getImportTemplate,
  validateImportData,
  mapColumns,
} from "@/lib/inventory-import";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;

    // 1. Parse FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) ?? "validate"; // "validate" | "import"

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an .xlsx, .xls, or .csv file." },
        { status: 400 }
      );
    }

    // 2. Read business profile
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { businessType: true },
    });
    const businessType = business?.businessType ?? "Other";
    const template = getImportTemplate(businessType);

    // 3. Parse Excel file
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: "buffer", cellText: true, cellDates: true });

    // Get first sheet that contains "Import" or just the first sheet
    const sheetName =
      wb.SheetNames.find((n) => n.toLowerCase().includes("import")) ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    if (!ws) {
      return NextResponse.json({ error: "No valid sheet found in the uploaded file." }, { status: 400 });
    }

    // Convert to JSON (header row = row 1)
    const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, {
      defval: "",
      raw: false,
    });

    if (rawRows.length === 0) {
      return NextResponse.json({ error: "The uploaded file appears to be empty." }, { status: 400 });
    }

    // 4. Smart column mapping
    const uploadedHeaders = Object.keys(rawRows[0] ?? {});
    const columnMapping = mapColumns(uploadedHeaders, template.columns);

    // Re-map rows to template headers
    const normalizedRows = rawRows.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const [templateHeader, uploadedHeader] of Object.entries(columnMapping)) {
        if (uploadedHeader) {
          // Find the column def
          const colDef = template.columns.find(
            (c) => c.header.toLowerCase() === templateHeader
          );
          if (colDef) {
            mapped[colDef.header] = row[uploadedHeader] ?? "";
          }
        }
      }
      // Also carry unmapped original keys for extra data
      for (const [key, val] of Object.entries(row)) {
        if (!Object.values(columnMapping).includes(key)) {
          mapped[key] = val;
        }
      }
      return mapped;
    });

    // 5. Get existing SKUs for this business
    const existingProducts = await prisma.product.findMany({
      where: { businessId },
      select: { id: true, sku: true },
    });
    const existingSkus = existingProducts
      .map((p) => p.sku)
      .filter((s): s is string => !!s);

    // 6. Validate
    const profile = getImportTemplate(businessType);
    const allowedCategories = profile.columns
      .find((c) => c.key === "category")
      ? [] // let all categories through; flag non-standard as warning
      : [];

    const validationResult = validateImportData(
      normalizedRows,
      template,
      existingSkus,
      allowedCategories
    );

    // Auto-detect unmapped columns and generate suggestions
    const unmappedHeaders = uploadedHeaders.filter(
      (h) => !Object.values(columnMapping).includes(h)
    );
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

    // 7. If validate-only mode, return results without writing to DB
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

    // 8. IMPORT MODE — write to database
    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: "File contains validation errors. Please fix them before importing.",
          validation: validationResult,
        },
        { status: 422 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as { row: number; message: string }[],
    };

    const existingSkuMap = new Map(
      existingProducts.map((p) => [p.sku?.toLowerCase() ?? "", p.id])
    );

    // Process rows in chunks of 50 for performance
    const CHUNK_SIZE = 50;
    for (let i = 0; i < validationResult.processedRows.length; i += CHUNK_SIZE) {
      const chunk = validationResult.processedRows.slice(i, i + CHUNK_SIZE);

      for (const processedRow of chunk) {
        if (processedRow.errors.length > 0) {
          results.skipped++;
          continue;
        }

        try {
          const d = processedRow.data as Record<string, unknown>;
          const sku = d.sku ? String(d.sku) : "";
          const productData = {
            name: String(d.name ?? ""),
            sku,
            category: String(d.category ?? "Other"),
            stock: Number(d.stock ?? 0),
            minStock: Number(d.minStock ?? 5),
            purchasePrice: Number(d.purchasePrice ?? 0),
            sellingPrice: Number(d.sellingPrice ?? 0),
            unit: String(d.unit ?? "pcs"),
            supplier: d.supplier ? String(d.supplier) : null,
            hsnCode: d.hsnCode ? String(d.hsnCode) : null,
            gstRate: Number(d.gstRate ?? 0),
          };

          if (processedRow.action === "update" && sku) {
            const existingId = existingSkuMap.get(sku.toLowerCase());
            if (existingId) {
              await prisma.product.update({
                where: { id: existingId },
                data: productData,
              });
              results.updated++;
            } else {
              await prisma.product.create({
                data: { ...productData, businessId },
              });
              results.created++;
            }
          } else {
            await prisma.product.create({
              data: { ...productData, businessId },
            });
            results.created++;
          }
        } catch (err) {
          results.failed++;
          results.errors.push({
            row: processedRow.rowIndex,
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    // Audit log
    await (prisma as any).userActivity.create({
      data: {
        businessId,
        userId: session.user.id ?? "unknown",
        eventType: "inventory_bulk_import",
        metadata: {
          filename: file.name,
          totalRows: validationResult.summary.total,
          created: results.created,
          updated: results.updated,
          failed: results.failed,
        },
      },
    }).catch(() => {}); // non-critical

    return NextResponse.json({
      mode: "import",
      success: true,
      results,
      summary: {
        total: validationResult.summary.total,
        created: results.created,
        updated: results.updated,
        skipped: results.skipped,
        failed: results.failed,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error("Inventory import error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
