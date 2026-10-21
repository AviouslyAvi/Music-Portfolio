# Part C: The sequence (seat, headphones, boot, heard-all-three, portal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "press E at the computer" into the full visit: ease to the seat, headphones lower, the room goes quiet, a green terminal boots for real, the plugin plays three sounds that dim when heard, and after the third the screen becomes a portal that pulls the visitor into the Premonition site.

**Architecture:** A pure state machine (`src/room/sequence/machine.ts`) holds the visit state and the heard set; small components render each stage (terminal, headphones rig, portal); `RoomExperience.tsx`, which only this part edits, drives the machine from its frame loop. Parts A and B land first; until they do, this part builds against two stand-ins that match their contracts, replaced at integration.

**Tech Stack:** React 19, three.js, Web Audio (via `TrackPlayer.hold/release`), canvas 2D for the portal, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-room-premonition-sequence-design.md`, "Part C", "The handshake" and "Calls after the builder check". Branch `feat/part-c-sequence`, cut from `7f508e9`, in your own git worktree. Merge order is A, then B, then C; rebase onto each as it merges.

## Global Constraints

- You own `src/room/RoomExperience.tsx`, `RoomGate.tsx` (only if the opener changes), `room.module.css` additions, `src/room/sequence/**`, `tests/e2e/room.spec.ts` demo tests. Do not edit Part A's files (`layout.ts`, `furniture.ts`, `buildRoom.ts`, `palette.ts`, `audioEngine.ts`) or `src/premonition/**`; if you need a change there, message the main session.
- Contracts you consume (names fixed by the spec): from Part A `SEAT_POSE`, `updateRoom(room, listener, dt)`, `Room.headphones`, `Room.screen`, `FilmGrain`; from Part B `PluginScreen` props (`sources`, `playedIds`, `onSoundPlayed`, `onReady`, `onLoadError`, `onClose`).
- Silence rule: seated means `TrackPlayer.hold()`; standing means `release()`. The visitor's own pause is never undone. The plugin plays on its own audio context, never the room's.
- Played rule: a sound counts when its preview plays to its natural end once; a cut-off play does not count; a counted sound stays counted; the portal fires exactly once, when the heard set reaches three. The set lives in memory only.
- Portal destination: hard navigation to `LINKS.premonitionStore` (`NEXT_PUBLIC_PREMONITION_URL`, placeholder `https://premonition.avious.co`); set `room:left` before navigating. Under reduced motion: cross-fade, no dolly, then navigate.
- `Skip to site` is always visible and works in every state, including mid-portal. Escape at the computer stands up, lifts the headphones and releases the room's audio.
- Engine loading starts at the `E` press; the boot waits for `onReady` (minimum about 2.5 s) and shows a load failure plainly, then `Skip to site` still works and the portal never fires.
- No pure white, emoji, exclamation marks, em or en dashes. No Jam Room or remote-recording mentions. `tests/guards.test.ts` stays green. The owner sees a still or short clip of the portal before it ships. Do not deploy or merge to `main`.

## Review Focus

- `E` pressed twice, or Escape pressed during the seating ease or the headphone drop: the machine ends in one consistent state (Task 1).
- Skip pressed during boot, plugin, or portal: the room unmounts once, audio is released, no navigation to the portal URL (Tasks 1 and 6).
- The third sound's play is cut off by a knob or pick, then replayed: the portal fires once, after the replay ends (Task 1).
- The engine fails to load or `onLoadError` fires: the portal cannot fire and Skip works (Tasks 1 and 3).
- Tab hidden or the pointer lock released mid-sequence: nothing double-starts, audio stays held, the sequence resumes (Task 6).

---

### Task 1: The sequence machine and played tracking

**Files:**
- Create: `src/room/sequence/machine.ts`, `src/room/sequence/machine.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Stage = 'walk' | 'seating' | 'headphones' | 'boot' | 'plugin' | 'portal' | 'leaving';
  export type SeqState = { stage: Stage; heard: ReadonlySet<string>; engineReady: boolean; loadError: boolean };
  export type SeqEvent =
    | { type: 'INTERACT' }            // E or click at the computer
    | { type: 'SEATED' }              // the ease finished
    | { type: 'HEADPHONES_ON' }
    | { type: 'ENGINE_READY' } | { type: 'ENGINE_FAILED' }
    | { type: 'BOOT_DONE' }           // terminal finished and engine ready
    | { type: 'SOUND_PLAYED'; id: string }
    | { type: 'ESCAPE' }
    | { type: 'PORTAL_DONE' }
    | { type: 'SKIP' };
  export const SOUND_COUNT = 3;
  export const initialSeq: SeqState;
  export function seqReducer(s: SeqState, e: SeqEvent): SeqState;
  export function shouldHoldRoomAudio(stage: Stage): boolean;   // true for seating..portal
  ```

- [ ] **Step 1: Failing tests** in `machine.test.ts`: `INTERACT only works from walk`; `the happy path walk -> seating -> headphones -> boot -> plugin`; `BOOT_DONE is ignored until the engine is ready`; `two SOUND_PLAYED with distinct ids stays in plugin`; `the third distinct id moves to portal exactly once`; `a repeated id does not count twice`; `SOUND_PLAYED outside plugin is ignored`; `ENGINE_FAILED blocks the portal and keeps Skip available`; `ESCAPE from seating, headphones, boot or plugin returns to walk and keeps the heard set`; `SKIP from any stage goes to leaving`; `shouldHoldRoomAudio is true for seating through portal and false for walk and leaving`; `PORTAL_DONE moves to leaving`.
- [ ] **Step 2:** `./node_modules/.bin/vitest run src/room/sequence/machine.test.ts`; fails. **Step 3:** Implement as a pure reducer (never mutate; unchanged state returns the same object). **Step 4:** Passes.
- [ ] **Step 5:** `git commit -m "feat(sequence): visit state machine and played tracking"`

### Task 2: Stand-ins for Parts A and B

**Files:**
- Create: `src/room/sequence/stubs/StubPluginScreen.tsx`, `src/room/sequence/stubs/stubRoom.ts`, `src/room/sequence/stubs/index.ts`

**Interfaces:**
- Produces: `StubPluginScreen` with exactly Part B's prop contract (three buttons that call `onSoundPlayed(id)` after 300 ms, dim when in `playedIds`, call `onReady` after 500 ms); `stubRoom` exporting `SEAT_POSE` (copy of the current `DESK_POSE`), a no-op `updateRoom`, and a plain box `headphones` object. `index.ts` re-exports one swap point: `export { PluginScreen } ...; export { SEAT_POSE, updateRoom, makeHeadphones } ...`.

- [ ] **Step 1: Failing test:** `StubPluginScreen fires onReady, then onSoundPlayed for the clicked id, and marks played ids dimmed`.
- [ ] **Step 2:** Run it; fails. **Step 3:** Implement. **Step 4:** Passes.
- [ ] **Step 5:** `git commit -m "chore(sequence): stand-ins for the room and plugin contracts"`

### Task 3: Green terminal boot

**Files:**
- Create: `src/room/sequence/Terminal.tsx`, `src/room/sequence/Terminal.test.tsx`

**Interfaces:**
- Produces: `export function Terminal(props: { engineReady: boolean; failed: boolean; onDone(): void; minMs?: number }): JSX.Element` (default `minMs` 2500). Green phosphor on black; a brief falling-code field, then log lines that reflect the real stages (`loading engine`, `loading samples`, `ready`); a failed load prints `engine failed to load` and never calls `onDone`.

- [ ] **Step 1: Failing tests** with fake timers: `does not call onDone before minMs`; `does not call onDone while the engine is not ready, even after minMs`; `calls onDone once after both`; `failed prints the failure line and never calls onDone`; `under reduced motion there is no falling-code field and the lines appear at once but minMs still holds`.
- [ ] **Step 2:** `./node_modules/.bin/vitest run src/room/sequence/Terminal.test.tsx`; fails. **Step 3:** Implement from `src/demo/BootSequence.tsx` as a starting point (do not delete it yet). **Step 4:** Passes.
- [ ] **Step 5:** `git commit -m "feat(sequence): green terminal boot that waits on the real load"`

### Task 4: Headphones rig

**Files:**
- Create: `src/room/sequence/headphones.ts`, `src/room/sequence/headphones.test.ts`

**Interfaces:**
- Produces: `export function headphonePose(t: number): { y: number; pitch: number }` (pure, `t` 0..1, ends at rest with the band across the top of the view); `export function attachHeadphones(camera: THREE.Camera, obj: THREE.Object3D): () => void` (parents the object to the camera at a fixed offset, returns a detach function); `export const HEADPHONE_DROP_MS = 800`.

- [ ] **Step 1: Failing tests:** `headphonePose(0) starts above the view and headphonePose(1) is at rest`; `it is monotonic and never overshoots below the rest height`; `t outside 0..1 is clamped`; `attachHeadphones parents to the camera and the detach function removes it`; `detach twice is safe`.
- [ ] **Step 2:** Run the file; fails. **Step 3:** Implement with a smootherstep. **Step 4:** Passes.
- [ ] **Step 5:** `git commit -m "feat(sequence): headphones rig and pose curve"`

### Task 5: Portal

**Files:**
- Create: `src/room/sequence/Portal.tsx`, `src/room/sequence/portalMath.ts`, `src/room/sequence/portalMath.test.ts`, `src/room/sequence/Portal.test.tsx`

**Interfaces:**
- Produces: `export function dollyProgress(t: number): number` (0..1, accelerating, ends at 1) and `export const PORTAL_MS = 3000`; `export function Portal(props: { onDone(): void; reduced?: boolean }): JSX.Element` drawing a swirling spacey tunnel (stars streaking toward the viewer, a spiral in terracotta, mustard and midnight) on a full-screen canvas, calling `onDone` once at `PORTAL_MS`; with `reduced` it cross-fades and calls `onDone` after 400 ms with no motion.

- [ ] **Step 1: Failing tests:** `dollyProgress is 0 at 0, 1 at 1, monotonic and accelerating (second half covers more than the first)`; `Portal calls onDone exactly once at PORTAL_MS (fake timers)`; `reduced calls onDone after 400 ms and draws no animation frames`; `Portal renders nothing and still calls onDone when canvas is unavailable`; `unmounting before the end never calls onDone`.
- [ ] **Step 2:** Run the two files; fails. **Step 3:** Implement. Do not ship its look: produce a still screenshot and a short clip for the owner (Task 8). **Step 4:** Passes.
- [ ] **Step 5:** `git commit -m "feat(sequence): portal tunnel"`

### Task 6: Integrate into `RoomExperience`

**Files:**
- Modify: `src/room/RoomExperience.tsx`, `src/room/room.module.css`
- Test: `src/room/RoomExperience.sequence.test.tsx` (jsdom, three mocked)

**Interfaces:**
- Consumes: Task 1 to 5 exports; from `stubs/index.ts` `PluginScreen`, `SEAT_POSE`, `updateRoom`, `makeHeadphones`.
- Produces: the computer interaction (`E` or click) runs `INTERACT`; `DESK_POSE` and the `demoOpen` path are removed; the iPod flow is untouched; the frame loop calls `updateRoom(room, player, dt)`; the camera dolly during `portal` uses `dollyProgress`; `TrackPlayer.hold()/release()` follow `shouldHoldRoomAudio(stage)`.

- [ ] **Step 1: Failing tests:** `E at the computer starts seating and holds the room audio once`; `Escape in boot or plugin releases the audio and returns to walk`; `the visitor's own iPod pause survives seat and stand`; `Skip to site works in seating, boot, plugin and portal and unmounts once`; `the third SOUND_PLAYED shows the portal and, at PORTAL_DONE, sets room:left in sessionStorage then navigates to LINKS.premonitionStore (assert location assignment through an injected navigate function)`; `ENGINE_FAILED shows the failure and never navigates to the portal URL`; `a hidden tab keeps audio held and does not restart the boot`.
- [ ] **Step 2:** `./node_modules/.bin/vitest run src/room/RoomExperience.sequence.test.tsx`; fails. **Step 3:** Implement; inject `navigate` as a prop defaulting to `window.location.assign` so tests can assert it. **Step 4:** Passes; run `./node_modules/.bin/vitest run` too.
- [ ] **Step 5:** `git commit -m "feat(sequence): drive the visit from RoomExperience"`

### Task 7: Swap in Parts A and B, remove the old demo

**Files:**
- Modify: `src/room/sequence/stubs/index.ts` (point at the real modules), `src/room/RoomExperience.tsx` (mount `FilmGrain`)
- Delete: `src/demo/**`, `src/content/sounds.ts` (and any import), once nothing imports them

- [ ] **Step 1:** Rebase onto `main` after Parts A and B merge. **Step 2:** Replace the stand-in re-exports with Part A's `SEAT_POSE`, `updateRoom`, `Room.headphones` and Part B's `PluginScreen`; mount `<FilmGrain />`; delete the stand-ins and the old demo.
- [ ] **Step 3:** `./node_modules/.bin/tsc --noEmit -p . && ./node_modules/.bin/vitest run`. Expected: PASS.
- [ ] **Step 4:** `npm run budget`. Expected: PASS; the wasm and plugin UI are not in the room chunk.
- [ ] **Step 5:** `git commit -m "feat(sequence): use the real room and plugin; retire the old demo"`

### Task 8: e2e, owner checkpoint, handoff

**Files:**
- Modify: `tests/e2e/room.spec.ts` (the three demo tests: `E at the computer opens the demo`, `Skip in the demo`, `Escape in the demo`), create `docs/superpowers/handoff-2026-10-21-studio-visit.md`

- [ ] **Step 1:** Rewrite the demo tests: `E at the computer lowers the headphones, silences the room and shows the terminal`; `Escape stands up and the room music resumes`; `playing all three sounds shows the portal and requests the configured Premonition URL (route intercepted)`; `Skip to site works mid-portal`; `a played sound is dimmed and still clickable`.
- [ ] **Step 2:** `npx playwright test tests/e2e/room.spec.ts`. Expected: PASS.
- [ ] **Step 3:** Capture screenshots (seated with headphones, terminal, plugin with one sound dimmed, portal mid-pull) and a short portal clip into `docs/superpowers/screens/part-c/` for the owner.
- [ ] **Step 4:** Write the handoff: what shipped, the open items (real portal URL, three dry samples, Mosvita font), how to run it.
- [ ] **Step 5:** `git commit -m "test(sequence): e2e for the full visit; handoff"`; report to the main session. Do not merge.
