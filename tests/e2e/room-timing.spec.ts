import { test, expect } from '@playwright/test';

// Soft check: room readiness under 4x CPU throttling. Target is about 5 s; this only fails above 15 s
// (software GL in CI is slower than a real laptop). The measured number is printed for the record.
test('room is walkable under 4x CPU throttling (soft limit 15 s)', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/');
  const enter = page.getByRole('dialog', { name: 'Enter the room' }).getByRole('button', { name: 'Enter' });
  await expect(enter).toBeVisible({ timeout: 30_000 });

  const start = Date.now();
  await enter.click();
  const canvas = page.getByTestId('room-canvas');
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute('data-player-z', /\d/);
  const z0 = await canvas.getAttribute('data-player-z');
  await page.keyboard.down('w');
  await expect.poll(async () => canvas.getAttribute('data-player-z'), { timeout: 30_000 }).not.toBe(z0);
  await page.keyboard.up('w');
  const ms = Date.now() - start;
  console.log(`ROOM_READY_MS_4X_CPU=${ms}`);
  expect(ms).toBeLessThan(15_000);
});
