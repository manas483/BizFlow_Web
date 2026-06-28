"use client";

import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/shared/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/ui/Card";
import { FileText, ShieldAlert } from "lucide-react";

export function PriceAuditTrail() {
  const { data: overrides, isLoading } = useQuery({
    queryKey: ["price-audit"],
    queryFn: async () => {
      const res = await fetch("/api/reports/price-audit");
      if (!res.ok) throw new Error("Failed to fetch price audit trail");
      return res.json();
    }
  });

  return (
    <Card className="shadow-sm border-primary/10">
      <CardHeader className="pb-3 border-b border-primary/5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-400" /> Price Override Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-primary/70">
            <thead>
              <tr className="border-b border-primary/10 bg-primary/5 text-primary/40">
                <th className="px-5 py-3 font-medium">Invoice No</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">Original Price</th>
                <th className="px-5 py-3 font-medium">Sold Price</th>
                <th className="px-5 py-3 font-medium">Discount / Reduction</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Approved By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/5">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-primary/40 text-sm">Loading audit trail...</td>
                </tr>
              ) : !overrides || overrides.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-primary/40 text-sm">No price overrides found</td>
                </tr>
              ) : (
                overrides.map((item: any) => {
                  const original = Number(item.originalPrice) || 0;
                  const sold = Number(item.price) || 0;
                  const reduction = original > 0 ? original - sold : 0;
                  const pct = original > 0 ? (reduction / original) * 100 : 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-violet-400">{item.sale?.invoiceNo}</td>
                      <td className="px-5 py-3.5 text-primary/60">{formatDate(item.createdAt)}</td>
                      <td className="px-5 py-3.5 text-primary">{item.product?.name || 'Unknown Product'}</td>
                      <td className="px-5 py-3.5 text-primary/60">{formatCurrency(original)}</td>
                      <td className="px-5 py-3.5 text-primary font-medium">{formatCurrency(sold)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-rose-400 font-medium">-{formatCurrency(reduction)}</span>
                          <span className="text-[10px] text-rose-400/70">(-{pct.toFixed(1)}%)</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-primary/60 max-w-[200px] truncate" title={item.priceOverrideReason}>
                        {item.priceOverrideReason || '-'}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.sale?.workflowState === 'awaiting_approval' ? (
                          <span className="text-amber-400 font-medium text-[10px] uppercase bg-amber-400/10 px-1.5 py-0.5 rounded">Pending Approval</span>
                        ) : item.sale?.workflowState === 'rejected' ? (
                          <span className="text-rose-400 font-medium text-[10px] uppercase bg-rose-400/10 px-1.5 py-0.5 rounded">Rejected</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">{item.sale?.approvedByUser?.name || '-'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
