import { test, expect, devices, type Page, type Browser, type BrowserContextOptions } from '@playwright/test';
import { KEYBOARD_STAND, DESK, IPOD_POS, COMPUTER_POS } from '../../src/room/layout';
import { PLAYER_RADIUS } from '../../src/room/movement';


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
  await page.goto('/'); // the site opens straight into the room
  await expect(canvas(page)).toBeVisible({ timeout: 20_000 });
  await expect(canvas(page)).toHaveAttribute('data-player-z', /\d/);
}

async function holdKey(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

// The floating prompts are display:none while hidden, so they are found by attribute, not role.
const promptOf = (page: Page, target: 'ipod' | 'computer') => page.locator(`[data-prompt="${target}"]`);

/** Walk to the desk, then strafe until in front of the target (positions come from the layout). */
async function walkToDesk(page: Page, target: 'ipod' | 'computer') {
  await holdKey(page, 'w', 2600);
  const goal = (target === 'ipod' ? IPOD_POS : COMPUTER_POS).x;
  for (let i = 0; i < 20; i++) {
    const dx = goal - (await attr(page, 'data-player-x'));
    if (Math.abs(dx) < 0.08) break;
    await holdKey(page, dx < 0 ? 'a' : 'd', Math.min(300, Math.max(40, (Math.abs(dx) / 1.6) * 1000)));
  }
  const prompt = promptOf(page, target);
  await expect(prompt).toHaveAttribute('data-visible', 'true');
  return prompt;
}

/** Walk to the iPod, press E and wait for the zoomed-in iPod. */
async function openIpod(page: Page) {
  await walkToDesk(page, 'ipod');
  await page.keyboard.press('e');
  const ipod = page.getByTestId('ipod');
  await expect(ipod).toBeVisible({ timeout: 10_000 });
  return ipod;
}

test.describe('room gate', () => {
  test('the site opens straight into the room, with no entry card and the portfolio locked behind it', async ({ page }) => {
    await page.goto('/');
    await expect(canvas(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('dialog', { name: 'Enter the room' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Enter' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Skip to site' })).toBeVisible();
  });

  test('Skip to site reveals the normal home, and a reload does not reopen the room', async ({ page }) => {
    await enterRoom(page);
    await page.getByRole('button', { name: 'Skip to site' }).click();
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('room:left'))).toBe('1');
    const three = watchThree(page);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    expect(await three.settled()).toEqual([]);
  });

  test('/services never loads three.js', async ({ page }) => {
    const three = watchThree(page);
    await page.goto('/services', { waitUntil: 'networkidle' });
    expect(await three.settled()).toEqual([]);
  });
});

