import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';
import { requireAuth, AuthError } from '@/shared/lib/api-guard';

// PATCH /api/bill-of-supply/[id] — update payment status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id } = await params;
    const body = await req.json();
    const { paid } = body;

    const existing = await prisma.billOfSupply.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bill of Supply not found' }, { status: 404 });
    }

    const paidAmt = parseFloat(String(paid ?? existing.paid)) || 0;
    const status =
      paidAmt >= existing.total ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid';

    const updated = await prisma.billOfSupply.update({
      where: { id },
      data: { paid: paidAmt, status },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('Update bill of supply error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/bill-of-supply/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id } = await params;

    const existing = await prisma.billOfSupply.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Bill of Supply not found' }, { status: 404 });
    }

    await prisma.billOfSupply.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('Delete bill of supply error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
