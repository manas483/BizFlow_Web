import React from 'react';
import { Html, Body, Head, Heading, Container, Text, Preview, Section, Button } from '@react-email/components';

interface PasswordResetEmailProps {
  resetLink: string;
}

export const PasswordResetEmail = ({ resetLink = '#' }: PasswordResetEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Reset your BizFlow password</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Password Reset Request</Heading>
          <Text style={text}>
            We received a request to reset your BizFlow password. Click the button below to choose a new password:
          </Text>
          <Section style={{ textAlign: 'center' as const, marginTop: '20px' }}>
            <Button style={btn} href={resetLink}>
              Reset Password
            </Button>
          </Section>
          <Text style={text}>
            If you did not request a password reset, please ignore this email. Your password will remain unchanged.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default PasswordResetEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '5px',
  boxShadow: '0 5px 10px rgba(20,50,70,.2)',
  maxWidth: '580px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  padding: '0 40px',
};

const text = {
  color: '#555',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
};

const btn = {
  backgroundColor: '#2563eb',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};
