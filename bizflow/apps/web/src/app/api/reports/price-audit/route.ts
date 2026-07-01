import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/lib/db";
import { requireAuth } from "@/shared/lib/api-guard";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    // Fetch sale items where price is less than originalPrice
    // and originalPrice is set (not null/zero if it means something else, but let's just check originalPrice > price)
    const overrides = await prisma.saleItem.findMany({
      where: {
        sale: { businessId: session.user.businessId },
        originalPrice: { not: null }
      },
      include: {
        product: { select: { name: true, sku: true } },
        sale: { 
          select: { 
            invoiceNo: true, 
            workflowState: true, 
            approvedBy: true
          } 
        }
      },
      orderBy: { sale: { createdAt: 'desc' } },
      take: 200
    });

    const filtered = overrides.filter(o => o.originalPrice && o.originalPrice > o.price);

    return NextResponse.json(filtered);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
