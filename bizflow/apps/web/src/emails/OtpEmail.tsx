import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Row, Column,
} from "@react-email/components";
import * as React from "react";

interface OtpEmailProps {
  name: string;
  otp: string;
  expiresInMinutes?: number;
}

export function OtpEmail({ name, otp, expiresInMinutes = 10 }: OtpEmailProps) {
  const digits = otp.split("");

  return (
    <Html>
      <Head />
      <Preview>Your BizFlow verification code: {otp}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logo}>BizFlow</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Verify your email address</Heading>
            <Text style={greeting}>Hi {name},</Text>
            <Text style={paragraph}>
              Use the 6-digit code below to verify your BizFlow account. This code expires in{" "}
              <strong>{expiresInMinutes} minutes</strong>.
            </Text>

            {/* OTP Code display */}
            <Section style={otpSection}>
              <Row>
                {digits.map((digit, i) => (
                  <Column key={i} style={otpCell}>
                    <Text style={otpDigit}>{digit}</Text>
                  </Column>
                ))}
              </Row>
            </Section>

            <Text style={paragraph}>
              If you didn&apos;t create a BizFlow account, you can safely ignore this email.
              Someone may have entered your email by mistake.
            </Text>

            <Hr style={hr} />
            <Text style={footer}>
              For security, never share this code with anyone. BizFlow will never ask you
              for your verification code.
            </Text>
          </Section>

          <Section style={footerSection}>
            <Text style={footerText}>
              © {new Date().getFullYear()} BizFlow. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default OtpEmail;

// ── Styles ────────────────────────────────────────────────────────────────────
const main: React.CSSProperties = {
  backgroundColor: "#0a0a0f",
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
};

const container: React.CSSProperties = {
  margin: "0 auto",
  maxWidth: "520px",
};

const header: React.CSSProperties = {
  backgroundColor: "#7c3aed",
  borderRadius: "16px 16px 0 0",
  padding: "24px 32px",
};

const logo: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0",
};

const content: React.CSSProperties = {
  backgroundColor: "#13131f",
  padding: "32px",
  borderRadius: "0 0 16px 16px",
};

const h1: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 16px",
};

const greeting: React.CSSProperties = {
  color: "#a1a1b5",
  fontSize: "15px",
  margin: "0 0 8px",
};

const paragraph: React.CSSProperties = {
  color: "#a1a1b5",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 24px",
};

const otpSection: React.CSSProperties = {
  backgroundColor: "#1e1e2e",
  borderRadius: "12px",
  padding: "20px",
  margin: "0 0 24px",
  textAlign: "center",
};

const otpCell: React.CSSProperties = {
  width: "48px",
  padding: "0 4px",
  textAlign: "center",
};

const otpDigit: React.CSSProperties = {
  backgroundColor: "#2a2a3e",
  border: "2px solid #7c3aed",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: "700",
  lineHeight: "52px",
  margin: "0",
  textAlign: "center",
  display: "block",
};

const hr: React.CSSProperties = {
  borderColor: "#2a2a3e",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  color: "#6b6b80",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
};

const footerSection: React.CSSProperties = {
  padding: "16px 32px",
  textAlign: "center",
};

const footerText: React.CSSProperties = {
  color: "#3a3a50",
  fontSize: "12px",
};
