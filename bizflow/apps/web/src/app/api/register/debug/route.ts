import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  
  if (!email) return NextResponse.json({ error: "No email" });

  try {
    // Delete Employee directly by its OWN email field
    const employeeRes = await prisma.employee.deleteMany({ where: { email } });
    
    // Also delete User and Invitation just in case
    const userRes = await prisma.user.deleteMany({ where: { email } });
    const invRes = await prisma.invitation.deleteMany({ where: { email } });
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted records for ${email}`,
      deletedEmployees: employeeRes.count,
      deletedUsers: userRes.count,
      deletedInvitations: invRes.count
    });
  } catch(e: any) {
    return NextResponse.json({ error: e.message });
  }
}
