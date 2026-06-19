import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
  page:      { padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  band:      { backgroundColor: '#451a03', padding: '12 16', marginBottom: 12, borderRadius: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bandTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', letterSpacing: 1.5 },
  bandSub:   { fontSize: 10, color: '#fdba74', fontStyle: 'italic' },
  row2:      { flexDirection: 'row', gap: 12, marginBottom: 12 },
  box:       { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, padding: 10 },
  boxLabel:  { fontSize: 8.5, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 4 },
  bold:      { fontWeight: 'bold', color: '#111', fontSize: 11 },
  muted:     { color: '#6b7280', marginTop: 3, fontSize: 9.5 },
  orange:    { color: '#c2410c', fontWeight: 'bold', marginTop: 4, fontSize: 9 },
  metaGrid:  { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metaBox:   { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, padding: 8 },
  metaKey:   { fontSize: 8.5, color: '#9ca3af', marginBottom: 2 },
  metaVal:   { fontSize: 10.5, fontWeight: 'bold', color: '#111' },
  reasonBox: { borderWidth: 1, borderColor: '#fed7aa', borderRadius: 4, backgroundColor: '#fff7ed', padding: 10, marginBottom: 12 },
  reasonKey: { fontSize: 8.5, color: '#c2410c', marginBottom: 4 },
  reasonVal: { fontSize: 10.5, color: '#7c2d12', fontWeight: 'bold' },
  amtBlock:  { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 4, padding: 12, marginBottom: 12 },
  amtRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  amtKey:    { color: '#6b7280', fontSize: 9.5 },
  amtVal:    { fontWeight: 'bold', color: '#111', fontSize: 9.5 },
  grandRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#451a03' },
  grandKey:  { fontWeight: 'bold', color: '#451a03', fontSize: 11 },
  grandVal:  { fontWeight: 'bold', color: '#451a03', fontSize: 14 },
  noticeBox: { borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed', borderRadius: 4, padding: 10, marginBottom: 12 },
  noticeTxt: { fontSize: 9.5, color: '#7c2d12', lineHeight: 1.4 },
  sigBlock:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  sigBox:    { width: '45%', borderTopWidth: 1, borderTopColor: '#374151', paddingTop: 6 },
  sigLabel:  { fontSize: 9, color: '#6b7280', textAlign: 'center' },
  sigName:   { fontSize: 11, fontWeight: 'bold', color: '#111', textAlign: 'center', marginTop: 20 },
  footer:    { position: 'absolute', bottom: 20, left: 36, right: 36, borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerTxt: { fontSize: 8, color: '#9ca3af' },
});

const REASON_LABELS: Record<string, string> = {
  lower_taxable_value: 'Tax invoice has a lower taxable value than the amount that should have been charged',
  lower_tax_value:     'Tax invoice has a lower tax value than the amount that should have been charged',
};

export const DebitNoteDocument = ({ note }: { note: any }) => {
  const total = note.amount + note.taxAmount;
  const date  = new Date(note.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.band}>
          <Text style={s.bandTitle}>DEBIT NOTE</Text>
          <Text style={s.bandSub}>Original for Buyer</Text>
        </View>

        <View style={s.row2}>
          <View style={s.box}>
            <Text style={s.boxLabel}>Issued By (Supplier)</Text>
            <Text style={s.bold}>{note.business?.name}</Text>
            {note.business?.address && <Text style={s.muted}>{note.business.address}</Text>}
            {note.business?.gstNumber && <Text style={s.orange}>GSTIN: {note.business.gstNumber}</Text>}
          </View>
          <View style={s.box}>
            <Text style={s.boxLabel}>Issued To (Recipient)</Text>
            <Text style={s.bold}>{note.customer?.name}</Text>
            {note.customer?.address && <Text style={s.muted}>{note.customer.address}</Text>}
            {note.customer?.phone && <Text style={s.muted}>Ph: {note.customer.phone}</Text>}
            {note.customer?.gstNumber && <Text style={s.orange}>GSTIN: {note.customer.gstNumber}</Text>}
          </View>
        </View>

        <View style={s.metaGrid}>
          {[
            { k: 'Debit Note No.', v: note.debitNoteNo },
            { k: 'Date', v: date },
            { k: 'Original Invoice', v: note.sale?.invoiceNo || '—' },
          ].map(({ k, v }) => (
            <View key={k} style={s.metaBox}>
              <Text style={s.metaKey}>{k}</Text>
              <Text style={s.metaVal}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={s.reasonBox}>
          <Text style={s.reasonKey}>Reason for Debit Note</Text>
          <Text style={s.reasonVal}>{REASON_LABELS[note.reason] || note.reason}</Text>
        </View>

        <View style={s.amtBlock}>
          <View style={s.amtRow}><Text style={s.amtKey}>Additional Taxable Value</Text><Text style={s.amtVal}>Rs. {note.amount.toFixed(2)}</Text></View>
          <View style={s.amtRow}><Text style={s.amtKey}>Additional GST</Text><Text style={s.amtVal}>Rs. {note.taxAmount.toFixed(2)}</Text></View>
          <View style={s.grandRow}>
            <Text style={s.grandKey}>Total Debit</Text>
            <Text style={s.grandVal}>Rs. {total.toFixed(2)}</Text>
          </View>
        </View>

        {note.notes && (
          <View style={s.noticeBox}>
            <Text style={[s.reasonKey, { marginBottom: 2 }]}>Notes</Text>
            <Text style={s.noticeTxt}>{note.notes}</Text>
          </View>
        )}

        <View style={s.noticeBox}>
          <Text style={s.noticeTxt}>This Debit Note is issued under Section 34 of the CGST Act, 2017. The recipient's payable amount increases by Rs. {total.toFixed(2)}. The recipient is eligible to claim additional ITC of Rs. {note.taxAmount.toFixed(2)} upon payment.</Text>
        </View>

        <View style={s.sigBlock}>
          <View style={s.sigBox}><Text style={s.sigLabel}>Receiver's Signature</Text></View>
          <View style={s.sigBox}>
            <Text style={s.sigLabel}>For {note.business?.name}</Text>
            <Text style={s.sigName}>{note.business?.ownerName || ''}</Text>
            <Text style={s.sigLabel}>Authorised Signatory</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <View>
            <Text style={s.footerTxt}>This is a system-generated document. no signature is required.</Text>
            <Text style={s.footerTxt}>Debit Note issued under Sec 34 CGST Act 2017 against Invoice {note.sale?.invoiceNo}</Text>
          </View>
          <Text style={s.footerTxt}>{note.debitNoteNo} · {date}</Text>
        </View>
      </Page>
    </Document>
  );
};
