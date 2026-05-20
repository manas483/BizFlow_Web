import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

/* ── Amount in Words (Indian system) ──────────────────────── */
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function toWords(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
  if (n < 100000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
  if (n < 10000000) return toWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + toWords(n % 100000) : '');
  return toWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + toWords(n % 10000000) : '');
}

function amountInWords(amount: number) {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  return 'Indian Rupee ' + toWords(rupees) + (paise > 0 ? ' and ' + toWords(paise) + ' Paise' : '') + ' Only';
}

// Map state names to GST codes loosely
const GST_STATE_CODES: Record<string, string> = {
  "Jammu and Kashmir": "01", "Himachal Pradesh": "02", "Punjab": "03", "Chandigarh": "04",
  "Uttarakhand": "05", "Haryana": "06", "Delhi": "07", "Rajasthan": "08", "Uttar Pradesh": "09",
  "Bihar": "10", "Sikkim": "11", "Arunachal Pradesh": "12", "Nagaland": "13", "Manipur": "14",
  "Mizoram": "15", "Tripura": "16", "Meghalaya": "17", "Assam": "18", "West Bengal": "19",
  "Jharkhand": "20", "Odisha": "21", "Chhattisgarh": "22", "Madhya Pradesh": "23", "Gujarat": "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26", "Maharashtra": "27", "Karnataka": "29",
  "Goa": "30", "Lakshadweep": "31", "Kerala": "32", "Tamil Nadu": "33", "Puducherry": "34",
  "Andaman and Nicobar Islands": "35", "Telangana": "36", "Andhra Pradesh": "37", "Ladakh": "38"
};

const BORDER_COLOR = '#000';

const s = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000',
    backgroundColor: '#fff'
  },
  bold: { fontFamily: 'Helvetica-Bold', fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },

  // Outer Border
  container: {
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    flex: 1,
    flexDirection: 'column'
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR,
  },
  titleText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center'
  },
  headerRight: {
    width: 150,
    alignItems: 'flex-end',
  },
  headerLeft: {
    width: 200,
    justifyContent: 'flex-end',
    fontSize: 8
  },

  // Two column layout
  topGrid: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR,
  },
  colLeft: {
    width: '50%',
    borderRightWidth: 1,
    borderColor: BORDER_COLOR,
  },
  colRight: {
    width: '50%',
  },

  // Sections inside columns
  section: {
    borderBottomWidth: 1,
    borderColor: BORDER_COLOR,
    padding: 4,
  },
  sectionNoBorder: {
    padding: 4,
    flexGrow: 1
  },

  label: { fontSize: 8, color: '#333' },
  value: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  text: { fontSize: 9, marginTop: 2 },

  // Right grid rows
  rRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER_COLOR },
  rRowLast: { flexDirection: 'row', flexGrow: 1 },
  rCol: { width: '50%', padding: 4, borderRightWidth: 1, borderColor: BORDER_COLOR },
  rColLast: { width: '50%', padding: 4 },

  // Items Table
  table: { flex: 1, flexDirection: 'column' },
  thRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER_COLOR },
  th: { padding: 4, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', borderRightWidth: 1, borderColor: BORDER_COLOR },
  thLast: { padding: 4, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center' },

  tr: { flexDirection: 'row' },
  td: { padding: 4, paddingVertical: 4, fontSize: 9, borderRightWidth: 1, borderColor: BORDER_COLOR },
  tdLast: { padding: 4, paddingVertical: 4, fontSize: 9 },

  // Columns Widths
  wSl: { width: '6%' },
  wDesc: { width: '34%' },
  wHsn: { width: '8%', textAlign: 'center' },
  wQty: { width: '8%', textAlign: 'center' },
  wRate: { width: '10%', textAlign: 'right' },
  wDisc: { width: '8%', textAlign: 'right' },
  wTax: { width: '11%', textAlign: 'right' },
  wAmt: { width: '15%', textAlign: 'right' },

  // Total Row
  totRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: BORDER_COLOR },
  totText: { textAlign: 'right', padding: 4, fontFamily: 'Helvetica-Bold', fontSize: 9 },

  // Words
  wordsBox: { borderBottomWidth: 1, borderColor: BORDER_COLOR, padding: 4, flexDirection: 'row', justifyContent: 'space-between' },

  // Tax Table
  taxHead: { flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER_COLOR },
  taxTh: { padding: 4, fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'center', borderRightWidth: 1, borderColor: BORDER_COLOR },
  taxTd: { padding: 4, fontSize: 8, textAlign: 'right', borderRightWidth: 1, borderColor: BORDER_COLOR },

  wTaxHsn: { width: '20%' },
  wTaxVal: { width: '15%' },
  wTaxCT: { width: '25%' },
  wTaxST: { width: '25%' },
  wTaxTot: { width: '15%' },

  // Footer
  footerGrid: { flexDirection: 'row' },
  fLeft: { width: '50%', padding: 4, borderRightWidth: 1, borderColor: BORDER_COLOR },
  fRight: { width: '50%', padding: 4, justifyContent: 'space-between', alignItems: 'flex-end' },

  bottomNote: { position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', fontSize: 8 }
});

