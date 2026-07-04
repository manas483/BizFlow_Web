import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const business = await prisma.business.findFirst({
    where: { name: 'BizFlow' }
  });
  
  if (!business) {
      console.log('No BizFlow business found.');
      return;
  }
  
  console.log(`BizFlow Business ID: ${business.id}`);

  const user = await prisma.user.findFirst({
    where: { email: 'sachan.manas483@gmail.com' },
    include: { business: true }
  });

  if (!user) {
    console.log('User sachan.manas483@gmail.com NOT found.');
  } else {
    console.log(`User found: ${user.email}, Role: ${user.role}, BusinessId: ${user.businessId}`);
    if (user.businessId === business.id) {
        console.log('User IS linked to the BizFlow business that contains the recovered data.');
    } else {
        console.log('User IS NOT linked to the correct BizFlow business!');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
