import { prisma } from './src/shared/lib/db';
async function main() {
  try {
    const email = 'pratikkumarsinghdevsachan@gmail.com';
    await prisma.employee.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.invitation.deleteMany({ where: { email } });
    console.log('Deleted successfully');
  } catch(e) {
    console.error('Delete failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
