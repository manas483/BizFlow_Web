import React from 'react';
import { Html, Head, Body, Container, Section, Text, Hr } from '@react-email/components';

interface PaymentReminderEmailProps {
  customerName: string;
  invoiceRef: string;
  amount: number;
  dueDate: string;
  businessName?: string;
}

export function PaymentReminderEmail({
  customerName,
  invoiceRef,
  amount,
  dueDate,
  businessName = 'BizFlow',
}: PaymentReminderEmailProps) {
  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#0a0a0f', fontFamily: 'Inter, system-ui, sans-serif', color: '#ffffff' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: '#1a1a2e', borderRadius: '16px', padding: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
              ⏰ Payment Reminder
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6' }}>
              Dear {customerName},
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6' }}>
              This is a friendly reminder that payment of <strong style={{ color: '#8b5cf6' }}>{formattedAmount}</strong> for
              invoice <strong style={{ color: '#ffffff' }}>{invoiceRef}</strong> was due on <strong>{dueDate}</strong>.
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6' }}>
              Please arrange the payment at your earliest convenience to avoid any service disruptions.
            </Text>
            <Hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '24px 0' }} />
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              — {businessName}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default PaymentReminderEmail;
