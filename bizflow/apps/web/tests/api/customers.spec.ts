import { test, expect } from '@playwright/test';
import { getAuthenticatedContext } from '../setup/auth-helper';

test.describe('Customers API', () => {
  test('Unauthorized GET /api/v1/customers returns 401', async ({ request }) => {
    const response = await request.get('/api/v1/customers');
    // Without an authenticated context, we expect 401
    expect(response.status()).toBe(401);
  });

  test.describe('Authenticated endpoints', () => {
    let authContext: any;
    let createdCustomerId: string;

    test.beforeAll(async ({ baseURL }) => {
      authContext = await getAuthenticatedContext(baseURL!);
    });

    test('POST /api/v1/customers (valid data) returns 201 + customer object', async () => {
      const uniquePhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
      const payload = {
        name: 'Test Customer',
        phone: uniquePhone,
        email: `test${uniquePhone}@example.com`,
        customerType: 'retail',
      };

      const response = await authContext.post('/api/v1/customers', {
        data: payload,
      });

      expect(response.status()).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      expect(data.name).toBe(payload.name);
      
      createdCustomerId = data.id;
    });

    test('POST /api/v1/customers (invalid phone) returns 400', async () => {
      // Create first customer with an invalid phone format
      const response = await authContext.post('/api/v1/customers', {
        data: {
          name: 'Invalid Phone Customer',
          phone: '123', // invalid
          customerType: 'retail',
        },
      });

      // API should reject invalid phone
      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('POST /api/v1/customers (invalid GSTIN) returns 400 Zod error', async () => {
      const uniquePhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
      const payload = {
        name: 'GSTIN Customer',
        phone: uniquePhone,
        customerType: 'b2b',
        gstNumber: 'INVALID_GSTIN_FORMAT', // Invalid mod-36 checksum and format
      };

      const response = await authContext.post('/api/v1/customers', {
        data: payload,
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
      // Should mention GST or validation error
      expect(JSON.stringify(data.error).toLowerCase()).toContain('gst');
    });

    test('GET /api/v1/customers returns paginated list with data, total, page', async () => {
      const response = await authContext.get('/api/v1/customers');
      
      expect(response.status()).toBe(200);
      const json = await response.json();
      
      // Data format should be paginated { data, total, page, limit }
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.total).toBeDefined();
      expect(json.page).toBeDefined();
      
      if (createdCustomerId) {
        const found = json.data.find((c: any) => c.id === createdCustomerId);
        expect(found).toBeDefined();
      }
    });

    test('GET /api/v1/customers?search=Customer filters results', async () => {
      const response = await authContext.get('/api/v1/customers?search=Customer');
      expect(response.status()).toBe(200);
      
      const json = await response.json();
      expect(Array.isArray(json.data)).toBe(true);
      
      // Ensure the returned data matches the search term
      if (json.data.length > 0) {
        const hasMatch = json.data.some((c: any) => c.name.includes('Customer'));
        expect(hasMatch).toBe(true);
      }
    });

    test('PUT /api/v1/customers/:id updates customer fields', async () => {
      expect(createdCustomerId).toBeDefined();
      
      const response = await authContext.put(`/api/v1/customers/${createdCustomerId}`, {
        data: {
          name: 'Updated Customer Name',
          city: 'Mumbai',
        },
      });

      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.name).toBe('Updated Customer Name');
      expect(data.city).toBe('Mumbai');
    });
  });
});
