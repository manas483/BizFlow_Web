import { useState, useEffect } from 'react';
import { exportRegister, exportBIReport } from './export-excel';

export function useExportRegister() {
  const [categories, setCategories] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Fetch available categories dynamically
    fetch('/api/reports/register')
      .then(res => res.json())
      .then(data => {
        if (data.categories) {
          // ensure Fertiliser, Pesticide, Seed are always available even if empty, or just rely on DB
          const base = ['Fertiliser', 'Pesticide', 'Seed'];
          const combined = Array.from(new Set([...base, ...data.categories]));
          setCategories(combined);
        }
      })
      .catch(console.error);
  }, []);

  const handleExportRegister = async (type: 'sale' | 'stock', category: string, startDate?: string, endDate?: string) => {
    setIsExporting(true);
    try {
      let url = `/api/reports/register?category=${encodeURIComponent(category)}`;
      if (startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      
      exportRegister(type, category, data, { from: startDate || '', to: endDate || '' });
    } catch (error) {
      console.error('Failed to export register', error);
      alert('Failed to generate export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBI = (reportData: any) => {
    try {
      exportBIReport(reportData);
    } catch (error) {
      console.error('Failed to export BI report', error);
      alert('Failed to generate BI report.');
    }
  };

  return {
    categories,
    isExporting,
    handleExportRegister,
    handleExportBI
  };
}
