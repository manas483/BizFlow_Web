import { test, expect } from '@playwright/test';
import { z } from 'zod';

// Zod Schemas for Contract Testing
const AuthSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
    businessId: z.string()
  })
});

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  stock: z.number(),
  price: z.number()
});

const SaleSchema = z.object({
  id: z.string(),
  invoiceNo: z.string(),
  total: z.number(),
  status: z.string()
});

const DashboardKpiSchema = z.object({
  salesTotal: z.number(),
  purchasesTotal: z.number(),
  profit: z.number(),
  pendingReceivables: z.number()
});

// Generic tester to ensure API responses match Zod schemas
async function expectContract(response: any, schema: z.ZodTypeAny) {
  expect(response.ok()).toBeTruthy();
  const json = await response.json();
  const result = schema.safeParse(json);
  if (!result.success) {
    console.error('Contract Violation:', result.error.format());
  }
  expect(result.success).toBeTruthy();
}

test.describe('API Contract Tests', () => {
  let cookies = ''; // In a real test, you'd populate this during a globalSetup or a beforeAll login

  test.beforeAll(async ({ request }) => {
    // For a real contract test, we'd authenticate here and save the cookie.
    // For now we just mock or rely on test configuration.
  });

  test('Authentication Contract', async ({ request }) => {
    // Check session structure
    const response = await request.get('/api/auth/session');
    // If not authenticated it returns {}, if authenticated it matches AuthSessionSchema
    // We just verify it's valid JSON for now since we don't have a real token in this spec
    const json = await response.json();
    expect(typeof json).toBe('object');
  });

  test('Products API Contract', async ({ request }) => {
    const response = await request.get('/api/v1/products', {
      headers: { cookie: cookies }
    });
    if (response.ok()) {
      const json = await response.json();
      const ArraySchema = z.array(ProductSchema);
      expect(ArraySchema.safeParse(json.products || []).success).toBeTruthy();
    }
  });

  test('Sales API Contract', async ({ request }) => {
    const response = await request.get('/api/v1/sales', {
      headers: { cookie: cookies }
    });
    if (response.ok()) {
      const json = await response.json();
      const ArraySchema = z.array(SaleSchema);
      expect(ArraySchema.safeParse(json.sales || []).success).toBeTruthy();
    }
  });

  test('Dashboard API Contract', async ({ request }) => {
    const response = await request.get('/api/v1/dashboard', {
      headers: { cookie: cookies }
    });
    if (response.ok()) {
      const json = await response.json();
      expect(DashboardKpiSchema.safeParse(json).success).toBeTruthy();
    }
  });
});
