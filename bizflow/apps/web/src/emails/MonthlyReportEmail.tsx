import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

interface MonthlyReportEmailProps {
  businessName: string;
  month: string;
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  profitOrLoss: number;
}

export const MonthlyReportEmail = ({
  businessName,
  month,
  totalSales,
  totalPurchases,
  totalExpenses,
  profitOrLoss,
}: MonthlyReportEmailProps) => {
  const isProfit = profitOrLoss >= 0;

  return (
    <Html>
      <Head />
      <Preview>Monthly P&L Summary for {month} - {businessName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>BizFlow Monthly Report</Heading>
          
          <Text style={text}>
            Hello {businessName} Admin,
          </Text>
          <Text style={text}>
            Here is your Profit & Loss summary for <strong>{month}</strong>.
          </Text>

          <Section style={dataSection}>
            <Text style={dataRow}>
              <strong>Total Sales:</strong> <span style={amountVal}>₹{totalSales.toFixed(2)}</span>
            </Text>
            <Text style={dataRow}>
              <strong>Total Purchases:</strong> <span style={amountVal}>₹{totalPurchases.toFixed(2)}</span>
            </Text>
            <Text style={dataRow}>
              <strong>Total Expenses:</strong> <span style={amountVal}>₹{totalExpenses.toFixed(2)}</span>
            </Text>
            <hr style={hr} />
            <Text style={dataRow}>
              <strong>{isProfit ? "Net Profit:" : "Net Loss:"}</strong>{" "}
              <span style={{ ...amountVal, color: isProfit ? "#16a34a" : "#dc2626" }}>
                ₹{Math.abs(profitOrLoss).toFixed(2)}
              </span>
            </Text>
          </Section>

          <Text style={text}>
            For a more detailed breakdown, please log in to your BizFlow dashboard.
          </Text>

          <Text style={footer}>
            © {new Date().getFullYear()} BizFlow SaaS. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default MonthlyReportEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
};

const h1 = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "40px",
  margin: "0 0 20px",
  padding: "0 48px",
};

const text = {
  color: "#334155",
  fontSize: "16px",
  lineHeight: "24px",
  padding: "0 48px",
};

const dataSection = {
  backgroundColor: "#f8fafc",
  padding: "24px 48px",
  margin: "24px 0",
  borderTop: "1px solid #e2e8f0",
  borderBottom: "1px solid #e2e8f0",
};

const dataRow = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "16px",
  color: "#1e293b",
  margin: "8px 0",
};

const amountVal = {
  fontWeight: "bold",
};

const hr = {
  borderColor: "#cbd5e1",
  margin: "16px 0",
};

const footer = {
  color: "#64748b",
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 48px",
  marginTop: "32px",
};
