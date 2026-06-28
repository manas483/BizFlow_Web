import { prisma } from "./src/shared/lib/db";

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { employee: true }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  // test creating a dummy user to see if it hangs
  console.log("Attempting transaction...");
  try {
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.findFirst();
      console.log("Transaction read:", u?.id);
    }, { timeout: 5000 });
    console.log("Transaction success");
  } catch(e) {
    console.error("Transaction failed:", e);
  }
}
main().catch(console.error).finally(() => process.exit(0));
