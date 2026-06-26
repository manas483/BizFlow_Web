import React, { useState, useEffect } from 'react';
import Modal, { FormField, ModalInput, ModalFooter } from "@/shared/ui/ui/Modal";
import { CustomSelect } from '@/shared/ui/ui/CustomSelect';
import { CustomMultiSelect } from '@/shared/ui/ui/CustomMultiSelect';
import { useProducts } from '@/shared/hooks/useProducts';
import { useBusiness } from '@/shared/hooks/useBusiness';
import { useUpdateExpense } from '@/shared/hooks/useExpenses';
import { toast } from 'react-hot-toast';
import { Edit2 } from 'lucide-react';
import { getBusinessProfile } from '@/shared/lib/business-intelligence';

const CATEGORIES = [
  { value: 'Transport', label: 'Transport / Shipping' },
  { value: 'Rent', label: 'Rent / Lease' },
  { value: 'Salary', label: 'Salary / Wages' },
  { value: 'Utilities', label: 'Utilities (Electricity/Water)' },
  { value: 'Marketing', label: 'Marketing / Ads' },
  { value: 'Maintenance', label: 'Maintenance / Repairs' },
  { value: 'Misc', label: 'Miscellaneous' }
];

export function EditExpenseModal({ expense, onClose }: { expense: any; onClose: () => void }) {
  const productsQuery = useProducts();
  const products = productsQuery.data?.data ?? [];
  const { data: business } = useBusiness();
  const updateExpense = useUpdateExpense();

  const [form, setForm] = useState({
    category: expense?.category || 'Misc',
    amount: expense?.amount?.toString() || '',
    date: expense?.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    note: expense?.note || '',
    recurring: expense?.recurring || false,
    invoiceNumbers: expense?.invoiceNumbers || ([] as string[]),
    excludedProductIds: expense?.excludedProductIds || ([] as string[])
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (expense) {
      setForm({
        category: expense.category,
        amount: expense.amount.toString(),
        date: new Date(expense.date).toISOString().split('T')[0],
        note: expense.note || '',
        recurring: expense.recurring || false,
        invoiceNumbers: expense.invoiceNumbers || [],
        excludedProductIds: expense.excludedProductIds || []
      });
    }
  }, [expense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateExpense.mutateAsync({ id: expense.id, data: { ...form, amount: parseFloat(form.amount) || 0 } });
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update expense');
    } finally {
      setLoading(false);
    }
  };

  const invoices = Array.from(new Set(products.map((p: any) => p.purchaseInvoiceNo).filter(Boolean))) as string[];
  const profile = business ? getBusinessProfile(business.businessType) : null;
  const categoriesList = profile 
    ? Array.from(new Set([...profile.expenseCategories, 'Misc'])).map(c => ({ value: c, label: c }))
    : CATEGORIES;

  if (!expense) return null;

  return (
    <Modal
      open={!!expense} onClose={onClose}
      title='Edit Expense' subtitle='Modify an existing expense'
      icon={<Edit2 size={18} />} iconColor='bg-amber-500/20 text-amber-500'
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
           <div className='rounded-xl overflow-hidden mt-4 bg-amber-500/5 border border-amber-500/10 p-4 text-xs text-primary/70'>
             Landed Cost Preview is omitted. The backend will allocate this expense directly to active inventory layers. (Reversal entries will be posted for older allocation).
           </div>
        )}

        <FormField label='Description / Note' required>
          <ModalInput required placeholder='Note...' value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </FormField>

        <div className='flex items-center gap-2 pt-2'>
          <input type='checkbox' id='recurring-edit' checked={form.recurring}
            onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
            className='w-4 h-4 rounded accent-amber-500' />
          <label htmlFor='recurring-edit' className='text-sm cursor-pointer' style={{ color: 'var(--text-secondary)' }}>
            Mark as recurring monthly expense
          </label>
        </div>

        <ModalFooter onClose={onClose} loading={loading} submitLabel='Update Expense' />
      </form>
    </Modal>
  );
}

