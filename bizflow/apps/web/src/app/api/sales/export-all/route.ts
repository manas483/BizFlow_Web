import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/shared/ui/pdf/InvoiceDocument';
import { PDFDocument } from 'pdf-lib';
import React from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/sales/export-all?copy=original|duplicate|triplicate&filter=all|paid|unpaid|partial
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const copy = req.nextUrl.searchParams.get('copy') || 'original';
    const filter = req.nextUrl.searchParams.get('filter') || 'all';

    const COPY_LABELS: Record<string, string> = {
      original:   'Original for Buyer',
      duplicate:  'Duplicate for Transporter',
      triplicate: 'Triplicate for Supplier',
    };
    const copyLabel = COPY_LABELS[copy] || 'Original for Buyer';

    // Build the where clause
    const where: any = {
      businessId: session.user.businessId,
      workflowState: 'posted', // only posted/approved invoices
    };
    if (filter !== 'all') {
      where.status = filter;
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        customer: {
          select: {
            name: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            state: true,
            stateCode: true,
            gstNumber: true,
          }
        },
        business: true,
        items: {
          include: {
            product: {
              select: { name: true, sku: true, category: true, unit: true }
            }
          }
        }
      }
    });

    if (sales.length === 0) {
      return NextResponse.json(
        { error: 'No invoices found to export' },
        { status: 404 }
      );
    }

    // Merge all individual PDFs into one document
    const mergedPdf = await PDFDocument.create();

    for (const sale of sales) {
      const pdfBuffer = await renderToBuffer(
        React.createElement(InvoiceDocument, { sale, copyLabel }) as any
      );
      const singlePdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(
        singlePdf,
        singlePdf.getPageIndices()
      );
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const today = new Date().toISOString().slice(0, 10);
    const filename = `All-Invoices_${copy}_${today}.pdf`;

    return new NextResponse(mergedBytes as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('Export All PDF Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate merged PDF' },
      { status: 500 }
    );
  }
}
