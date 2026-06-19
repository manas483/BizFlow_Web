/**
 * Playwright auth helper — logs in via NextAuth credentials provider
 * and returns an authenticated request context for API tests.
 *
 * The returned APIRequestContext carries the session cookie, so all
 * subsequent requests made with it are authenticated.
 */
import { APIRequestContext, request } from '@playwright/test'
import { TEST_USER } from './test-db'

/**
 * Creates a Playwright APIRequestContext that is authenticated via
 * NextAuth's credentials provider.
 *
 * Flow:
 * 1. Fetch CSRF token from /api/auth/csrf
 * 2. POST credentials to /api/auth/callback/credentials
 * 3. The context now carries the session cookie
 *
 * @param baseURL - The base URL of the running Next.js server
 * @param credentials - Optional override credentials (defaults to TEST_USER)
 */
export async function getAuthenticatedContext(
  baseURL: string,
  credentials?: { email: string; password: string }
): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL })
  const creds = credentials || TEST_USER

  // Step 1: Get CSRF token (required by NextAuth)
  const csrfRes = await context.get('/api/auth/csrf')
  const { csrfToken } = await csrfRes.json()

  // Step 2: Login via NextAuth credentials callback
  await context.post('/api/auth/callback/credentials', {
    form: {
      csrfToken,
      email: creds.email,
      password: creds.password,
    },
  })

  // The context now carries the session cookie
  return context
}
