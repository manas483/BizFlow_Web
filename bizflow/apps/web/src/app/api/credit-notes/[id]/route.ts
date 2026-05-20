import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['SUPER_ADMIN', 'MANAGER']);
    const { id } = await params;

    const existing = await prisma.creditNote.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Credit note not found' }, { status: 404 });
    }

    await prisma.creditNote.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error('Delete credit note error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
