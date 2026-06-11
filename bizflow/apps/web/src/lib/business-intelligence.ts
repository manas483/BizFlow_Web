// ─────────────────────────────────────────────────────────────────────────────
// BizFlow — Business Intelligence Knowledge Base
// Maps businessType → categories, products, GST settings, dashboard config
// ─────────────────────────────────────────────────────────────────────────────

export type BusinessTypeKey =
  | "Kirana Store"
  | "FMCG Shop"
  | "Fertilizer Dealer"
  | "Hardware Store"
  | "Construction Materials"
  | "Pharmacy"
  | "Electronics Shop"
  | "Other";

export interface SeedProduct {
  name: string;
  category: string;
  sku: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  hsnCode: string;
  gstRate: number;
  unitsPerBag?: number;
}

export interface DashboardWidget {
  id: string;
  label: string;
  priority: number; // 1 = highest
}

export interface BusinessProfile {
  displayName: string;
  emoji: string;
  tagline: string;
  billingType: "gst_invoice" | "bill_of_supply" | "both";
  expenseCategories: string[];
  productCategories: string[];
  seedProducts: SeedProduct[];
  dashboardWidgets: DashboardWidget[];
  reportTypes: string[];
  insights: string[];
  gstDefaultRate: number;
  primaryUnit: string;
  customerPlaceholder?: { name: string; email: string };
}

// ─── Intelligent Detection ───────────────────────────────────────────────────

