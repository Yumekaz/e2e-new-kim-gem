import { test, expect, Page } from '@playwright/test';

async function registerAndReachHome(page: Page, suffix: string) {
  const ts = Date.now();
  await page.goto('/');
  await page.getByTestId('auth-toggle-mode').click();
  await page.getByTestId('auth-email-input').fill(`e2e_room_${suffix}_${ts}@example.com`);
  await page.getByTestId('auth-username-input').fill(`e2eroom${suffix}${ts}`.slice(0, 20));
  await page.getByTestId('auth-password-input').fill('TestPassword123');
  await page.getByTestId('auth-confirm-password-input').fill('TestPassword123');
  await page.getByTestId('auth-submit-button').click();
  await expect(page.getByTestId('create-room-button')).toBeVisible({ timeout: 15000 });
}

test.describe('Room Flow', () => {
  test('creates room, sends message, opens modals, and leaves', async ({ page }) => {
    await registerAndReachHome(page, 'a');
    await page.getByTestId('create-room-button').click();

    await expect(page.getByTestId('room-message-input')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('room-message-input').fill('Hello encrypted room');
    await page.getByTestId('room-send-button').click();
    await expect(page.getByText('Hello encrypted room')).toBeVisible();

    await page.getByTestId('room-info-open-button').click();
    await expect(page.getByTestId('room-info-modal')).toBeVisible();
    await page.getByTestId('room-code-copy-button').click();
    await page.getByTestId('room-info-close-button').click();

    await page.getByTestId('room-members-open-button').click();
    await expect(page.getByTestId('room-members-panel')).toBeVisible();
    await page.getByTestId('room-members-close-button').click();

    await page.getByTestId('room-leave-open-button').click();
    await expect(page.getByTestId('room-leave-modal')).toBeVisible();
    await page.getByTestId('room-leave-confirm-button').click();

    await expect(page.getByTestId('create-room-button')).toBeVisible({ timeout: 10000 });
  });

  test('validates join room modal code length', async ({ page }) => {
    await registerAndReachHome(page, 'b');
    await page.getByTestId('open-join-room-modal-button').click();
    await expect(page.getByTestId('join-room-modal')).toBeVisible();
    await page.getByTestId('join-room-code-input').fill('ABC');
    await expect(page.getByTestId('join-room-submit-button')).toBeDisabled();
    await page.getByTestId('join-room-code-input').fill('ABCDEF');
    await expect(page.getByTestId('join-room-submit-button')).toBeEnabled();
  });
});
