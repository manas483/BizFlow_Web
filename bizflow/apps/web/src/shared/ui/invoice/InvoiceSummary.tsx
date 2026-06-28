"use client";

import React from "react";
import type { InvoiceTotals } from "./types";
import DiscountInput from "./DiscountInput";
import { formatCurrency } from "@/shared/lib/utils";

interface InvoiceSummaryProps {
  totals: InvoiceTotals;
  gstInclusive: boolean;
  isInterState: boolean;
  hasGst: boolean;
  placeOfSupply: string;
  // Invoice-level discount
  invoiceDiscountInput: string;
  invoiceDiscountType: "flat" | "percent";
  onInvoiceDiscountInputChange: (v: string) => void;
  onInvoiceDiscountTypeChange: (t: "flat" | "percent") => void;
  // Payment
  paid: string;
  onPaidChange: (v: string) => void;
  // Notes
  notes: string;
  onNotesChange: (v: string) => void;
  maxPayable: number;
}

/**
 * Enhanced sticky summary card with full GST breakdown,
 * invoice-level discount, round-off, items count, and payment status.
 */
export default function InvoiceSummary({
  totals,
  gstInclusive,
  isInterState,
  hasGst,
  placeOfSupply,
  invoiceDiscountInput,
  invoiceDiscountType,
  onInvoiceDiscountInputChange,
  onInvoiceDiscountTypeChange,
  paid,
  onPaidChange,
  notes,
  onNotesChange,
  maxPayable,
}: InvoiceSummaryProps) {
  const paidNum = parseFloat(paid) || 0;

  // Payment status badge
  let paymentStatus = "";
  let statusColor = "";
  if (totals.grandTotal > 0) {
    if (paidNum <= 0) { paymentStatus = "Unpaid"; statusColor = "text-rose-400 bg-rose-400/10"; }
    else if (paidNum < totals.grandTotal) { paymentStatus = "Partially Paid"; statusColor = "text-amber-400 bg-amber-400/10"; }
    else if (paidNum >= totals.grandTotal) { paymentStatus = "Paid"; statusColor = "text-emerald-400 bg-emerald-400/10"; }
    if (paidNum > totals.grandTotal) { paymentStatus = "Overpaid"; statusColor = "text-blue-400 bg-blue-400/10"; }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
      {/* Left — Payment + Invoice Discount + Notes */}
      <div className="space-y-4">
        {/* Invoice-level discount */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
            Invoice Discount
          </label>
          <DiscountInput
            value={invoiceDiscountInput}
            type={invoiceDiscountType}
            onValueChange={(v) => onInvoiceDiscountInputChange(String(v))}
            onTypeChange={onInvoiceDiscountTypeChange}
          />
          {totals.invoiceDiscountAmount > 0 && (
            <p className="text-[10px] mt-1 text-violet-400/70">
              Discount: {formatCurrency(totals.invoiceDiscountAmount)}
            </p>
          )}
        </div>

        {/* Amount Paid */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
            Amount Paid (₹)
          </label>
          <input
            type="number" min="0" max={maxPayable} placeholder="0.00"
            value={paid}
            onChange={(e) => onPaidChange(e.target.value)}
            className="w-full rounded-xl px-3.5 py-2.5 text-sm transition-all focus:outline-none"
            style={{
              backgroundColor: "var(--input-bg)",
              border: "1px solid var(--input-border)",
              color: "var(--text-primary)",
            }}
          />
          <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Leave blank if unpaid</p>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
            Notes / Terms
          </label>
          <textarea
            rows={2}
            placeholder="Payment terms, bank details, etc."
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--input-border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>

      {/* Right — Summary Card */}
      <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 space-y-1.5 self-start">
        {/* Item count + Qty */}
        <div className="flex justify-between text-xs pb-2 mb-1 border-b border-primary/5">
          <span style={{ color: "var(--text-muted)" }}>
            Items: <strong className="text-white/80">{totals.itemCount}</strong>
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            Total Qty: <strong className="text-white/80">{totals.totalQty}</strong>
          </span>
        </div>

        {/* Subtotal */}
        <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />

        {/* Line Discounts */}
        {totals.lineDiscountTotal > 0 && (
          <SummaryRow label="Line Discounts" value={`-${formatCurrency(totals.lineDiscountTotal)}`} className="text-amber-400/80" />
        )}

        {/* Invoice Discount */}
        {totals.invoiceDiscountAmount > 0 && (
          <SummaryRow label="Invoice Discount" value={`-${formatCurrency(totals.invoiceDiscountAmount)}`} className="text-amber-400/80" />
        )}

        {/* Taxable Value */}
        <SummaryRow
          label={gstInclusive ? "Taxable Value (excl. GST)" : "Taxable Value"}
          value={formatCurrency(totals.taxableValue)}
        />

        {/* GST breakdown */}
        {hasGst && (
          <>
            {placeOfSupply ? (
              isInterState ? (
                <SummaryRow label="IGST" value={formatCurrency(totals.totalIgst)} className="text-violet-300" />
              ) : (
                <>
                  <SummaryRow label="CGST" value={formatCurrency(totals.totalCgst)} className="text-violet-300/80" />
                  <SummaryRow label="SGST" value={formatCurrency(totals.totalSgst)} className="text-violet-300/80" />
                </>
              )
            ) : (
              <SummaryRow label="Total GST" value={formatCurrency(totals.totalGst)} className="text-violet-300" />
            )}
          </>
        )}

        {/* Round Off */}
        {totals.roundOff !== 0 && (
          <SummaryRow
            label="Round Off"
            value={`${totals.roundOff > 0 ? "+" : ""}${formatCurrency(totals.roundOff)}`}
            className="text-primary/40"
          />
        )}

        {/* Divider */}
        <div className="h-px bg-primary/10 !my-2" />

        {/* Grand Total */}
        <div className="flex justify-between items-center">
          <span className="font-semibold text-primary">Grand Total</span>
          <span className="font-bold text-emerald-400 text-lg">{formatCurrency(totals.grandTotal)}</span>
        </div>

        {/* Paid */}
        {paidNum > 0 && (
          <SummaryRow label="Amount Paid" value={formatCurrency(paidNum)} className="text-emerald-400" />
        )}

        {/* Balance Due */}
        {totals.balanceDue > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-rose-400/80 font-medium">Balance Due</span>
            <span className="text-rose-400 font-semibold">{formatCurrency(totals.balanceDue)}</span>
          </div>
        )}

        {/* Payment Status badge */}
        {paymentStatus && totals.grandTotal > 0 && (
          <div className="flex justify-end pt-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor}`}>
              {paymentStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className={className || ""} style={className ? {} : { color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
