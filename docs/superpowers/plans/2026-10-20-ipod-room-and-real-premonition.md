# iPod-driven room and the real Premonition: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The 3D room is operated through a click-wheel iPod, and the computer (and the `/premonition` page) runs the real Premonition DSP, compiled to WebAssembly, on the visitor's own sounds, listen only.

**Architecture:** A standalone `src/premonition/` module (params, allowance, render worker plus WASM, plugin UI component) is embedded by both the room's computer and `/premonition`; it loads WASM only when opened. The iPod is a pure menu state machine (`src/room/ipod/`) with a DOM click-wheel UI that replaces the HUD buttons. The gate becomes an opaque per-page-load opener.

**Tech Stack:** Next.js 16 App Router, React 19, three.js, Vitest + Testing Library, Playwright, Emscripten (WASM, Web Worker), Web Audio.

**Spec:** `docs/superpowers/specs/2026-10-18-avious-site-design.md`, section "Revision 2026-10-20: iPod-driven room and the real Premonition" (plus "Calls made after the builder check" and "Owner answers after the builder check"). Executors read both. Next.js here has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before touching app or routing code.

## Global Constraints

- Plugin repo `/Users/aviouslyavi/Claude/Projects/premonition-vst` is **read only**; never edit it. Pin to the latest commit where the plugin's own DSP tests pass; record the hash in `src/premonition/PLUGIN_COMMIT.md`.
- Listen only: no download, save or export; the module returns samples to the worker's caller only for Web Audio playback and exposes no file-producing function.
- Clip cap `MAX_CLIP_SECONDS = 15`, enforced in the worker. Per-session allowance `RENDER_ALLOWANCE = 10` renders.
- Audio is processed in the browser and never uploaded; the UI says so in one line.
- Premonition is an offline renderer, not a live insert effect; copy never claims otherwise, no Windows claim, no testimonials or benchmarks.
- No pure white, no emoji, no exclamation marks. Never mention the Jam Room or remote-recording projects.
- Skip to site is always visible in the room (top-right) and never gated. No buttons in the room's bottom-left; the floating E prompts replace them.
- Budget: room chunk plus audio under 2 MB gzipped with no room chunk on any route; the WASM plus plugin UI target under about 1.5 MB gzipped and never load in the room chunk, on `/`, or on routes other than the room's computer and `/premonition`.
- Do not build outside this plan until the owner approves it. The spike (Task 1) stays local.

## Review Focus

- A visitor drops a file that is not audio, is empty, or fails to decode: the screen names the cause and stays usable (test in Task 4).
- A clip over 15 seconds, or a mono or 96 kHz file: cropped or resampled with a status line, never a crash or a silent render (Tasks 2 and 4).
- Render pressed twice, or Esc or Close during a render: the first render is cancelled, no audio plays after close (Tasks 2 and 4).
- sessionStorage blocked or the allowance counter corrupt: the allowance falls back to a fresh in-memory count of 10, never throws (Task 3).
- iPod used with only the keyboard, or with the pointer lock released: every menu entry reachable, Escape steps back then puts the iPod down (Task 6).
- WASM or Worker unsupported or fails to load: the plugin screen shows a plain message and the rest of the page and room still work (Task 4).

---

### Task 0: Housekeeping

**Files:**
- Modify: `.gitignore`, `HANDOFF.md` (already edited, uncommitted)
- Create: none; track `AGENTS.md`

