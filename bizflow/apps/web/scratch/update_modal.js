const fs = require('fs');

const file = 'c:\\Users\\sacha\\Desktop\\B\\bizflow\\apps\\web\\src\\shared\\ui\\modals\\NewSaleModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
content = content.replace(
  `import InvoiceSummary from "@/shared/ui/invoice/InvoiceSummary";`,
  `import InvoiceSummary from "@/shared/ui/invoice/InvoiceSummary";
import { PaymentTermsSelect } from "@/shared/ui/invoice/PaymentTermsSelect";
import { SplitPaymentPanel, PaymentEntry } from "@/shared/ui/invoice/SplitPaymentPanel";`
);

// 2. Add state variables for Phase 2
content = content.replace(
  `  const [invoiceDiscountType, setInvoiceDiscountType] = useState<"flat" | "percent">("flat");`,
  `  const [invoiceDiscountType, setInvoiceDiscountType] = useState<"flat" | "percent">("flat");
  const [paymentTerms, setPaymentTerms] = useState<string>("immediate");
  const [customDueDate, setCustomDueDate] = useState<string>("");
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [deletedItems, setDeletedItems] = useState<{item: LineItem, index: number, timer: any}[]>([]);
  const [workflowState, setWorkflowState] = useState<"draft" | "posted">("draft");`
);

// 3. Reset form to clear Phase 2 state
content = content.replace(
  `    setLastAddedIndex(null);
  };`,
  `    setLastAddedIndex(null);
    setPaymentTerms("immediate"); setCustomDueDate(""); setPayments([]); setWorkflowState("draft");
    deletedItems.forEach(d => clearTimeout(d.timer)); setDeletedItems([]);
  };`
);

// 4. Update data fetching mapping
content = content.replace(
  `            setNotes(data.notes || "");
            setInvoiceDate(data.invoiceDate ? new Date(data.invoiceDate).toISOString().split("T")[0] : new Date(data.createdAt).toISOString().split("T")[0]);
          }
        })`,
  `            setNotes(data.notes || "");
            setInvoiceDate(data.invoiceDate ? new Date(data.invoiceDate).toISOString().split("T")[0] : new Date(data.createdAt).toISOString().split("T")[0]);
            setPaymentTerms(data.paymentTerms || "immediate");
            if (data.dueDate) setCustomDueDate(new Date(data.dueDate).toISOString().split("T")[0]);
            if (data.payments) {
              setPayments(data.payments.map((p: any) => ({
                id: p.id, paymentMethod: p.paymentMethod, amount: p.amount, reference: p.reference, notes: p.notes
              })));
            }
            setWorkflowState(data.workflowState || "posted");
          }
        })`
);

// 5. Update saveSale
content = content.replace(
  `  const saveSale = async () => {`,
  `  const saveSale = async (isDraft: boolean = false) => {`
);

content = content.replace(
  `      const payload = {
        customerId: customer,
        items: items.map(lineItemToPayload),
        paid: Number(paid) || 0,
        notes,
        placeOfSupply,
        reverseCharge,
        isAggregate,
        aggregateDate: isAggregate ? new Date().toISOString() : null,
        invoiceDate,
      };`,
  `      // Clear any pending undo deletions
      deletedItems.forEach(d => clearTimeout(d.timer));
      setDeletedItems([]);

      const computedPaid = payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) : Number(paid) || 0;
      const payload = {
        customerId: customer,
        items: items.map(lineItemToPayload),
        paid: computedPaid,
        notes,
        placeOfSupply,
        reverseCharge,
        isAggregate,
        aggregateDate: isAggregate ? new Date().toISOString() : null,
        invoiceDate,
        isDraft,
        paymentTerms,
        dueDate: paymentTerms === 'custom' ? customDueDate : null,
        payments: payments.map(p => ({
          paymentMethod: p.paymentMethod, amount: p.amount, reference: p.reference, notes: p.notes
        }))
      };`
);

// 6. Fix handleRemoveItem for Undo logic
content = content.replace(
  `  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };`,
  `  const handleRemoveItem = (index: number) => {
    const itemToRemove = items[index];
    setItems(items.filter((_, i) => i !== index));
    
    // Undo delete logic
    const timer = setTimeout(() => {
      setDeletedItems(prev => prev.filter(d => d.timer !== timer));
    }, 5000);
    
    const id = Date.now();
    setDeletedItems(prev => [...prev, { item: itemToRemove, index, timer }]);
    
    toast((t) => (
      <div className="flex items-center justify-between w-full">
        <span>Item removed</span>
        <button 
          onClick={() => {
            clearTimeout(timer);
            setItems(prev => {
              const newItems = [...prev];
              newItems.splice(index, 0, itemToRemove);
              return newItems;
            });
            setDeletedItems(prev => prev.filter(d => d.timer !== timer));
            toast.dismiss(t.id);
          }}
          className="text-primary hover:underline font-medium ml-4"
        >
          Undo
        </button>
      </div>
    ), { duration: 5000, id: \`undo-\${id}\` });
  };`
);

// 7. Add PaymentTermsSelect & SplitPaymentPanel to render
content = content.replace(
  `        {/* ── Summary + Payment (sticky) ── */}`,
  `        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <PaymentTermsSelect
            value={paymentTerms}
            onChange={setPaymentTerms}
            customDueDate={customDueDate}
            onCustomDueDateChange={setCustomDueDate}
            disabled={workflowState === 'posted'}
          />
          <SplitPaymentPanel
            total={totals.grandTotal}
            payments={payments}
            onChange={setPayments}
            disabled={workflowState === 'posted'}
          />
        </div>

        {/* ── Summary + Payment (sticky) ── */}`
);

// 8. Update ModalFooter
content = content.replace(
  `<ModalFooter onClose={handleClose} loading={loading} submitLabel={editSaleId ? "Update GST Invoice" : "Generate GST Invoice"} />`,
  `<div className="flex items-center justify-between mt-4">
    <div className="flex gap-2">
      <button 
        type="button" 
        onClick={() => saveSale(true)} 
        disabled={loading || (workflowState === 'posted')}
        className="px-4 py-2 border border-slate-700 text-slate-300 rounded hover:bg-slate-800 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        {loading ? "Saving..." : "Save Draft"}
      </button>
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={handleClose} disabled={loading} className="px-4 py-2 text-slate-400 hover:text-slate-300">Cancel</button>
      <button
        type="button"
        onClick={() => saveSale(false)}
        disabled={loading || items.length === 0 || !customer || (workflowState === 'posted')}
        className="px-6 py-2 bg-primary text-primary-foreground font-semibold rounded hover:bg-primary/90 disabled:opacity-50 shadow-sm transition-all"
      >
        {workflowState === 'draft' ? "Confirm & Post" : (editSaleId ? "Update Invoice" : "Confirm & Post")}
      </button>
    </div>
  </div>`
);

// 9. Add "Create Product" button to ProductPickerModal headerActions
content = content.replace(
  `        onClose={() => {
          setIsProductPickerOpen(false);
          setPickingIndex(null);
        }}`,
  `        onClose={() => {
          setIsProductPickerOpen(false);
          setPickingIndex(null);
        }}
        headerActions={
          <button
            onClick={() => setIsAddProductOpen(true)}
            className="flex items-center px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Create Product
          </button>
        }`
);

fs.writeFileSync(file, content);
