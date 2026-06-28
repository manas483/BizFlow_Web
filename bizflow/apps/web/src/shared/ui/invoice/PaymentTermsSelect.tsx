import React from 'react';

interface PaymentTermsSelectProps {
  value: string;
  onChange: (value: string) => void;
  customDueDate: string | null;
  onCustomDueDateChange: (date: string) => void;
  disabled?: boolean;
}

export const PAYMENT_TERMS_OPTIONS = [
  { value: 'immediate', label: 'Immediate' },
  { value: '7_days', label: '7 Days' },
  { value: '15_days', label: '15 Days' },
  { value: '30_days', label: '30 Days' },
  { value: '45_days', label: '45 Days' },
  { value: '60_days', label: '60 Days' },
  { value: 'custom', label: 'Custom Date' },
];

export function PaymentTermsSelect({ 
  value, 
  onChange, 
  customDueDate, 
  onCustomDueDateChange,
  disabled 
}: PaymentTermsSelectProps) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-400">Payment Terms</label>
        <select 
          disabled={disabled} 
          value={value || 'immediate'} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-900/50 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
        >
          {PAYMENT_TERMS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      
      {value === 'custom' && (
        <div className="space-y-1.5 mt-2">
          <label className="text-xs font-medium text-slate-400">Custom Due Date</label>
          <input 
            type="date"
            disabled={disabled}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
            value={customDueDate || ''}
            onChange={(e) => onCustomDueDateChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
