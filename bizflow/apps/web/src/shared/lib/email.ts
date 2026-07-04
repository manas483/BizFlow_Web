import { Resend } from 'resend';
import React from 'react';
import { WelcomeEmail } from '@/emails/WelcomeEmail';
import { OtpEmail } from '@/emails/OtpEmail';
import { LowStockEmail } from '@/emails/LowStockEmail';
import { InvoiceEmail } from '@/emails/InvoiceEmail';
import { PasswordResetEmail } from '@/emails/PasswordResetEmail';
import { MonthlyReportEmail } from '@/emails/MonthlyReportEmail';
import { EmployeeInvitationEmail } from '@/emails/EmployeeInvitationEmail';
import { PaymentReminderEmail } from '@/emails/PaymentReminderEmail';
import { GstReminderEmail } from '@/emails/GstReminderEmail';

if (!process.env.RESEND_API_KEY && process.env.NODE_ENV === 'production') {
  console.warn('RESEND_API_KEY is missing. Email features will fail.');
}
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_for_build');

// H-N7 FIX: Read sender address from environment variable (configurable without redeploy)
const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'BizFlow <noreply@bizflow.littleryders.com>';

export async function sendWelcomeEmail(to: string, name: string) {
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

export async function sendPaymentReminder(to: string, customerName: string, invoiceRef: string, amount: number, dueDate: string, businessName?: string) {
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: `⏰ Payment Reminder: ${invoiceRef}`,
      react: React.createElement(PaymentReminderEmail, { customerName, invoiceRef, amount, dueDate, businessName }),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send payment reminder:', error);
    return { success: false, error };
  }
}

export async function sendGstReminder(to: string, businessName: string, period: string, returnType: string) {
  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject: `📋 GST Filing Reminder: ${returnType} for ${period}`,
      react: React.createElement(GstReminderEmail, { businessName, period, returnType }),
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send GST reminder:', error);
    return { success: false, error };
  }
}