- [ ] **Step 1:** Commit `.gitignore` (adds `.vercel`), `HANDOFF.md`, `AGENTS.md` (the owner's call is open; my default is to commit it) and the spec and this plan.
- [ ] **Step 2:** `git status` clean except `.superpowers/`. Commit: `docs: iPod-driven room and real Premonition design and plan`.

### Task 1: Spike (throwaway): can the real DSP run in a browser?

**Files:**
- Create (throwaway, in `.spike/`, gitignored): `build.sh`, `spike_main.cpp`, `spike.html`
- Create: `docs/superpowers/spike-2026-10-20-wasm-result.md` (the result)

**Interfaces:**
- Produces: a measured result and the entry point name used in Task 2 (the plugin's `renderRiser` in `Premonition/dsp/OfflinePipeline.h`, called from a thin C wrapper `extern "C" int premonition_render(...)`).

- [ ] **Step 1: Ask the owner for the go-ahead once more, then** install Emscripten into `~/.local/emsdk` (never system-wide), `emcc --version` prints a version.
- [ ] **Step 2:** Record the plugin commit: in the plugin repo run the tests per `tests/CONTEXT.md`; note the latest passing commit hash in the result file (read only; do not check out or edit in place: copy `Premonition/dsp/` and `Premonition/vendor/` to `.spike/src` from `git archive` of that commit).
- [ ] **Step 3:** Write `spike_main.cpp` wrapping `renderRiser` for a stereo float buffer, params from `Parameters.h`, BPM 120, 5 second clip. Compile with `emcc -O3 -msimd128 -s ALLOW_MEMORY_GROWTH=1 -s EXPORTED_FUNCTIONS=... -o spike.js`. Stub out `AudioLoader` (not needed).
- [ ] **Step 4:** Load in a Worker from `spike.html`, render a 5 s synthesized clip, write the result. Pass bar: render under about 5 s on this laptop, WASM plus JS under about 1.5 MB gzipped, output not silent and ends on the bar line.
- [ ] **Step 5:** Write measured numbers, the exact compile flags, and pass or fail into the result file. **If it fails or is borderline, stop and bring the owner the A-or-C choice from the spec; do not continue to Task 2.**
- [ ] **Step 6:** Commit the result file only: `docs: WASM spike result`.

### Task 2: WASM package and render worker

**Files:**
- Create: `scripts/build-dsp-wasm.sh`, `src/premonition/engine/wrapper.cpp`, `src/premonition/engine/render.worker.ts`, `src/premonition/engine/renderClient.ts`, `src/premonition/PLUGIN_COMMIT.md`
- Output (committed or built in CI per the spike's size result): `public/premonition/dsp.wasm`, `public/premonition/dsp.js`
- Test: `src/premonition/engine/renderClient.test.ts`

**Interfaces:**
- Consumes: Task 1 compile flags; `PluginParams` from `src/premonition/params.ts` (Task 3). Do Task 3 before Task 2.
- Produces:
  ```ts
  export const MAX_CLIP_SECONDS = 15;
  export type RenderRequest = { channels: Float32Array[]; sampleRate: number; bpm: number; params: PluginParams };
  export type RenderResult = { channels: Float32Array[]; sampleRate: number };
  export type RenderErrorCode = 'too-long' | 'empty' | 'unsupported' | 'failed' | 'cancelled';
  export class RenderError extends Error { code: RenderErrorCode }
  export function createRenderClient(): { render(req: RenderRequest, onProgress: (p: number) => void, signal: AbortSignal): Promise<RenderResult>; dispose(): void };
  ```

- [ ] **Step 1: Write failing tests** in `renderClient.test.ts` against a fake Worker injected through `createRenderClient(workerFactory?)`: `rejects a clip longer than 15 seconds with code 'too-long'`, `rejects zero-length input with 'empty'`, `aborting the signal rejects with 'cancelled' and terminates the worker`, `a second render cancels the first`, `reports 0..1 progress in order`, `a missing Worker maps to 'unsupported'`.
- [ ] **Step 2:** Run `npx vitest run src/premonition/engine` and see them fail.
- [ ] **Step 3:** Implement `renderClient.ts` (cap enforced in the worker message handler too, using `MAX_CLIP_SECONDS * sampleRate`), `render.worker.ts` (loads `dsp.js`, calls the wrapper, posts progress and result, transfers buffers), `wrapper.cpp` (the C entry point from the spike; no function that writes a file). Write `scripts/build-dsp-wasm.sh` taking the pinned plugin commit and building to `public/premonition/`.
- [ ] **Step 4:** Tests pass. Add one real-wasm Playwright check later in Task 8.
- [ ] **Step 5:** Commit: `feat(premonition): WASM render engine in a worker`.

### Task 3: Params and render allowance

**Files:**
- Create: `src/premonition/params.ts`, `src/premonition/allowance.ts`
- Test: `src/premonition/params.test.ts`, `src/premonition/allowance.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ReverbType = 'hall' | 'plate' | 'spring' | 'room';
  export type RiserMode = 'natural' | 'stretch' | 'forward';
  export type PluginParams = { type: ReverbType; stretch: number; size: number; decay: number; tail: number; mix: number; mode: RiserMode; normalize: boolean };
  export const RANGES: Record<'stretch' | 'size' | 'decay' | 'tail' | 'mix', { min: number; max: number }>;
  export const DEFAULT_PARAMS: PluginParams;
  export function clampParams(p: PluginParams): PluginParams;
  export const RENDER_ALLOWANCE = 10;
  export function createAllowance(storage?: Pick<Storage, 'getItem' | 'setItem'>): { remaining(): number; consume(): boolean };
  ```
  Ranges, defaults and labels are copied from `Premonition/Parameters.h` and `PRODUCT.md` (Stretch 0.25 to 4, default 1; Decay 0.1 to 20 s, default 2; Type default Plate per PRODUCT.md, Tail default 2 bars, Normalize off). The `Custom` type is excluded (spec).

- [ ] **Step 1: Failing tests:** `defaults match Parameters.h`, `clampParams clamps stretch to 0.25..4 and decay to 0.1..20`, `consume decrements and returns false at zero`, `remaining survives a reload through storage`, `a throwing storage falls back to an in-memory count of 10`, `a corrupt stored value resets to 10`.
- [ ] **Step 2:** Run, see them fail. **Step 3:** Implement. **Step 4:** Pass.
- [ ] **Step 5:** Commit: `feat(premonition): params and render allowance`.

### Task 4: Plugin screen component

**Files:**
- Create: `src/premonition/PluginScreen.tsx`, `src/premonition/Knob.tsx`, `src/premonition/PluginWaveform.tsx`, `src/premonition/usePreview.ts`, `src/premonition/decode.ts`, `src/premonition/plugin.module.css`
- Test: `src/premonition/PluginScreen.test.tsx`, `src/premonition/decode.test.ts`

**Interfaces:**
- Consumes: `createRenderClient`, `MAX_CLIP_SECONDS`, `PluginParams`, `DEFAULT_PARAMS`, `createAllowance`, `track` from `@/lib/analytics`.
- Produces:
  ```ts
  export function PluginScreen(props: { onClose?: () => void; onFirstPreview?: () => void }): JSX.Element;
  export function decodeClip(file: Blob, ctx: BaseAudioContext): Promise<{ channels: Float32Array[]; sampleRate: number; cropped: boolean }>;
  ```
  `decodeClip` crops to `MAX_CLIP_SECONDS`, mixes to at most two channels and sets `cropped`. `usePreview(result)` plays through Web Audio with play, stop and a playhead.

- [ ] **Step 1: Failing tests:** `decodeClip crops a 20 s clip to 15 s and reports cropped`, `a corrupt file shows "Could not read that file" and Render stays disabled`, `Render is disabled until a clip is loaded`, `pressing Render calls the client with the current params and consumes one allowance`, `Render at zero allowance shows the full-plugin line and does not call the client`, `Close during a render aborts it`, `the Drag card is disabled and no anchor, download attribute or blob URL exists in the DOM`, `Worker unsupported shows a plain message`.
- [ ] **Step 2:** Run, see them fail. **Step 3:** Implement the UI as a replica of `Premonition-current-ui.png` (Warm Analog palette, 960 by 720 design scaled to fit; knobs are keyboard-operable `role="slider"`; knob drag per the plugin spec); status bar shows 48 kHz and `120.0 bpm` (manual); one line "Your sound is processed in this browser and never uploaded". Starter sounds: 2 or 3 files from `content/sounds.ts` stand-ins. Fire `onFirstPreview` once and `track('demo_played')`.
- [ ] **Step 4:** Tests pass. **Step 5:** Commit: `feat(premonition): plugin screen replica with real render`.

### Task 5: `/premonition` page uses the plugin; retire the old demo

**Files:**
- Modify: `src/app/premonition/PremonitionDemoFrame.tsx`, `src/app/premonition/page.tsx` (copy only if the demo lede is now wrong), `src/content/copy.ts`
- Delete: `src/demo/*` and `src/content/sounds.ts` pre-rendered entries once Task 7 no longer imports them; remove `public/audio/demo/*`
- Test: `tests/e2e/premonition.spec.ts`

**Interfaces:**
- Consumes: `PluginScreen`.
- Produces: `PremonitionDemoFrame` renders `PluginScreen` loaded via `next/dynamic` with `ssr: false` after a "Try it" press, so `/premonition` ships no WASM until pressed. Phone layout: the 960 by 720 screen scales to the viewport width; the Render, Preview and knobs stay at least 44 px touch targets.

- [ ] **Step 1: Failing e2e:** `/premonition loads no dsp.wasm until Try it is pressed`, `after pressing Try it a short generated clip can be rendered and previewed` (headless Chromium; assert Preview becomes enabled), `at 390 px width there is no horizontal scroll`.
- [ ] **Step 2:** Run `npm run e2e -- premonition`, see fail. **Step 3:** Implement. **Step 4:** Pass; `tsc` clean.
- [ ] **Step 5:** Commit: `feat(premonition): working plugin on the page, retire pre-rendered demo`.

### Task 6: iPod menu model and UI

**Files:**
- Create: `src/room/ipod/menu.ts`, `src/room/ipod/IpodScreen.tsx`, `src/room/ipod/ClickWheel.tsx`, `src/room/ipod/ipod.module.css`
- Modify: `src/room/audioEngine.ts` (add `TrackPlayer.goTo(index: number): Promise<void>`, equal-power crossfade, same in-flight rules as `next()`), `src/content/copy.ts`
- Test: `src/room/ipod/menu.test.ts`, `src/room/ipod/IpodScreen.test.tsx`, additions to `src/room/audioEngine.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type PageId = 'services' | 'about' | 'contact';
  export type IpodScreenId = { kind: 'menu' } | { kind: 'music' } | { kind: 'page'; id: PageId };
  export type IpodState = { stack: IpodScreenId[]; index: number };
  export type IpodEvent = { type: 'SCROLL'; delta: number } | { type: 'SELECT' } | { type: 'BACK' };
  export type IpodAction = { type: 'play'; trackIndex: number } | { type: 'computer' } | { type: 'leave' } | { type: 'link'; href: string } | { type: 'close' };
  export const IPOD_MENU: readonly ['Music', 'Services', 'About', 'Contact', 'Computer', 'Leave the room'];
  export function ipodReducer(s: IpodState, e: IpodEvent): { state: IpodState; action: IpodAction | null };
  export function IpodScreen(props: { tracks: Track[]; currentIndex: number; onAction: (a: IpodAction) => void }): JSX.Element;
  ```
  `BACK` at the top-level menu returns `{ type: 'close' }`; scrolling wraps; `Music` lists the tracks; a page entry shows a few lines of copy and a link row to the full page.

- [ ] **Step 1: Failing tests:** `SCROLL wraps through the six menu entries`, `SELECT on Music pushes the music screen`, `SELECT on a track returns a play action with its index`, `SELECT on Services opens a page screen with a link action to /services`, `BACK from a page returns to the menu, BACK at the menu returns close`, `ArrowDown ArrowUp Enter Escape drive the component without a pointer`, `wheel drag in a circle scrolls one entry per step`, `goTo plays the requested track and ignores calls during an in-flight fade`.
- [ ] **Step 2:** Run, fail. **Step 3:** Implement; the click wheel is an SVG ring, pointer drag measures angle, centre button selects, "MENU" label goes back; a focusable list with `aria-activedescendant` mirrors the screen for assistive tech. **Step 4:** Pass.
- [ ] **Step 5:** Commit: `feat(room): click-wheel iPod menu and UI`.

### Task 7: Room integration (floating E prompts, zoom, iPod and plugin overlays)

**Files:**
- Create: `src/room/InteractPrompt.tsx`, `src/room/InteractPrompt.test.tsx`
- Modify: `src/room/RoomExperience.tsx`, `src/room/Hud.tsx`, `src/room/Hud.test.tsx`, `src/room/room.module.css`, `src/content/copy.ts`
- Test: `src/room/Hud.test.tsx`, `src/room/InteractPrompt.test.tsx`, `tests/e2e/room.spec.ts`

**Interfaces:**
- Consumes: `IpodScreen`, `IpodAction`, `PluginScreen`, `TrackPlayer.goTo`, `Interactable` (`'ipod' | 'computer'`), the existing `nearby` detection (`INTERACT_RADIUS`), `DESK_POSE` and the camera ease in `RoomExperience.tsx`.
- Produces:
  ```ts
  export function InteractPrompt(props: { target: Interactable; screenX: number; screenY: number; visible: boolean; onActivate: () => void }): JSX.Element;
  export const IPOD_POSE: { x: number; z: number; yaw: number; pitch: number };  // close, in front of the iPod screen
  ```
  `InteractPrompt` is the Roblox-style label from the spec (small dark rounded label, circled **E**, text "Use the iPod" or "Use the computer"), absolutely positioned at the object's projected screen position, a real `<button>` with `aria-label` "Use the iPod, press E". `RoomExperience` projects each object's anchor point with `camera` each frame and updates the two prompts via refs (no React state per frame), and hides them outside `mode === 'walk'` or out of range.
  `Hud` props reduce to `{ trackTitle: string; audioError?: boolean; onSkip: () => void }`: a "Skip to site" link top-right, the now-playing text, no other buttons, nothing clickable bottom-left. `RoomExperience.interact('ipod')` now eases to `IPOD_POSE` (same ease and `mode` machine as the computer, a new mode value `'ipod'`), then opens the iPod overlay centred; `interact('computer')` is unchanged (ease to `DESK_POSE`, then the plugin overlay). Actions from the iPod: `play` calls `goTo`, `computer` eases from the iPod pose to `DESK_POSE` and opens `PluginScreen`, `leave` calls `onLeave`, `link` navigates, `close` eases back to walking. Escape puts either overlay down and eases back. Clicking an object in range or its prompt does the same as E. `onFirstPreview` shows the quiet "Like it? Continue to the site" line with a link and fires `track('demo_played')` once; Skip fires `demo_skipped`, Leave fires a new `room_left` event (add to `EventName`).

- [ ] **Step 1: Failing tests:** `Hud has one control, Skip to site, positioned top-right, and no iPod, computer or leave buttons`, `InteractPrompt renders a circled E and "Use the iPod" with an accessible name, and calls onActivate when clicked`, `InteractPrompt is hidden when visible is false`, `E near the iPod eases to IPOD_POSE then shows the iPod overlay` (e2e), `no prompt shows while the iPod or computer overlay is open`, `walking out of range hides the prompt`, `Escape from the iPod eases back and the prompt returns`, `choosing Leave the room from the iPod calls onLeave`, `choosing a track changes the now-playing title`, `the plugin overlay closes with Esc and returns focus to the room`, `Skip is reachable by Tab while the iPod is open`.
- [ ] **Step 2:** Run, fail. **Step 3:** Implement. **Step 4:** Pass; run `npm test` and `npx tsc --noEmit`; view in the browser at 1280 px and send the owner a screenshot of both prompts and both zooms.
- [ ] **Step 5:** Commit: `feat(room): floating E prompts, zoom into iPod and computer, plugin overlay`.

### Task 8: Opaque front-door opener

**Files:**
- Modify: `src/room/RoomGate.tsx`, `src/room/RoomGate.test.tsx`, `src/room/room.module.css`, `tests/e2e/room.spec.ts`, `src/app/page.tsx` only if home content is not already in the server HTML

**Interfaces:**
- Produces: the `room:left` sessionStorage flag is removed; Skip or Leave sets a module-level `leftThisView` so the opener returns on the next page load; the opener is opaque and full screen (no home content visible behind it) while the home page content stays in the server HTML (keep the existing `inert` handling).

- [ ] **Step 1: Failing tests:** `Skip hides the opener and a fresh mount shows it again`, `the opener covers the viewport with an opaque background`, `the server HTML of / still contains the home heading` (e2e or SSR render assertion), `Escape still skips`.
- [ ] **Step 2:** Run, fail. **Step 3:** Implement. **Step 4:** Pass.
- [ ] **Step 5:** Commit: `feat(room): opaque per-page-load opener`.

### Task 9: Budget, timing, docs

**Files:**
- Modify: `scripts/check-budget.mjs`, `scripts/check-budget.test.ts`, `tests/e2e/room-timing.spec.ts`, `README.md`, `HANDOFF.md`, `src/premonition/PLUGIN_COMMIT.md`, `THIRD-PARTY` credits link in the footer if needed

- [ ] **Step 1: Failing tests:** `budget fails when the wasm chunk is referenced by /` and `by the room chunk`, `budget reports the wasm plus plugin UI gzip total and fails over 1.5 MB`, and an e2e `a 5 s clip renders within 30 s under 4x CPU throttling` (soft limit).
- [ ] **Step 2:** Run, fail. **Step 3:** Extend the script to read `public/premonition/*` and the plugin UI chunk; add a visible credits entry for signalsmith-stretch and WDL per the plugin's `THIRD-PARTY-NOTICES.txt` (copy the notice text, do not paraphrase). **Step 4:** `npm run build && npm run budget` passes; `npm test`, `npx tsc --noEmit` and `npm run e2e` all green.
- [ ] **Step 5:** Update `README.md` (build step for the WASM) and `HANDOFF.md`; commit: `docs: iPod room and real Premonition shipped notes`.
- [ ] **Step 6:** Preview deploy only with the owner's yes (`vercel deploy`, never `--prod`).

---

## Self-review notes

- Coverage: iPod click wheel and menu (6, 7), real plugin on the computer (4, 7) and on `/premonition` (5), listen only (4 test), time limited (3, 4), opener per page load (8), Skip always (7), WASM budget (9), spike and fallback (1), pinning (1, 2), credits (9).
- Types: `PluginParams`, `RenderRequest`, `IpodAction`, `TrackPlayer.goTo` are named identically wherever used.
- Left open: starter sounds and iPod track list (placeholders), the owner's confirmation of "time limited" as a render count.
