import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/shared/lib/api-guard';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await requireAuth();
    const { businessId } = session.user;

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required in the query parameters.' },
        { status: 400 }
      );
    }

    if (!request.body) {
      return NextResponse.json(
        { error: 'Request body is required.' },
        { status: 400 }
      );
    }

    const blob = await put(`${businessId}/${filename}`, request.body, {
      access: 'public', // Set to public for easy viewing/downloading in UI
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error('Error uploading file to Vercel Blob:', error);
    return NextResponse.json(
      { error: 'Failed to upload file.' },
      { status: 500 }
    );
  }
}