function detectIntelligentProfile(businessType: string): Partial<BusinessProfile> {
  const type = businessType.toLowerCase();
  
  if (type.includes('bakery') || type.includes('bake')) {
    return {
      emoji: "🧁",
      productCategories: ["Breads", "Cakes & Pastries", "Cookies & Biscuits", "Beverages", "Sweets"],
      expenseCategories: ["Flour & Ingredients", "Electricity", "Packaging", "Salary", "Rent"],
      primaryUnit: "pcs",
      customerPlaceholder: { name: "Aarti Bakery Shop", email: "orders@aartibakery.com" },
      seedProducts: [
        { name: "Chocolate Truffle Cake (1kg)", category: "Cakes & Pastries", sku: "CAKE-001", unit: "pcs", purchasePrice: 250, sellingPrice: 500, stock: 5, minStock: 2, hsnCode: "1905", gstRate: 18 }
      ]
    };
  }
  
  if (type.includes('salon') || type.includes('parlour') || type.includes('beauty') || type.includes('spa')) {
    return {
      emoji: "💇",
      productCategories: ["Hair Services", "Skincare", "Facials", "Makeup", "Bridal", "Retail Products"],
      expenseCategories: ["Products & Consumables", "Rent", "Salary", "Electricity", "Marketing"],
      primaryUnit: "service",
      customerPlaceholder: { name: "Priya Sharma", email: "priya.s@example.com" },
      seedProducts: [
        { name: "Haircut & Styling", category: "Hair Services", sku: "SRV-001", unit: "service", purchasePrice: 0, sellingPrice: 450, stock: 100, minStock: 0, hsnCode: "9997", gstRate: 18 },
        { name: "L'Oreal Shampoo 250ml", category: "Retail Products", sku: "RET-001", unit: "pcs", purchasePrice: 200, sellingPrice: 350, stock: 20, minStock: 5, hsnCode: "3305", gstRate: 18 }
      ]
    };
  }

  if (type.includes('cafe') || type.includes('coffee') || type.includes('restaurant')) {
    return {
      emoji: "☕",
      productCategories: ["Hot Beverages", "Cold Beverages", "Snacks", "Main Course", "Desserts"],
      expenseCategories: ["Kitchen Supplies", "Rent", "Salary", "Electricity", "Gas"],
      primaryUnit: "pcs",
      customerPlaceholder: { name: "Rahul Verma", email: "rahul.v@example.com" },
      seedProducts: [
        { name: "Cappuccino (Regular)", category: "Hot Beverages", sku: "BEV-001", unit: "pcs", purchasePrice: 30, sellingPrice: 120, stock: 100, minStock: 0, hsnCode: "2101", gstRate: 5 }
      ]
    };
  }

  if (type.includes('gym') || type.includes('fitness')) {
    return {
      emoji: "💪",
      productCategories: ["Memberships", "Personal Training", "Supplements", "Apparel"],
      expenseCategories: ["Equipment Maint.", "Rent", "Trainer Salary", "Electricity"],
      primaryUnit: "month",
      customerPlaceholder: { name: "Amit Kumar", email: "amit.k@example.com" },
      seedProducts: [
        { name: "Annual Membership", category: "Memberships", sku: "MEM-001", unit: "month", purchasePrice: 0, sellingPrice: 12000, stock: 100, minStock: 0, hsnCode: "9996", gstRate: 18 },
        { name: "Whey Protein 1kg", category: "Supplements", sku: "SUP-001", unit: "pcs", purchasePrice: 1800, sellingPrice: 2500, stock: 15, minStock: 3, hsnCode: "2106", gstRate: 18 }
      ]
    };
  }

  if (type.includes('boutique') || type.includes('cloth') || type.includes('fashion') || type.includes('garment')) {
    return {
      emoji: "👗",
      productCategories: ["Men's Wear", "Women's Wear", "Kids' Wear", "Accessories", "Alterations"],
      expenseCategories: ["Inventory", "Rent", "Salary", "Electricity", "Marketing"],
      primaryUnit: "pcs",
      customerPlaceholder: { name: "Sneha Patel", email: "sneha.p@example.com" },
      seedProducts: [
        { name: "Cotton Printed T-Shirt", category: "Men's Wear", sku: "TSH-001", unit: "pcs", purchasePrice: 250, sellingPrice: 599, stock: 30, minStock: 5, hsnCode: "6109", gstRate: 5 }
      ]
    };
  }

  return {};
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────


const profiles: Record<BusinessTypeKey, BusinessProfile> = {
  "Kirana Store": {
    displayName: "Kirana Store",
    emoji: "🛒",
    tagline: "Your neighborhood grocery — powered by BizFlow",
    billingType: "both",
    gstDefaultRate: 5,
    primaryUnit: "kg",
    expenseCategories: ["Rent", "Electricity", "Salary", "Transport", "Packaging", "Misc"],
    productCategories: ["Grains & Pulses", "Edible Oil", "Spices", "Dairy", "Beverages", "Snacks", "Cleaning", "Personal Care"],
    dashboardWidgets: [
      { id: "revenue", label: "Today's Revenue", priority: 1 },
      { id: "low_stock", label: "Low Stock Alert", priority: 2 },
      { id: "top_products", label: "Top Selling Items", priority: 3 },
      { id: "dues", label: "Customer Dues", priority: 4 },
      { id: "weekly_sales", label: "Weekly Sales", priority: 5 },
    ],
    reportTypes: ["Daily Sales", "Stock Report", "Customer Ledger", "GST Summary"],
    insights: [
      "Track daily sales to identify peak hours",
      "Set reorder alerts to avoid stockouts",
      "Offer credit to loyal customers with due tracking",
    ],
    seedProducts: [
      { name: "Basmati Rice (25kg)", category: "Grains & Pulses", sku: "GR-001", unit: "bag", purchasePrice: 1250, sellingPrice: 1450, stock: 50, minStock: 10, hsnCode: "1006", gstRate: 0 },
      { name: "Toor Dal (1kg)", category: "Grains & Pulses", sku: "PL-001", unit: "kg", purchasePrice: 135, sellingPrice: 160, stock: 40, minStock: 15, hsnCode: "0713", gstRate: 0 },
      { name: "Sunflower Oil (1L)", category: "Edible Oil", sku: "OL-001", unit: "ltr", purchasePrice: 130, sellingPrice: 155, stock: 60, minStock: 20, hsnCode: "1512", gstRate: 5 },
      { name: "Sugar (1kg)", category: "Grains & Pulses", sku: "SG-001", unit: "kg", purchasePrice: 42, sellingPrice: 52, stock: 100, minStock: 30, hsnCode: "1701", gstRate: 5 },
      { name: "Chilli Powder (500g)", category: "Spices", sku: "SP-001", unit: "pkt", purchasePrice: 85, sellingPrice: 115, stock: 30, minStock: 10, hsnCode: "0904", gstRate: 5 },
      { name: "Aashirvaad Atta (10kg)", category: "Grains & Pulses", sku: "GR-002", unit: "bag", purchasePrice: 355, sellingPrice: 420, stock: 25, minStock: 8, hsnCode: "1101", gstRate: 0 },
    ],
    customerPlaceholder: { name: "Ramesh Grocery", email: "ramesh@grocery.in" },
  },

  "FMCG Shop": {
    displayName: "FMCG Shop",
    emoji: "🏪",
    tagline: "Fast-moving goods, faster billing",
    billingType: "gst_invoice",
    gstDefaultRate: 12,
    primaryUnit: "pcs",
    expenseCategories: ["Rent", "Electricity", "Salary", "Marketing", "Transport", "Misc"],
    productCategories: ["Beverages", "Snacks & Biscuits", "Personal Care", "Home Care", "Dairy", "Frozen Foods", "Baby Products"],
    dashboardWidgets: [
      { id: "revenue", label: "Total Revenue", priority: 1 },
      { id: "top_brands", label: "Top Brands", priority: 2 },
      { id: "low_stock", label: "Low Stock", priority: 3 },
      { id: "margin_analysis", label: "Margin Analysis", priority: 4 },
      { id: "returns", label: "Returns & Damages", priority: 5 },
    ],
    reportTypes: ["Brand-wise Sales", "Category Report", "GST Return", "Stock Ageing"],
    insights: [
      "Monitor brand-wise margins to optimize stocking",
      "Track fast-movers to avoid stockouts",
      "Bulk orders reduce per-unit cost significantly",
    ],
    seedProducts: [
      { name: "Parle-G Biscuit (800g)", category: "Snacks & Biscuits", sku: "SN-001", unit: "pkt", purchasePrice: 45, sellingPrice: 50, stock: 100, minStock: 30, hsnCode: "1905", gstRate: 18 },
      { name: "Colgate MaxFresh (150g)", category: "Personal Care", sku: "PC-001", unit: "pcs", purchasePrice: 65, sellingPrice: 82, stock: 50, minStock: 15, hsnCode: "3306", gstRate: 18 },
      { name: "Surf Excel (1kg)", category: "Home Care", sku: "HC-001", unit: "pkt", purchasePrice: 120, sellingPrice: 145, stock: 40, minStock: 10, hsnCode: "3402", gstRate: 18 },
      { name: "Amul Butter (500g)", category: "Dairy", sku: "DY-001", unit: "pkt", purchasePrice: 215, sellingPrice: 250, stock: 20, minStock: 5, hsnCode: "0405", gstRate: 12 },
      { name: "Coca-Cola (2L)", category: "Beverages", sku: "BV-001", unit: "btl", purchasePrice: 70, sellingPrice: 90, stock: 60, minStock: 20, hsnCode: "2202", gstRate: 28 },
    ],
    customerPlaceholder: { name: "City Supermarket", email: "purchase@citysuper.com" },
  },

  "Fertilizer Dealer": {
    displayName: "Fertilizer Dealer",
    emoji: "🌾",
    tagline: "Agri-commerce, simplified",
    billingType: "gst_invoice",
    gstDefaultRate: 0,
    primaryUnit: "bag",
    expenseCategories: ["Rent", "Salary", "Transport", "Storage", "License Fees", "Misc"],
    productCategories: ["Fertilizers", "Pesticides", "Seeds", "Irrigation Equipment", "Farming Tools", "Soil Conditioners"],
    dashboardWidgets: [
      { id: "revenue", label: "Season Revenue", priority: 1 },
      { id: "stock_by_season", label: "Stock by Season", priority: 2 },
      { id: "top_products", label: "Top Agri Products", priority: 3 },
      { id: "pending_orders", label: "Farmer Orders", priority: 4 },
      { id: "credit_customers", label: "Credit Farmers", priority: 5 },
    ],
    reportTypes: ["Seasonal Sales", "Pesticide Stock Report", "Farmer Ledger", "GST E-Way Bill"],
    insights: [
      "Fertilizer demand peaks in Kharif/Rabi seasons — stock up early",
      "Track farmer credit carefully during off-season",
      "Monitor pesticide batch expiry dates regularly",
    ],
    seedProducts: [
      { name: "Matix Urea 45 Kg", sku: "MTX-UR-45", category: "Fertilizers", stock: 20, unitsPerBag: 1, purchasePrice: 260, sellingPrice: 290, minStock: 10, hsnCode: "31021000", gstRate: 0, unit: "bag" },
      { name: "GR 28:28:0 50 Kg", sku: "GR-2828-50", category: "Fertilizers", stock: 15, unitsPerBag: 1, purchasePrice: 1890, sellingPrice: 2050, minStock: 8, hsnCode: "31055100", gstRate: 0, unit: "bag" },
      { name: "IPL DAP 50 Kg", sku: "IPL-DP-50", category: "Fertilizers", stock: 10, unitsPerBag: 1, purchasePrice: 1345, sellingPrice: 1450, minStock: 10, hsnCode: "31053000", gstRate: 0, unit: "bag" },
      { name: "NR DAP 50 Kg", sku: "NR-DP-50", category: "Fertilizers", stock: 10, unitsPerBag: 1, purchasePrice: 1345, sellingPrice: 1450, minStock: 10, hsnCode: "31053000", gstRate: 0, unit: "bag" },
      { name: "GR 20:20:0:13 50 Kg", sku: "GR-2020-50", category: "Fertilizers", stock: 20, unitsPerBag: 1, purchasePrice: 1790, sellingPrice: 1920, minStock: 10, hsnCode: "31055100", gstRate: 0, unit: "bag" },
      { name: "NR 20:20:0:13 50 Kg", sku: "NR-2020-50", category: "Fertilizers", stock: 20, unitsPerBag: 1, purchasePrice: 1790, sellingPrice: 1920, minStock: 10, hsnCode: "31055900", gstRate: 0, unit: "bag" },
      { name: "IPL MOP 50 Kg", sku: "IPL-MP-50", category: "Fertilizers", stock: 25, unitsPerBag: 1, purchasePrice: 1845, sellingPrice: 1980, minStock: 10, hsnCode: "31042000", gstRate: 0, unit: "bag" },
      { name: "NR TSP 46% 50 Kg", sku: "NR-TS-50", category: "Fertilizers", stock: 10, unitsPerBag: 1, purchasePrice: 1295, sellingPrice: 1400, minStock: 5, hsnCode: "31031100", gstRate: 0, unit: "bag" },
      { name: "Trump-162LS", sku: "TRM-162", category: "Seeds", stock: 10, unitsPerBag: 5, purchasePrice: 1000, sellingPrice: 1200, minStock: 5, hsnCode: "1209", gstRate: 0, unit: "pack" },
      { name: "Yashraj", sku: "YSH-RJ", category: "Seeds", stock: 6, unitsPerBag: 6, purchasePrice: 510, sellingPrice: 620, minStock: 3, hsnCode: "1209", gstRate: 0, unit: "pack" },
      { name: "Pan 804 (Jamuna)", sku: "PAN-804", category: "Seeds", stock: 12, unitsPerBag: 6, purchasePrice: 730, sellingPrice: 850, minStock: 6, hsnCode: "1209", gstRate: 0, unit: "pack" },
      { name: "NP-7075", sku: "NP-7075", category: "Seeds", stock: 12, unitsPerBag: 6, purchasePrice: 672, sellingPrice: 780, minStock: 6, hsnCode: "1209", gstRate: 0, unit: "pack" },
      { name: "Vishal Gaurav", sku: "VSH-GR", category: "Seeds", stock: 12, unitsPerBag: 6, purchasePrice: 600, sellingPrice: 700, minStock: 6, hsnCode: "1209", gstRate: 0, unit: "pack" },
      { name: "Sindhu", sku: "SND-HU", category: "Seeds", stock: 8, unitsPerBag: 4, purchasePrice: 970, sellingPrice: 1100, minStock: 4, hsnCode: "1209", gstRate: 0, unit: "pack" },
      { name: "Kalachampa Gold", sku: "KLC-GD", category: "Seeds", stock: 8, unitsPerBag: 4, purchasePrice: 760, sellingPrice: 880, minStock: 4, hsnCode: "1209", gstRate: 0, unit: "pack" },
      { name: "Chemfree Vamax 4 KG", sku: "CF-VMX-4", category: "Soil Conditioners", stock: 18, unitsPerBag: 1, purchasePrice: 550, sellingPrice: 650, minStock: 5, hsnCode: "3101", gstRate: 0, unit: "pcs" },
      { name: "Shaktiman Oorja (FCO) 1 KG", sku: "SM-ORJ-1", category: "Soil Conditioners", stock: 25, unitsPerBag: 1, purchasePrice: 90, sellingPrice: 120, minStock: 10, hsnCode: "3101", gstRate: 0, unit: "pcs" },
      { name: "Matix Zinc Sulphate (33%) 1 KG", sku: "MTX-ZN-1", category: "Soil Conditioners", stock: 20, unitsPerBag: 1, purchasePrice: 190, sellingPrice: 240, minStock: 5, hsnCode: "2833", gstRate: 0, unit: "pcs" },
      { name: "PROM (Prabhat) 50 KG", sku: "PRM-PB-50", category: "Soil Conditioners", stock: 5, unitsPerBag: 1, purchasePrice: 1250, sellingPrice: 1450, minStock: 2, hsnCode: "3101", gstRate: 0, unit: "pcs" },
      { name: "Nashak 500 ml", sku: "NSK-500", category: "Pesticides", stock: 20, unitsPerBag: 1, purchasePrice: 275, sellingPrice: 350, minStock: 5, hsnCode: "3808", gstRate: 0, unit: "pcs" },
      { name: "Nashak 250 ml", sku: "NSK-250", category: "Pesticides", stock: 40, unitsPerBag: 1, purchasePrice: 150, sellingPrice: 200, minStock: 10, hsnCode: "3808", gstRate: 0, unit: "pcs" }
    ],
    customerPlaceholder: { name: "Kisan Agro Farm", email: "contact@kisanfarm.in" },
  },

  "Hardware Store": {
    displayName: "Hardware Store",
    emoji: "🔧",
    tagline: "Every bolt, every beam — tracked",
    billingType: "gst_invoice",
    gstDefaultRate: 18,
    primaryUnit: "pcs",
    expenseCategories: ["Rent", "Salary", "Transport", "Electricity", "Tools & Equipment", "Misc"],
    productCategories: ["Fasteners", "Plumbing", "Electrical", "Hand Tools", "Power Tools", "Paints", "Safety Equipment"],
    dashboardWidgets: [
      { id: "revenue", label: "Total Revenue", priority: 1 },
      { id: "project_sales", label: "Project Sales", priority: 2 },
      { id: "low_stock", label: "Low Stock Alert", priority: 3 },
      { id: "bulk_customers", label: "Contractor Orders", priority: 4 },
      { id: "returns", label: "Returns", priority: 5 },
    ],
    reportTypes: ["Product-wise Sales", "Contractor Ledger", "GST GSTR-1", "Stock Valuation"],
    insights: [
      "Contractor accounts drive 60% of hardware sales — offer credit",
      "Keep fast-moving fasteners and plumbing stock high",
      "Track paint batch numbers for warranty",
    ],
    seedProducts: [
      { name: "Iron Nails (1kg)", category: "Fasteners", sku: "HW-001", unit: "kg", purchasePrice: 60, sellingPrice: 85, stock: 50, minStock: 10, hsnCode: "7317", gstRate: 18 },
      { name: "PVC Pipe 1\" (3m)", category: "Plumbing", sku: "PL-001", unit: "pcs", purchasePrice: 120, sellingPrice: 155, stock: 80, minStock: 20, hsnCode: "3917", gstRate: 18 },
      { name: "MCB 32A Single Pole", category: "Electrical", sku: "EL-001", unit: "pcs", purchasePrice: 180, sellingPrice: 240, stock: 30, minStock: 5, hsnCode: "8536", gstRate: 18 },
      { name: "Hammer 500g", category: "Hand Tools", sku: "HT-001", unit: "pcs", purchasePrice: 150, sellingPrice: 220, stock: 20, minStock: 5, hsnCode: "8205", gstRate: 18 },
      { name: "Asian Paints Apex (10L)", category: "Paints", sku: "PT-001", unit: "tin", purchasePrice: 1650, sellingPrice: 2100, stock: 25, minStock: 5, hsnCode: "3209", gstRate: 18 },
    ],
    customerPlaceholder: { name: "ABC Construction", email: "info@abcbuild.com" },
  },

  "Construction Materials": {
    displayName: "Construction Materials",
    emoji: "🏗️",
    tagline: "Build more, worry less",
    billingType: "gst_invoice",
    gstDefaultRate: 18,
    primaryUnit: "bag",
    expenseCategories: ["Rent", "Salary", "Transport", "Loading/Unloading", "Crane Charges", "Misc"],
    productCategories: ["Cement & Concrete", "Steel & Iron", "Bricks & Blocks", "Sand & Aggregate", "Roofing", "Tiles & Flooring", "Waterproofing"],
    dashboardWidgets: [
      { id: "revenue", label: "Total Revenue", priority: 1 },
      { id: "project_deliveries", label: "Deliveries Today", priority: 2 },
      { id: "stock_weight", label: "Stock by Weight", priority: 3 },
      { id: "site_orders", label: "Site Orders", priority: 4 },
      { id: "dues", label: "Contractor Dues", priority: 5 },
    ],
    reportTypes: ["Site-wise Sales", "Material Delivery Log", "GST E-Way Bill", "Contractor Ledger"],
    insights: [
      "Construction demand spikes in post-monsoon season",
      "Large order discounts improve contractor loyalty",
      "E-Way bill required for materials above ₹50,000",
    ],
    seedProducts: [
      { name: "UltraTech Cement (50kg)", category: "Cement & Concrete", sku: "CM-001", unit: "bag", purchasePrice: 370, sellingPrice: 420, stock: 500, minStock: 100, hsnCode: "2523", gstRate: 28 },
      { name: "TMT Steel Bar 10mm (12m)", category: "Steel & Iron", sku: "ST-001", unit: "pcs", purchasePrice: 580, sellingPrice: 680, stock: 200, minStock: 50, hsnCode: "7213", gstRate: 18 },
      { name: "Red Brick (per 1000)", category: "Bricks & Blocks", sku: "BR-001", unit: "lot", purchasePrice: 5500, sellingPrice: 6500, stock: 20, minStock: 5, hsnCode: "6901", gstRate: 5 },
      { name: "River Sand (per truck)", category: "Sand & Aggregate", sku: "SA-001", unit: "trip", purchasePrice: 12000, sellingPrice: 15000, stock: 10, minStock: 2, hsnCode: "2505", gstRate: 5 },
      { name: "Ceramic Tile 2x2 ft (box)", category: "Tiles & Flooring", sku: "TL-001", unit: "box", purchasePrice: 350, sellingPrice: 480, stock: 100, minStock: 20, hsnCode: "6908", gstRate: 28 },
    ],
    customerPlaceholder: { name: "Skyline Developers", email: "procurement@skyline.com" },
  },

  "Pharmacy": {
    displayName: "Pharmacy",
    emoji: "💊",
    tagline: "Healthcare inventory, zero compromise",
    billingType: "both",
    gstDefaultRate: 12,
    primaryUnit: "strip",
    expenseCategories: ["Rent", "Salary", "Cold Storage", "License Renewal", "Electricity", "Misc"],
    productCategories: ["Prescription Drugs", "OTC Medicines", "Vitamins & Supplements", "Medical Devices", "Personal Care", "Baby Care", "Surgical Items"],
    dashboardWidgets: [
      { id: "revenue", label: "Daily Revenue", priority: 1 },
      { id: "expiry_alerts", label: "Expiry Alerts", priority: 2 },
      { id: "prescription_count", label: "Prescriptions Today", priority: 3 },
      { id: "top_medicines", label: "Top Medicines", priority: 4 },
      { id: "schedule_h", label: "Schedule H Stock", priority: 5 },
    ],
    reportTypes: ["Daily Dispensing Report", "Expiry Report", "Schedule H/X Register", "GST Summary"],
    insights: [
      "Monitor batch expiry — near-expiry items must be returned to distributor",
      "Seasonal demand spikes for antihistamines (May-July) and cold meds (Oct-Jan)",
      "Maintain Schedule H register for controlled medications",
    ],
    seedProducts: [
      { name: "Paracetamol 500mg (10s)", category: "OTC Medicines", sku: "MED-001", unit: "strip", purchasePrice: 12, sellingPrice: 18, stock: 200, minStock: 50, hsnCode: "3004", gstRate: 12 },
      { name: "Azithromycin 500mg (3s)", category: "Prescription Drugs", sku: "MED-002", unit: "strip", purchasePrice: 55, sellingPrice: 80, stock: 50, minStock: 15, hsnCode: "3004", gstRate: 12 },
      { name: "Cetirizine 10mg (10s)", category: "OTC Medicines", sku: "MED-003", unit: "strip", purchasePrice: 20, sellingPrice: 32, stock: 100, minStock: 25, hsnCode: "3004", gstRate: 12 },
      { name: "Dolo 650 (15s)", category: "OTC Medicines", sku: "MED-004", unit: "strip", purchasePrice: 22, sellingPrice: 35, stock: 150, minStock: 30, hsnCode: "3004", gstRate: 12 },
      { name: "Vitamin C 500mg (10s)", category: "Vitamins & Supplements", sku: "VIT-001", unit: "strip", purchasePrice: 45, sellingPrice: 75, stock: 80, minStock: 20, hsnCode: "3004", gstRate: 12 },
      { name: "Digital Thermometer", category: "Medical Devices", sku: "DEV-001", unit: "pcs", purchasePrice: 180, sellingPrice: 280, stock: 20, minStock: 5, hsnCode: "9025", gstRate: 12 },
    ],
    customerPlaceholder: { name: "Dr. Singh Clinic", email: "dr.singh@clinic.com" },
  },

  "Electronics Shop": {
    displayName: "Electronics Shop",
    emoji: "📱",
    tagline: "Smart devices, smarter billing",
    billingType: "gst_invoice",
    gstDefaultRate: 18,
    primaryUnit: "pcs",
    expenseCategories: ["Rent", "Salary", "Insurance", "Demo Units", "Electricity", "Marketing", "Misc"],
    productCategories: ["Mobile Phones", "Laptops & Tablets", "Accessories", "Audio", "Smart Home", "Cameras", "Gaming", "Components"],
    dashboardWidgets: [
      { id: "revenue", label: "Total Revenue", priority: 1 },
      { id: "imei_tracker", label: "IMEI Tracking", priority: 2 },
      { id: "warranty_alerts", label: "Warranty Expiry", priority: 3 },
      { id: "top_brands", label: "Top Brands", priority: 4 },
      { id: "emi_sales", label: "EMI Sales", priority: 5 },
    ],
    reportTypes: ["IMEI-wise Sales", "Brand Report", "GST GSTR-1", "Service Center Log"],
    insights: [
      "Festival season (Oct-Dec) drives 40% of annual electronics sales",
      "IMEI tracking is mandatory for GST compliance on phones",
      "Accessories have 60-80% margins — promote bundles",
    ],
    seedProducts: [
      { name: "Samsung Galaxy A55 5G", category: "Mobile Phones", sku: "MB-001", unit: "pcs", purchasePrice: 28000, sellingPrice: 34999, stock: 10, minStock: 2, hsnCode: "8517", gstRate: 18 },
      { name: "Boat Rockerz 255 Pro", category: "Audio", sku: "AU-001", unit: "pcs", purchasePrice: 800, sellingPrice: 1499, stock: 20, minStock: 5, hsnCode: "8518", gstRate: 18 },
      { name: "Anker 65W Charger", category: "Accessories", sku: "AC-001", unit: "pcs", purchasePrice: 700, sellingPrice: 1299, stock: 30, minStock: 10, hsnCode: "8504", gstRate: 18 },
      { name: "SanDisk 128GB MicroSD", category: "Accessories", sku: "AC-002", unit: "pcs", purchasePrice: 450, sellingPrice: 799, stock: 40, minStock: 10, hsnCode: "8523", gstRate: 18 },
      { name: "HP Pavilion 15 (Ryzen 5)", category: "Laptops & Tablets", sku: "LT-001", unit: "pcs", purchasePrice: 45000, sellingPrice: 58999, stock: 5, minStock: 1, hsnCode: "8471", gstRate: 18 },
    ],
    customerPlaceholder: { name: "Tech Solutions IT", email: "purchase@techit.in" },
  },

  "Other": {
    displayName: "General Business",
    emoji: "🏢",
    tagline: "Every business deserves smart management",
    billingType: "both",
    gstDefaultRate: 18,
    primaryUnit: "pcs",
    expenseCategories: ["Rent", "Electricity", "Salary", "Transport", "Marketing", "Misc"],
    productCategories: ["Category A", "Category B", "Category C", "Services"],
    dashboardWidgets: [
      { id: "revenue", label: "Total Revenue", priority: 1 },
      { id: "sales_count", label: "Total Sales", priority: 2 },
      { id: "customers", label: "Customers", priority: 3 },
      { id: "expenses", label: "Expenses", priority: 4 },
      { id: "profit", label: "Net Profit", priority: 5 },
    ],
    reportTypes: ["Sales Report", "Expense Report", "Customer Report", "GST Summary"],
    insights: [
      "Start by adding your product catalog",
      "Set minimum stock levels to get reorder alerts",
      "Use customer dues tracking to manage credit",
    ],
    seedProducts: [
      { name: "Sample Product 1", category: "Category A", sku: "GEN-001", unit: "pcs", purchasePrice: 100, sellingPrice: 150, stock: 50, minStock: 10, hsnCode: "9999", gstRate: 18 },
      { name: "Sample Product 2", category: "Category B", sku: "GEN-002", unit: "pcs", purchasePrice: 200, sellingPrice: 280, stock: 30, minStock: 5, hsnCode: "9999", gstRate: 18 },
    ],
    customerPlaceholder: { name: "Acme Corp", email: "john@example.com" },
  },
};

export function getBusinessProfile(businessType: string): BusinessProfile {
  const profile = profiles[businessType as BusinessTypeKey];
  if (profile) return profile;

  // Dynamic fallback for custom business types (e.g., "Bakery")
  const customProfile = { ...profiles["Other"] };
  if (businessType && businessType !== "Other") {
    const intelligentDefaults = detectIntelligentProfile(businessType);
    
    customProfile.displayName = businessType;
    customProfile.tagline = `${businessType} management, simplified`;
    
    if (intelligentDefaults.emoji) customProfile.emoji = intelligentDefaults.emoji;
    if (intelligentDefaults.productCategories) customProfile.productCategories = intelligentDefaults.productCategories;
    if (intelligentDefaults.expenseCategories) customProfile.expenseCategories = intelligentDefaults.expenseCategories;
    if (intelligentDefaults.primaryUnit) customProfile.primaryUnit = intelligentDefaults.primaryUnit;
    if (intelligentDefaults.seedProducts && intelligentDefaults.seedProducts.length > 0) {
      customProfile.seedProducts = intelligentDefaults.seedProducts;
    } else {
      // Clear seed products for custom types if no intelligent ones found
      customProfile.seedProducts = [];
    }
    if (intelligentDefaults.customerPlaceholder) {
      customProfile.customerPlaceholder = intelligentDefaults.customerPlaceholder;
    }
  }
  return customProfile;
}

export function getAllBusinessTypes(): BusinessTypeKey[] {
  return Object.keys(profiles) as BusinessTypeKey[];
}

export function getOnboardingConfig(businessType: string) {
  const profile = getBusinessProfile(businessType);
  return {
    billingType: profile.billingType,
    gstDefaultRate: profile.gstDefaultRate,
    primaryUnit: profile.primaryUnit,
    dashboardWidgets: profile.dashboardWidgets,
    reportTypes: profile.reportTypes,
    expenseCategories: profile.expenseCategories,
    productCategories: profile.productCategories,
    insights: profile.insights,
    emoji: profile.emoji,
    tagline: profile.tagline,
  };
}

export function findProductIntelligence(
  businessType: string,
  name: string,
  sku?: string
): Partial<SeedProduct> | null {
  const profile = getBusinessProfile(businessType);
  if (!profile || !profile.seedProducts) return null;

  const searchSku = sku?.trim().toLowerCase();
  const searchName = name?.trim().toLowerCase();

  // 1. Try exact SKU match
  if (searchSku) {
    const matched = profile.seedProducts.find(
      (p) => p.sku?.trim().toLowerCase() === searchSku
    );
    if (matched) return matched;
  }

  // 2. Try exact name match
  if (searchName) {
    const matched = profile.seedProducts.find(
      (p) => p.name.trim().toLowerCase() === searchName
    );
    if (matched) return matched;
  }

  // 3. Try partial name match (e.g., "Trump-162" inside "Trump-162LS")
  if (searchName) {
    const matched = profile.seedProducts.find(
      (p) =>
        p.name.trim().toLowerCase().includes(searchName) ||
        searchName.includes(p.name.trim().toLowerCase())
    );
    if (matched) return matched;
  }

  return null;
}
