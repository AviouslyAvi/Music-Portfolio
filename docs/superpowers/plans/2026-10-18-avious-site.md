# AVIOUS Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild imavious.org as a Next.js portfolio whose desktop home is a three.js walk-in music room (iPod = portfolio, computer = Premonition demo), with a complete, fast, 3D-free normal site behind it.

**Architecture:** Every route is a server-rendered normal page. The room is a client-only module that `/` loads with `next/dynamic` only after a capable desktop visitor clicks Enter, so no other visitor downloads three.js. Pure logic (capability detection, movement and collision, demo state machine, crossfade math, layout) lives in small framework-free modules with unit tests; the three.js/React layers are thin wrappers over them. The Premonition demo is one React component reused inside the room (full-screen overlay) and on `/premonition`.

**Tech Stack:** Next.js (App Router) + TypeScript, three.js (vanilla, no react-three-fiber, to stay under budget), Vitest + Testing Library (unit), Playwright (e2e), Resend (contact email), Vercel (hosting/previews).

**Spec:** `docs/superpowers/specs/2026-10-18-avious-site-design.md` (read it before any task; the plan argues from it).

## Global Constraints

- Branch `experiment/new-architecture`; `main` and the GitHub Pages deploy (`CNAME`, old `index.html`, `contact.html`, `styles.css`, `script.js`) stay untouched until the owner switches the domain. The new app lives in `src/`, `public/`, and root config files; old static files are left in place until the owner approves removal.
- Build **only after the owner OKs this plan.** No product code before that.
- Room is built from code with simple shapes: no imported 3D models.
- Palette: charcoal and walnut with warm lamp glow; warm off-white text. **No pure white** (`#fff`, `#ffffff`, `white`, `rgb(255,255,255)`), no cream, no emoji, no exclamation marks in visitor-facing copy. Maroon only as a tiny accent.
- Never mention the Jam Room or remote recording anywhere (copy, links, comments, filenames).
- Premonition facts allowed: offline renderer, not a live insert effect; VST3, AU, CLAP; drop, render, drag; tagline "Echoes of the future."; launch price $19.99 then $24.99; free demo; wordmark uppercase tracked PREMONITION. No testimonials, press, benchmarks, or "real-time" claims. **No Windows claim.**
- Plugins section lists Premonition only, built so a second plugin is a data addition (`src/content/plugins.ts`).
- About lists exactly these DAWs: FL Studio, Ableton, Studio One, Logic Pro, Cubase, Reaper.
- Routes: room only at `/`. `/services`, `/work`, `/premonition`, `/about`, `/contact` never import three.js. `contact.html` redirects (permanent) to `/contact`.
- Skip control always visible and working during Enter, room, boot and demo. A persistent "Leave the room" control is available in the room at all times.
- Demo: pre-rendered audio files, about 3 seconds, ending on the downbeat; generic DAW screen (copies no real DAW); placeholder audio until the owner supplies real renders, each placeholder flagged `placeholder: true`.
- Budget: room code + assets about 2 MB gzipped or less, walkable in about 5 s on a laptop 5+ years old; over budget means cutting geometry.
- Contact: email via form, no file upload, no database, no accounts. Analytics: cookieless event counts only (`room_entered`, `demo_played`, `demo_skipped`, `premonition_viewed`), no consent banner.
- Links to premonition.avious.co and avious.co are env-configurable placeholders until those sites exist.
- Every commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Pointer lock denied or released with Esc: the visitor can still move (arrow keys/WASD), reach the iPod and computer (E key / HUD buttons), and leave. (Task 10)
2. Audio file missing, decode failure, or autoplay refused: iPod and demo show a quiet error state, never throw, and Skip still works. (Tasks 5, 9)
3. Rapid repeated input: clicking the iPod mid-crossfade, picking a sound while a riser plays, double-clicking Enter. (Tasks 5, 9)
4. WebGL context loss or a throw while building the room: visitor lands on the normal site instead of a blank canvas. (Task 10)
5. Contact form: empty or malformed email, huge message, honeypot filled, mail provider failure, double submit. (Task 4)

---

## File Structure

