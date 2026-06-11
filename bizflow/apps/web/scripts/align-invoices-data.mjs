/**
 * Script: Align database product records with physical invoices
 *
 * Run: node scripts/align-invoices-data.mjs
 */
import pg from 'pg';

const DATABASE_URL = "postgres://e44ab1827ec514905ab475e3dcba47480dd1f2d4e96299f8ea1032e36132407e:sk_zKK4j0aNjyW6NvLz80fPP@db.prisma.io:5432/postgres?sslmode=require";

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const USER_EMAIL = "sachan.manas483@gmail.com";
const PURCHASE_DATE = new Date("2026-06-08");

// Define product updates mapped to their respective invoices
const updates = [
  // 1. Fertilizers (Invoice: AGCMBPDF0274, Supplier: AGROCHEM)
  // Transport cost already set to 0 per bag
  { name: "Matix Urea 45 Kg", category: "Fertilizer", invoice: "AGCMBPDF0274", supplier: "AGROCHEM", basePrice: 260.00, transport: 0 },
  { name: "GR 28:28:0 50 Kg", category: "Fertilizer", invoice: "AGCMBPDF0274", supplier: "AGROCHEM", basePrice: 1890.00, transport: 0 },
  { name: "IPL DAP 50 Kg", category: "Fertilizer", invoice: "AGCMBPDF0274", supplier: "AGROCHEM", basePrice: 1345.00, transport: 0 },
  { name: "NR DAP 50 Kg", category: "Fertilizer", invoice: "AGCMBPDF0274", supplier: "AGROCHEM", basePrice: 1345.00, transport: 0 },
  { name: "GR 20:20:0:13 50 Kg", category: "Fertilizer", invoice: "AGCMBPDF0274", supplier: "AGROCHEM", basePrice: 1790.00, transport: 0 },
  { name: "NR 20:20:0:13 50 Kg", category: "Fertilizer", invoice: "AGCMBPDF0274", supplier: "AGROCHEM", basePrice: 1790.00, transport: 0 },
  { name: "IPL MOP 50 Kg", category: "Fertilizer", invoice: "AGCMBPDF0274", supplier: "AGROCHEM", basePrice: 1845.00, transport: 0 },
  { name: "NR TSP 46% 50 Kg", category: "Fertilizer", invoice: "AGCMBPDF0274", supplier: "AGROCHEM", basePrice: 1295.00, transport: 0 },

  // 2. Seeds (Invoices: ASDBPDS0277/0278, Supplier: ASHIRWAD SEEDS)
  // Transport cost already set
  { name: "Kalachampa Gold", category: "Seeds", invoice: "ASDBPDS0277", supplier: "ASHIRWAD SEEDS", basePrice: 760.00, transport: 0 },
  { name: "Trump-162LS", category: "Seeds", invoice: "ASDBPDS0278", supplier: "ASHIRWAD SEEDS", basePrice: 1000.00, transport: 0 },
  { name: "Yashraj", category: "Seeds", invoice: "ASDBPDS0278", supplier: "ASHIRWAD SEEDS", basePrice: 510.00, transport: 0 },
  { name: "Pan 804 (Jamuna)", category: "Seeds", invoice: "ASDBPDS0278", supplier: "ASHIRWAD SEEDS", basePrice: 730.00, transport: 0 },
  { name: "NP-7075", category: "Seeds", invoice: "ASDBPDS0278", supplier: "ASHIRWAD SEEDS", basePrice: 672.00, transport: 0 },
  { name: "Vishal Gaurav", category: "Seeds", invoice: "ASDBPDS0278", supplier: "ASHIRWAD SEEDS", basePrice: 600.00, transport: 0 },
  { name: "Sindhu", category: "Seeds", invoice: "ASDBPDS0278", supplier: "ASHIRWAD SEEDS", basePrice: 970.00, transport: 0 },

  // 3. Soil Conditioners (Invoice: AGCMBPDSND0126, Supplier: AGROCHEM, Transport: 0)
  { name: "Chemfree Vamax 4 KG", category: "Soil Conditioners", invoice: "AGCMBPDSND0126", supplier: "AGROCHEM", basePrice: 550.00, transport: 0 },
  { name: "Shaktiman Oorja (FCO) 1 KG", category: "Soil Conditioners", invoice: "AGCMBPDSND0126", supplier: "AGROCHEM", basePrice: 90.00, transport: 0 },
  { name: "Matix Zinc Sulphate (33%) 1 KG", category: "Soil Conditioners", invoice: "AGCMBPDSND0126", supplier: "AGROCHEM", basePrice: 190.00, transport: 0 },
  { name: "PROM (Prabhat) 50 KG", category: "Soil Conditioners", invoice: "AGCMBPDSND0126", supplier: "AGROCHEM", basePrice: 1250.00, transport: 0 },

  // 4. Pesticides (Invoice: AGCMBPDC0253, Supplier: AGROCHEM, Transport: 0)
  // Updating to GST-inclusive base rates (275.00 and 150.00)
  { name: "Nashak 500 ml", category: "Pesticides", invoice: "AGCMBPDC0253", supplier: "AGROCHEM", basePrice: 275.00, transport: 0 },
  { name: "Nashak 250 ml", category: "Pesticides", invoice: "AGCMBPDC0253", supplier: "AGROCHEM", basePrice: 150.00, transport: 0 },
];

async function main() {
  await client.connect();
  console.log("Connected to database.");

  // Find user details
  const userResult = await client.query(
    `SELECT id, "businessId" FROM "User" WHERE email = $1`,
    [USER_EMAIL]
  );

  if (userResult.rows.length === 0) {
    console.error(`❌ User not found with email: ${USER_EMAIL}`);
    await client.end();
    process.exit(1);
  }

  const { businessId } = userResult.rows[0];

  console.log("Starting alignment updates...");

  let updatedCount = 0;
  for (const item of updates) {
    const purchasePrice = item.basePrice + item.transport;
    
    const res = await client.query(
      `UPDATE "Product"
       SET "purchaseInvoiceNo" = $1,
           "purchaseFrom" = $2,
           "purchaseDate" = $3,
           "basePurchasePrice" = $4,
           "transportCost" = $5,
           "purchasePrice" = $6
       WHERE "businessId" = $7 AND "category" = $8 AND "name" = $9`,
      [
        item.invoice,
        item.supplier,
        PURCHASE_DATE,
        item.basePrice,
        item.transport,
        purchasePrice,
        businessId,
        item.category,
        item.name
      ]
    );

    if (res.rowCount > 0) {
      console.log(`  ✅ Updated: ${item.name} under ${item.category} (Invoice: ${item.invoice}, Price: ₹${purchasePrice})`);
      updatedCount++;
    } else {
      console.log(`  ❌ Product not found or not updated: ${item.name}`);
    }
  }

  console.log(`\n🎉 Completed alignment! Updated ${updatedCount}/${updates.length} products.`);

  // Calculate new total stock valuation
  const valuationRes = await client.query(
    `SELECT SUM(stock * "purchasePrice") as "totalValuation" FROM "Product" WHERE "businessId" = $1`,
    [businessId]
  );
  console.log(`\n📊 New Total Stock Valuation (Cost): ₹${parseFloat(valuationRes.rows[0].totalValuation).toFixed(2)}`);

  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
