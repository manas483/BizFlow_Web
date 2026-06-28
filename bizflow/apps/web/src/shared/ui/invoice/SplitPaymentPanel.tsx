import React, { useState, useEffect } from 'react';
import { Trash2, Plus } from 'lucide-react';

export interface PaymentEntry {
  id: string; // local UI id
  paymentMethod: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque';
  amount: number;
  reference?: string;
  notes?: string;
}

interface SplitPaymentPanelProps {
  total: number;
  payments: PaymentEntry[];
  onChange: (payments: PaymentEntry[]) => void;
  disabled?: boolean;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

export function SplitPaymentPanel({ total, payments, onChange, disabled }: SplitPaymentPanelProps) {
  const [localPayments, setLocalPayments] = useState<PaymentEntry[]>(payments);

  useEffect(() => {
    setLocalPayments(payments);
  }, [payments]);

  const paidAmount = localPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = Math.max(0, total - paidAmount);

  const notifyChange = (newPayments: PaymentEntry[]) => {
    setLocalPayments(newPayments);
    onChange(newPayments);
  };

  const addPayment = () => {
    if (remaining <= 0) return;
    notifyChange([
      ...localPayments,
      { id: Date.now().toString(), paymentMethod: 'cash', amount: remaining }
    ]);
  };

  const removePayment = (id: string) => {
    notifyChange(localPayments.filter(p => p.id !== id));
  };

  const updatePayment = (id: string, field: keyof PaymentEntry, value: any) => {
    notifyChange(localPayments.map(p => {
      if (p.id === id) {
        return { ...p, [field]: value };
      }
      return p;
    }));
  };

  const statusColor = paidAmount >= total ? 'text-emerald-500' : (paidAmount > 0 ? 'text-amber-500' : 'text-red-500');

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
      <div className="flex flex-row items-center justify-between pb-3 border-b border-slate-800/50">
        <div>
          <h3 className="text-sm font-medium text-slate-200">Payments</h3>
          <div className="flex gap-4 mt-1.5 text-xs">
            <span className="text-slate-400">Total: <span className="text-slate-200 font-medium">₹{total.toFixed(2)}</span></span>
            <span className="text-slate-400">Paid: <span className="text-slate-200 font-medium">₹{paidAmount.toFixed(2)}</span></span>
            <span className="text-slate-400">Rem: <span className={`font-medium ${statusColor}`}>₹{remaining.toFixed(2)}</span></span>
          </div>
        </div>
        <button 
          onClick={addPayment}
          disabled={disabled || remaining <= 0}
          className="flex items-center px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add
        </button>
      </div>
      <div className="space-y-3">
        {localPayments.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No payments recorded.
          </div>
        ) : (
          localPayments.map((payment) => (
            <div key={payment.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-800/50">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Method</label>
                  <select
                    disabled={disabled}
                    value={payment.paymentMethod}
                    onChange={(e) => updatePayment(payment.id, 'paymentMethod', e.target.value)}
                    className="w-full h-8 bg-slate-900/80 border border-slate-700 rounded-md px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Amount (₹)</label>
                  <input 
                    type="number"
                    disabled={disabled}
                    className="w-full h-8 bg-slate-900/80 border border-slate-700 rounded-md px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                    value={payment.amount || ''}
                    onChange={(e) => updatePayment(payment.id, 'amount', parseFloat(e.target.value) || 0)}
                    min={0.01}
                    step={0.01}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Ref (Opt)</label>
                  <input 
                    disabled={disabled}
                    className="w-full h-8 bg-slate-900/80 border border-slate-700 rounded-md px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                    placeholder="UPI/Cheque Ref"
                    value={payment.reference || ''}
                    onChange={(e) => updatePayment(payment.id, 'reference', e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={() => removePayment(payment.id)}
                disabled={disabled}
                className="mt-6 sm:mt-0 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
