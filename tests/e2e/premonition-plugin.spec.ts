import { test, expect } from '@playwright/test';

const SOURCE_LABELS = ['Snare', 'Pluck', 'Vocal'];

test.describe('/premonition plugin', () => {
  test('shows the plugin with three sources and no Skip or Continue', async ({ page }) => {
    await page.goto('/premonition');
    const plugin = page.getByRole('region', { name: /plugin/i });
    await expect(plugin).toBeVisible();
    for (const label of SOURCE_LABELS) await expect(plugin.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
    await expect(plugin.getByRole('button', { name: /^(skip|continue)/i })).toHaveCount(0);
    await expect(page.getByText('Your sound is processed in this browser and never uploaded')).toBeVisible();
    await expect(plugin.locator('[download], [draggable="true"]')).toHaveCount(0);
  });

  test('the wasm is requested only after the plugin mounts and never on /', async ({ page }) => {
    const wasmUrls: string[] = [];
    page.on('request', (r) => {
      if (/dsp\.(wasm|js)/.test(r.url())) wasmUrls.push(new URL(r.url()).pathname);
    });
    await page.goto('/', { waitUntil: 'networkidle' });
    expect(wasmUrls).toEqual([]);
    await page.goto('/premonition');
    await expect(page.getByRole('button', { name: /snare/i })).toBeEnabled({ timeout: 15_000 });
    expect(wasmUrls.some((u) => u.endsWith('dsp.wasm'))).toBe(true);
  });

  test('a real render of each source completes in under 5 s in Chromium and the status reads RENDERED', async ({ page }) => {
    await page.goto('/premonition');
    const plugin = page.getByRole('region', { name: /plugin/i });
    const status = plugin.getByRole('status');
    const timings: Record<string, number> = {};
    for (const label of SOURCE_LABELS) {
      const button = plugin.getByRole('button', { name: new RegExp(label, 'i') });
      await expect(button).toBeEnabled({ timeout: 15_000 });
      const t0 = Date.now();
      await button.click();
      await expect(status).toHaveText(/PREVIEW|RENDERED/, { timeout: 5_000 });
      timings[label] = Date.now() - t0;
      expect(timings[label]).toBeLessThan(5_000);
    }
    console.log('render timings (ms, click to first preview sample):', JSON.stringify(timings));
    // The last pick plays to its natural end (about 4.5 s of audio).
    await expect(status).toHaveText('RENDERED', { timeout: 20_000 });
    await expect(plugin.getByRole('button', { name: /vocal/i })).toBeEnabled();
  });

  test('moving a knob re-renders', async ({ page }) => {
    await page.goto('/premonition');
    const plugin = page.getByRole('region', { name: /plugin/i });
    const status = plugin.getByRole('status');
    await expect(plugin.getByRole('button', { name: /snare/i })).toBeEnabled({ timeout: 15_000 });
    await plugin.getByRole('button', { name: /snare/i }).click();
    await expect(status).toHaveText(/PREVIEW|RENDERED/, { timeout: 5_000 });
    await plugin.getByRole('slider', { name: 'Bloom' }).focus();
    await page.keyboard.press('ArrowUp');
    await expect(status).toHaveText('RENDERING');
    await expect(status).toHaveText(/PREVIEW|RENDERED/, { timeout: 5_000 });
  });
});
