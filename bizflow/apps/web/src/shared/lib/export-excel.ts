import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export function exportRegister(type: 'sale' | 'stock', category: string, data: any, period: { from: string; to: string }) {
  const wb = XLSX.utils.book_new();

  if (type === 'stock') {
    const wsData = generateStockRegisterData(data);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Merge headers
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } }, // Title
      { s: { r: 2, c: 2 }, e: { r: 2, c: 5 } },  // Received/Purchased From
    ];

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 15 }, // Opening Balance
      { wch: 20 }, // From Whom
      { wch: 15 }, // Challan No
      { wch: 10 }, // Quantity
      { wch: 10 }, // Rate
      { wch: 15 }, // Total Quantity
      { wch: 15 }, // Quantity Sold
      { wch: 15 }, // Closing Balance
      { wch: 20 }, // Signature
      { wch: 20 }, // Remarks
    ];

    XLSX.utils.book_append_sheet(wb, ws, `${category} Stock Register`);
  } else {
    const wsData = generateSaleRegisterData(data);
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Merge headers
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }, // Title
      { s: { r: 2, c: 6 }, e: { r: 2, c: 8 } },  // Sales Details
    ];

    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // Sl No
      { wch: 12 }, // Date
      { wch: 20 }, // Farmer Name
      { wch: 15 }, // Village
      { wch: 10 }, // GP
      { wch: 15 }, // Adhar No
      { wch: 20 }, // Item Name
      { wch: 15 }, // Qty
      { wch: 10 }, // Rate
      { wch: 15 }, // Amount
      { wch: 15 }, // Cash MR Memo No
      { wch: 20 }, // Signature
    ];

    XLSX.utils.book_append_sheet(wb, ws, `${category} Sale Register`);
  }

  const fileName = `${category}_${type}_Register_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function generateStockRegisterData(data: any) {
  const { products, sales, stockMovements, period } = data;
  
  const rows: any[][] = [];
  
  rows.push([`${data.category.toUpperCase()} WISE STOCK REPORT`]);
  rows.push([]); // Empty row
  
  // Headers
  rows.push([
    'Date', 'Opening Balance', 'Received/Purchased From', '', '', '', 'Total Quantity', 'Quantity Sold', 'Closing Balance', 'Signature of Dealer', 'Remarks'
  ]);
  rows.push([
    '', '', 'From Whom', 'Challan No', 'Quantity', 'Rate', '', '', '', '', ''
  ]);
  
  // Create a map of events by Date
  const eventsByDate: Record<string, { in: any[], out: any[] }> = {};
  
  stockMovements.forEach((m: any) => {
    const d = format(new Date(m.createdAt), 'yyyy-MM-dd');
    if (!eventsByDate[d]) eventsByDate[d] = { in: [], out: [] };
    eventsByDate[d].in.push(m);
  });
  
  sales.forEach((s: any) => {
    const d = format(new Date(s.createdAt), 'yyyy-MM-dd');
    if (!eventsByDate[d]) eventsByDate[d] = { in: [], out: [] };
    
    // Group sale items
    const qty = s.items.reduce((acc: number, item: any) => acc + item.qty, 0);
    eventsByDate[d].out.push({ qty, invoiceNo: s.invoiceNo });
  });

  // Calculate generic opening balance
  // Assuming products.stock is current stock, we'll just show the movement logic for the report timeframe.
  // Proper historical stock requires ledger calculation. We'll use a placeholder or basic calculation.
  let currentStock = products.reduce((acc: number, p: any) => acc + p.stock, 0);
  
  // Start from earliest date in period or first event
  const sortedDates = Object.keys(eventsByDate).sort();
  
  sortedDates.forEach(dateStr => {
    const evs = eventsByDate[dateStr];
    
    // We will list each incoming movement, and summarize sales
    // If multiple ins and outs, we can create multiple rows or combine.
    // For simplicity, we create one row per IN, and if no IN, just one row for OUT.
    const maxRows = Math.max(evs.in.length, 1);
    
    let dailySold = evs.out.reduce((a: number, b: any) => a + b.qty, 0);
    let dailyIn = evs.in.reduce((a: number, b: any) => a + b.quantity, 0);
    
    // Back-calculate opening balance for this specific row line (simplified)
    const openingBal = currentStock - dailyIn + dailySold; 
    let runningStock = openingBal;
    
    for (let i = 0; i < maxRows; i++) {
      const inMov = evs.in[i];
      const purchasedQty = inMov ? inMov.quantity : '';
      const purchasedRate = inMov ? (inMov.product?.purchasePrice || '') : '';
      const fromWhom = inMov ? (inMov.notes || 'Supplier') : '';
      const challan = inMov ? (inMov.referenceId || '') : '';
      
      const soldQty = i === 0 ? dailySold : ''; // Only show total daily sold on first row
      const totalQty = i === 0 ? openingBal + dailyIn : '';
      runningStock = runningStock + (inMov ? inMov.quantity : 0) - (i === 0 ? dailySold : 0);
      
      rows.push([
        i === 0 ? dateStr : '',
        i === 0 ? openingBal : '',
        fromWhom,
        challan,
        purchasedQty,
        purchasedRate,
        totalQty,
        soldQty,
        i === maxRows - 1 ? runningStock : '',
        '', // Signature
        ''  // Remarks
      ]);
    }
    
    currentStock = runningStock;
  });

  return rows;
}

function generateSaleRegisterData(data: any) {
  const { sales } = data;
  
  const rows: any[][] = [];
  
  rows.push([`${data.category.toUpperCase()} Sale Register`]);
  rows.push([]);
  
  rows.push([
    'Sl No', 'Date', 'Name of the Farmer', 'Village', 'GP', 'Adhar No', 'Sales Details', '', '', 'Amount', 'Cash MR memo No.', 'Signature of Farmer'
  ]);
  rows.push([
    '', '', '', '', '', '', `${data.category} name`, 'quantity sold', 'rate', '', '', ''
  ]);
  
  let slNo = 1;
  sales.forEach((s: any) => {
    const dateStr = format(new Date(s.createdAt), 'yyyy-MM-dd');
    const customerName = s.customer?.name || 'Cash Customer';
    const village = s.customer?.address || ''; // Mapping address to village
    
    // A sale can have multiple items, we'll list them
    s.items.forEach((item: any, i: number) => {
      rows.push([
        i === 0 ? slNo++ : '',
        i === 0 ? dateStr : '',
        i === 0 ? customerName : '',
        i === 0 ? village : '',
        '', // GP
        '', // Aadhar
        item.product?.name || '',
        item.qty,
        item.price,
        i === 0 ? s.total : '',
        i === 0 ? s.invoiceNo : '',
        '' // Signature
      ]);
    });
  });

  return rows;
}

// Optional BI export if needed
export function exportBIReport(reportData: any) {
  const wb = XLSX.utils.book_new();
  
  // Add summary sheet
  const summaryWs = XLSX.utils.json_to_sheet([
    {
      Metric: 'Total Sales Revenue',
      Value: reportData.summary.totalSales
    },
    {
      Metric: 'Gross Profit',
      Value: reportData.summary.grossProfit
    },
    {
      Metric: 'Net Profit',
      Value: reportData.summary.netProfit
    },
    {
      Metric: 'Outstanding Dues',
      Value: reportData.summary.outstandingDues
    }
  ]);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Executive Summary');

  // Add products sheet
  const productsWs = XLSX.utils.json_to_sheet(reportData.topProducts.map((p: any) => ({
    'Product Name': p.product?.name,
    'Category': p.product?.category,
    'Quantity Sold': p.qty,
    'Revenue': p.revenue
  })));
  XLSX.utils.book_append_sheet(wb, productsWs, 'Product Performance');

  // Add customers sheet
  const customersWs = XLSX.utils.json_to_sheet(reportData.topCustomers.map((c: any) => ({
    'Customer Name': c.customer?.name,
    'Phone': c.customer?.phone,
    'Total Revenue': c.total
  })));
  XLSX.utils.book_append_sheet(wb, customersWs, 'Customer Insights');

  XLSX.writeFile(wb, `Business_Intelligence_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
