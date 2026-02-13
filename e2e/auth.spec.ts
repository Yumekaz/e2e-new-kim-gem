import { test, expect } from '@playwright/test';

const timestamp = Date.now();
const testUser = {
  email: `e2e_auth_${timestamp}@example.com`,
  username: `e2eauth${timestamp}`.slice(0, 20),
  password: 'TestPassword123',
};

test.describe('Authentication Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('shows auth screen and encryption indicator', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('encryption-indicator')).toBeVisible();
    await expect(page.getByTestId('auth-form')).toBeVisible();
  });

  test('registers a new user', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('auth-toggle-mode').click();
    await page.getByTestId('auth-email-input').fill(testUser.email);
    await page.getByTestId('auth-username-input').fill(testUser.username);
    await page.getByTestId('auth-password-input').fill(testUser.password);
    await page.getByTestId('auth-confirm-password-input').fill(testUser.password);
    await page.getByTestId('auth-submit-button').click();

    await expect(page.getByTestId('open-join-room-modal-button')).toBeVisible({ timeout: 15000 });
  });

  test('logs out and logs back in', async ({ page }) => {
    await page.goto('/');

    const logout = page.getByTestId('logout-button');
    if (await logout.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logout.click();
    }

    await expect(page.getByTestId('auth-form')).toBeVisible();
    await page.getByTestId('auth-email-input').fill(testUser.email);
    await page.getByTestId('auth-password-input').fill(testUser.password);
    await page.getByTestId('auth-submit-button').click();

    await expect(page.getByTestId('open-join-room-modal-button')).toBeVisible({ timeout: 15000 });
  });
});

