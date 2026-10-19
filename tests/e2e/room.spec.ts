import { test, expect, devices, type Page, type Browser, type BrowserContextOptions } from '@playwright/test';

const ENTER_DIALOG = { name: 'Enter the room' };
const DEMO_DIALOG = { name: 'Premonition demo' };

/** Records every JavaScript response that ships the three.js renderer. */
function watchThree(page: Page) {
  const hits: string[] = [];
  const pending: Promise<void>[] = [];
  page.on('response', (response) => {
    const url = response.url();
    const type = response.headers()['content-type'] ?? '';
    if (!/javascript/.test(type) && !/\.js(\?|$)/.test(url)) return;
    pending.push(
      response
        .text()
        .then((body) => {
          if (/WebGLRenderer/.test(body)) hits.push(url);
        })
        .catch(() => {}),
    );
  });
  return {
    async settled() {
      await Promise.all(pending);
      return hits;
    },
  };
}

const canvas = (page: Page) => page.getByTestId('room-canvas');
const attr = async (page: Page, name: string) => Number(await canvas(page).getAttribute(name));

async function enterRoom(page: Page) {
  await page.goto('/');
  await page.getByRole('dialog', ENTER_DIALOG).getByRole('button', { name: 'Enter' }).click();
  await expect(canvas(page)).toBeVisible({ timeout: 20_000 });
  await expect(canvas(page)).toHaveAttribute('data-player-z', /\d/);
}

async function holdKey(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test.describe('room gate', () => {
  test('offers Enter and Skip, and loads no three.js before Enter', async ({ page }) => {
    const three = watchThree(page);
    await page.goto('/', { waitUntil: 'networkidle' });
    const dialog = page.getByRole('dialog', ENTER_DIALOG);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Enter' })).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Skip' })).toBeVisible();
    expect(await three.settled()).toEqual([]);
  });

  test('Skip reveals the normal home and never requests the room', async ({ page }) => {
    const three = watchThree(page);
    await page.goto('/');
    await page.getByRole('dialog', ENTER_DIALOG).getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('room:left'))).toBe('1');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await three.settled()).toEqual([]);
  });

  test('/services never loads three.js', async ({ page }) => {
    const three = watchThree(page);
    await page.goto('/services', { waitUntil: 'networkidle' });
    expect(await three.settled()).toEqual([]);
  });
});

