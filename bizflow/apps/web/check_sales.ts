import { prisma } from './src/shared/lib/db';

async function main() {
  const business = await prisma.business.findFirst();
  console.log("Business ID:", business?.id);
  const salesCount = await prisma.sale.count({ where: { businessId: business?.id } });
  console.log("Sales Count:", salesCount);
  
  const forecast = await prisma.aiForecast.findMany({ where: { businessId: business?.id }});
  console.log("Forecasts in cache:", forecast.map(f => ({ id: f.id, type: f.type, data: JSON.stringify(f.data).substring(0, 50) })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
