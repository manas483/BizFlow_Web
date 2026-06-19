import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { QuotationDocument } from '@/shared/ui/pdf/QuotationDocument';
import React from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const quotation = await prisma.quotation.findFirst({
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

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(React.createElement(QuotationDocument, { quotation }) as any);
    const safeDate = new Date(quotation.createdAt).toISOString().slice(0, 10);
    const safeName = (quotation.customer?.name || 'walkin').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filename = `Quotation-${quotation.quotationNo}_${safeName}_${safeDate}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
