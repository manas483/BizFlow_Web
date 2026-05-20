import { Resend } from 'resend';
import React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY);

// H-N7 FIX: Read sender address from environment variable (configurable without redeploy)
const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'BizFlow <noreply@bizflow.littleryders.com>';

export async function sendWelcomeEmail(to: string, name: string) {
  // We will dynamic import the React template to prevent SSR issues or circular dependencies sometimes
  const { WelcomeEmail } = await import('@/emails/WelcomeEmail');
  
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: 'Welcome to BizFlow! 🎉',
      react: React.createElement(WelcomeEmail, { name }),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    return { success: false, error };
  }
}

export async function sendOtpEmail(to: string, name: string, otp: string) {
  const { OtpEmail } = await import('@/emails/OtpEmail');

  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: `${otp} is your BizFlow verification code`,
      react: React.createElement(OtpEmail, { name, otp, expiresInMinutes: 10 }),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    return { success: false, error };
  }
}

export async function sendLowStockAlert(to: string, productName: string, stock: number) {
  const { LowStockEmail } = await import('@/emails/LowStockEmail');
  
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: `🚨 Low Stock Alert: ${productName}`,
      react: React.createElement(LowStockEmail, { productName, stock }),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send low stock alert:', error);
    return { success: false, error };
  }
}

export async function sendInvoiceEmail(to: string, customerName: string, invoiceNo: string, amount: number, pdfBuffer: Uint8Array) {
  const { InvoiceEmail } = await import('@/emails/InvoiceEmail');
  
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: `Invoice ${invoiceNo} from BizFlow`,
      react: React.createElement(InvoiceEmail, { customerName, invoiceNo, amount }),
      attachments: [
        {
          filename: `${invoiceNo}.pdf`,
          content: Buffer.from(pdfBuffer),
        }
      ]
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const { PasswordResetEmail } = await import('@/emails/PasswordResetEmail');
  
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: 'Reset your BizFlow password',
      react: React.createElement(PasswordResetEmail, { resetLink }),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error };
  }
}

export async function sendMonthlyReportEmail(to: string, businessName: string, month: string, totalSales: number, totalPurchases: number, totalExpenses: number, profitOrLoss: number) {
  const { MonthlyReportEmail } = await import('@/emails/MonthlyReportEmail');
  
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: `Monthly P&L Report: ${month}`,
      react: React.createElement(MonthlyReportEmail, { businessName, month, totalSales, totalPurchases, totalExpenses, profitOrLoss }),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send monthly report email:', error);
    return { success: false, error };
  }
}

export async function sendEmployeeInvitationEmail(to: string, name: string, role: string, inviteLink: string, businessName?: string) {
  const { EmployeeInvitationEmail } = await import('@/emails/EmployeeInvitationEmail');
  
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: `You've been invited to join ${businessName || 'BizFlow'} 🎉`,
      react: React.createElement(EmployeeInvitationEmail, { name, role, inviteLink, businessName }),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send employee invitation email:', error);
    return { success: false, error };
  }
}
