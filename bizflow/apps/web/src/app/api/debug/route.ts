import { NextResponse } from "next/server";
import { prisma } from "@/shared/lib/db";

export async function GET() {
  try {
    // Fetch ALL products in the whole DB
    const allProducts = await prisma.product.findMany({ select: { id: true, businessId: true, name: true, createdAt: true, category: true }});
    
    // Fetch all businesses
    const businesses = await prisma.business.findMany({ select: { id: true, name: true }});

    // Fetch all users
    const users = await prisma.user.findMany({ select: { id: true, email: true, businessId: true }});
    
    return NextResponse.json({
      allProductsSummary: allProducts,
      businesses,
      users
    });
  } catch (error: any) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
