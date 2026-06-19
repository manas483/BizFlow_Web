import { test, expect } from '@playwright/test';
import { TEST_USER } from '../setup/test-db';

test.describe('Authentication E2E', () => {
  test('Login and redirect to dashboard', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');

    // Fill in the login form
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Verify redirect to dashboard
    await page.waitForURL('/dashboard');
    expect(page.url()).toContain('/dashboard');

    // Basic verification that dashboard loaded (e.g. by checking for a typical dashboard element)
    // The exact text depends on the UI, but "Dashboard", "Overview", or the user's name is standard
    await expect(page.locator('body')).toContainText(/Dashboard|Overview|Welcome/i);
  });

  test('Invalid login shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', 'WrongPassword123');
    await page.click('button[type="submit"]');

    // Should stay on login page and show error
    await expect(page).toHaveURL(/.*\/login.*/);
    
    // Check for an error message toast or text
    await expect(page.locator('body')).toContainText(/Invalid|Error|Incorrect/i);
  });
});
