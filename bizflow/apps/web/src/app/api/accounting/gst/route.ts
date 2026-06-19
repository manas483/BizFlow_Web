import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { gstReturnSchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const returnType = searchParams.get('returnType');
    const status = searchParams.get('status');

    const returns = await prisma.gstReturn.findMany({
      where: {
        businessId: session.user.businessId,
        ...(returnType ? { returnType } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { period: 'desc' },
    });

    // Compute summary dynamically from actual data
    const summary = {
      totalTaxable: returns.reduce((s, r) => s + r.totalTaxable, 0),
      totalCgst: returns.reduce((s, r) => s + r.totalCgst, 0),
      totalSgst: returns.reduce((s, r) => s + r.totalSgst, 0),
      totalIgst: returns.reduce((s, r) => s + r.totalIgst, 0),
      totalCess: returns.reduce((s, r) => s + r.totalCess, 0),
      totalTax: returns.reduce((s, r) => s + r.totalTax, 0),
      filed: returns.filter(r => r.status === 'FILED').length,
      pending: returns.filter(r => r.status === 'PENDING').length,
    };

    return NextResponse.json({ returns, summary });
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
    const data = gstReturnSchema.parse(body);

    // Compute totalTax from components
    const totalTax = (data.totalCgst ?? 0) + (data.totalSgst ?? 0) + (data.totalIgst ?? 0) + (data.totalCess ?? 0);

    const gstReturn = await prisma.gstReturn.create({
      data: {
        ...data,
        totalTax,
        filingDate: data.filingDate ? new Date(data.filingDate) : null,
        businessId: session.user.businessId,
      },
    });

    return NextResponse.json(gstReturn, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
