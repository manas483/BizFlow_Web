import React from 'react';
import { Html, Head, Body, Container, Section, Text, Hr } from '@react-email/components';

interface GstReminderEmailProps {
  businessName: string;
  period: string;
  returnType: string;
}

export function GstReminderEmail({
  businessName,
  period,
  returnType,
}: GstReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#0a0a0f', fontFamily: 'Inter, system-ui, sans-serif', color: '#ffffff' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 20px' }}>
          <Section style={{ backgroundColor: '#1a1a2e', borderRadius: '16px', padding: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
              📋 GST Filing Reminder
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6' }}>
              Hi {businessName},
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6' }}>
              Your <strong style={{ color: '#8b5cf6' }}>{returnType}</strong> return for
              period <strong style={{ color: '#ffffff' }}>{period}</strong> is pending filing.
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6' }}>
              Please ensure timely filing to avoid penalties. Log in to BizFlow to review and
              prepare your return data.
            </Text>
            <Hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '24px 0' }} />
            <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              — BizFlow Compliance
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default GstReminderEmail;
