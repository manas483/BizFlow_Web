export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';
import { tdsEntrySchema } from '@/shared/lib/validations';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const entries = await prisma.tdsEntry.findMany({
      where: {
        businessId: session.user.businessId,
        ...(section ? { section } : {}),
        ...(status ? { status } : {}),
        ...(from || to ? {
          paymentDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        } : {}),
      },
      orderBy: { paymentDate: 'desc' },
    });

    // Dynamically compute summary from fetched data
    const totalTds = entries.reduce((s, e) => s + e.tdsAmount, 0);
    const totalPayments = entries.reduce((s, e) => s + e.paymentAmount, 0);

    // Group by section dynamically
    const bySection = entries.reduce((map, e) => {
      if (!map[e.section]) map[e.section] = { count: 0, tdsAmount: 0, paymentAmount: 0 };
      map[e.section].count += 1;
      map[e.section].tdsAmount += e.tdsAmount;
      map[e.section].paymentAmount += e.paymentAmount;
      return map;
    }, {} as Record<string, { count: number; tdsAmount: number; paymentAmount: number }>);

    return NextResponse.json({
      entries,
      summary: {
        totalTds: Math.round(totalTds * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        deposited: entries.filter(e => e.status === 'DEPOSITED').length,
        pending: entries.filter(e => e.status === 'DEDUCTED').length,
        bySection,
      },
    });
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
    const data = tdsEntrySchema.parse(body);

    const entry = await prisma.tdsEntry.create({
      data: {
        ...data,
        paymentDate: new Date(data.paymentDate),
        depositDate: data.depositDate ? new Date(data.depositDate) : null,
        businessId: session.user.businessId,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

