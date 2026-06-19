import { prisma } from './src/database/prisma-client';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from './src/shared/ui/pdf/InvoiceDocument';
import React from 'react';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const sale = await prisma.sale.findFirst({
      include: {
        customer: true,
        business: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!sale) {
      console.log('No sale found in the database. Please create a sale first.');
      return;
    }

    console.log(`Found sale: ID=${sale.id}, InvoiceNo=${sale.invoiceNo}`);
    console.log('Generating PDF...');

    const pdfBuffer = await renderToBuffer(
      React.createElement(InvoiceDocument, {
        sale: sale as any,
        copyLabel: 'Original for Buyer'
      }) as any
    );

    const dest = path.join(__dirname, 'test-invoice.pdf');
    fs.writeFileSync(dest, pdfBuffer);
    console.log(`Success! PDF written to: ${dest}`);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
