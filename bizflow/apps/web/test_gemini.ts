import { generateForecast } from './src/shared/lib/gemini';
import { prisma } from './src/shared/lib/db';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

async function main() {
  const business = await prisma.business.findFirst();
  console.log("Business ID:", business?.id);
  if (!business) return;

  // Clear cache first
  await prisma.aiForecast.deleteMany({ where: { businessId: business.id } });
  console.log("Cache cleared.");

  // Generate forecast
  const forecast = await generateForecast(business.id);
  console.log("Forecast Result:", JSON.stringify(forecast, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
