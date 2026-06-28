import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function main() {
  const { sendEmployeeInvitationEmail } = await import('./apps/web/src/shared/lib/email.ts');
  const result = await sendEmployeeInvitationEmail(
    'test@example.com',
    'Test User',
    'MANAGER',
    'http://localhost:3000/accept-invitation?token=123',
    'Test Business'
  );
  console.log(result);
}
main();
