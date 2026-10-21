# Part B: The real Premonition (WASM engine and plugin screen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `PluginScreen` component that renders three shipped dry sounds through Premonition's own C++ pipeline compiled to WebAssembly, re-renders when a knob moves, previews in stereo, and reports which sounds have been heard.

**Architecture:** `src/premonition/` is a self-contained module: params, a wrapper-built `dsp.wasm` loaded only inside a Web Worker, a render client, a preview player on its own `AudioContext`, and the plugin screen. The face starts from the replica already committed in `src/demo/` (Mockup O Console skin) and is moved here, driven by real render output. Part C embeds it in the room; the `/premonition` page embeds it standalone.

**Tech Stack:** Emscripten (installed at `~/.local/emsdk`, source it with `source ~/.local/emsdk/emsdk_env.sh`), Web Worker, Web Audio, React 19, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-room-premonition-sequence-design.md`, "Part B" and "The handshake". Also read `docs/superpowers/spike-2026-10-20-wasm-result.md`, and `docs/superpowers/plans/2026-10-20-ipod-room-and-real-premonition.md` Tasks 2 to 4 (this plan overrides them where the spec does). Branch `feat/part-b-premonition`, cut from `7f508e9`, in your own git worktree. Merge order is A, then B, then C.

## Global Constraints

- Plugin repo `/Users/aviouslyavi/Claude/Projects/premonition-vst` is read only. Pin the DSP to a commit where its own tests pass; record the hash and the test result in `src/premonition/PLUGIN_COMMIT.md`.
- The throwaway spike is in `/Users/aviouslyavi/Claude/Projects/Music-Portfolio/.spike/` (gitignored, so absent from your worktree): read `src/spike_main.cpp` and `build.sh` there by absolute path. Do not commit it.
- Only edit `src/premonition/**`, `scripts/build-dsp-wasm.sh`, `scripts/make-placeholder-sources.mjs`, `public/premonition/**`, `public/audio/premonition/**`, the `/premonition` route files, and append-only to `package.json` scripts and `tests/guards.test.ts`. Never edit `src/room/**`.
- Listen only: no download, save, export, anchor with `download`, or blob URL for a render; the wasm wrapper exposes no file-writing function.
- Three shipped sources, no file drop. No render allowance. `MAX_CLIP_SECONDS = 15` guard stays in the worker.
- Fixed 120 BPM, fixed 48 kHz. Natural (reverse) mode. No FX rack, settings, Room 3D, presets.
- The plugin keeps Warm Analog (its own design system). Copy: it is an offline renderer, no Windows claim, no testimonials or benchmarks, one line "Your sound is processed in this browser and never uploaded". No pure white, emoji, exclamation marks, em or en dashes.
- Budget: WASM plus plugin UI about 1.5 MB gzipped, never in the room chunk, never on `/`; samples under about 150 KB each. `npm run budget` must pass.
- No Emscripten threads: build a patched COPY of `Convolution.h` that renders serially (spike finding 1); build with `-fexceptions`.
- Do not deploy or merge to `main`.

## Review Focus

- The wasm or Worker is missing, blocked or fails to fetch: the screen shows one plain line, stays inert, and reports `onLoadError` (Task 6).
- Knob dragged continuously: renders are debounced and the previous in-flight render is cancelled, no stale audio plays (Tasks 4 and 5).
- A render is cancelled mid-play by a knob or a new pick: that play does not fire `onSoundPlayed` (Task 5).
- A sample 404s or fails to decode: that source shows an error and the other two still work (Task 6).
- Close or unmount during a render or a play: nothing keeps playing, the context is closed, no unhandled rejection (Tasks 5 and 6).

---

### Task 1: Pin the plugin commit and prove the DSP tests

**Files:**
- Create: `src/premonition/PLUGIN_COMMIT.md`

- [ ] **Step 1:** In a temporary copy (`git -C <plugin> worktree` is not allowed; use `git archive` into a scratch folder under the scratchpad), build and run the plugin's Catch2 tests (`tests/CONTEXT.md` says how; `brew install catch2` if missing, tell the owner first).
- [ ] **Step 2:** Walk back from `b2e58d1` (the spike's commit) until the DSP tests pass; if none does, keep `b2e58d1`.
- [ ] **Step 3:** Write `PLUGIN_COMMIT.md` with the hash, the date, the exact test command, pass or fail per suite, and the reason if pinned on a failing commit. Expected: file exists and names one hash.
- [ ] **Step 4:** `git commit -m "docs(premonition): pin the plugin DSP commit"`

### Task 2: Params

**Files:**
- Create: `src/premonition/params.ts`, `src/premonition/params.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ReverbType = 'hall' | 'plate';           // the two vintage engines need no impulse response
  export type PluginParams = { type: ReverbType; stretch: number; bloom: number; size: number; overhang: number; diffusion: number; bars: 0.5 | 1 | 2 | 4 | 8; direction: 'reverse' | 'forward' };
  export const RANGES: Record<'stretch' | 'bloom' | 'size' | 'overhang' | 'diffusion', { min: number; max: number }>;
  export const DEFAULT_PARAMS: PluginParams;           // stretch 1, bloom 0.25, size 0.5, overhang 0.125 bar, diffusion 0.7, bars 2, reverse
  export function clampParams(p: PluginParams): PluginParams;
  ```
  Values and the exact knob-to-`PipelineConfig` mapping are read from `Premonition/Parameters.h` and `Premonition::BuildPipelineConfig()` at the pinned commit (decay is derived from bars, not a knob).

- [ ] **Step 1: Failing tests:** `defaults match Parameters.h and the plugin UI (stretch 1, bloom 25%, size 50%, overhang 1/8 bar, diffusion 70%)`; `clampParams clamps stretch to 0.25..4`; `clampParams maps NaN to the default`; `forward direction is accepted`.
- [ ] **Step 2:** `./node_modules/.bin/vitest run src/premonition/params.test.ts` fails. **Step 3:** Implement. **Step 4:** Passes.
- [ ] **Step 5:** `git commit -m "feat(premonition): params"`

### Task 3: WASM build

**Files:**
- Create: `scripts/build-dsp-wasm.sh`, `src/premonition/engine/wrapper.cpp`
- Output: `public/premonition/dsp.js`, `public/premonition/dsp.wasm`

**Interfaces:**
- Produces C entry `int premonition_render(const float* inL, const float* inR, int frames, int sampleRate, float bpm, int mode, int reverbType, float stretch, float bloom, float size, float overhangBars, float diffusion, float bars, float* outL, float* outR, int outCapacity)` returning frames written, or a negative error code (`-1` failed, `-2` output too small). No file I/O.
- The script takes the pinned hash from `PLUGIN_COMMIT.md`, `git archive`s `Premonition/dsp`, `vendor`, `Parameters.h`, `ReverbRouting.h` and WDL `fft.c`, patches the copy, builds, and writes only to `public/premonition/`.

- [ ] **Step 1: Failing check:** a Node script test `src/premonition/engine/wasm.node.test.ts` (Vitest, node environment) that loads `public/premonition/dsp.js`, renders a synthetic 1 s decaying noise burst at 2 bars and 120 BPM, and asserts: output frames equal `2 bars * 2 s * 48000 = 192000`, peak is finite and in `(0.05, 1.0]`, the last 5 ms are louder than the first 5 ms (a riser), and a zero-length input returns `-1`.
- [ ] **Step 2:** Run it. Expected: FAIL (no build yet).
- [ ] **Step 3:** Write the wrapper from the spike's `spike_main.cpp` (same `PipelineConfig` wiring, `crossfadeIntoSource = true`, exceptions caught and mapped to `-1`) and the build script; run `scripts/build-dsp-wasm.sh`.
- [ ] **Step 4:** Run the test. Expected: PASS. Run `gzip -c public/premonition/dsp.wasm | wc -c` and record it in the commit message (spike measured about 92 KB).
- [ ] **Step 5:** `git commit -m "feat(premonition): compile the real DSP to wasm"`

### Task 4: Render worker and client

**Files:**
- Create: `src/premonition/engine/render.worker.ts`, `src/premonition/engine/renderClient.ts`, `src/premonition/engine/renderClient.test.ts`

**Interfaces:**
- Consumes: `PluginParams`; `public/premonition/dsp.js`.
- Produces:
  ```ts
  export const MAX_CLIP_SECONDS = 15;
  export type RenderRequest = { channels: Float32Array[]; sampleRate: number; params: PluginParams };
  export type RenderResult = { channels: Float32Array[]; sampleRate: number };
  export type RenderErrorCode = 'too-long' | 'empty' | 'unsupported' | 'failed' | 'cancelled';
  export class RenderError extends Error { code: RenderErrorCode }
  export function createRenderClient(workerFactory?: () => Worker): { ready(): Promise<void>; render(req: RenderRequest, signal: AbortSignal): Promise<RenderResult>; dispose(): void };
  ```

- [ ] **Step 1: Failing tests** against a fake Worker: `rejects longer than 15 s with 'too-long'`; `rejects zero-length with 'empty'`; `aborting rejects with 'cancelled' and the next render still works`; `a second render cancels the first`; `a missing Worker maps ready() to 'unsupported'`; `a wasm load failure rejects ready() with 'failed'`; `dispose terminates the worker and rejects pending renders`.
- [ ] **Step 2:** Run `./node_modules/.bin/vitest run src/premonition/engine/renderClient.test.ts`; fails. **Step 3:** Implement (worker lazily created on first `ready()`, buffers transferred, cap also enforced in the worker). **Step 4:** Passes.
- [ ] **Step 5:** `git commit -m "feat(premonition): render worker and client"`

### Task 5: Sources and preview player

**Files:**
- Create: `src/premonition/sources.ts`, `scripts/make-placeholder-sources.mjs`, `public/audio/premonition/*.mp3`, `src/premonition/usePreview.ts`, `src/premonition/usePreview.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DrySource = { id: string; label: string; src: string; placeholder: boolean };
  export const SOURCES: readonly [DrySource, DrySource, DrySource];
  export function usePreview(): {
    play(result: RenderResult, onEnded: () => void): Promise<void>;   // creates the AudioContext on first call (inside the click), resumes it, plays to ctx.destination
    stop(): void;                                                    // cancels without calling onEnded
    playing: boolean; progress: number;                              // 0..1, for the playhead
  };
  ```
  Until the owner supplies the dry hits, `make-placeholder-sources.mjs` synthesises three short, clearly distinct, labelled `placeholder: true` hits (snare-like noise burst, plucked tone, vocal-like formant blip) at 48 kHz.

- [ ] **Step 1: Failing tests** with a fake `AudioContext`: `play creates the context on first call and reuses it`; `play resumes a suspended context`; `onEnded fires once when the source ends naturally`; `stop does not fire onEnded`; `a second play stops the first without firing its onEnded`; `unmount closes the context and stops sound`.
- [ ] **Step 2:** Run `./node_modules/.bin/vitest run src/premonition/usePreview.test.ts`; fails. **Step 3:** Implement. **Step 4:** Passes.
- [ ] **Step 5:** `git commit -m "feat(premonition): sources and stereo preview player"`

### Task 6: Plugin screen with real renders

**Files:**
- Create (moved from `src/demo/`, then adapted): `src/premonition/PluginScreen.tsx`, `Knob.tsx`, `PluginCanvases.tsx`, `pluginViz.ts`, `plugin.module.css`, `src/premonition/PluginScreen.test.tsx`
- Leave `src/demo/**` in place (Part C deletes it after it integrates this component).

**Interfaces:**
- Consumes: `createRenderClient`, `usePreview`, `SOURCES`, `PluginParams`.
- Produces:
  ```ts
  export function PluginScreen(props: {
    sources?: readonly DrySource[];                 // defaults to SOURCES
    playedIds: ReadonlySet<string>;                 // played sources render dimmed (opacity and a "heard" mark), still clickable
    onSoundPlayed(id: string): void;                // fired once when a preview of that source plays to its natural end
    onReady?(): void;                               // wasm loaded and all three samples decoded
    onLoadError?(reason: string): void;
    onClose?(): void;
  }): JSX.Element;
  ```
  Behaviour: picking a source renders it and plays it; moving a knob re-renders the current source after a 150 ms debounce and plays again; a render in flight is aborted by a newer one; the waveforms and terrain are computed from the real source and render samples.

- [ ] **Step 1: Failing tests** with a fake render client and `usePreview`: `pick renders then plays and passes the current params`; `a knob change re-renders once after 150 ms of quiet`; `a knob change during a play stops it without firing onSoundPlayed`; `onSoundPlayed fires once when playback ends naturally`; `played sources get data-heard and stay enabled`; `a sample that fails to decode disables only that source and the others still render`; `a wasm load failure shows one plain line and calls onLoadError`; `onReady fires after wasm and all three samples are ready`; `there is no download attribute, anchor to a blob, or Drag-into-DAW action in the DOM`; `unmount mid-render aborts it and plays nothing`.
- [ ] **Step 2:** Run `./node_modules/.bin/vitest run src/premonition/PluginScreen.test.tsx`; fails. **Step 3:** Move and adapt the face; drop controls that do nothing (the fake source chips become the three real sources, Direction and Tail map to params, keep the five knobs, remove the drag pill's drag hint, keep the footer RENDER and Play buttons).
- [ ] **Step 4:** Run `./node_modules/.bin/vitest run`. Expected: all PASS including `tests/guards.test.ts`.
- [ ] **Step 5:** `git commit -m "feat(premonition): plugin screen driven by the real render"`

### Task 7: `/premonition` page and budget

**Files:**
- Modify: the page and frame component under `src/app/premonition/` that render `PremonitionDemo` today; `scripts/check-budget.mjs` only if a measured threshold must change.

- [ ] **Step 1: Failing test:** extend the existing premonition page e2e (or add `tests/e2e/premonition-plugin.spec.ts`): `/premonition shows the plugin with three sources and no Skip or Continue`; `the wasm is requested only after the page's plugin mounts and never on /`; `a real render of the first source completes in under 5 s in Chromium and the status reads RENDERED` (Playwright, real wasm).
- [ ] **Step 2:** `npx playwright test tests/e2e/premonition-plugin.spec.ts`; fails. **Step 3:** Swap the page to `PluginScreen`, lazy-loaded with `next/dynamic` (`ssr: false`). **Step 4:** Run the spec and `npm run budget`; both PASS.
- [ ] **Step 5:** `git commit -m "feat(premonition): the /premonition page runs the real plugin"`; report the branch, the wasm gzipped size and the three timings to the main session. Do not merge.
