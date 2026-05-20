import { NextResponse } from "next/server";
import { requireAuth, withAuth, AuthError } from "@/lib/api-guard";
import { prisma } from "@/lib/db";
import { getBusinessProfile, getOnboardingConfig } from "@/lib/business-intelligence";

export const POST = withAuth(async () => {
  try {
    const session = await requireAuth();
    const businessId = session.user.businessId;

    // Fetch business
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) return NextResponse.json({ message: "Business not found" }, { status: 404 });

    // Already onboarded — skip
    if (business.onboardingCompleted) {
      return NextResponse.json({ message: "Already onboarded", skipped: true });
    }

    const profile = getBusinessProfile(business.businessType);
    const config = getOnboardingConfig(business.businessType);

    await prisma.$transaction(async (tx: any) => {
      // 1. We no longer seed hardcoded products to ensure a clean slate for the user.
      const existingCount = await tx.product.count({ where: { businessId } });
      // Removed hardcoded product generation

      // 2. Seed starter expense categories as sample expenses (skip if any exist)
      const expenseCount = await tx.expense.count({ where: { businessId } });
      if (expenseCount === 0 && profile.expenseCategories.length > 0) {
        await tx.expense.create({
          data: {
            category: profile.expenseCategories[0],
            amount: 0,
            note: "Sample expense — update with real value",
            date: new Date(),
            businessId,
          },
        });
      }

      // 3. Save onboardingConfig to business
      await tx.business.update({
        where: { id: businessId },
        data: {
          onboardingCompleted: true,
          onboardingConfig: config,
        },
      });

      // 4. Create welcome notification
      await tx.notification.create({
        data: {
          type: "system",
          title: `Welcome to BizFlow ${profile.emoji}`,
          message: `Your ${profile.displayName} is configured! You can now start adding your own products and inventory. ${profile.tagline}`,
          businessId,
        },
      });
    });

    return NextResponse.json({ success: true, profile: { displayName: profile.displayName, emoji: profile.emoji, seedCount: profile.seedProducts.length } });
  } catch (error) {
    if (error instanceof AuthError) throw error;
    console.error("Onboarding seed error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
