import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, AuthError } from '@/lib/api-guard';
import { z } from 'zod';

const documentSchema = z.object({
  name: z.string().min(1, "Document name is required").max(100),
  docType: z.enum(['AGREEMENT', 'SANCTION', 'KYC', 'PAN', 'AADHAAR', 'PROPERTY', 'OTHER']).default('OTHER'),
  fileData: z.string().min(1, "File content is required"),
  mimeType: z.string().optional().nullable(),
  fileSize: z.coerce.number().int().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
      select: { id: true },
    });
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const documents = await prisma.loanDocument.findMany({
      where: { loanId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        loanId: true,
        name: true,
        docType: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
        // Exclude fileData from index GET calls to save bandwidth. We can fetch fileData separately or include it,
        // but since we want to be able to download, including it is fine for base64 prototype storage.
        fileData: true,
      }
    });

    return NextResponse.json(documents);
  } catch (error) {
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const loan = await prisma.loanMaster.findFirst({
      where: { id, businessId: session.user.businessId },
      select: { id: true },
    });
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const body = await req.json();
    const data = documentSchema.parse(body);

    const doc = await prisma.loanDocument.create({
      data: {
        loanId: id,
        name: data.name,
        docType: data.docType,
        fileData: data.fileData,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
    if (error instanceof AuthError) return error.response;
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
