import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
  const { sendEmployeeInvitationEmail } = await import('./src/shared/lib/email');
  console.log('Sending email...');
  const result = await sendEmployeeInvitationEmail(
    'test@example.com',
    'Test User',
    'MANAGER',
    'http://localhost:3000/accept-invitation?token=123',
    'Test Business'
  );
  console.log(result);
}

main().catch(console.error);
