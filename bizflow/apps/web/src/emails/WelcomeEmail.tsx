import React from 'react';
import { Html, Body, Head, Heading, Container, Text, Preview, Section, Img, Button } from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
}

export const WelcomeEmail = ({ name = 'User' }: WelcomeEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Welcome to BizFlow! Let's get your business flowing.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to BizFlow, {name}! 🎉</Heading>
          <Text style={text}>
            We're thrilled to have you on board. BizFlow is designed to make managing your sales, inventory, and invoices as seamless as possible.
          </Text>
          <Section style={{ textAlign: 'center' as const, marginTop: '20px' }}>
            <Button style={btn} href="https://bizflow-saas.com/dashboard">
              Go to your Dashboard
            </Button>
          </Section>
          <Text style={text}>
            If you need any help getting started, our support team is just an email away.
          </Text>
          <Text style={footer}>
            Best,<br/>The BizFlow Team
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

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

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 40px',
  marginTop: '20px',
};
