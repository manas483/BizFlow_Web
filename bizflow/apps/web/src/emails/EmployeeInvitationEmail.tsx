import { Html, Head, Preview, Body, Container, Text, Button, Section, Hr, Row, Column } from '@react-email/components';
import React from 'react';

interface EmployeeInvitationEmailProps {
  name: string;
  role: string;
  inviteLink: string;
  businessName?: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  MANAGER: "Manager",
  ACCOUNTANT: "Accountant",
  STAFF: "Staff",
  CUSTOM_ROLE: "Custom Role",
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["Full system access", "Manage employees", "Manage inventory", "View reports", "Manage billing"],
  MANAGER: ["View dashboard", "Manage inventory", "Manage sales", "Manage customers", "View reports"],
  ACCOUNTANT: ["View dashboard", "View reports", "Manage sales", "Manage billing", "Process payments"],
  STAFF: ["View dashboard", "Manage inventory", "Manage sales"],
  CUSTOM_ROLE: ["View dashboard"],
};

export const EmployeeInvitationEmail = ({ name, role, inviteLink, businessName = "BizFlow" }: EmployeeInvitationEmailProps) => {
  const roleLabel = ROLE_LABELS[role] || role.replace('_', ' ');
  const permissions = ROLE_PERMISSIONS[role] || ["View dashboard"];

  return (
    <Html>
      <Head />
      <Preview>You've been invited to join {businessName} on BizFlow 🎉</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>BizFlow</Text>
          </Section>

          {/* Greeting */}
          <Text style={h1}>Welcome to {businessName}, {name}! 🎉</Text>

          <Text style={text}>
            You've been invited to join <strong>{businessName}</strong> on BizFlow as a{" "}
            <strong>{roleLabel}</strong>.
          </Text>

          <Text style={text}>
            Click the button below to set your password and activate your account. This invitation link expires in <strong>7 days</strong>.
          </Text>

          {/* CTA Button */}
          <Section style={btnContainer}>
            <Button style={button} href={inviteLink}>
              Accept Invitation & Set Password
            </Button>
          </Section>

          <Hr style={divider} />

          {/* Role & Access Details */}
          <Text style={sectionTitle}>Your Access Details</Text>
          <Section style={accessCard}>
            <Row>
              <Column>
                <Text style={accessLabel}>ASSIGNED ROLE</Text>
                <Text style={accessValue}>{roleLabel}</Text>
              </Column>
            </Row>
            <Text style={accessLabel}>YOUR PERMISSIONS</Text>
            {permissions.map((perm, i) => (
              <Text key={i} style={permItem}>✓ {perm}</Text>
            ))}
          </Section>

          <Hr style={divider} />

          {/* Setup Instructions */}
          <Text style={sectionTitle}>How to Get Started</Text>
          <Text style={instructionItem}>
            <strong>1.</strong> Click the "Accept Invitation" button above.
          </Text>
          <Text style={instructionItem}>
            <strong>2.</strong> Set a strong password for your account.
          </Text>
          <Text style={instructionItem}>
            <strong>3.</strong> Your email will be automatically verified.
          </Text>
          <Text style={instructionItem}>
            <strong>4.</strong> Log in and start managing your work.
          </Text>

          <Hr style={divider} />

          {/* Fallback link */}
          <Text style={smallText}>
            If the button above doesn't work, copy and paste this link into your browser:
          </Text>
          <Text style={linkText}>{inviteLink}</Text>

          <Text style={smallText}>
            If you did not expect this invitation, you can safely ignore this email. The link will expire automatically.
          </Text>

          <Hr style={divider} />

          <Text style={footer}>
            © 2026 BizFlow SaaS · This is an automated email, please do not reply.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f0f4ff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  padding: '20px 0',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '600px',
  borderRadius: '12px',
  overflow: 'hidden' as const,
  border: '1px solid #e2e8f0',
};

const header = {
  backgroundColor: '#4f46e5',
  padding: '24px 40px',
};

const logo = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: '700' as const,
  margin: '0',
  letterSpacing: '-0.5px',
};

const h1 = {
  color: '#1a1a2e',
  fontSize: '24px',
  fontWeight: '700' as const,
  lineHeight: '32px',
  margin: '32px 40px 16px',
};

const text = {
  color: '#4b5563',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 40px 16px',
};

const btnContainer = {
  textAlign: 'center' as const,
  margin: '24px 40px 32px',
};

const button = {
  backgroundColor: '#4f46e5',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '15px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  padding: '14px 32px',
  display: 'inline-block',
};

const divider = {
  borderColor: '#e2e8f0',
  margin: '0 40px',
};

const sectionTitle = {
  color: '#1a1a2e',
  fontSize: '13px',
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '24px 40px 12px',
};

const accessCard = {
  backgroundColor: '#f8f9ff',
  border: '1px solid #e2e8ff',
  borderRadius: '8px',
  margin: '0 40px',
  padding: '16px',
};

const accessLabel = {
  color: '#6b7280',
  fontSize: '11px',
  fontWeight: '600' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px',
};

const accessValue = {
  color: '#4f46e5',
  fontSize: '16px',
  fontWeight: '700' as const,
  margin: '0 0 16px',
};

const permItem = {
  color: '#374151',
  fontSize: '13px',
  margin: '2px 0',
  lineHeight: '20px',
};

const instructionItem = {
  color: '#4b5563',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 40px 8px',
};

const smallText = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '16px 40px 8px',
};

const linkText = {
  color: '#4f46e5',
  fontSize: '12px',
  margin: '0 40px 16px',
  wordBreak: 'break-all' as const,
};

const footer = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '16px 40px 24px',
  textAlign: 'center' as const,
};
