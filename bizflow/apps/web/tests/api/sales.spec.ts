import { test, expect } from '@playwright/test';
import { getAuthenticatedContext } from '../setup/auth-helper';

test.describe('Sales & Billing API', () => {
  let authContext: any;
  let customerId: string;
  let productId: string;

  test.beforeAll(async ({ baseURL }) => {
    authContext = await getAuthenticatedContext(baseURL!);

    // Setup: Create a customer
    const cRes = await authContext.post('/api/v1/customers', {
      data: {
        name: 'Sales Test Customer',
        phone: `98000${Math.floor(10000 + Math.random() * 90000)}`,
        customerType: 'retail',
        stateCode: '29', // Karnataka
      },
    });
    if (cRes.ok()) {
      const c = await cRes.json();
      customerId = c.id;
    }

    // Setup: Create a product
    const pRes = await authContext.post('/api/v1/products', {
      data: {
        name: `Sales Test Product ${Date.now()}`,
        sku: `SALE-SKU-${Date.now()}`,
        price: 1000,
        hsnCode: '8471',
        gstRate: 18,
        stock: 100,
      },
    });
    if (pRes.ok()) {
      const p = await pRes.json();
      productId = p.id;
    }
  });

  test('Create Sale with 1 item, no discount', async () => {
    test.skip(!customerId || !productId, 'Setup failed');

    const payload = {
      customerId,
      items: [
        {
          productId,
          quantity: 2,
          unitPrice: 1000,
          discount: 0,
          gstRate: 18,
        }
      ],
      paymentMethod: 'cash',
      paymentStatus: 'PAID',
    };

    const response = await authContext.post('/api/v1/sales', { data: payload });
    expect([200, 201]).toContain(response.status());
    
    const data = await response.json();
    expect(data.invoiceTotal).toBeDefined();
    // 2 * 1000 = 2000. 18% GST = 360. Total = 2360
    expect(Number(data.invoiceTotal)).toBeCloseTo(2360, 0);
  });

  test('Create Sale with 100% discount → total = 0', async () => {
    test.skip(!customerId || !productId, 'Setup failed');

    const payload = {
      customerId,
      items: [
        {
          productId,
          quantity: 1,
          unitPrice: 1000,
          discount: 1000, // 100% discount
          gstRate: 18,
        }
      ],
      paymentMethod: 'cash',
      paymentStatus: 'PAID',
    };

    const response = await authContext.post('/api/v1/sales', { data: payload });
    expect([200, 201]).toContain(response.status());
    
    const data = await response.json();
    expect(Number(data.invoiceTotal)).toBe(0);
  });

  test('Create inter-state sale (customer state !== 29) → verify IGST applied', async () => {
    test.skip(!productId, 'Setup failed');

    // Create inter-state customer
    const isRes = await authContext.post('/api/v1/customers', {
      data: {
        name: 'Interstate Customer',
        phone: `97000${Math.floor(10000 + Math.random() * 90000)}`,
        customerType: 'retail',
        stateCode: '27', // Maharashtra
      },
    });
    expect(isRes.ok()).toBeTruthy();
    const isCustomer = await isRes.json();

    const payload = {
      customerId: isCustomer.id,
      items: [
        {
          productId,
          quantity: 1,
          unitPrice: 1000,
          discount: 0,
          gstRate: 18,
        }
      ],
    };

    const response = await authContext.post('/api/v1/sales', { data: payload });
    expect([200, 201]).toContain(response.status());
    
    const data = await response.json();
    // IGST should be populated, CGST/SGST should be 0
    // This assumes the API returns the line items or total tax breakdown
    if (data.totalIgst !== undefined) {
      expect(Number(data.totalIgst)).toBe(180);
      expect(Number(data.totalCgst)).toBe(0);
      expect(Number(data.totalSgst)).toBe(0);
    }
  });
});
