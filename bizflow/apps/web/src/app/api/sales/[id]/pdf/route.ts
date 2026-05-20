import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/components/pdf/InvoiceDocument';
import React from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COPY_LABELS: Record<string, string> = {
  original:    'Original for Buyer',
  duplicate:   'Duplicate for Transporter',
  triplicate:  'Triplicate for Supplier',
};

// GET /api/sales/[id]/pdf?copy=original|duplicate|triplicate
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const copy = req.nextUrl.searchParams.get('copy') || 'original';
    const copyLabel = COPY_LABELS[copy] || 'Original for Buyer';

    const sale = await prisma.sale.findFirst({
      where: { id, businessId: session.user.businessId },
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
        business: {
          select: {
            name: true,
            phone: true,
            address: true,
            gstNumber: true,
            ownerName: true,
            businessType: true,
            bankName: true,
            accountNumber: true,
            ifscCode: true,
            branch: true,
            gstInclusive: true,
          }
        },
        items: {
          include: {
            product: {
              select: { name: true, sku: true, category: true, unit: true }
            }
          }
        }
      }
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(React.createElement(InvoiceDocument, { sale, copyLabel }) as any);
    const safeDate = new Date(sale.createdAt).toISOString().slice(0, 10);
    const safeName = (sale.customer?.name || 'walkin').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filename = `Invoice-${sale.invoiceNo}_${safeName}_${safeDate}_${copy}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    // NC-2 FIX: Never expose stack traces to clients — log server-side only
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
