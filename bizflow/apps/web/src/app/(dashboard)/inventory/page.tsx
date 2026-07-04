"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "@/shared/ui/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/ui/Card";
import { Badge } from "@/shared/ui/ui/Badge";
import { Button } from "@/shared/ui/ui/Button";
import { StatCard } from "@/shared/ui/ui/StatCard";
import { CustomSelect } from "@/shared/ui/ui/CustomSelect";
import ConfirmDialog from "@/shared/ui/ui/ConfirmDialog";
import { useProducts, useDeleteProduct } from "@/shared/hooks/useProducts";
import { useBusiness } from "@/shared/hooks/useBusiness";
import { getBusinessProfile } from "@/shared/lib/business-intelligence";
import { useProductCategories } from "@/shared/hooks/useProducts";
import Pagination from "@/shared/ui/ui/Pagination";
import { formatCurrency, exportToCSV } from "@/shared/lib/utils";
import { Package, Plus, Search, AlertTriangle, TrendingUp, Download, Pencil, Trash2, Upload } from "lucide-react";
import AddProductModal from "@/shared/ui/modals/AddProductModal";
import EditProductModal from "@/shared/ui/modals/EditProductModal";
import ImportInventoryModal from "@/shared/ui/modals/ImportInventoryModal";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const [page, setPage] = useState(1);

  const { data: paged, isLoading } = useProducts(search, category, page);
  const products = paged?.data ?? [];
  const { data: business } = useBusiness();
  const deleteProduct = useDeleteProduct();

  const { data: dbCategories } = useProductCategories();

  const profile = business ? getBusinessProfile(business.businessType) : null;
  const profileCats = profile ? profile.productCategories : ["Grains", "Pulses", "Edible Oil", "Spices", "Construction"];
  const mergedCategories = Array.from(new Set([...(dbCategories || []), ...profileCats]));
  const categories = ["All", ...mergedCategories, "Other"];
  const totalProducts = paged?.total ?? 0;
  const lowStock = paged?.stats?.lowStock ?? products.filter((p: any) => p.stock <= p.minStock).length;
  const totalValue = paged?.stats?.totalValue ?? products.reduce((s: number, p: any) => s + Math.max(0, p.stock) * p.standardCost, 0);
  const totalSellValue = paged?.stats?.totalSellValue ?? products.reduce((s: number, p: any) => s + Math.max(0, p.stock) * p.sellingPrice, 0);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProduct.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
      toast.error("Failed to delete product");
    }
  };

  const handleExport = () => {
    const exportData = products.map((p: any) => ({
      SKU: p.sku || "",
      Name: p.name,
      Category: p.category,
      Stock: p.stock,
      "Min Stock": p.minStock,
      "Standard Cost": p.standardCost,
      "Selling Price": p.sellingPrice,
      Supplier: p.supplier || "",
      Status: p.stock <= 0 ? "Out of Stock" : p.stock <= p.minStock ? "Low Stock" : "In Stock"
    }));
    exportToCSV(exportData, "inventory_export");
  };

  return (
    <DashboardLayout title="Inventory">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary">Inventory Management</h2>
          <p className="text-primary/40 text-sm mt-0.5">Track stock levels, prices and suppliers</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExport}>Export</Button>
          <Button variant="secondary" size="sm" icon={<Upload size={14} />} onClick={() => setIsImportOpen(true)}
            className="border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10">Import</Button>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setIsAddOpen(true)}>Add Product</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total Products" value={totalProducts.toString()} icon={<Package size={18} />} color="violet" />
        <StatCard label="Low Stock Items" value={lowStock.toString()} icon={<AlertTriangle size={18} />} color="rose" trend="down" change={lowStock} />
        <StatCard label="Stock Value (Cost)" value={formatCurrency(totalValue)} icon={<TrendingUp size={18} />} color="blue" />
        <StatCard label="Stock Value (Sell)" value={formatCurrency(totalSellValue)} icon={<TrendingUp size={18} />} color="emerald" />
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle>Products</CardTitle>
          {/* Search + filter */}
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40 w-4 h-4" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..."
                className="w-full bg-primary/5 border border-primary/10 rounded-xl pl-9 pr-3 py-2.5 text-sm
                  text-primary placeholder:text-primary/40 focus:outline-none focus:border-violet-500/50" />
            </div>
            <CustomSelect value={category} onChange={setCategory}
              options={categories.map(c => ({ value: c, label: c }))} className="w-32 sm:w-36" />
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-primary/10">
                {["SKU", "Product Name", "Category", "Stock", "Standard Cost", "Selling Price", "Margin", "Supplier", "Status", ""].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-primary/40 text-xs font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-primary/10">
              {isLoading ? (
                <tr><td colSpan={10} className="text-center py-12 text-primary/40 text-sm">Loading products...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-primary/40 text-sm">No products found. Click "Add Product" to get started.</td></tr>
              ) : products.map((product: any) => {
                const margin = product.standardCost > 0
                  ? (((product.sellingPrice - product.standardCost) / product.standardCost) * 100).toFixed(1)
                  : "0.0";
                const isOut = product.stock <= 0;
                const isLow = product.stock > 0 && product.stock <= product.minStock;
                return (
                  <tr key={product.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-5 py-3.5 text-primary/40 text-xs font-mono">{product.sku || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-primary text-sm font-medium group-hover:text-violet-400 transition-colors">{product.name}</span>
                    </td>
                    <td className="px-5 py-3.5"><Badge variant="violet">{product.category}</Badge></td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className={`text-sm font-semibold ${isOut ? "text-rose-400" : isLow ? "text-amber-400" : "text-primary"}`}>{product.stock}</span>
                        <div className="w-16 h-1 bg-primary/5 rounded-full mt-1">
                          <div className={`h-1 rounded-full ${isOut ? "bg-rose-500" : isLow ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${Math.min(100, product.minStock > 0 ? (Math.max(0, product.stock) / (product.minStock * 3)) * 100 : 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-primary/40 text-sm">{formatCurrency(product.standardCost)}</td>
                    <td className="px-5 py-3.5 text-primary text-sm font-medium">{formatCurrency(product.sellingPrice)}</td>
                    <td className="px-5 py-3.5"><span className="text-emerald-400 text-sm font-medium">+{margin}%</span></td>
                    <td className="px-5 py-3.5 text-primary/40 text-xs">{product.supplier || "—"}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={isOut ? "danger" : isLow ? "warning" : "success"}>
                        {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditProduct(product)}
                          aria-label={`Edit ${product.name}`}
                          className="p-1.5 rounded-lg hover:bg-violet-500/10 text-primary/40 hover:text-violet-400 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteTarget({ id: product.id, name: product.name })}
                          aria-label={`Delete ${product.name}`}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-primary/40 hover:text-rose-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {paged && paged.totalPages > 1 && (
        <Pagination
          page={paged.page}
          totalPages={paged.totalPages}
          total={paged.total}
          limit={paged.limit}
          onPage={setPage}
        />
      )}

      <AddProductModal open={isAddOpen} onClose={() => setIsAddOpen(false)} />
      {editProduct && <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} />}
      <ImportInventoryModal open={isImportOpen} onClose={() => setIsImportOpen(false)} />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete Product"
        loading={deleteProduct.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </DashboardLayout>
  );
}
