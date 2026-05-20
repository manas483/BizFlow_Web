import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
  page:      { padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  band:      { backgroundColor: '#1e3a5f', padding: '12 16', marginBottom: 12, borderRadius: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bandTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', letterSpacing: 1.5 },
  bandSub:   { fontSize: 10, color: '#93c5fd', fontStyle: 'italic' },
  row2:      { flexDirection: 'row', gap: 12, marginBottom: 12 },
  box:       { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, padding: 10 },
  boxLabel:  { fontSize: 8.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 4 },
  bold:      { fontWeight: 'bold', color: '#111', fontSize: 11 },
  muted:     { color: '#6b7280', marginTop: 3, fontSize: 9.5 },
  blue:      { color: '#1d4ed8', fontWeight: 'bold', marginTop: 4, fontSize: 9.5 },
  metaGrid:  { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metaBox:   { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, padding: 8 },
  metaKey:   { fontSize: 8.5, color: '#9ca3af', marginBottom: 2 },
  metaVal:   { fontSize: 10.5, fontWeight: 'bold', color: '#111' },
  noticeBox: { borderWidth: 1, borderColor: '#bfdbfe', backgroundColor: '#eff6ff', borderRadius: 4, padding: 10, marginBottom: 12 },
  noticeTxt: { fontSize: 9.5, color: '#1e40af', lineHeight: 1.4 },
  table:     { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 4, marginBottom: 12, overflow: 'hidden' },
  tHead:     { flexDirection: 'row', backgroundColor: '#1e3a5f', padding: '6 0' },
  tRow:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: '6 0' },
  tRowAlt:   { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb', padding: '6 0', backgroundColor: '#f9fafb' },
  th:        { fontWeight: 'bold', color: '#dbeafe', fontSize: 8.5, textAlign: 'center' },
  thLeft:    { fontWeight: 'bold', color: '#dbeafe', fontSize: 8.5, textAlign: 'left', paddingLeft: 8 },
  td:        { fontSize: 9.5, color: '#374151', textAlign: 'center' },
  totBox:    { alignItems: 'flex-end', marginBottom: 12 },
  totRow:    { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  totKey:    { width: 140, textAlign: 'right', paddingRight: 12, color: '#6b7280', fontSize: 9.5 },
  totVal:    { width: 100, textAlign: 'right', fontWeight: 'bold', color: '#111', fontSize: 9.5 },
  grandRow:  { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#1e3a5f' },
  grandKey:  { width: 140, textAlign: 'right', paddingRight: 12, fontWeight: 'bold', color: '#1e3a5f', fontSize: 11 },
  grandVal:  { width: 100, textAlign: 'right', fontWeight: 'bold', color: '#1e3a5f', fontSize: 13 },
  sigBlock:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  sigBox:    { width: '45%', borderTopWidth: 1, borderTopColor: '#374151', paddingTop: 6 },
  sigLabel:  { fontSize: 9, color: '#6b7280', textAlign: 'center' },
  sigName:   { fontSize: 11, fontWeight: 'bold', color: '#111', textAlign: 'center', marginTop: 20 },
  footer:    { position: 'absolute', bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerTxt: { fontSize: 8, color: '#9ca3af' },
});

export const BillOfSupplyDocument = ({ bill }: { bill: any }) => {
  const date  = new Date(bill.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const total = bill.items.reduce((s: number, i: any) => s + i.qty * i.price, 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <Text style={s.bandTitle}>BILL OF SUPPLY</Text>
          <Text style={s.bandSub}>{bill.supplyType === 'composition' ? 'Composition Scheme Supplier' : 'Exempt Supply — No GST Applicable'}</Text>
        </View>

        <View style={s.row2}>
          <View style={s.box}>
            <Text style={s.boxLabel}>Supplier</Text>
            <Text style={s.bold}>{bill.business?.name}</Text>
            {bill.business?.address && <Text style={s.muted}>{bill.business.address}</Text>}
            {bill.business?.gstNumber && <Text style={s.blue}>GSTIN: {bill.business.gstNumber}</Text>}
          </View>
          <View style={s.box}>
            <Text style={s.boxLabel}>Recipient</Text>
            <Text style={s.bold}>{bill.customer?.name}</Text>
            {bill.customer?.address && <Text style={s.muted}>{bill.customer.address}</Text>}
            {(bill.customer?.city || bill.customer?.state) && (
              <Text style={s.muted}>{[bill.customer.city, bill.customer.state].filter(Boolean).join(', ')}</Text>
            )}
            {bill.customer?.phone && <Text style={s.muted}>Ph: {bill.customer.phone}</Text>}
            {bill.customer?.gstNumber
              ? <Text style={s.blue}>GSTIN: {bill.customer.gstNumber}</Text>
              : <Text style={[s.muted, { fontStyle: 'italic' }]}>Unregistered Recipient</Text>
            }
          </View>
        </View>

        <View style={s.metaGrid}>
          {[
            { k: 'Bill No.', v: bill.billNo },
            { k: 'Date', v: date },
            { k: 'Supply Type', v: bill.supplyType === 'composition' ? 'Composition Scheme' : 'Exempt Supply' },
            { k: 'Status', v: bill.status.toUpperCase() },
          ].map(({ k, v }) => (
            <View key={k} style={s.metaBox}>
              <Text style={s.metaKey}>{k}</Text>
              <Text style={s.metaVal}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={s.noticeBox}>
          <Text style={s.noticeTxt}>
            {bill.supplyType === 'composition'
              ? 'COMPOSITION TAXABLE PERSON: This supplier is registered under Composition Scheme and is not eligible to collect tax on supplies. No Input Tax Credit is admissible to the recipient on this supply.'
              : 'EXEMPT SUPPLY: The goods/services covered under this Bill of Supply are exempt from GST. No tax is charged and no Input Tax Credit can be claimed by the recipient on this supply.'}
          </Text>
        </View>

        <View style={s.table}>
          <View style={s.tHead}>
            <Text style={[s.th, { width: '5%' }]}>#</Text>
            <Text style={[s.thLeft, { width: '35%' }]}>Description of Goods / Services</Text>
            <Text style={[s.th, { width: '12%' }]}>HSN/SAC</Text>
            <Text style={[s.th, { width: '8%' }]}>Unit</Text>
            <Text style={[s.th, { width: '8%' }]}>Qty</Text>
            <Text style={[s.th, { width: '15%' }]}>Rate (Rs.)</Text>
            <Text style={[s.th, { width: '17%', paddingRight: 5 }]}>Amount (Rs.)</Text>
          </View>
          {bill.items.map((item: any, idx: number) => (
            <View key={item.id} style={idx % 2 === 0 ? s.tRow : s.tRowAlt}>
              <Text style={[s.td, { width: '5%' }]}>{idx + 1}</Text>
              <View style={{ width: '35%', paddingLeft: 8 }}>
                <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: '#111' }}>{item.product?.name}</Text>
                {item.product?.sku && <Text style={{ fontSize: 8, color: '#9ca3af' }}>SKU: {item.product.sku}</Text>}
              </View>
              <Text style={[s.td, { width: '12%' }]}>{item.hsnCode || '—'}</Text>
              <Text style={[s.td, { width: '8%' }]}>{item.product?.unit || 'pcs'}</Text>
              <Text style={[s.td, { width: '8%' }]}>{item.qty}</Text>
              <Text style={[s.td, { width: '15%' }]}>{item.price.toFixed(2)}</Text>
              <Text style={[s.td, { width: '17%', paddingRight: 5 }]}>{(item.qty * item.price).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totBox}>
          <View style={s.totRow}><Text style={s.totKey}>Total (excl. GST)</Text><Text style={s.totVal}>Rs. {total.toFixed(2)}</Text></View>
          <View style={s.totRow}><Text style={[s.totKey, { color: '#9ca3af', fontStyle: 'italic' }]}>GST</Text><Text style={[s.totVal, { color: '#9ca3af', fontStyle: 'italic' }]}>Not Applicable</Text></View>
          <View style={s.grandRow}><Text style={s.grandKey}>Grand Total</Text><Text style={s.grandVal}>Rs. {total.toFixed(2)}</Text></View>
          <View style={s.totRow}><Text style={[s.totKey, { color: '#15803d' }]}>Amount Paid</Text><Text style={[s.totVal, { color: '#15803d' }]}>Rs. {bill.paid.toFixed(2)}</Text></View>
          <View style={s.totRow}>
            <Text style={[s.totKey, { color: bill.paid < total ? '#b91c1c' : '#6b7280' }]}>Balance Due</Text>
            <Text style={[s.totVal, { color: bill.paid < total ? '#b91c1c' : '#374151' }]}>Rs. {Math.max(0, total - bill.paid).toFixed(2)}</Text>
          </View>
        </View>

        {bill.notes && (
          <View style={s.noticeBox}>
            <Text style={[s.noticeTxt, { color: '#374151' }]}>{bill.notes}</Text>
          </View>
        )}

        <View style={s.sigBlock}>
          <View style={s.sigBox}><Text style={s.sigLabel}>Receiver's Signature &amp; Stamp</Text></View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>For {bill.business?.name}</Text>
            <Text style={s.sigName}>{bill.business?.ownerName || ''}</Text>
            <Text style={s.sigLabel}>Authorised Signatory</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <View>
            <Text style={s.footerTxt}>This is a system-generated document. no signature is required.</Text>
            <Text style={s.footerTxt}>No GST charged on this document.</Text>
          </View>
          <Text style={s.footerTxt}>{bill.billNo} · {date}</Text>
        </View>
      </Page>
    </Document>
  );
};
