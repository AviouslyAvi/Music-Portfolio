# Part A: The room (straight desk, speakers, keyboard, retro look, audio placement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the room around a straight desk with two visible speakers that turn to face the visitor, an 88-key keyboard on a stand, a cable into the iPod, a 70s AVIOUS look with film grain, and sound that provably comes from the speakers.

**Architecture:** Pure data and pure functions in `src/room/layout.ts` (single source of truth for solids, speaker and seat positions, `aimYaw`), geometry in `furniture.ts` and `buildRoom.ts` (adds `updateRoom`), audio panner positions read from `layout.ts`, and a small `FilmGrain` React component. Part C owns `RoomExperience.tsx` and calls `updateRoom` and mounts `FilmGrain`; this part never edits that file.

**Tech Stack:** three.js, React 19, Web Audio, Vitest (node and jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-room-premonition-sequence-design.md`, section "Part A" and "The handshake". Executors read it and the "Calls after the builder check" section. Branch `feat/part-a-room`, cut from commit `7f508e9`. Work in your own git worktree. Merge order is A, then B, then C.

## Global Constraints

- Only edit: `src/room/layout.ts`, `furniture.ts`, `buildRoom.ts`, `palette.ts`, `audioEngine.ts` (panner positions only), their tests, new `src/room/FilmGrain.tsx` plus its test, `room.module.css` additions for grain, and `tests/e2e/room.spec.ts` lines that assert the old layout. Never edit `RoomExperience.tsx` (hand Part C the snippet instead).
- No pure white (`#fff`/`0xffffff`), no emoji, no exclamation marks in copy, no em or en dashes. Never mention the Jam Room or remote-recording. `tests/guards.test.ts` must stay green.
- The room's triangle count stays within the ceiling asserted in `buildRoom.test.ts`; raise that ceiling only with a measured reason noted in the commit message.
- Respect `prefers-reduced-motion`: grain renders still.
- Palette: pick from the named AVIOUS colours (oxblood, terracotta, sage, midnight, mustard, espresso, cotton). Exact hex is your call; show the owner swatches and screenshots at the checkpoint (Task 6); not a blocking gate.
- Existing fonts stay. Do not deploy or merge to `main`.

## Review Focus

- The player walks into the keyboard, stand, speaker or desk edge: they slide along it, never pass through (Task 1 collision test over all solids).
- Visitor stands very close to a speaker or exactly on top of the aim target: `aimYaw` returns a finite angle, never NaN (Task 3).
- A frame with `dt = 0` or a huge `dt` after a hidden tab: speaker turn stays finite and never overshoots (Task 3).
- Listener facing every compass direction: left speaker is always to the listener's left when facing the desk, rotating correctly otherwise (Task 4).
- Grain with `matchMedia` missing or canvas unsupported: renders nothing, no throw (Task 5).

---

### Task 1: Layout: straight desk, speakers, keyboard solid, seat pose

**Files:**
- Modify: `src/room/layout.ts`, `src/room/layout.test.ts`, `src/room/furniture.ts` (`addDesk` signature), `src/room/buildRoom.ts` (call site)

**Interfaces:**
- Produces:
  ```ts
  export const DESK: Box;                        // was DESK_MAIN; DESK_LEG is removed
  export const SPEAKER_LEFT: Box; export const SPEAKER_RIGHT: Box;   // floor footprints, one each side of DESK
  export const KEYBOARD_STAND: Box;              // solid, left of DESK, long axis along z
  export const SPEAKERS: readonly [Vec3, Vec3];  // cabinet centres: x, z from the boxes, y = TWEETER_Y
  export const TWEETER_Y = 1.1;
  export const SEAT_POSE: { x: number; z: number; yaw: number; pitch: number }; // camera when seated; replaces DESK_POSE in RoomExperience
  export type Vec3 = { x: number; y: number; z: number };
  ```
  `SOLIDS` becomes `[DESK, SPEAKER_LEFT, SPEAKER_RIGHT, KEYBOARD_STAND]`. `addDesk(k, g, m, desk: Box, top: number)` builds one top, legs and a modesty panel, no return leg.

- [ ] **Step 1: Failing tests** in `layout.test.ts`: `has no desk leg export` (`import * as L`, expect `'DESK_LEG' in L` false); `solids sit inside the room and none overlap each other`; `keyboard stand is left of the desk and its long side runs along z` (`maxZ - minZ > maxX - minX`, `maxX <= DESK.minX`); `a lane of at least 0.5 m stays walkable between every pair of solids and the room walls` (grid-sample or box-gap check); `speakers flank the desk` (`SPEAKERS[0].x < DESK.minX`, `SPEAKERS[1].x > DESK.maxX`); `SPEAKERS y equals TWEETER_Y`; `SEAT_POSE is walkable, inside bounds, faces the desk (yaw 0) and is within INTERACT_RADIUS of COMPUTER_POS`; keep the existing interactable and palette tests.
- [ ] **Step 2:** Run `./node_modules/.bin/vitest run src/room/layout.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement in `layout.ts`: desk keeps x -1.2 to 1.6, z -3 to -2.4; place the two speaker footprints and the keyboard stand per the tests (keyboard about 1.3 m long by 0.4 m wide, running out from the far wall to the left of the desk; move the left speaker or put it on the desk end if needed to clear it). `SEAT_POSE` is `{ x: COMPUTER_POS.x, z: -1.85, yaw: 0, pitch: -0.5 }`. Update `addDesk` and its call in `buildRoom.ts`; `userData.solid` meshes must match the layout boxes.
- [ ] **Step 4:** Run the full room tests: `./node_modules/.bin/vitest run src/room`. Expected: PASS (fix `buildRoom.test.ts` expectations that name the removed leg).
- [ ] **Step 5:** `git commit -m "feat(room): straight desk, speaker and keyboard layout, seat pose"`

### Task 2: Keyboard, cable and headphones models

**Files:**
- Modify: `src/room/furniture.ts`, `src/room/buildRoom.ts`, `src/room/buildRoom.test.ts`

**Interfaces:**
- Produces: `addKeyboard88(k, g, m, stand: Box)` returning the group named `keyboard-88` with `userData.whiteKeys === 52` and `userData.blackKeys === 36`; `addIpodCable(k, g, m, from: V3, to: V3)` group named `ipod-cable`; `addHeadphones(k, m)` returning a detached `THREE.Group` named `headphones` (not added to the room). `Room` gains `headphones: THREE.Object3D`, `screen: THREE.Object3D` (the computer's glowing screen plane, for Part C's portal).

- [ ] **Step 1: Failing tests** in `buildRoom.test.ts`: `the room has a keyboard-88 with 52 white and 36 black keys, in the real pattern` (assert the black-key gaps follow 2-3 grouping by index); `the keyboard sits on its stand and clears every other solid`; `keys are off-white, never 0xffffff`; `ipod-cable exists and both ends touch the iPod port and the computer back within 0.02 m`; `headphones is returned on Room and is not a child of room.group`; `triangleCount stays under the ceiling`.
- [ ] **Step 2:** Run `./node_modules/.bin/vitest run src/room/buildRoom.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Keys: white keys as one merged or instanced geometry to protect the triangle budget. Cable: a tube along a drooping `CatmullRomCurve3` ending in a small plug at the iPod port. Headphones: band, two cups, cushions, in espresso and mustard.
- [ ] **Step 4:** Run `./node_modules/.bin/vitest run src/room`. Expected: PASS.
- [ ] **Step 5:** `git commit -m "feat(room): 88-key keyboard, iPod cable and headphones"`

### Task 3: Speakers aim at the visitor (`aimYaw`, `updateRoom`)

**Files:**
- Modify: `src/room/layout.ts` (`aimYaw`), `src/room/buildRoom.ts` (`updateRoom`, store speaker cabinet groups), tests in `layout.test.ts` and `buildRoom.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function aimYaw(from: { x: number; z: number }, to: { x: number; z: number }): number; // yaw so a +z-facing cabinet points from -> to, wrapped to (-PI, PI], 0 if from == to
  export function updateRoom(room: Room, listener: { x: number; z: number; yaw: number }, dt: number): void; // eases each cabinet toward aimYaw at rate AIM_RESPONSE = 6 per second
  export const AIM_RESPONSE = 6;
  ```
- Consumes: `normalizeYaw` from `movement.ts`.

- [ ] **Step 1: Failing tests:** `aimYaw faces the listener straight on from every compass point`; `aimYaw is finite and 0 when from equals to`; `updateRoom with dt 0 changes nothing`; `updateRoom with dt 10 never overshoots (final yaw within 1e-3 of the target, never past it)`; `after 2 s of frames the cabinets point at the listener within 0.02 rad`; `both cabinets move toward the same listener`.
- [ ] **Step 2:** Run the two test files. Expected: FAIL.
- [ ] **Step 3:** Implement with the shortest-angle exponential ease `yaw += normalizeYaw(target - yaw) * (1 - exp(-AIM_RESPONSE * clamp(dt, 0, 0.1)))`. `buildRoom` keeps the cabinet `THREE.Group` of each speaker reachable from `Room` (add `speakerCabinets` internal or find by name).
- [ ] **Step 4:** Run `./node_modules/.bin/vitest run src/room`. Expected: PASS.
- [ ] **Step 5:** `git commit -m "feat(room): speakers turn to face the visitor"`

### Task 4: Audio comes from the speakers

**Files:**
- Modify: `src/room/audioEngine.ts` (panner construction), `src/room/audioEngine.test.ts`

**Interfaces:**
- Consumes: `SPEAKERS` from `layout.ts`. Produces: panner `positionX/Y/Z` equal `SPEAKERS[i]` exactly (replaces the box-centre and `SPEAKER_HEIGHT = 1.0` code). Remove the now-unused `SPEAKER_LEFT/RIGHT` import.

- [ ] **Step 1: Failing tests:** `panners sit at SPEAKERS including y = TWEETER_Y` (replaces the `[-1.6, 1.85]` assertion); `with the listener at START facing yaw 0 the left panner has negative x relative to the listener's right vector` (compute with the same forward and right formulas as `movement.ts`); `the mapping rotates: at yaw PI/2 the left speaker is behind-right as geometry says`; `a listener standing on a speaker does not produce NaN positions`.
- [ ] **Step 2:** Run `./node_modules/.bin/vitest run src/room/audioEngine.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Keep every other `TrackPlayer` behaviour unchanged (immediate switching, hold, release).
- [ ] **Step 4:** Run `./node_modules/.bin/vitest run`. Expected: PASS.
- [ ] **Step 5:** `git commit -m "fix(audio): pan from the real speaker positions"`

### Task 5: 70s palette, warm materials, film grain

**Files:**
- Modify: `src/room/palette.ts`, `src/room/furniture.ts` (`makeMaterials`), `src/room/buildRoom.ts` (light colours, background), `src/room/room.module.css`
- Create: `src/room/FilmGrain.tsx`, `src/room/FilmGrain.test.tsx`

**Interfaces:**
- Produces: `ROOM_COLORS` extended with named AVIOUS entries (`oxblood`, `terracotta`, `sage`, `midnight`, `mustard`, `espresso`, `cotton`) and the existing keys kept so nothing else breaks; `export function FilmGrain(props: { intensity?: number }): JSX.Element | null` rendering a fixed, pointer-events-none canvas tile overlay, animated about 12 fps with `requestAnimationFrame` throttling, still under reduced motion, `null` without canvas support.
- Part C mounts it; hand Part C this snippet: `<FilmGrain />` as the last child inside the room root.

- [ ] **Step 1: Failing tests:** `palette has no pure white and no duplicates` (extend the existing test over the new colours); `FilmGrain renders null when canvas getContext is unavailable`; `FilmGrain draws once and does not start an animation loop when prefers-reduced-motion matches`; `FilmGrain is aria-hidden and ignores pointer events`; `FilmGrain cleans up its animation frame on unmount`.
- [ ] **Step 2:** Run the two test files. Expected: FAIL.
- [ ] **Step 3:** Implement the palette shift (warmer espresso walls and walnut, mustard lamp, terracotta rug, sage plant, a faint warm vignette via CSS gradient in the grain layer) and the grain tile (64 by 64 noise regenerated per frame, drawn scaled up with `image-rendering: pixelated`, low opacity so text on the plugin overlay stays readable).
- [ ] **Step 4:** Run `./node_modules/.bin/vitest run`. Expected: PASS, including `tests/guards.test.ts`.
- [ ] **Step 5:** `git commit -m "feat(room): warm 70s palette and film grain"`

### Task 6: e2e, budget and owner checkpoint

**Files:**
- Modify: `tests/e2e/room.spec.ts` (any test that depends on the old desk, speaker or iPod positions), `scripts/check-budget.mjs` thresholds only if measured necessary

- [ ] **Step 1:** Run `npx playwright test tests/e2e/room.spec.ts` and `npm run budget`; list failures caused by the layout change.
- [ ] **Step 2:** Update those tests to the new positions (use `SEAT_POSE` and `COMPUTER_POS`, not hard-coded numbers) and add `walking to the left of the desk is blocked by the keyboard stand`.
- [ ] **Step 3:** Run both again. Expected: PASS.
- [ ] **Step 4:** Take screenshots with the preview browser: the room from the doorway, from the seat, the keyboard and both speakers, the cable on the iPod, and a swatch strip of the palette. Save them to `docs/superpowers/screens/part-a/` and tell Part C's coordinator (the main session) they are ready.
- [ ] **Step 5:** `git commit -m "test(room): update e2e and budget for the new layout"`; report branch name and screenshot paths. Do not merge.
