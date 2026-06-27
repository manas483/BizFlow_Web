export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { quotationSchema } from '@/shared/lib/validations';
import { extractStateCodeFromGST } from '@/shared/lib/gst-engine';
import { calculateInvoiceTotal } from '@/shared/lib/invoice-engine';
import { z } from 'zod';
import { buildProductSnapshot } from '@/shared/lib/product-snapshot';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    const quotations = await prisma.quotation.findMany({
      where: {
        businessId: session.user.businessId,
        ...(search ? { 
          OR: [
            { quotationNo: { contains: search, mode: 'insensitive' } },
            { customer: { name: { contains: search, mode: 'insensitive' } } }
          ]
        } : {}),
      },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(quotations);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const validatedData = quotationSchema.parse(body);
    const { customerId, items, notes, placeOfSupply, reverseCharge, validUntil } = validatedData;

    const result = await prisma.$transaction(async (tx: any) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId: session.user.businessId },
        select: { id: true }
      });
      if (!customer) {
        throw new Error('Customer not found or access denied');
      }

      // 0. Get business settings
      const business = await tx.business.findUnique({
        where: { id: session.user.businessId },
        select: { gstInclusive: true, gstNumber: true, stateCode: true }
      });
      const gstInclusive = business?.gstInclusive ?? false;
      const businessStateCode = business?.stateCode || extractStateCodeFromGST(business?.gstNumber) || null;

      // Resolve place of supply state code
      let placeOfSupplyCode: string | null = null;
      if (placeOfSupply) {
        placeOfSupplyCode = placeOfSupply.length === 2 && /^\d{2}$/.test(placeOfSupply)
          ? placeOfSupply
          : businessStateCode;
      }

      // 1. Calculate total with Invoice Engine
      const productMap: Record<string, any> = {};
      const invoiceLines = [];
      for (const item of items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, businessId: session.user.businessId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        if (!product.active) throw new Error(`Product "${product.name}" is archived and cannot be used in new transactions.`);
        productMap[item.productId] = product;
        invoiceLines.push({
          qty: item.qty,
          price: product.sellingPrice,
          discount: item.discount || 0,
          gstRate: item.gstRate || product.gstRate || 0,
        });
      }

      const invoiceResult = calculateInvoiceTotal(
        invoiceLines,
        businessStateCode,
        placeOfSupplyCode,
        gstInclusive,
      );
      const total = invoiceResult.grandTotal;

      // 2. Auto-generate quotation number (collision-proof)
      const year = new Date().getFullYear();
      const prefix = `QTN-${year}-`;
      const lastQuotation = await tx.quotation.findFirst({
        where: { businessId: session.user.businessId, quotationNo: { startsWith: prefix } },
        orderBy: { quotationNo: 'desc' },
        select: { quotationNo: true }
      });
      let nextNum = 1;
      if (lastQuotation) {
        const parts = lastQuotation.quotationNo.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const quotationNo = `${prefix}${String(nextNum).padStart(3, "0")}`;

      // 3. Create quotation
      const quotation = await tx.quotation.create({
        data: {
          quotationNo,
          customerId,
          total,
          notes,
          placeOfSupply: placeOfSupply || null,
          reverseCharge: reverseCharge === true,
          validUntil: validUntil ? new Date(validUntil) : null,
          businessId: session.user.businessId,
          items: {
            create: items.map((item: any) => {
              const product = productMap[item.productId];
              return {
                productId: item.productId,
                qty: item.qty,
                price: item.price,
                purchasePrice: productMap[item.productId]?.purchasePrice || 0,
                discount: parseFloat(item.discount) || 0,
                hsnCode: item.hsnCode,
                gstRate: parseFloat(item.gstRate) || 0,
                ...buildProductSnapshot(product),
              };
            })
          }
        }
      });

      await tx.userActivity.create({
        data: {
          businessId: session.user.businessId,
          userId: session.user.id ?? "unknown",
          eventType: "quotation_created",
          metadata: { quotationId: quotation.id, total },
        }
      });

      return quotation;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
