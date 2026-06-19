import { test, expect } from '@playwright/test';
import { getAuthenticatedContext } from '../setup/auth-helper';
import { TEST_USER } from '../setup/test-db';

test.describe('Authentication API', () => {
  test('Valid credentials return ok and set session cookie', async ({ request, baseURL }) => {
    const csrfRes = await request.get('/api/auth/csrf');
    const { csrfToken } = await csrfRes.json();

    const response = await request.post('/api/auth/callback/credentials', {
      form: {
        csrfToken,
        email: TEST_USER.email,
        password: TEST_USER.password,
        redirect: 'false',
      },
    });

    expect(response.ok()).toBeTruthy();
    
    // Response JSON from NextAuth on success looks like { ok: true, url: ... }
    const json = await response.json();
    expect(json.ok).toBe(true);

    // Verify cookies contain session token
    const headers = response.headers();
    const setCookie = headers['set-cookie'];
    expect(setCookie).toMatch(/authjs\.session-token|next-auth\.session-token/);
  });

  test('Invalid credentials return 401 or ok: false', async ({ request }) => {
    const csrfRes = await request.get('/api/auth/csrf');
    const { csrfToken } = await csrfRes.json();

    const response = await request.post('/api/auth/callback/credentials', {
      form: {
        csrfToken,
        email: TEST_USER.email,
        password: 'wrongpassword',
        redirect: 'false',
      },
    });

    // NextAuth often returns 200 OK but with ok: false in the JSON body when redirect: false is used
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBeTruthy();
  });

  test('Fetching session with valid cookie', async ({ baseURL }) => {
    // getAuthenticatedContext automatically does the login step and gives us a context with the cookie
    const authContext = await getAuthenticatedContext(baseURL!);
    
    const response = await authContext.get('/api/auth/session');
    expect(response.ok()).toBeTruthy();
    
    const session = await response.json();
    expect(session.user).toBeDefined();
    expect(session.user.email).toBe(TEST_USER.email);
  });

  test('Signout clears the session cookie', async ({ baseURL }) => {
    const authContext = await getAuthenticatedContext(baseURL!);
    
    const csrfRes = await authContext.get('/api/auth/csrf');
    const { csrfToken } = await csrfRes.json();

    const response = await authContext.post('/api/auth/signout', {
      form: {
        csrfToken,
        redirect: 'false',
      },
    });

    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    const setCookie = headers['set-cookie'];
    // Should set the cookie with Max-Age=0 or Expires in the past to clear it
    expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    
    // Verify session is now empty
    const sessionRes = await authContext.get('/api/auth/session');
    const session = await sessionRes.json();
    expect(Object.keys(session)).toHaveLength(0); // NextAuth returns {} for no session
  });

  test('Unauthenticated API request returns 401 UNAUTHORIZED', async ({ request }) => {
    const response = await request.get('/api/customers');
    expect(response.status()).toBe(401);
    
    const json = await response.json();
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  test('Health check returns { status: "ok", db: "connected" }', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    
    const json = await response.json();
    expect(json.status).toBe('ok');
    expect(json.db).toBe('connected');
  });

  test('Non-existent email returns error', async ({ request }) => {
    const csrfRes = await request.get('/api/auth/csrf');
    const { csrfToken } = await csrfRes.json();

    const response = await request.post('/api/auth/callback/credentials', {
      form: {
        csrfToken,
        email: 'notfound@bizflow.test',
        password: 'anypassword',
        redirect: 'false',
      },
    });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBeTruthy();
  });
});
