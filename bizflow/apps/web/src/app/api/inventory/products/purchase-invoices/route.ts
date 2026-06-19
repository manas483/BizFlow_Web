import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const invoicesParam = searchParams.get('invoices');

    if (invoicesParam) {
      const invoiceList = invoicesParam.split(',').map(i => i.trim()).filter(Boolean);
      const products = await prisma.product.findMany({
        where: {
          businessId: session.user.businessId,
          purchaseInvoiceNo: { in: invoiceList },
        },
      });
      return NextResponse.json(products);
    }

    const products = await prisma.product.findMany({
      where: {
        businessId: session.user.businessId,
        purchaseInvoiceNo: { not: null },
      },
      select: {
        purchaseInvoiceNo: true,
      },
      distinct: ['purchaseInvoiceNo'],
    });

    const invoices = products
      .map(p => p.purchaseInvoiceNo)
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .sort();

    return NextResponse.json(invoices);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
