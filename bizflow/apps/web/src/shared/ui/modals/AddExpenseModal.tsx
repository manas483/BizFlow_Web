import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { FormField } from '../forms/FormField';
import { ModalInput } from '../forms/ModalInput';
import { ModalFooter } from '../forms/ModalFooter';
import { CustomSelect } from '../forms/CustomSelect';
import { CustomMultiSelect } from '../forms/CustomMultiSelect';
import { useProducts } from '@/hooks/useProducts';
import { useBusiness } from '@/hooks/useBusiness';
import { useExpenses } from '@/hooks/useExpenses';
import { toast } from 'react-hot-toast';
import { Receipt } from 'lucide-react';
import { getBusinessProfile } from '@/shared/lib/business-profiles';

const CATEGORIES = [
  { value: 'Transport', label: 'Transport / Shipping' },
  { value: 'Rent', label: 'Rent / Lease' },
  { value: 'Salary', label: 'Salary / Wages' },
  { value: 'Utilities', label: 'Utilities (Electricity/Water)' },
  { value: 'Marketing', label: 'Marketing / Ads' },
  { value: 'Maintenance', label: 'Maintenance / Repairs' },
  { value: 'Misc', label: 'Miscellaneous' }
];

export function AddExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { products } = useProducts();
  const { business } = useBusiness();
  const { createExpense } = useExpenses();

  const [form, setForm] = useState({
    category: 'Misc',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
    recurring: false,
    invoiceNumbers: [] as string[],
    excludedProductIds: [] as string[]
  });
  const [loading, setLoading] = useState(false);

  // Note: Since we are moving to Layer-Based Costing, Landed Cost Preview is disabled on the frontend.
  // The backend will distribute expenses over Inventory Layers via \pplyLateLandedCost\.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createExpense.mutateAsync({ ...form, amount: parseFloat(form.amount) || 0 });
      setForm({ category: 'Misc', amount: '', date: new Date().toISOString().split('T')[0], note: '', recurring: false, invoiceNumbers: [], excludedProductIds: [] });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  const invoices = Array.from(new Set(products.map(p => p.purchaseInvoiceNo).filter(Boolean))) as string[];
  const profile = business ? getBusinessProfile(business.businessType) : null;
  const categoriesList = profile 
    ? Array.from(new Set([...profile.expenseCategories, 'Misc'])).map(c => ({ value: c, label: c }))
    : CATEGORIES;

  return (
    <Modal
      open={open} onClose={onClose}
      title='Add New Expense' subtitle='Record a business expense'
      icon={<Receipt size={18} />} iconColor='bg-rose-500/20 text-rose-400'
    >
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <FormField label='Amount' required>
            <ModalInput required type='number' min='0' placeholder='0.00' value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </FormField>
          <FormField label='Date' required>
            <ModalInput required type='date' value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </FormField>
        </div>

        <FormField label='Category'>
          <CustomSelect
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={categoriesList}
          />
        </FormField>

        <FormField label='Associate Invoice(s)'>
          <CustomMultiSelect
            value={form.invoiceNumbers}
            onChange={(v) => setForm({ ...form, invoiceNumbers: v })}
            options={invoices.map(inv => ({ value: inv, label: inv }))}
            placeholder='Select invoices...'
          />
        </FormField>

        {form.invoiceNumbers.length > 0 && (
           <div className='rounded-xl overflow-hidden mt-4 bg-violet-500/5 border border-violet-500/10 p-4 text-xs text-primary/70'>
             Landed Cost Preview is omitted. The backend will allocate this expense directly to active inventory layers.
           </div>
        )}

        <FormField label='Description / Note' required>
          <ModalInput required placeholder='Note...' value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </FormField>

        <div className='flex items-center gap-2 pt-2'>
          <input type='checkbox' id='recurring' checked={form.recurring}
            onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
            className='w-4 h-4 rounded accent-violet-500' />
          <label htmlFor='recurring' className='text-sm cursor-pointer' style={{ color: 'var(--text-secondary)' }}>
            Mark as recurring monthly expense
          </label>
        </div>

        <ModalFooter onClose={onClose} loading={loading} submitLabel='Save Expense' />
      </form>
    </Modal>
  );
}

