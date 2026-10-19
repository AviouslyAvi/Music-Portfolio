import { test, expect } from '@playwright/test';

const DAWS = ['FL Studio', 'Ableton', 'Studio One', 'Logic Pro', 'Cubase', 'Reaper'];
const SERVICES = ['Production and arrangement', 'Sound design', 'Finishing and finalization', 'Teaching and mentorship'];

for (const path of ['/', '/services', '/about']) {
  test(`${path} renders with one h1 and nav`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav).toBeAttached();
    for (const label of ['Work', 'Services', 'Premonition', 'About', 'Contact', 'Buy', 'Account']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeAttached();
    }
  });
}

test('/about lists the six DAWs', async ({ page }) => {
  await page.goto('/about');
  const text = await page.locator('main').innerText();
  for (const d of DAWS) expect(text).toContain(d);
});

test('/services lists the four services', async ({ page }) => {
  await page.goto('/services');
  const text = await page.locator('main').innerText();
  for (const s of SERVICES) expect(text.toLowerCase()).toContain(s.toLowerCase());
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('home still contains the hero line', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText("I don't make beats. I build worlds you can live in.");
  });
});

test('footer links to avious.co', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href^="https://avious.co"]')).toBeAttached();
});

test('home has a PREMONITION section that links to /premonition', async ({ page }) => {
  await page.goto('/');
  const section = page.getByRole('region', { name: 'PREMONITION' });
  await expect(section).toBeAttached();
  await expect(section).toContainText('PREMONITION');
  await expect(section).toContainText('Echoes of the future.');
  const link = section.getByRole('link', { name: 'Hear it' });
  await expect(link).toHaveAttribute('href', '/premonition');
  const text = await section.innerText();
  expect(text).not.toMatch(/windows|real-?time|!|\$/i);
});
