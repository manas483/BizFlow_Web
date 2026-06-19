import { seedTestDB, cleanTestDB, testPrisma } from './test-db';

async function globalSetup() {
  console.log('--- Playwright Global Setup ---');
  console.log('Seeding test database...');
  await seedTestDB();
  console.log('Test database seeded successfully.');

  return async () => {
    console.log('--- Playwright Global Teardown ---');
    console.log('Cleaning test database...');
    await cleanTestDB();
    await testPrisma.$disconnect();
    console.log('Test database cleaned successfully.');
  };
}

export default globalSetup;