test.describe('in the room', () => {
  test('Enter loads the room chunk and W walks forward', async ({ page }) => {
    const three = watchThree(page);
    await enterRoom(page);
    expect((await three.settled()).length).toBeGreaterThan(0);
    const z0 = await attr(page, 'data-player-z');
    await holdKey(page, 'w', 500);
    await expect.poll(() => attr(page, 'data-player-z')).toBeLessThan(z0 - 0.1);
    await expect(page.getByRole('button', { name: 'Leave the room' })).toBeVisible();
  });

  test('walking to the desk highlights the iPod and E plays the next track', async ({ page }) => {
    await enterRoom(page);
    const ipod = page.getByRole('button', { name: 'Play next track (iPod)' });
    await expect(ipod).toHaveAttribute('data-nearby', 'false');
    await holdKey(page, 'w', 2600);
    await expect(ipod).toHaveAttribute('data-nearby', 'true');
    await expect(page.getByText('Placeholder Track One')).toBeVisible();
    await page.keyboard.press('e');
    await expect(page.getByText('Placeholder Track Two')).toBeVisible({ timeout: 10_000 });
  });

  test('Use the computer opens the demo; finishing returns to the room', async ({ page }) => {
    await enterRoom(page);
    await page.getByRole('button', { name: 'Use the computer' }).click();
    const demo = page.getByRole('dialog', DEMO_DIALOG);
    await expect(demo).toBeVisible({ timeout: 5_000 });
    await demo.getByRole('button', { name: 'Rising Pad' }).click({ timeout: 10_000 });
    await demo.getByRole('button', { name: /continue to site/i }).click({ timeout: 15_000 });
    await expect(demo).toHaveCount(0);
    await expect(canvas(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use the computer' })).toBeFocused();
    // Control returns: movement works again near the desk.
    const z0 = await attr(page, 'data-player-z');
    await holdKey(page, 's', 400);
    await expect.poll(() => attr(page, 'data-player-z')).toBeGreaterThan(z0 + 0.1);
  });

  test('Skip in the demo returns to the room, and so does Escape', async ({ page }) => {
    await enterRoom(page);
    const demo = page.getByRole('dialog', DEMO_DIALOG);
    await page.getByRole('button', { name: 'Use the computer' }).click();
    await expect(demo).toBeVisible();
    await demo.getByRole('button', { name: 'Skip' }).click();
    await expect(demo).toHaveCount(0);
    await expect(canvas(page)).toBeVisible();
    await page.getByRole('button', { name: 'Use the computer' }).click();
    await expect(demo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(demo).toHaveCount(0);
    await expect(canvas(page)).toBeVisible();
  });

  test('Leave the room removes the canvas and sets room:left', async ({ page }) => {
    await enterRoom(page);
    await page.getByRole('button', { name: 'Leave the room' }).click();
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('room:left'))).toBe('1');
  });

  test('a refused pointer lock still allows arrow keys and the HUD', async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.requestPointerLock = function () {
        return Promise.reject(new DOMException('denied', 'NotAllowedError'));
      } as typeof Element.prototype.requestPointerLock;
    });
    await enterRoom(page);
    await canvas(page).click({ position: { x: 640, y: 200 } });
    const z0 = await attr(page, 'data-player-z');
    await holdKey(page, 'ArrowUp', 500);
    await expect.poll(() => attr(page, 'data-player-z')).toBeLessThan(z0 - 0.1);
    const yaw0 = await attr(page, 'data-player-yaw');
    await holdKey(page, 'ArrowLeft', 400);
    await expect.poll(() => attr(page, 'data-player-yaw')).toBeGreaterThan(yaw0 + 0.1);
    await page.getByRole('button', { name: 'Use the computer' }).click();
    await expect(page.getByRole('dialog', DEMO_DIALOG)).toBeVisible();
  });
});

test.describe('room failures land on the normal site', () => {
  test('a setup failure (no WebGL context after Enter) unmounts the room', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        if ((window as unknown as { __failGL?: boolean }).__failGL && /webgl/.test(id)) return null;
        return (orig as (...a: unknown[]) => unknown).call(this, id, ...rest);
      } as typeof orig;
    });
    await page.goto('/');
    const dialog = page.getByRole('dialog', ENTER_DIALOG);
    await expect(dialog).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __failGL?: boolean }).__failGL = true;
    });
    await dialog.getByRole('button', { name: 'Enter' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 });
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('webglcontextlost unmounts the room', async ({ page }) => {
    await enterRoom(page);
    await page.evaluate(() => {
      const c = document.querySelector('[data-testid="room-canvas"] canvas') as HTMLCanvasElement;
      const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    });
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
  });
});

const NO_ROOM: Array<[string, BrowserContextOptions, string?]> = [
  ['reduced motion', { reducedMotion: 'reduce' }],
  ['a phone', { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
  ['WebGL disabled', {}, 'nowebgl'],
];

async function checkNoRoom(browser: Browser, options: BrowserContextOptions, mode?: string) {
  const context = await browser.newContext({ ...options, baseURL: 'http://localhost:3000' });
  if (mode === 'nowebgl') {
    await context.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        if (/webgl/.test(id)) return null;
        return (orig as (...a: unknown[]) => unknown).call(this, id, ...rest);
      } as typeof orig;
    });
  }
  const page = await context.newPage();
  const three = watchThree(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('h1')).toBeVisible();
  expect(await three.settled()).toEqual([]);
  await context.close();
}

test.describe('no room offered', () => {
  for (const [label, options, mode] of NO_ROOM) {
    test(`with ${label}: no overlay and no room request`, async ({ browser }) => {
      await checkNoRoom(browser, options, mode);
    });
  }
});
