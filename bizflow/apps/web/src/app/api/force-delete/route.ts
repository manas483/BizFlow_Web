import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const employees = await prisma.employee.findMany();
    return NextResponse.json(employees);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
