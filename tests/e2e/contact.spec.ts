import { test, expect } from '@playwright/test';

async function fill(page: import('@playwright/test').Page) {
  await page.goto('/contact');
  await page.getByLabel('Your name').fill('Ada');
  await page.getByLabel('Your email').fill('ada@example.com');
  await page.getByLabel('What are you imagining').fill('A slow warm idea');
}

test('no file input and invitation line is shown', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await expect(page.getByText('A link to a voice note, a rough idea, or a mood.', { exact: true })).toBeVisible();
});

test('success shows confirmation', async ({ page }) => {
  await page.route('**/api/contact', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await fill(page);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('status')).toContainText('Thank you');
});

test('server error shows message and keeps typed text', async ({ page }) => {
  await page.route('**/api/contact', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"send_failed"}' }));
  await fill(page);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.contact-form [role=alert]')).toContainText('did not go through');
  await expect(page.getByLabel('What are you imagining')).toHaveValue('A slow warm idea');
  await expect(page.getByLabel('Your email')).toHaveValue('ada@example.com');
  await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
});

test('inline field errors block submit; button disabled while pending', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/contact', async (r) => {
    calls++;
    await new Promise((res) => setTimeout(res, 400));
    await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Please add your name.')).toBeVisible();
  expect(calls).toBe(0);
  await fill(page);
  const btn = page.getByRole('button', { name: 'Send' });
  await btn.click();
  await expect(page.getByRole('button', { name: 'Sending' })).toBeDisabled();
  await expect(page.getByRole('status')).toBeVisible();
  expect(calls).toBe(1);
});
