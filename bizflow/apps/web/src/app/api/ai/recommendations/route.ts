import { NextResponse } from "next/server";
import { requireAuth, withAuth, AuthError } from "@/shared/lib/api-guard";
import { generateRecommendations } from "@/shared/lib/ml-engine";

export const GET = withAuth(async () => {
  try {
    const session = await requireAuth();
    const result = await generateRecommendations(session.user.businessId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) throw error;
    console.error("Recommendations error:", error);
    return NextResponse.json({ productRecommendations: [], quickActions: [], insights: [], reorderAlerts: [] });
  }
});
