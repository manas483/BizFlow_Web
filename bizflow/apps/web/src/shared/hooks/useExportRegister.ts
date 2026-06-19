import { useState, useEffect } from 'react';
import { exportRegister, exportBIReport } from '@/shared/lib/export-excel';

export function useExportRegister() {
  const [categories, setCategories] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    // Fetch available categories dynamically
    fetch('/api/reports/register')
      .then(res => res.json())
      .then(data => {
        if (data.categories) {
          setCategories(data.categories);
        }
      })
      .catch(console.error);
  }, []);

  const handleExportRegister = async (type: 'sale' | 'stock' | 'combined', category: string, period: string, startDate?: string, endDate?: string) => {
    setIsExporting(true);
    try {
      let url = `/api/reports/register?category=${encodeURIComponent(category)}&period=${period}`;
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
