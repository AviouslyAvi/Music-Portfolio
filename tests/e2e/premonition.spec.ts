import { test, expect } from '@playwright/test';
import { TRACKS } from '../../src/content/tracks';

const STORE = 'https://premonition.avious.co';
const TRACK_TITLES = TRACKS.map((t) => t.title);
const SOUND_LABELS = ['Rising Pad', 'Noise Sweep', 'Tension Lift'];

test.describe('/premonition', () => {
  test('shows the product facts and the ready demo', async ({ page }) => {
    const res = await page.goto('/premonition');
    expect(res?.status()).toBe(200);
    const main = page.locator('main');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('PREMONITION');
    await expect(main).toContainText('Echoes of the future.');
    await expect(main).toContainText('VST3, AU, CLAP');
    await expect(main).toContainText('$19.99');
    await expect(main).toContainText('$24.99');
    await expect(main.getByRole('link', { name: /buy/i })).toHaveAttribute('href', STORE);
    await expect(main.getByRole('link', { name: /free demo/i })).toHaveAttribute('href', /premonition-demo/);
    await expect(main.getByRole('status')).toHaveText('Ready. Choose a sound.');
    for (const label of SOUND_LABELS) {
      await expect(main.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('makes no Windows or real-time claim', async ({ page }) => {
    await page.goto('/premonition');
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/windows|real-?time/i);
    expect(await page.content()).not.toMatch(/windows|real-?time/i);
  });

  test('loads no three.js chunk', async ({ page }) => {
    const bad: string[] = [];
    const pending: Promise<void>[] = [];
    page.on('response', (response) => {
      const url = response.url();
      if (/three/i.test(url)) bad.push(`url: ${url}`);
      const type = response.headers()['content-type'] ?? '';
      if (!/javascript/.test(type) && !/\.js(\?|$)/.test(url)) return;
      pending.push(
        response
          .text()
          .then((body) => {
            if (/WebGLRenderer/.test(body)) bad.push(`body: ${url}`);
          })
          .catch(() => {}),
      );
    });
    await page.goto('/premonition', { waitUntil: 'networkidle' });
    await Promise.all(pending);
    expect(bad).toEqual([]);
  });
});

test('/contact.html redirects permanently to /contact', async ({ request }) => {
  const res = await request.get('/contact.html', { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(new URL(res.headers()['location'], 'http://localhost:3000').pathname).toBe('/contact');
});

test.describe('/work', () => {
  test('lists every track and plays one at a time', async ({ page }) => {
    // Stub playback so the test does not depend on autoplay policy or codec support.
    await page.addInitScript(() => {
      const proto = HTMLMediaElement.prototype;
      const playing = new WeakSet<HTMLMediaElement>();
      proto.play = function (this: HTMLMediaElement) {
        playing.add(this);
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      proto.pause = function (this: HTMLMediaElement) {
        playing.delete(this);
      };
      Object.defineProperty(proto, 'paused', {
        configurable: true,
        get(this: HTMLMediaElement) {
          return !playing.has(this);
        },
      });
    });
    await page.goto('/work');
    await expect(page.locator('h1')).toHaveCount(1);
    const main = page.locator('main');
    for (const t of TRACK_TITLES) await expect(main).toContainText(t);
    const audios = page.locator('main audio');
    await expect(audios).toHaveCount(TRACK_TITLES.length);
    const paused = () => audios.evaluateAll((els) => els.map((e) => (e as HTMLAudioElement).paused));
    await audios.nth(0).evaluate((e) => (e as HTMLAudioElement).play());
    const onlyPlaying = (i: number) => TRACK_TITLES.map((_, j) => j !== i);
    expect(await paused()).toEqual(onlyPlaying(0));
    await audios.nth(1).evaluate((e) => (e as HTMLAudioElement).play());
    expect(await paused()).toEqual(onlyPlaying(1));
  });
});

test('sitemap lists the six routes and robots points to it', async ({ request }) => {
  const sm = await (await request.get('/sitemap.xml')).text();
  for (const p of ['', '/work', '/services', '/premonition', '/about', '/contact']) {
    expect(sm).toContain(`<loc>https://imavious.org${p}</loc>`);
  }
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Sitemap: https://imavious.org/sitemap.xml');
});
