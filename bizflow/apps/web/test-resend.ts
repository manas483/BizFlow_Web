import { Resend } from 'resend';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

console.log('API KEY:', process.env.RESEND_API_KEY);

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  try {
    const data = await resend.emails.send({
      from: 'BizFlow <noreply@biz.littleryders.com>',
      to: 'test@example.com',
      subject: 'Test Email',
      html: '<p>Test</p>'
    });
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
main();
