/**
 * WhatsApp Click-to-Chat — free integration using wa.me URLs.
 *
 * No API costs. User manually presses send in WhatsApp.
 * Generates pre-filled messages with invoice details.
 */

// ── URL Generator ────────────────────────────────────────────────────────────

/**
 * Generate a WhatsApp Click-to-Chat URL.
 *
 * @param phone   Customer phone number (any format — auto-cleaned)
 * @param message Pre-filled message text
 * @returns       WhatsApp URL that opens in a new tab
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  // Remove all non-digit chars
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 0, assume Indian number — prepend 91
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1);
  }

  // If 10 digits (no country code), assume Indian — prepend 91
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }

  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

// ── Message Templates ────────────────────────────────────────────────────────

/**
 * Format an invoice notification message for WhatsApp.
 */
export function formatInvoiceMessage(params: {
  customerName: string;
  invoiceNo: string;
  amount: number;
  companyName: string;
  pdfUrl?: string;
}): string {
  const { customerName, invoiceNo, amount, companyName, pdfUrl } = params;

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

  let message = `Dear ${customerName},\n\n`;
  message += `Your invoice *${invoiceNo}* for *${formattedAmount}* has been generated.\n\n`;

  if (pdfUrl) {
    message += `📄 Invoice PDF: ${pdfUrl}\n\n`;
  }

  message += `Thank you for your business!\n`;
  message += `— ${companyName}`;

  return message;
}

/**
 * Format a payment reminder message for WhatsApp.
 */
export function formatPaymentReminderMessage(params: {
  customerName: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
  companyName: string;
}): string {
  const { customerName, invoiceNo, amount, dueDate, companyName } = params;

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

  let message = `Dear ${customerName},\n\n`;
  message += `This is a friendly reminder that payment of *${formattedAmount}* for invoice *${invoiceNo}* is due on *${dueDate}*.\n\n`;
  message += `Please arrange the payment at your earliest convenience.\n\n`;
  message += `Thank you,\n${companyName}`;

  return message;
}

/**
 * Format a quotation message for WhatsApp.
 */
export function formatQuotationMessage(params: {
  customerName: string;
  quotationNo: string;
  amount: number;
  validUntil?: string;
  companyName: string;
}): string {
  const { customerName, quotationNo, amount, validUntil, companyName } = params;

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);

  let message = `Dear ${customerName},\n\n`;
  message += `We've prepared quotation *${quotationNo}* for *${formattedAmount}*.\n\n`;

  if (validUntil) {
    message += `This quotation is valid until *${validUntil}*.\n\n`;
  }

  message += `Please review and let us know if you'd like to proceed.\n\n`;
  message += `Best regards,\n${companyName}`;

  return message;
}
