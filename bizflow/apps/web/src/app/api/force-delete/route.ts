import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  
  if (!email) return NextResponse.json({ error: 'No email provided' }, { status: 400 });

  try {
    await prisma.employee.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.invitation.deleteMany({ where: { email } });
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted all records for ${email}` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
