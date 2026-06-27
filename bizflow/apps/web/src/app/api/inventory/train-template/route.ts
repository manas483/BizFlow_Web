export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/shared/lib/api-guard";
import { prisma } from "@/shared/lib/db";
import { trainTemplate } from "@/shared/lib/invoice-template-learner";
import { parseInvoicePdfLocally } from "@/shared/lib/pdf-parser";

/**
 * POST /api/inventory/train-template
 *
 * Trains a new invoice template from a sample PDF.
 * The ML learner analyzes the PDF structure and learns:
 *   - Column positions via K-means clustering
 *   - Header field locations via label proximity
 *   - Table boundaries via edge detection
 *   - Format fingerprint for future matching
 *
 * After training, it extracts data from the same PDF to verify accuracy.
 * If validation passes, the template is stored in the DB.
 *
 * Request: multipart/form-data with "file" (PDF) and optional "name" (template name)
 * Response: The extracted invoice data + template metadata
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const customName = formData.get("name") as string | null;

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Please upload a PDF invoice file to train." },
        { status: 400 }
      );
    }

    // ── Hardening: Enforce 5MB limit ──
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds the 5MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Hardening: Magic Bytes Check (%PDF) ──
    if (buffer.length < 4 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
      return NextResponse.json({ error: "Invalid PDF file: Missing %PDF magic bytes." }, { status: 400 });
    }

    // ── Step 1: Train the template ──
    console.log(`[TrainTemplate] Training on: ${file.name}`);
    const result = await trainTemplate(buffer);

    console.log(`[TrainTemplate] Learned: ${result.details}`);

    // ── Step 2: Check for existing template with same fingerprint ──
    const existing = await prisma.invoiceTemplate.findFirst({
      where: { businessId, fingerprint: result.fingerprint },
    });

    // ── Step 3: Store/update the template ──
    let template;
    const templateName = customName || result.formatName || `Template from ${file.name}`;

    if (existing) {
      // Update existing template (retrain)
      template = await prisma.invoiceTemplate.update({
        where: { id: existing.id },
        data: {
          name: templateName,
          templateData: result.config as any,
          trainingMeta: {
            accuracy: result.accuracy,
            columnCount: result.columnCount,
            productRowCount: result.productRowCount,
            hasGst: result.hasGst,
            details: result.details,
            lastTrainedFrom: file.name,
            trainedAt: new Date().toISOString(),
          } as any,
          sampleCount: { increment: 1 },
        },
      });
      console.log(`[TrainTemplate] Updated existing template: ${template.id}`);
    } else {
      // Create new template
      template = await prisma.invoiceTemplate.create({
        data: {
          name: templateName,
          fingerprint: result.fingerprint,
          templateData: result.config as any,
          trainingMeta: {
            accuracy: result.accuracy,
            columnCount: result.columnCount,
            productRowCount: result.productRowCount,
            hasGst: result.hasGst,
            details: result.details,
            lastTrainedFrom: file.name,
            trainedAt: new Date().toISOString(),
          } as any,
          sampleCount: 1,
          businessId,
        },
      });
      console.log(`[TrainTemplate] Created new template: ${template.id}`);
    }

    // ── Step 4: Verify by extracting from the same PDF ──
    // Now that the template is stored, parse should work
    const extractionResult = await parseInvoicePdfLocally(buffer, businessId);

    if (extractionResult.trainingRequired) {
      // This shouldn't happen since we just stored the template
      return NextResponse.json({
        error: "Template was saved but matching failed. This is unexpected.",
        templateId: template.id,
      }, { status: 500 });
    }

    // ── Fuzzy match extracted products against DB to get categories/names ──
    if (extractionResult.products && Array.isArray(extractionResult.products)) {
      const { computeStringSimilarity, cleanProductName, generateFallbackSku } = await import("@/shared/lib/product-matcher");
      const existingProducts = await prisma.product.findMany({
        where: { businessId },
        select: { name: true, sku: true, category: true, hsnCode: true, unit: true, unitsPerBag: true, gstRate: true }
      });

      extractionResult.products = extractionResult.products.map((p: any) => {
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
        
        if (matchedDbProduct) {
          p.name = matchedDbProduct.name;
          p.category = matchedDbProduct.category || p.category;
          p.sku = matchedDbProduct.sku || p.sku;
          p.unit = matchedDbProduct.unit || p.unit;
          p.unitsPerBag = matchedDbProduct.unitsPerBag || p.unitsPerBag;
        } else {
          p.name = cleanProductName(p.name);
          if (!p.sku || p.sku.trim() === '') {
            p.sku = generateFallbackSku(p.name);
          }
        }
        
        return p;
      });
    }

    return NextResponse.json({
      success: true,
      message: `Template "${templateName}" trained successfully from ${file.name}`,
      template: {
        id: template.id,
        name: template.name,
        fingerprint: result.fingerprint,
        columnCount: result.columnCount,
        productRowCount: result.productRowCount,
        hasGst: result.hasGst,
        isRetrained: !!existing,
      },
      // Return the extraction result so the UI can show the parsed data
      extraction: extractionResult,
    });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("[TrainTemplate] Error:", err);
    return NextResponse.json(
      { error: "Training failed: " + err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inventory/train-template
 *
 * List all trained templates for the current business.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;

    const templates = await prisma.invoiceTemplate.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        fingerprint: true,
        sampleCount: true,
        trainingMeta: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch templates: " + err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inventory/train-template?id=...
 *
 * Delete a trained template.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;
    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("id");

    if (!templateId) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }

    // Verify ownership
    const template = await prisma.invoiceTemplate.findFirst({
      where: { id: templateId, businessId },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    await prisma.invoiceTemplate.delete({ where: { id: templateId } });

    return NextResponse.json({ success: true, message: `Template "${template.name}" deleted.` });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete template: " + err.message },
      { status: 500 }
    );
  }
}