```
package.json, tsconfig.json, next.config.mjs, vitest.config.ts, playwright.config.ts, .env.example
public/audio/tracks/*.mp3        placeholder tracks (swap step in README)
public/audio/demo/*.mp3          placeholder ~3 s risers (swap step in README)
scripts/check-budget.mjs         gzip budget + "no three outside room" check
src/app/layout.tsx, globals.css  tokens, fonts, Nav, Footer, analytics script
src/app/page.tsx                 normal home + <RoomGate/>
src/app/{work,services,premonition,about,contact}/page.tsx
src/app/api/contact/route.ts     POST handler
src/app/sitemap.ts, robots.ts
src/content/{site,tracks,sounds,plugins,copy}.ts   all copy and data
src/lib/{capability,analytics,contact}.ts
src/demo/{machine.ts,PremonitionDemo.tsx,BootSequence.tsx,DawScreen.tsx,useRenderedAudio.ts}
src/room/{palette,layout,movement,buildRoom,audioEngine}.ts
src/room/{RoomGate,RoomExperience,Hud}.tsx
tests/guards.test.ts             copy/palette/forbidden-term guards
tests/e2e/*.spec.ts
```

---

### Task 1: Scaffold, tooling, design tokens, guard tests

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder), `tests/guards.test.ts`
- Modify: `.gitignore` (add `.next`, `node_modules`, `.env*.local`)

**Interfaces:**
- Produces: CSS custom properties `--charcoal #23262a`, `--charcoal-2 #2d3136`, `--walnut #5b3f2c`, `--lamp #e9a85f`, `--text #efe6d8`, `--muted #b9ad9c`, `--accent-maroon #6e2330`; scripts `npm run dev|build|test|e2e|budget`; `@/` alias to `src/`.

