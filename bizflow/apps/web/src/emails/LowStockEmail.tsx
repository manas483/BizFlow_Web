import React from 'react';
import { Html, Body, Head, Heading, Container, Text, Preview, Section, Button } from '@react-email/components';

interface LowStockEmailProps {
  productName: string;
  stock: number;
}

export const LowStockEmail = ({ productName = 'Product', stock = 0 }: LowStockEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>🚨 Low Stock Alert: {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Low Stock Alert</Heading>
          <Text style={text}>
            Attention Manager,
          </Text>
          <Text style={text}>
            The product <strong>{productName}</strong> is running low on inventory.
          </Text>
          <Section style={alertBox}>
            <Text style={alertText}>Current Stock: {stock}</Text>
          </Section>
          <Text style={text}>
            Please review the inventory and restock if necessary.
          </Text>
          <Section style={{ textAlign: 'center' as const, marginTop: '20px' }}>
            <Button style={btn} href="https://bizflow-saas.com/inventory">
              View Inventory
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default LowStockEmail;

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
  color: '#e11d48', // rose-600
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

const alertBox = {
  backgroundColor: '#ffe4e6', // rose-100
  borderRadius: '8px',
  padding: '12px',
  margin: '20px 40px',
  textAlign: 'center' as const,
};

const alertText = {
  color: '#be123c', // rose-700
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0',
};

const btn = {
  backgroundColor: '#e11d48',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};
