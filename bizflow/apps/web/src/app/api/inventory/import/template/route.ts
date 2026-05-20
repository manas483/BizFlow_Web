import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth, AuthError } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { getImportTemplate } from "@/lib/inventory-import";

export async function GET() {
  try {
    const session = await requireAuth();

    // Fetch business to get store type
    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: { businessType: true, name: true },
    });

    const businessType = business?.businessType ?? "Other";
    const template = getImportTemplate(businessType);

    // ── Build workbook ─────────────────────────────────────────────────────

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Import Template ───────────────────────────────────────────

    const headers = template.columns.map((c) => c.header);

    // Build worksheet data: [headers, ...exampleRows]
    const wsData: (string | number)[][] = [headers];
    for (const row of template.exampleRows) {
      wsData.push(headers.map((h) => (row[h] !== undefined ? row[h] : "") as string | number));
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = headers.map((h) => ({
      wch: Math.max(h.length + 4, 18),
    }));

    // Style header row (bold + background — note: XLSX community edition has limited styling)
    // We encode required columns via notes sheet instead

    XLSX.utils.book_append_sheet(wb, ws, "📦 Import Template");

    // ── Sheet 2: Column Guide ──────────────────────────────────────────────

    const guideHeaders = ["Column Name", "Required", "Data Type", "Example", "Notes & Accepted Values"];
    const guideData: (string | number)[][] = [guideHeaders];
    for (const col of template.columns) {
      guideData.push([
        col.header,
        col.required ? "✅ Yes" : "Optional",
        col.type === "integer" ? "Whole Number" : col.type === "number" ? "Decimal Number" : "Text",
        col.example,
        col.notes,
      ]);
    }
    const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
    wsGuide["!cols"] = [
      { wch: 22 },
      { wch: 10 },
      { wch: 16 },
      { wch: 22 },
      { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, wsGuide, "📖 Column Guide");

    // ── Sheet 3: Import Notes ──────────────────────────────────────────────

    const notesData: string[][] = [
      ["BizFlow Inventory Import — Instructions"],
      [""],
      ...template.notes.map((note) => [note]),
      [""],
      ["Valid Categories for This Store:"],
      ...getImportTemplate(businessType)
        .notes.slice(0, 1)
        .map(() => [""]), // spacer
    ];

    // Add categories from template notes
    const profile = getImportTemplate(businessType);
    const categoriesLine = template.notes.find((n) => n.includes("Valid categories"));
    if (categoriesLine) {
      const cats = categoriesLine.split(":")[1]?.split(",").map((c) => c.trim()) ?? [];
      for (const cat of cats) {
        notesData.push([`  • ${cat}`]);
      }
    }

    const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
    wsNotes["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsNotes, "📝 Instructions");

    // ── Serialize & Return ─────────────────────────────────────────────────

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const filename = `BizFlow_${businessType.replace(/\s+/g, "_")}_Inventory_Template.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error("Template generation error:", error);
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
