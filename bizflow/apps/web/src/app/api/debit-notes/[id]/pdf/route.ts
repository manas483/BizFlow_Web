import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { renderToBuffer } from '@react-pdf/renderer';
import { DebitNoteDocument } from '@/components/pdf/DebitNoteDocument';
import React from 'react';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const note = await prisma.debitNote.findFirst({
      where: { id, businessId: session.user.businessId },
      include: {
        customer: true,
        sale: { select: { invoiceNo: true } },
        business: { select: { name: true, ownerName: true, address: true, gstNumber: true } },
      },
    });
    if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const buf = await renderToBuffer(React.createElement(DebitNoteDocument, { note }) as any);
    const safeDate = new Date(note.createdAt).toISOString().slice(0, 10);
    const safeName = (note.customer?.name || 'customer').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    const filename = `DebitNote-${note.debitNoteNo}_${safeName}_${safeDate}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` },
    });
  } catch (e: any) {
    if (e instanceof AuthError) return e.response;
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
