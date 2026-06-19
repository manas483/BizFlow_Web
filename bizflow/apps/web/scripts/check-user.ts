import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  const email = 'sachan.manas483@gmail.com';
  const user = await prisma.user.findUnique({
    where: { email }
  });
  
  if (user) {
    console.log(`User found: ${user.id} - ${user.name}`);
  } else {
    console.log(`User NOT found for email: ${email}`);
  }
}

checkUser().catch(console.error).finally(() => prisma.$disconnect());
