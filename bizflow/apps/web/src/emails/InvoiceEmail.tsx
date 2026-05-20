import React from 'react';
import { Html, Body, Head, Heading, Container, Text, Preview } from '@react-email/components';

interface InvoiceEmailProps {
  customerName: string;
  invoiceNo: string;
  amount: number;
}

export const InvoiceEmail = ({ customerName = 'Customer', invoiceNo = 'INV-001', amount = 0 }: InvoiceEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your invoice {invoiceNo} from BizFlow</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Thank you for your business, {customerName}!</Heading>
          <Text style={text}>
            We appreciate your prompt payment. Please find your invoice <strong>{invoiceNo}</strong> for the amount of <strong>₹{amount.toFixed(2)}</strong> attached to this email.
          </Text>
          <Text style={text}>
            If you have any questions regarding this invoice, please do not hesitate to contact us.
          </Text>
          <Text style={footer}>
            Best regards,<br/>The BizFlow Team
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default InvoiceEmail;

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

const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 40px',
  marginTop: '20px',
};