export const InvoiceDocument = ({ sale, copyLabel = '' }: { sale: any; copyLabel?: string }) => {
  const gstInclusive: boolean = sale.business?.gstInclusive ?? false;

  const isInterState = sale.placeOfSupply && sale.business?.state
    ? sale.placeOfSupply.toLowerCase() !== sale.business.state?.toLowerCase()
    : false;

  const invoiceDate = new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');

  // Tax aggregation — handle inclusive pricing
  const taxMap: Record<string, { taxable: number; cgst: number; sgst: number; igst: number }> = {};
  let totalQty = 0;
  let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

  sale.items.forEach((item: any) => {
    const disc = item.discount || 0;
    const grossAmt = item.qty * item.price - disc;
    const rate = item.gstRate || 0;
    const key = item.hsnCode || String(rate);
    totalQty += item.qty;

    // Back-calculate taxable base when prices are GST-inclusive
    // Round to 2 decimals to ensure "on-paper" math adds up perfectly
    const taxable = Number(((gstInclusive && rate > 0) ? grossAmt / (1 + rate / 100) : grossAmt).toFixed(2));

    if (!taxMap[key]) taxMap[key] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    taxMap[key].taxable += taxable;
    totalTaxable += taxable;

    if (isInterState) {
      const igst = Number((taxable * (rate / 100)).toFixed(2));
      taxMap[key].igst += igst; totalIgst += igst;
    } else {
      const half = Number((taxable * (rate / 2 / 100)).toFixed(2));
      taxMap[key].cgst += half; taxMap[key].sgst += half;
      totalCgst += half; totalSgst += half;
    }
  });

  const totalTaxAmount = totalCgst + totalSgst + totalIgst;
  const grandTotal = sale.total; // already rounded usually

  const bizState = sale.business?.state || '';
  const custState = sale.customer?.state || '';
  const bizStateCode = GST_STATE_CODES[bizState] || '';
  const custStateCode = GST_STATE_CODES[custState] || '';

  return (
    <Document>
      <Page size="A4" style={s.page}>

        <View style={s.container}>

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              {/* Placeholders for IRN if available */}
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={s.titleText}>{sale.isAggregate ? 'Aggregate Invoice' : 'Tax Invoice'}</Text>
              {copyLabel && <Text style={{ fontSize: 8, marginTop: 2, fontStyle: 'italic' }}>{copyLabel}</Text>}
            </View>
            <View style={s.headerRight}>
              <Text style={[s.label, s.bold]}>e-Invoice</Text>
            </View>
          </View>

          {/* Top Grid */}
          <View style={s.topGrid}>
            <View style={s.colLeft}>
              <View style={s.section}>
                <Text style={s.value}>{sale.business?.name}</Text>
                {sale.business?.address && <Text style={s.text}>{sale.business.address}</Text>}
                {sale.business?.phone && <Text style={s.text}>{sale.business.phone}</Text>}
                <Text style={s.text}>GSTIN: {sale.business?.gstNumber || 'Unregistered'}</Text>
                {bizState && <Text style={s.text}>State Name : {bizState}, Code : {bizStateCode}</Text>}
              </View>

              <View style={s.section}>
                <Text style={s.label}>Consignee (Ship to)</Text>
                <Text style={[s.value, { marginTop: 2 }]}>{sale.customer?.name || 'Cash Customer'}</Text>
                {sale.customer?.address && <Text style={s.text}>{sale.customer.address}</Text>}
                {sale.customer?.gstNumber && <Text style={s.text}>GSTIN/UIN      : {sale.customer.gstNumber}</Text>}
                {custState && <Text style={s.text}>State Name     : {custState}, Code : {custStateCode}</Text>}
              </View>

              <View style={s.sectionNoBorder}>
                <Text style={s.label}>Buyer (Bill to)</Text>
                <Text style={[s.value, { marginTop: 2 }]}>{sale.customer?.name || 'Cash Customer'}</Text>
                {sale.customer?.address && <Text style={s.text}>{sale.customer.address}</Text>}
                {sale.customer?.gstNumber && <Text style={s.text}>GSTIN/UIN      : {sale.customer.gstNumber}</Text>}
                {custState && <Text style={s.text}>State Name     : {custState}, Code : {custStateCode}</Text>}
              </View>
            </View>

            <View style={s.colRight}>
              <View style={s.rRow}>
                <View style={s.rCol}>
                  <Text style={s.label}>Invoice No.</Text>
                  <Text style={s.value}>{sale.invoiceNo}</Text>
                </View>
                <View style={s.rColLast}>
                  <Text style={s.label}>Dated</Text>
                  <Text style={s.value}>{invoiceDate}</Text>
                </View>
              </View>
              <View style={s.rRow}>
                <View style={s.rCol}>
                  <Text style={s.label}>Delivery Note</Text>
                </View>
                <View style={s.rColLast}>
                  <Text style={s.label}>Mode/Terms of Payment</Text>
                </View>
              </View>
              <View style={s.rRow}>
                <View style={s.rCol}>
                  <Text style={s.label}>Reference No. & Date</Text>
                </View>
                <View style={s.rColLast}>
                  <Text style={s.label}>Other References</Text>
                </View>
              </View>
              <View style={s.rRow}>
                <View style={s.rCol}>
                  <Text style={s.label}>Buyer's Order No.</Text>
                </View>
                <View style={s.rColLast}>
                  <Text style={s.label}>Dated</Text>
                </View>
              </View>
              <View style={s.rRow}>
                <View style={s.rCol}>
                  <Text style={s.label}>Dispatch Doc No.</Text>
                </View>
                <View style={s.rColLast}>
                  <Text style={s.label}>Delivery Note Date</Text>
                </View>
              </View>
              <View style={s.rRow}>
                <View style={s.rCol}>
                  <Text style={s.label}>Dispatched through</Text>
                </View>
                <View style={s.rColLast}>
                  <Text style={s.label}>Destination</Text>
                </View>
              </View>
              <View style={s.rRowLast}>
                <View style={[s.rColLast, { width: '100%' }]}>
                  <Text style={s.label}>Terms of Delivery</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Items Table */}
          <View style={s.table}>
            <View style={s.thRow}>
              <Text style={[s.th, s.wSl]}>S.NO.</Text>
              <Text style={[s.th, s.wDesc]}>ITEMS</Text>
              <Text style={[s.th, s.wHsn]}>HSN</Text>
              <Text style={[s.th, s.wQty]}>QTY.</Text>
              <Text style={[s.th, s.wRate]}>RATE</Text>
              <Text style={[s.th, s.wDisc]}>DISC.</Text>
              <Text style={[s.th, s.wTax]}>TAX</Text>
              <Text style={[s.thLast, s.wAmt]}>AMOUNT</Text>
            </View>

            {/* Print Items */}
            {sale.items.map((item: any, idx: number) => {
              const disc = item.discount || 0;
              const grossAmt = item.qty * item.price - disc;
              const unit = item.product?.unit || 'PCS';
              const rate = item.gstRate || 0;

              // When GST-inclusive: back-calculate the base (excl. GST) for Rate & Amount columns.
              // We round to 2 decimals so that Rate * Qty matches the displayed Amount.
              const baseUnitPrice = Number(((gstInclusive && rate > 0)
                ? item.price / (1 + rate / 100)
                : item.price).toFixed(2));
              
              const taxable = Number(((gstInclusive && rate > 0)
                ? grossAmt / (1 + rate / 100)
                : grossAmt).toFixed(2));
              
              const taxAmount = Number((taxable * (rate / 100)).toFixed(2));

              return (
                <View key={item.id} style={s.tr}>
                  <Text style={[s.td, s.wSl, { textAlign: 'center' }]}>{idx + 1}</Text>
                  <Text style={[s.td, s.wDesc]}>{item.product?.name}</Text>
                  <Text style={[s.td, s.wHsn]}>{item.hsnCode || ''}</Text>
                  <Text style={[s.td, s.wQty]}>{item.qty} {unit}</Text>
                  <Text style={[s.td, s.wRate]}>{baseUnitPrice.toFixed(2)}</Text>
                  <Text style={[s.td, s.wDisc]}>{disc.toFixed(2)}</Text>
                  <View style={[s.td, s.wTax, { alignItems: 'flex-end' }]}>
                    <Text>{taxAmount.toFixed(2)}</Text>
                    <Text style={{ fontSize: 7, color: '#555', marginTop: 2 }}>({rate}%)</Text>
                  </View>
                  <Text style={[s.tdLast, s.wAmt]}>{(taxable + taxAmount).toFixed(2)}</Text>
                </View>
              );
            })}

            {/* Empty space filler */}
            <View style={[s.tr, { flex: 1 }]}>
              <View style={[s.td, s.wSl]} />
              <View style={[s.td, s.wDesc]} />
              <View style={[s.td, s.wHsn]} />
              <View style={[s.td, s.wQty]} />
              <View style={[s.td, s.wRate]} />
              <View style={[s.td, s.wDisc]} />
              <View style={[s.td, s.wTax]} />
              <View style={[s.tdLast, s.wAmt]} />
            </View>

            <View style={s.totRow}>
              <Text style={[s.totText, { width: '40%', textAlign: 'center' }]}>TOTAL</Text>
              <Text style={[s.totText, s.wHsn]} />
              <Text style={[s.totText, s.wQty]} />
              <Text style={[s.totText, s.wRate, { textAlign: 'center' }]}>-</Text>
              <Text style={[s.totText, s.wDisc]} />
              <Text style={[s.totText, s.wTax]}>Rs. {totalTaxAmount.toFixed(2)}</Text>
              <Text style={[s.totText, s.wAmt]}>Rs. {grandTotal.toFixed(2)}</Text>
            </View>
          </View>

          {/* Tax Table */}
          <View>
            <View style={s.taxHead}>
              <View style={[s.taxTh, s.wTaxHsn, { paddingTop: 10 }]}><Text>HSN/SAC</Text></View>
              <View style={[s.taxTh, s.wTaxVal, { paddingTop: 10 }]}><Text>Taxable{'\n'}Value</Text></View>
              {isInterState ? (
                <View style={[s.taxTh, { width: '50%' }]}>
                  <Text style={{ borderBottomWidth: 1, borderColor: BORDER_COLOR, paddingBottom: 2, marginBottom: 2 }}>Integrated Tax</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={{ width: '50%', borderRightWidth: 1, borderColor: BORDER_COLOR }}>Rate</Text>
                    <Text style={{ width: '50%' }}>Amount</Text>
                  </View>
                </View>
              ) : (
                <>
                  <View style={[s.taxTh, s.wTaxCT]}>
                    <Text style={{ borderBottomWidth: 1, borderColor: BORDER_COLOR, paddingBottom: 2, marginBottom: 2 }}>Central Tax</Text>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={{ width: '50%', borderRightWidth: 1, borderColor: BORDER_COLOR }}>Rate</Text>
                      <Text style={{ width: '50%' }}>Amount</Text>
                    </View>
                  </View>
                  <View style={[s.taxTh, s.wTaxST]}>
                    <Text style={{ borderBottomWidth: 1, borderColor: BORDER_COLOR, paddingBottom: 2, marginBottom: 2 }}>State Tax</Text>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={{ width: '50%', borderRightWidth: 1, borderColor: BORDER_COLOR }}>Rate</Text>
                      <Text style={{ width: '50%' }}>Amount</Text>
                    </View>
                  </View>
                </>
              )}
              <View style={[s.taxTh, s.wTaxTot, { borderRightWidth: 0, paddingTop: 10 }]}><Text>Total{'\n'}Tax Amount</Text></View>
            </View>

            {Object.entries(taxMap).map(([hsn, v]) => {
              const rate = sale.items.find((i: any) => i.hsnCode === hsn || String(i.gstRate) === hsn)?.gstRate || 0;
              const rowTotalTax = isInterState ? v.igst : (v.cgst + v.sgst);

              return (
                <View key={hsn} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
                  <Text style={[s.taxTd, s.wTaxHsn, { textAlign: 'center' }]}>{hsn}</Text>
                  <Text style={[s.taxTd, s.wTaxVal]}>{v.taxable.toFixed(2)}</Text>
                  {isInterState ? (
                    <View style={{ width: '50%', flexDirection: 'row', borderRightWidth: 1, borderColor: BORDER_COLOR }}>
                      <Text style={[s.taxTd, { width: '50%' }]}>{rate}%</Text>
                      <Text style={[s.taxTd, { width: '50%', borderRightWidth: 0 }]}>{v.igst.toFixed(2)}</Text>
                    </View>
                  ) : (
                    <>
                      <View style={[s.wTaxCT, { flexDirection: 'row', borderRightWidth: 1, borderColor: BORDER_COLOR }]}>
                        <Text style={[s.taxTd, { width: '50%' }]}>{(rate / 2)}%</Text>
                        <Text style={[s.taxTd, { width: '50%', borderRightWidth: 0 }]}>{v.cgst.toFixed(2)}</Text>
                      </View>
                      <View style={[s.wTaxST, { flexDirection: 'row', borderRightWidth: 1, borderColor: BORDER_COLOR }]}>
                        <Text style={[s.taxTd, { width: '50%' }]}>{(rate / 2)}%</Text>
                        <Text style={[s.taxTd, { width: '50%', borderRightWidth: 0 }]}>{v.sgst.toFixed(2)}</Text>
                      </View>
                    </>
                  )}
                  <Text style={[s.taxTd, s.wTaxTot, { borderRightWidth: 0 }]}>Rs. {rowTotalTax.toFixed(2)}</Text>
                </View>
              );
            })}

            {/* Tax Total Row */}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
              <Text style={[s.taxTd, s.wTaxHsn, s.bold, { textAlign: 'right' }]}>Total</Text>
              <Text style={[s.taxTd, s.wTaxVal, s.bold]}>{totalTaxable.toFixed(2)}</Text>
              {isInterState ? (
                <View style={{ width: '50%', flexDirection: 'row', borderRightWidth: 1, borderColor: BORDER_COLOR }}>
                  <Text style={[s.taxTd, { width: '50%' }]}></Text>
                  <Text style={[s.taxTd, s.bold, { width: '50%', borderRightWidth: 0 }]}>{totalIgst.toFixed(2)}</Text>
                </View>
              ) : (
                <>
                  <View style={[s.wTaxCT, { flexDirection: 'row', borderRightWidth: 1, borderColor: BORDER_COLOR }]}>
                    <Text style={[s.taxTd, { width: '50%' }]}></Text>
                    <Text style={[s.taxTd, s.bold, { width: '50%', borderRightWidth: 0 }]}>{totalCgst.toFixed(2)}</Text>
                  </View>
                  <View style={[s.wTaxST, { flexDirection: 'row', borderRightWidth: 1, borderColor: BORDER_COLOR }]}>
                    <Text style={[s.taxTd, { width: '50%' }]}></Text>
                    <Text style={[s.taxTd, s.bold, { width: '50%', borderRightWidth: 0 }]}>{totalSgst.toFixed(2)}</Text>
                  </View>
                </>
              )}
              <Text style={[s.taxTd, s.wTaxTot, s.bold, { borderRightWidth: 0 }]}>Rs. {totalTaxAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Amount In Words - Spanning Full Width */}
          <View style={{ padding: 4, borderBottomWidth: 1, borderColor: BORDER_COLOR }}>
            <Text style={s.bold}>Total Amount (in words)</Text>
            <Text style={{ fontSize: 9, marginTop: 4 }}>{amountInWords(grandTotal)}</Text>
          </View>

          {/* 3-Column Footer Grid */}
          <View style={{ flexDirection: 'row' }}>

            {/* Column 1: Bank Details */}
            <View style={{ width: '35%', padding: 4, borderRightWidth: 1, borderColor: BORDER_COLOR }}>
              <Text style={[s.bold, { marginBottom: 4 }]}>Bank Details</Text>
              <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                <Text style={{ width: 60, fontSize: 8 }}>Account Name:</Text>
                <Text style={{ fontSize: 8, flex: 1 }}>{sale.business?.bankName || sale.business?.name || '—'}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                <Text style={{ width: 60, fontSize: 8 }}>IFSC Code:</Text>
                <Text style={{ fontSize: 8, flex: 1 }}>{sale.business?.ifscCode || '—'}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                <Text style={{ width: 60, fontSize: 8 }}>Account No:</Text>
                <Text style={{ fontSize: 8, flex: 1 }}>{sale.business?.accountNumber || '—'}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                <Text style={{ width: 60, fontSize: 8 }}>Bank & Branch:</Text>
                <Text style={{ fontSize: 8, flex: 1 }}>{sale.business?.branch || '—'}</Text>
              </View>
            </View>

            {/* Column 2: Terms & Conditions */}
            <View style={{ width: '35%', padding: 4, borderRightWidth: 1, borderColor: BORDER_COLOR }}>
              <Text style={[s.bold, { marginBottom: 4 }]}>Terms and Conditions</Text>
              <Text style={{ fontSize: 8, marginBottom: 2 }}>1. Item will be dispatched after full payment is made</Text>
              <Text style={{ fontSize: 8 }}>2. It will take at least 6 to 7 days for the goods to arrive</Text>
            </View>

            {/* Column 3: Signature */}
            <View style={{ width: '30%', padding: 4, justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 8, color: '#fff' }}>Hidden</Text>
              <View style={{ alignItems: 'center', width: '100%', marginTop: 30 }}>
                <Text style={{ fontSize: 8, textAlign: 'center' }}>Authorised Signatory For</Text>
                <Text style={[s.bold, { fontSize: 9, textAlign: 'center', marginTop: 2 }]}>{sale.business?.name}</Text>
              </View>
            </View>

          </View>

        </View>

        <Text style={s.bottomNote} fixed>This is a Computer Generated Invoice</Text>
      </Page>
    </Document>
  );
};
