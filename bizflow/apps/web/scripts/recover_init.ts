import { prisma } from '../src/shared/lib/db';

async function main() {
  console.log('Initializing Business and User...');
  
  let business = await prisma.business.findFirst({
    where: { name: 'BizFlow' }
  });

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'BizFlow',
        ownerName: 'Manas Ranjan Singh',
        phone: '1234567890',
        businessType: 'Retail',
        onboardingCompleted: true,
      }
    });
    console.log('Created Business:', business.id);
  } else {
    console.log('Found Business:', business.id);
  }

  let user = await prisma.user.findFirst({
    where: { email: 'sachan.manas483@gmail.com' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'sachan.manas483@gmail.com',
        name: 'Manas Ranjan Singh',
        role: 'SUPER_ADMIN',
        businessId: business.id,
      }
    });
    console.log('Created User:', user.email);
  } else {
    console.log('Found User:', user.email);
  }

  // Also create a test user just in case
  let testUser = await prisma.user.findFirst({
    where: { email: 'test@example.com' }
  });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test Admin',
        role: 'SUPER_ADMIN',
        businessId: business.id,
      }
    });
    console.log('Created Test User:', testUser.email);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
