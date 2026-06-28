const fs = require('fs');

const file = 'c:\\Users\\sacha\\Desktop\\B\\bizflow\\apps\\web\\src\\app\\(dashboard)\\sales\\page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update revenue calculation to exclude drafts
content = content.replace(
  `  const totalRevenue   = allSales.reduce((s: number, sale: any) => s + sale.paid, 0);`,
  `  const validSales = allSales.filter((s: any) => s.workflowState !== "draft");
  const totalRevenue   = validSales.reduce((s: number, sale: any) => s + sale.paid, 0);`
);
content = content.replace(
  `  const totalDues      = allSales.reduce((s: number, sale: any) => s + (sale.total - sale.paid), 0);
  const paidCount      = allSales.filter((s: any) => s.status === "paid").length;
  const unpaidCount    = allSales.filter((s: any) => s.status !== "paid").length;

  const revThis  = allSales.filter((s: any) => isThisMonth(s.createdAt)).reduce((a: number, s: any) => a + s.paid, 0);
  const revLast  = allSales.filter((s: any) => isLastMonth(s.createdAt)).reduce((a: number, s: any) => a + s.paid, 0);
  const dueThis  = allSales.filter((s: any) => isThisMonth(s.createdAt)).reduce((a: number, s: any) => a + (s.total - s.paid), 0);
  const dueLast  = allSales.filter((s: any) => isLastMonth(s.createdAt)).reduce((a: number, s: any) => a + (s.total - s.paid), 0);
  const paidThis = allSales.filter((s: any) => isThisMonth(s.createdAt) && s.status === "paid").length;
  const paidLast = allSales.filter((s: any) => isLastMonth(s.createdAt) && s.status === "paid").length;
  const unpaidThis = allSales.filter((s: any) => isThisMonth(s.createdAt) && s.status !== "paid").length;
  const unpaidLast = allSales.filter((s: any) => isLastMonth(s.createdAt) && s.status !== "paid").length;`,
  `  const totalDues      = validSales.reduce((s: number, sale: any) => s + (sale.total - sale.paid), 0);
  const paidCount      = validSales.filter((s: any) => s.status === "paid").length;
  const unpaidCount    = validSales.filter((s: any) => s.status !== "paid").length;

  const revThis  = validSales.filter((s: any) => isThisMonth(s.createdAt)).reduce((a: number, s: any) => a + s.paid, 0);
  const revLast  = validSales.filter((s: any) => isLastMonth(s.createdAt)).reduce((a: number, s: any) => a + s.paid, 0);
  const dueThis  = validSales.filter((s: any) => isThisMonth(s.createdAt)).reduce((a: number, s: any) => a + (s.total - s.paid), 0);
  const dueLast  = validSales.filter((s: any) => isLastMonth(s.createdAt)).reduce((a: number, s: any) => a + (s.total - s.paid), 0);
  const paidThis = validSales.filter((s: any) => isThisMonth(s.createdAt) && s.status === "paid").length;
  const paidLast = validSales.filter((s: any) => isLastMonth(s.createdAt) && s.status === "paid").length;
  const unpaidThis = validSales.filter((s: any) => isThisMonth(s.createdAt) && s.status !== "paid").length;
  const unpaidLast = validSales.filter((s: any) => isLastMonth(s.createdAt) && s.status !== "paid").length;`
);

// 2. Add 'draft' to filters dropdown
content = content.replace(
  `<option value="unpaid">Unpaid</option>`,
  `<option value="unpaid">Unpaid</option>\n                <option value="draft">Drafts</option>`
);

// 3. Add Workflow badge next to Status badge
content = content.replace(
  `<Badge className={sale.status === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : sale.status === "partial" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}>
                        {sale.status.toUpperCase()}
                      </Badge>`,
  `<div className="flex gap-2">
                        {sale.workflowState === 'draft' && (
                          <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20">DRAFT</Badge>
                        )}
                        {sale.workflowState !== 'draft' && (
                          <Badge className={sale.status === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : sale.status === "partial" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"}>
                            {sale.status.toUpperCase()}
                          </Badge>
                        )}
                      </div>`
);

// 4. Record Payment logic - if it's a draft, maybe prompt to Confirm first? Or let the NewSaleModal handle it. The quick action "Record Payment" should probably be disabled or open the modal if draft. But for now we just show it.
// Actually, I'll disable Record Payment for drafts.
content = content.replace(
  `onClick={() => setSalePayTarget({ id: sale.id, invoiceNo: sale.invoiceNo, total: sale.total, paid: sale.paid })}`,
  `onClick={() => { if (sale.workflowState === 'draft') { toast.error("Confirm invoice before recording payment"); } else { setSalePayTarget({ id: sale.id, invoiceNo: sale.invoiceNo, total: sale.total, paid: sale.paid }); } }}`
);

fs.writeFileSync(file, content);