- [ ] **Step 1: Write the failing guard test** `tests/guards.test.ts` that walks `src/` and `public/` text files and asserts: no match for `/jam[ -]?room|remote[ -]?record/i`; no `#fff\b|#ffffff|\bwhite\b|rgb\(255,\s*255,\s*255\)` in `.css/.ts/.tsx`; no emoji (`/\p{Extended_Pictographic}/u`); no `!` inside string literals/JSX text in `src/content/**` (exclamation marks); no `/windows/i` in `src/content/**`; no `/real-?time/i` in `src/content/**`.
- [ ] **Step 2: Run** `npx vitest run tests/guards.test.ts`. Expected: FAIL (no vitest config yet).
- [ ] **Step 3: Scaffold** Next.js App Router + TypeScript in the repo root without overwriting existing static files (create files by hand or scaffold in a temp dir and copy). Add `three`, `@types/three`, `resend`, `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test`. Pick fonts via `next/font` (builder's call: a serif for headlines, a clean sans for business text; confirm in the PR description). Write `globals.css` with the tokens above and body background `--charcoal`, text `--text`.
- [ ] **Step 4: Run** `npx vitest run` and `npm run build`. Expected: guard test PASS, build succeeds.
- [ ] **Step 5: Commit** `chore: scaffold Next.js app, tokens, content guard tests`.

---

### Task 2: Content data, capability detection, analytics

**Files:**
- Create: `src/content/site.ts`, `src/content/tracks.ts`, `src/content/sounds.ts`, `src/content/plugins.ts`, `src/lib/capability.ts`, `src/lib/analytics.ts`, `public/audio/tracks/placeholder-1.mp3` (+2), `public/audio/demo/placeholder-riser-{1,2,3}.mp3` (about 3 s generated placeholders), `src/lib/capability.test.ts`, `src/lib/analytics.test.ts`

**Interfaces:**
- Produces:
  - `LINKS: { premonitionStore: string; premonitionAccount: string; aviousCo: string; demoDownload: string }` (from `NEXT_PUBLIC_*` env, defaults `https://premonition.avious.co`, `https://premonition.avious.co/account`, `https://avious.co`, `/downloads/premonition-demo.zip`; each marked `// PLACEHOLDER`)
  - `type Track = { id: string; title: string; src: string; placeholder: boolean }`, `TRACKS: Track[]`
  - `type DemoSound = { id: string; label: string; rendered: string; placeholder: boolean }`, `SOUNDS: DemoSound[]` (three entries)
  - `type Plugin = { slug: string; name: string; tagline: string; formats: string[] }`, `PLUGINS: Plugin[]` (Premonition only)
  - `type Env = { webgl: boolean; reducedMotion: boolean; coarsePointer: boolean; viewportWidth: number; deviceMemory?: number; hardwareConcurrency?: number }`
  - `shouldOfferRoom(env: Env): boolean`; `detectEnv(win: Window): Env`
  - `type EventName = 'room_entered' | 'demo_played' | 'demo_skipped' | 'premonition_viewed'`; `track(name: EventName, send?: (name: string) => void): void`

- [ ] **Step 1: Write failing tests.** `shouldOfferRoom` returns true for `{webgl:true, reducedMotion:false, coarsePointer:false, viewportWidth:1440, deviceMemory:8, hardwareConcurrency:8}`; false when each of these changes alone: `webgl:false`, `reducedMotion:true`, `coarsePointer:true`, `viewportWidth:900`, `deviceMemory:2`, `hardwareConcurrency:2`; true when `deviceMemory`/`hardwareConcurrency` are undefined. `track('demo_played', spy)` calls `spy('demo_played')`; `track` with no `send` and no `window.plausible` does not throw.
- [ ] **Step 2: Run** `npx vitest run src/lib` — Expected: FAIL.
- [ ] **Step 3: Implement** the modules. `shouldOfferRoom` thresholds: width >= 1024, memory >= 4, cores >= 4 (named constants, builder tunes). `detectEnv` tests WebGL by creating a canvas and requesting `webgl2` then `webgl`; media queries `(prefers-reduced-motion: reduce)` and `(pointer: coarse)`. `track` default sender calls `window.plausible?.(name)`. Generate placeholder mp3s with `ffmpeg` sine/noise sweeps; document in the README that real files replace them at the same paths and `placeholder` flips to `false`.
- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS (including guards).
- [ ] **Step 5: Commit** `feat: content data, capability detection, analytics`.

---

### Task 3: Normal-site shell and home, services, about pages

**Files:**
- Create: `src/content/copy.ts`, `src/components/{Nav,Footer,Section}.tsx`, `src/app/services/page.tsx`, `src/app/about/page.tsx`, `tests/e2e/pages.spec.ts`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Produces: `Nav` links (Work, Services, Premonition, About, Contact); `<Section title?: string>` wrapper; exports from `copy.ts`: `HERO`, `PHILOSOPHY`, `EMOTIONAL_PALETTE`, `SERVICES` (production and arrangement, sound design, finishing and finalization, teaching and mentorship), `DAWS` (exactly the six in Global Constraints), `ABOUT`.
- Consumes: tokens (Task 1), `LINKS` (Task 2).

- [ ] **Step 1: Write failing e2e** `pages.spec.ts`: for `/`, `/services`, `/about`: status 200, one `h1`, nav present; `/about` text contains each of the six DAW names; `/services` lists the four services; with JS disabled `/` still contains the hero text "I don't make beats. I build worlds you can live in."
- [ ] **Step 2: Run** `npx playwright test tests/e2e/pages.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Adapt (do not paste verbatim) copy from the root `index.html` (hero, philosophy cards, emotional palette, services, legacy pillars) into `copy.ts`, rewriting to meet the no-exclamation rule and charcoal/walnut look. Nav includes outbound "Buy" link to `LINKS.premonitionStore` and "Account" to `LINKS.premonitionAccount`; footer links `LINKS.aviousCo`. Mobile nav collapses to a menu; layout works at 360 px.
- [ ] **Step 4: Run** the e2e and `npx vitest run` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: normal site shell, home, services, about`.

---

### Task 4: Contact form and API

**Files:**
- Create: `src/lib/contact.ts`, `src/lib/contact.test.ts`, `src/app/api/contact/route.ts`, `src/app/contact/ContactForm.tsx`, `src/app/contact/page.tsx`, `tests/e2e/contact.spec.ts`
- Modify: `.env.example` (`RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`)

**Interfaces:**
- Produces:
  - `type ContactInput = { name: string; email: string; message: string; link?: string; website?: string /* honeypot */ }`
  - `type ContactResult = { ok: true } | { ok: false; error: 'invalid' | 'spam' | 'send_failed' }`
  - `validateContact(input: unknown): { ok: true; value: ContactInput } | { ok: false; error: 'invalid' }` (name 1–100, email shape, message 1–5000, link optional http(s) URL)
  - `submitContact(input: unknown, send: (m: { subject: string; text: string; replyTo: string }) => Promise<void>): Promise<ContactResult>` (honeypot filled → `{ok:false,error:'spam'}` without calling `send`; a throwing `send` → `send_failed`)
  - `POST /api/contact` → 200 `{ok:true}` or 4xx/5xx `{ok:false,error}`

- [ ] **Step 1: Write failing tests** in `contact.test.ts`: valid input calls `send` once with `replyTo` = the email; empty message, `"not-an-email"`, 5001-char message, and `link: "javascript:alert(1)"` each return `invalid` and never call `send`; `website: "x"` returns `spam` and never calls `send`; a `send` that rejects returns `send_failed`.
- [ ] **Step 2: Run** `npx vitest run src/lib/contact.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `contact.ts`; the route builds the Resend sender from env and returns 500 `send_failed` if env is missing. `ContactForm` disables the submit button while pending (no double submit), shows inline field errors, shows a plain success message, and offers the invitation line "link to a voice note, a rough idea, or a mood". No file input.
- [ ] **Step 4: E2E** `contact.spec.ts` with the route mocked via Playwright `page.route`: success shows confirmation; a 500 shows an error and keeps the typed text. Run unit + e2e — Expected: PASS.
- [ ] **Step 5: Commit** `feat: contact form and email API`.

---

### Task 5: Demo state machine and PremonitionDemo component

**Files:**
- Create: `src/demo/machine.ts`, `src/demo/machine.test.ts`, `src/demo/useRenderedAudio.ts`, `src/demo/BootSequence.tsx`, `src/demo/DawScreen.tsx`, `src/demo/PremonitionDemo.tsx`, `src/demo/PremonitionDemo.test.tsx`

**Interfaces:**
- Consumes: `SOUNDS`, `DemoSound`, `track` (Task 2).
- Produces:
  - `type DemoPhase = 'idle' | 'booting' | 'ready' | 'playing' | 'done' | 'skipped'`
  - `type DemoState = { phase: DemoPhase; soundId: string | null; audioError: boolean }`
  - `type DemoEvent = { type: 'POWER_ON' } | { type: 'BOOT_DONE' } | { type: 'PICK'; soundId: string } | { type: 'ENDED'; failed?: boolean } | { type: 'SKIP' }`
  - `initialDemoState: DemoState`; `demoReducer(s: DemoState, e: DemoEvent): DemoState`
  - `useRenderedAudio(): { play(src: string): Promise<void>; stop(): void }` (resolves when the file ends; rejects on load/decode/autoplay failure)
  - `PremonitionDemo(props: { bootSequence: boolean; onFinish?: (reason: 'done' | 'skipped') => void })`

- [ ] **Step 1: Write failing tests** for `demoReducer`: `POWER_ON` only from `idle` → `booting`; `BOOT_DONE` `booting` → `ready`; `PICK` from `ready` or `done` → `playing` with `soundId`; **`PICK` while `playing` is ignored (state unchanged)**; `ENDED` `playing` → `done`; `ENDED` with `failed:true` → `done` with `audioError:true`; `SKIP` from any phase except `skipped` → `skipped`; all other transitions return the same state object. Component test: with a mocked `useRenderedAudio` that rejects, picking a sound shows "Audio unavailable" text, reaches `done`, and the Skip button remains enabled; with `bootSequence={false}` it renders in `ready` showing all `SOUNDS` labels.
- [ ] **Step 2: Run** `npx vitest run src/demo` — Expected: FAIL.
- [ ] **Step 3: Implement.** Reducer as specified. `BootSequence`: vintage-style text boot (about 2.5 s, calls `onDone`; the visitor can press any key or Skip to jump to `ready`). `DawScreen`: generic track-lane UI (no real-DAW likeness) with a PREMONITION plugin panel (uppercase tracked wordmark, tagline "Echoes of the future.", Drop / Render / Drag steps) and one button per sound. On `PICK`: call `play(sound.rendered)`, `track('demo_played')`, dispatch `ENDED` when it resolves or `ENDED{failed:true}` when it rejects. Skip button always rendered; on click call `stop()`, `track('demo_skipped')`, dispatch `SKIP`, then `onFinish('skipped')`. After `done`, show "Continue to site" calling `onFinish('done')`. Keyboard operable; `role="status"` region announces phase.
- [ ] **Step 4: Run** `npx vitest run src/demo` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: Premonition demo state machine and component`.

---

### Task 6: Work and Premonition pages, redirects, SEO

**Files:**
- Create: `src/app/work/page.tsx`, `src/app/work/TrackList.tsx`, `src/app/premonition/page.tsx`, `src/app/premonition/PremonitionViewed.tsx`, `src/app/sitemap.ts`, `src/app/robots.ts`, `tests/e2e/premonition.spec.ts`
- Modify: `next.config.mjs` (redirect `/contact.html` → `/contact`, permanent)

**Interfaces:**
- Consumes: `TRACKS`, `LINKS`, `PLUGINS`, `PremonitionDemo`, `track`.
- Produces: `TrackList` (`<audio>`-based, one track plays at a time).

- [ ] **Step 1: Write failing e2e:** `/premonition` shows the PREMONITION wordmark, tagline, formats "VST3, AU, CLAP", price text containing `$19.99`, a Buy link whose `href` equals the store placeholder, a free-demo download link, and the demo (ready phase, three sounds); its text matches none of `/windows|real-?time/i`; the page's network log loads no chunk containing `three`. `/contact.html` responds 308 to `/contact`. `/work` lists every `TRACKS` title; starting one track pauses another.
- [ ] **Step 2: Run** `npx playwright test tests/e2e/premonition.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `PremonitionViewed` is a client component firing `track('premonition_viewed')` once on mount. Page metadata (title/description/OpenGraph) on every route. Launch price copy states $19.99 launch then $24.99 without urgency language.
- [ ] **Step 4: Run** e2e + `npx vitest run` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: work and Premonition pages, redirects, metadata`.

---

### Task 7: Movement and collision (pure)

**Files:**
- Create: `src/room/palette.ts`, `src/room/layout.ts`, `src/room/movement.ts`, `src/room/movement.test.ts`, `src/room/layout.test.ts`

**Interfaces:**
- Produces:
  - `type Vec2 = { x: number; z: number }`; `type Box = { minX: number; maxX: number; minZ: number; maxZ: number }`
  - `type PlayerState = { pos: Vec2; yaw: number }`; `type MoveInput = { forward: number; strafe: number; turn: number }` (each −1..1)
  - `PLAYER_RADIUS = 0.3`, `WALK_SPEED = 1.6` (m/s), `TURN_SPEED = 1.8` (rad/s)
  - `stepPlayer(s: PlayerState, i: MoveInput, dt: number, solids: Box[], bounds: Box): PlayerState`
  - In `layout.ts`: `ROOM_BOUNDS: Box`, `SOLIDS: Box[]` (desk, rug excluded, speakers, shelves), `START: PlayerState`, `IPOD_POS: Vec2`, `COMPUTER_POS: Vec2`, `INTERACT_RADIUS = 1.4`, `nearestInteractable(p: Vec2): 'ipod' | 'computer' | null`
  - In `palette.ts`: `ROOM_COLORS = { charcoal, walnut, lamp, offWhite, rug }` (no pure white)

- [ ] **Step 1: Write failing tests:** forward input with `yaw=0` moves along −z by `WALK_SPEED*dt`; diagonal (`forward=1, strafe=1`) speed is not faster than `WALK_SPEED`; walking straight into `ROOM_BOUNDS` stops at `bound − PLAYER_RADIUS`; walking diagonally into a `Box` slides along it instead of sticking; `dt = 0` and a huge `dt` (1 s) never place the player inside a solid or out of bounds; `START` is not inside any solid; `nearestInteractable` returns `'ipod'` at `IPOD_POS`, `'computer'` at `COMPUTER_POS`, `null` at `START`.
- [ ] **Step 2: Run** `npx vitest run src/room` — Expected: FAIL.
- [ ] **Step 3: Implement** with axis-separated collision (resolve x then z) and sub-stepping for large `dt`. Room footprint about 4 m wide × 6 m deep (narrow production room per the spec); layout numbers are the builder's call but `SOLIDS` must match the geometry in Task 8.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: room layout and player movement`.

---

### Task 8: Room scene from simple shapes

**Files:**
- Create: `src/room/buildRoom.ts`, `src/room/buildRoom.test.ts`

**Interfaces:**
- Consumes: `ROOM_COLORS`, `ROOM_BOUNDS`, `SOLIDS`, `IPOD_POS`, `COMPUTER_POS` (Task 7).
- Produces: `buildRoom(): { group: THREE.Group; ipod: THREE.Object3D; computer: THREE.Object3D; speakers: [THREE.Object3D, THREE.Object3D]; triangleCount: number; dispose(): void }`

- [ ] **Step 1: Write failing test:** `buildRoom()` runs in Node without a DOM; `triangleCount <= 60000`; `ipod.position` equals `IPOD_POS` (x,z) and `computer.position` equals `COMPUTER_POS`; the two speakers exist; every material color is not pure white (`0xffffff`); the glow materials (ipod, computer screen) have `emissiveIntensity` greater than every other material's; `dispose()` can be called twice without throwing.
- [ ] **Step 2: Run** `npx vitest run src/room/buildRoom.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** with `BoxGeometry`/`CylinderGeometry`/`PlaneGeometry` only, flat-shaded low-poly materials, a baked-look lighting setup (one warm lamp point light, low ambient, no shadow maps). Scene dressing from the reference: charcoal walls, tall walnut slat panels, L-shaped walnut desk with black mat, a window on one side, two floating shelves on black brackets, shaggy grey rug (a flat slab, no fur), black chair, monitors on stands, a wall guitar from simple shapes, plants, analog clock, two posters as flat colored planes. Dim and muted overall; only iPod and computer screen use bright emissive.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: build walk-in room from primitives`.

---

### Task 9: Room audio engine and iPod

**Files:**
- Create: `src/room/audioEngine.ts`, `src/room/audioEngine.test.ts`

**Interfaces:**
- Consumes: `Track`, `TRACKS` (Task 2).
- Produces:
  - `crossfadeGains(t: number, duration: number): { out: number; in: number }` (equal-power; `t` clamped to 0..duration)
  - `class TrackPlayer { constructor(ctx: AudioContext, tracks: Track[], out: AudioNode); start(): Promise<void>; next(): Promise<void>; readonly index: number; readonly title: string; onError(cb: (e: { trackId: string }) => void): void; dispose(): void }`

- [ ] **Step 1: Write failing tests:** `crossfadeGains(0, 2)` → `{out:1,in:0}`; `crossfadeGains(2, 2)` → `{out:0,in:1}`; at the midpoint `out² + in²` ≈ 1; `t` below 0 or above `duration` is clamped. `TrackPlayer` with a fake `AudioContext`/fetch: `next()` three times quickly (called while a fade is running) ends with `index` advanced exactly once per accepted call and never more than one fade in flight (extra calls during a fade are queued as a single pending request or ignored — pick one and assert it); a track whose fetch/decode fails calls `onError` with its id and playback moves to the next track instead of going silent; `dispose()` is idempotent.
- [ ] **Step 2: Run** `npx vitest run src/room/audioEngine.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Decoded buffers cached; the master chain feeds both speakers (builder's call: two `PannerNode`s positioned at the speaker objects, with distance falloff, via `THREE.AudioListener` or raw Web Audio). Looping playlist; crossfade 1.5 s.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: room audio engine with crossfading playlist`.

---

### Task 10: RoomExperience, HUD, RoomGate

**Files:**
- Create: `src/room/RoomExperience.tsx`, `src/room/Hud.tsx`, `src/room/RoomGate.tsx`, `src/room/Hud.test.tsx`, `tests/e2e/room.spec.ts`
- Modify: `src/app/page.tsx` (render home content then `<RoomGate/>`)

**Interfaces:**
- Consumes: `shouldOfferRoom`, `detectEnv`, `track` (Task 2); `stepPlayer`, `nearestInteractable`, `START` (Task 7); `buildRoom` (Task 8); `TrackPlayer` (Task 9); `PremonitionDemo` (Task 5).
- Produces:
  - `RoomExperience(props: { onLeave: () => void; onFail: () => void })`, default export, only ever imported through `next/dynamic({ ssr: false })`
  - `Hud(props: { nearby: 'ipod' | 'computer' | null; trackTitle: string; onInteract: (t: 'ipod' | 'computer') => void; onLeave: () => void })` — always renders buttons "Play next track (iPod)", "Use the computer", "Leave the room"
  - `RoomGate()`: after mount, runs `shouldOfferRoom(detectEnv(window))`; if false or `sessionStorage['room:left']` is set, renders nothing (normal home stays); otherwise shows the Enter overlay with a Skip button; Enter calls `track('room_entered')`, starts audio from that user gesture, then loads `RoomExperience`

- [ ] **Step 1: Write failing tests.** Unit (`Hud.test.tsx`): the three buttons are always present and keyboard focusable, and clicking calls the matching callback, independent of `nearby`. E2E (`room.spec.ts`, Chromium desktop with WebGL via `--use-gl=swiftshader` args): `/` shows the Enter overlay and Skip; Skip reveals the normal home and the room chunk is never requested; Enter loads the canvas; pressing W changes a `data-player-z` attribute exposed on the canvas wrapper for tests; "Use the computer" opens the demo, picking a sound and finishing returns to the room, and Skip also returns; "Leave the room" removes the canvas and sets `room:left`. In a context with `reducedMotion: 'reduce'`, a mobile viewport (390×844 with `hasTouch`), and with WebGL disabled: no overlay, no room request. Denying pointer lock (stub `requestPointerLock` to reject) still allows arrow-key movement and the HUD buttons. Making `buildRoom` throw (test hook via `window.__ROOM_FAIL__` read only in non-production builds) lands on the normal site with no blank canvas. `webglcontextlost` on the canvas does the same.
- [ ] **Step 2: Run** unit + `npx playwright test tests/e2e/room.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `RoomExperience`: create renderer (`antialias:false`, pixel ratio capped at 1.5), camera at eye height 1.6 m, `requestAnimationFrame` loop calling `stepPlayer` from WASD/arrow keys, mouse-look when pointer is locked (click canvas to lock; drag-look fallback when lock is refused or released); `E` triggers the nearest interactable and raycast clicks on the `ipod`/`computer` objects do the same; iPod → `TrackPlayer.next()` and HUD title update; computer → camera eases to the screen, then `PremonitionDemo bootSequence` overlays; `onFinish` closes the overlay. Visibility change pauses the loop and audio. Cleanup disposes renderer, geometries, audio, listeners. Any exception in setup or `webglcontextlost` calls `onFail`, and `RoomGate` then unmounts the room and keeps the normal home. Leave the room: `sessionStorage['room:left']='1'`, unmount.
- [ ] **Step 4: Run** unit + e2e — Expected: PASS.
- [ ] **Step 5: Commit** `feat: walk-in room experience, HUD, and gate`.

---

### Task 11: Budget enforcement, docs, preview deploy

**Files:**
- Create: `scripts/check-budget.mjs`, `README.md` (replace; keep the old site's notes under a "Legacy static site" heading)
- Modify: `package.json` (`"budget": "node scripts/check-budget.mjs"`), `HANDOFF.md`

**Interfaces:**
- Consumes: the `.next` build output.
- Produces: `npm run budget` exits non-zero when (a) the gzip total of the room chunk plus `public/audio/tracks/*` and `public/audio/demo/*` exceeds 2 MB, or (b) any non-`/` route's first-load JS includes the three.js chunk.

- [ ] **Step 1: Write the script and run it against a build that deliberately imports `RoomExperience` from `/services`** — Expected: budget exits 1 naming the route.
- [ ] **Step 2: Remove the deliberate import**, run `npm run build && npm run budget` — Expected: exits 0, prints sizes. If over budget, cut geometry in `buildRoom.ts` and re-run (do not raise the limit).
- [ ] **Step 3: README** documents: env vars (`.env.example`), the audio swap step (replace files in `public/audio/tracks` and `public/audio/demo`, set `placeholder:false` in `src/content/{tracks,sounds}.ts`), how to set the premonition.avious.co / avious.co links, free-demo file hosting (default: direct download from `public/downloads/`, switch to the premonition.avious.co URL via `NEXT_PUBLIC_DEMO_DOWNLOAD`), and the domain switch steps (not performed).
- [ ] **Step 4: Full verification:** `npx vitest run && npm run build && npm run budget && npx playwright test` — Expected: all PASS. Manually time room load throttled to 4x CPU in Chromium DevTools and record in the PR description (target walkable in about 5 s).
- [ ] **Step 5: Deploy a Vercel preview only** (no production alias, no DNS change), update `HANDOFF.md` with status and the preview URL, commit `docs: README, budget check, handoff update`.

---

## Self-review notes

- **Spec coverage:** experience (Tasks 7–10), fallback and detection (2, 10), look/palette (1, 8), content areas (3, 6), Premonition demo (5), routing and Leave control (3, 6, 10), budget (11), assets/placeholder swap (2, 11), hosting/redirect (6, 11), contact (4), analytics (2, 5, 6, 10), Windows/real-time/Jam Room exclusions (1 guards). Open items (avious.co contents, iPod tracks, rendered sounds, domain switch) are placeholders by design and surfaced in the README.
- **Owner inputs needed before final polish, not before build:** real tracks, three rendered Premonition sounds, avious.co destination, the domain switch.
