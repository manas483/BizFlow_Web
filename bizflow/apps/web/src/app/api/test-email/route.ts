import { NextRequest, NextResponse } from 'next/server';
import { sendEmployeeInvitationEmail } from '@/shared/lib/email';

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    const result = await sendEmployeeInvitationEmail(
      'test@example.com',
      'Test User',
      'MANAGER',
      'http://localhost:3000/accept-invitation?token=123',
      'Test Business'
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