test.describe('focus stays in the dialogs', () => {
  const navInert = (page: Page) =>
    page.evaluate(() => Boolean(document.querySelector('nav[aria-label="Primary"]')?.closest('[inert]')));
  const focusIn = (page: Page, sel: string) =>
    page.evaluate((s) => Boolean(document.activeElement?.closest(s)), sel);

  test('in the room the site behind is inert and Tab stays on the room controls', async ({ page }) => {
    await enterRoom(page);
    expect(await navInert(page)).toBe(true);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await focusIn(page, 'nav, #main, footer')).toBe(false);
    }
    await page.getByRole('button', { name: 'Skip to site' }).click();
    await expect.poll(() => navInert(page)).toBe(false);
    await expect(page.locator('#main')).toBeFocused();
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
    await expect(page.getByRole('button', { name: 'Skip to site' })).toBeVisible();
  });

  test('the room has no iPod, computer or leave buttons, only Skip to site', async ({ page }) => {
    await enterRoom(page);
    await expect(page.getByRole('button', { name: 'Skip to site' })).toBeVisible();
    for (const name of [/play next track/i, /use the computer/i, /leave the room/i]) {
      await expect(page.getByRole('button', { name })).toHaveCount(0);
    }
  });

  test('no music plays, and no track is fetched, until play is pressed on the iPod', async ({ page }) => {
    const tracks: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/audio/tracks/')) tracks.push(r.url());
    });
    await enterRoom(page);
    await page.waitForTimeout(1500);
    expect(tracks).toEqual([]);
    await expect(page.getByText(/Now playing/)).toHaveCount(0);
    await openIpod(page);
    expect(tracks).toEqual([]);
    await expect(page.getByTestId('ipod').getByText(/Press play/)).toBeVisible();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByTestId('ipod').getByText(/Playing/).last()).toBeVisible({ timeout: 15_000 });
    expect(tracks.length).toBeGreaterThan(0);
    await expect(page.getByText(/Now playing/)).toBeVisible();
  });

  test('walking to the desk shows the floating prompt, E zooms into the iPod, next and volume work', async ({ page }) => {
    await enterRoom(page);
    const prompt = promptOf(page, 'ipod');
    await expect(prompt).toHaveAttribute('data-visible', 'false');
    await walkToDesk(page, 'ipod');
    await expect(prompt).toContainText('Press E to interact');
    await page.keyboard.press('e');
    const ipod = page.getByTestId('ipod');
    await expect(ipod).toBeVisible({ timeout: 10_000 });
    await expect(prompt).toHaveAttribute('data-visible', 'false');
    await expect(ipod.getByText('Space')).toBeVisible();
    await ipod.getByRole('button', { name: 'Next song' }).click();
    await expect(ipod.getByText('Park Scene')).toBeVisible();
    await ipod.getByRole('button', { name: 'Previous song' }).click();
    await expect(ipod.getByText('Space')).toBeVisible();
    const vol = ipod.getByRole('progressbar', { name: 'Volume' });
    await expect(vol).toHaveAttribute('aria-valuenow', '80');
    await page.keyboard.press('ArrowDown');
    await expect(vol).toHaveAttribute('aria-valuenow', '75');
    await page.keyboard.press('ArrowUp');
    await expect(vol).toHaveAttribute('aria-valuenow', '80');
  });

  test('walking to the left of the desk is blocked by the keyboard stand', async ({ page }) => {
    await enterRoom(page);
    await holdKey(page, 'w', 1500);
    // Strafe left into the lane beside the keyboard stand, then push on toward the far wall.
    const laneX = (KEYBOARD_STAND.minX + KEYBOARD_STAND.maxX) / 2;
    for (let i = 0; i < 12 && (await attr(page, 'data-player-x')) > laneX + 0.1; i++) await holdKey(page, 'a', 250);
    expect(await attr(page, 'data-player-x')).toBeLessThan(DESK.minX);
    await holdKey(page, 'w', 3000);
    const z = await attr(page, 'data-player-z');
    // The player slides to a stop at the stand's front edge and never passes through it.
    expect(z).toBeGreaterThanOrEqual(KEYBOARD_STAND.maxZ + PLAYER_RADIUS - 0.03);
    expect(z).toBeLessThan(KEYBOARD_STAND.maxZ + PLAYER_RADIUS + 0.2);
  });

  test('Escape puts the iPod down at once and the prompt returns', async ({ page }) => {
    await enterRoom(page);
    const ipod = await openIpod(page);
    await page.keyboard.press('Escape');
    await expect(ipod).toHaveCount(0, { timeout: 5_000 });
    await expect(promptOf(page, 'ipod')).toHaveAttribute('data-visible', 'true', { timeout: 10_000 });
  });

  test('the iPod menu is just Songs and Voice Memos', async ({ page }) => {
    await enterRoom(page);
    const ipod = await openIpod(page);
    await ipod.getByRole('button', { name: 'Menu' }).click();
    await expect(ipod.getByRole('option')).toHaveText(['Songs', 'Voice Memos']);
  });

  test('the door at the back of the room leaves for the site', async ({ page }) => {
    await enterRoom(page);
    await page.keyboard.press('e'); // the visitor starts beside the door
    await expectSiteOpen(page);
  });

  /** The room is gone and the normal home is in front, with focus on #main. */
  async function expectSiteOpen(page: Page) {
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('#main')).toBeFocused();
    expect(await page.evaluate(() => sessionStorage.getItem('room:left'))).toBe('1');
  }

  // The visit. The room dialog carries data-stage (walk, seating, headphones, boot, plugin, portal, leaving).
  const ROOM_DIALOG = { name: 'AVIOUS studio room' };
  const stageIs = (page: Page, stage: string) =>
    expect(page.getByRole('dialog', ROOM_DIALOG)).toHaveAttribute('data-stage', stage, { timeout: 20_000 });
  // The plugin's three sound buttons; a heard one carries data-heard="true".
  const soundButtons = (page: Page) => page.getByRole('group', { name: 'Choose a sound' }).getByRole('button');

  async function sitAtComputer(page: Page) {
    await enterRoom(page);
    await walkToDesk(page, 'computer');
    await page.keyboard.press('e');
  }

  async function playAllThree(page: Page) {
    await stageIs(page, 'plugin');
    const buttons = soundButtons(page);
    await expect(buttons).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const b = buttons.nth(i);
      await expect(b).toBeEnabled({ timeout: 20_000 });
      await b.click();
      // The render plays to its natural end before the sound counts as heard.
      if (i < 2) await expect(b).toHaveAttribute('data-heard', 'true', { timeout: 30_000 });
    }
  }

  test('E at the computer lowers the headphones, silences the room and shows the terminal', async ({ page }) => {
    await sitAtComputer(page);
    await stageIs(page, 'seating');
    await stageIs(page, 'headphones');
    await stageIs(page, 'boot');
    await expect(page.getByTestId('terminal')).toBeVisible();
    await expect(page.getByTestId('terminal')).toContainText(/loading engine/i);
  });

  test('Escape stands up and the room music resumes', async ({ page }) => {
    await sitAtComputer(page);
    await stageIs(page, 'boot');
    await page.keyboard.press('Escape');
    await stageIs(page, 'walk');
    await expect(page.getByTestId('terminal')).toHaveCount(0);
    await expect(canvas(page)).toBeVisible();
    // Walking works again once the stand-up ease ends.
    await expect(canvas(page)).toHaveAttribute('data-player-z', /\d/);
    await holdKey(page, 's', 600);
  });

  test('playing all three sounds shows the portal and requests the configured Premonition URL', async ({ page }) => {
    const requested: string[] = [];
    await page.route(/premonition\.avious\.co/, (route) => {
      requested.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Premonition</title>' });
    });
    // sessionStorage does not follow a cross-origin navigation, so note the write in window.name, which does.
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k: string, v: string) {
        if (k === 'room:left') window.name = 'room-left-set';
        return set.call(this, k, v);
      };
    });
    await sitAtComputer(page);
    await playAllThree(page);
    await stageIs(page, 'portal');
    await expect(page.getByTestId('portal')).toBeVisible();
    await page.waitForURL(/premonition\.avious\.co/, { timeout: 15_000 });
    expect(requested.length).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.name)).toBe('room-left-set');
  });

  test('Skip to site works mid-portal and never reaches the Premonition URL', async ({ page }) => {
    const requested: string[] = [];
    await page.route(/premonition\.avious\.co/, (route) => {
      requested.push(route.request().url());
      return route.abort();
    });
    await sitAtComputer(page);
    await playAllThree(page);
    await stageIs(page, 'portal');
    await page.getByRole('button', { name: 'Skip to site' }).click();
    await expectSiteOpen(page);
    await page.waitForTimeout(3500);
    expect(requested).toEqual([]);
  });

  test('a played sound is dimmed and still clickable', async ({ page }) => {
    await sitAtComputer(page);
    await stageIs(page, 'plugin');
    const first = soundButtons(page).first();
    await expect(first).toBeEnabled({ timeout: 20_000 });
    await expect(first).toHaveAttribute('data-heard', 'false');
    await first.click();
    await expect(first).toHaveAttribute('data-heard', 'true', { timeout: 30_000 });
    await expect(first).toBeEnabled();
    await first.click();
    await stageIs(page, 'plugin');
  });

  test('Skip to site removes the canvas and sets room:left', async ({ page }) => {
    await enterRoom(page);
    await page.getByRole('button', { name: 'Skip to site' }).click();
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('room:left'))).toBe('1');
  });

  test('when the music cannot load the HUD says so and the room still works', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/audio/tracks/**', (route) => route.fulfill({ status: 404, body: 'missing' }));
    await enterRoom(page);
    await openIpod(page);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByText('Audio unavailable')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Now playing/)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ipod')).toHaveCount(0, { timeout: 5_000 });
    // Wait for the camera to ease back to walking (the prompt returns when it has).
    await expect(promptOf(page, 'ipod')).toHaveAttribute('data-visible', 'true', { timeout: 10_000 });
    const z0 = await attr(page, 'data-player-z');
    await holdKey(page, 's', 400);
    await expect.poll(() => attr(page, 'data-player-z')).toBeGreaterThan(z0 + 0.1);
    await page.getByRole('button', { name: 'Skip to site' }).click();
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a refused pointer lock still allows arrow keys and Skip to site', async ({ page }) => {
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
    // The one always-visible control still works with the pointer lock refused.
    await page.getByRole('button', { name: 'Skip to site' }).click();
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('room failures land on the normal site', () => {
  test('a setup failure (no WebGL context) leaves the normal home', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        if (/webgl/.test(id)) return null;
        return (orig as (...a: unknown[]) => unknown).call(this, id, ...rest);
      } as typeof orig;
    });
    await page.goto('/');
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 });
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  // The room now opens at page load, so a failing room chunk cannot be isolated from the app's own chunks here.
  // It is covered by the RoomGate unit test 'a room chunk that fails to load falls back to the normal home'.


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
