import { test, expect, Page } from '@playwright/test';

async function createRoom(page: Page) {
  const ts = Date.now();
  await page.goto('/');
  await page.getByTestId('auth-toggle-mode').click();
  await page.getByTestId('auth-email-input').fill(`e2e_file_${ts}@example.com`);
  await page.getByTestId('auth-username-input').fill(`e2efile${ts}`.slice(0, 20));
  await page.getByTestId('auth-password-input').fill('TestPassword123');
  await page.getByTestId('auth-confirm-password-input').fill('TestPassword123');
  await page.getByTestId('auth-submit-button').click();
  await expect(page.getByTestId('create-room-button')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('create-room-button').click();
  await expect(page.getByTestId('file-upload-button')).toBeVisible({ timeout: 10000 });
}

test.describe('File Upload Flow', () => {
  test('uploads a valid text file', async ({ page }) => {
    await createRoom(page);
    await page.getByTestId('file-input').setInputFiles({
      name: 'playwright-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Playwright encrypted file test'),
    });

    await expect(page.getByText('playwright-file.txt')).toBeVisible({ timeout: 10000 });
  });

  test('rejects an invalid file type', async ({ page }) => {
    await createRoom(page);
    await page.getByTestId('file-input').setInputFiles({
      name: 'malicious.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('fake-binary'),
    });

    await expect(page.getByText(/invalid file type|not allowed/i)).toBeVisible({ timeout: 10000 });
  });
});
