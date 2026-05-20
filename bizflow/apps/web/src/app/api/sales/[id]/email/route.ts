import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/components/pdf/InvoiceDocument';
import { sendInvoiceEmail } from '@/lib/email';
import React from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

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

    if (!sale.customer.email) {
      return NextResponse.json({ error: 'Customer has no email address configured' }, { status: 400 });
    }

    const copyLabel = 'Original for Buyer';
    const pdfBuffer = await renderToBuffer(React.createElement(InvoiceDocument, { sale, copyLabel }) as any);

    const emailResult = await sendInvoiceEmail(
      sale.customer.email,
      sale.customer.name,
      sale.invoiceNo,
      sale.total,
      new Uint8Array(pdfBuffer)
    );

    if (!emailResult.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Invoice emailed successfully' });
  } catch (error: any) {
    if (error instanceof AuthError) return error.response;
    console.error('Email Generation Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      message: error.message
    }, { status: 500 });
  }
}
