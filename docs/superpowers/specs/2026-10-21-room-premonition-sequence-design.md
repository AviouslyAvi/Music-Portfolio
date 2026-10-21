# The studio visit: room, real Premonition, and the portal

Date: 2026-10-21. Status: draft for owner approval. Owner: Avi (they/them).
Repo: `/Users/aviouslyavi/Claude/Projects/Music-Portfolio`, branch `experiment/new-architecture`.
Read first: `docs/superpowers/specs/2026-10-18-avious-site-design.md`, `docs/superpowers/plans/2026-10-20-ipod-room-and-real-premonition.md`, `docs/superpowers/spike-2026-10-20-wasm-result.md`. Next.js here has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before touching app or routing code.

## Intent

The site opens on a small walk-in 3D studio. A visitor can play Avi's songs on an iPod, then sit at the computer and use a working copy of the Premonition plugin. Premonition is Avi's product, an offline reverse-reverb riser maker, and the room exists to make a visitor feel what it does before they ever see a sales page. When they have heard what it does, they are pulled through the screen into the Premonition site.

Why this matters: the plugin is the product. A visitor who has turned the knobs and heard their own riser land is a warmer lead than one who read a feature list. The room carries the AVIOUS feeling (a lived-in 70s studio), and the plugin carries the product's own look.

## The visit, start to finish

1. The visitor is in the room (existing behaviour: walk with WASD or arrows, look with the mouse, `E` or click to use things). They can play songs on the iPod; sound comes from the two speakers.
2. They press `E` at the computer. The camera eases to the seat. **Headphones lower over their head.** The room falls silent (iPod music included, a visitor's own pause is preserved). The screen runs a **green terminal boot** that loads the scene for real (the plugin engine and sound samples), then shows the Premonition plugin.
3. The plugin offers **three dry sounds**. The visitor picks one, renders it (the plugin's real DSP, reverse mode), and hears the result **in stereo inside the headphones, not from the room**. Knobs change the sound; moving one re-renders.
4. Once a sound has been heard to the end, its button is **dimmed** (still usable, plainly "done"). The visitor must hear all three.
5. When the third sound finishes, the screen turns into a **weird spacey portal** and the camera is **pulled forward into it**. The page then navigates to the Premonition site.
6. At any point `Skip to site` (top-right, always visible) leaves the room, and Escape at the computer stands up, lifts the headphones and returns the room's sound.

## Goals

- A visitor who plays all three sounds is delivered to the Premonition site by the portal.
- The sound the plugin makes is Premonition's own: the real C++ pipeline compiled to WebAssembly, not an imitation.
- Room audio is believable: it comes from the speakers, in the right ears, and follows the visitor around the room.
- The room looks and feels AVIOUS: 70s, warm, grainy, mid-century, not glossy.
- Three people (or sessions) can build the three parts at the same time without collisions.

## Non-goals

- Visitors loading their own audio files, downloading or exporting renders, or dragging files out. (Owner chose three shipped samples. This supersedes the "visitor's own sounds" wording in the 2026-10-20 plan.)
- The plugin's FX rack, settings drawer, Room 3D view, host tempo sync (fixed 120 BPM), export formats, presets.
- Any change to the Premonition site itself, or deploying anything. The portal needs only a destination URL.
- Phones and tablets (the room is already gated to large, fine-pointer, motion-allowed, WebGL-capable desktops).

## Anti-goals (a failure even if it technically works)

- The visitor feels trapped or tricked: Skip must always work, the portal must not fire if they have not heard all three, and nothing may autoplay sound before the visitor acts.
- The room gets heavier than the budget (see Constraints) or the plugin engine loads before it is needed.
- The plugin claims things it is not: it is an offline renderer, no Windows claim, no testimonials or benchmarks (carried from the 2026-10-20 plan).
- Pure white, emoji, or exclamation marks anywhere in site copy (the repo's content guards enforce emoji and exclamation marks; keep to the rest too). Never mention the Jam Room or remote-recording projects.

## Constraints

- Plugin repo `/Users/aviouslyavi/Claude/Projects/premonition-vst` is **read only**. Pin the DSP to a commit where the plugin's own tests pass and record it in `src/premonition/PLUGIN_COMMIT.md`.
- Budget (from the earlier plan): room chunk plus audio under 2 MB gzipped; the WASM plus plugin UI target about 1.5 MB gzipped and must load only when the visitor sits at the computer (not in the room chunk, not on `/`). `scripts/check-budget.mjs` is the check.
- No Emscripten threads or cross-origin isolation (spike finding): the build patches a copy of `Convolution.h` to render serially.
- Respect `prefers-reduced-motion` (grain still, no portal spin; the room is not offered to such visitors today, keep the plugin components safe anyway).
- The plugin's own repo rule: show Avi UI changes before they ship. Nothing is deployed or merged to `main` without the owner's yes.
- Existing guard tests (`tests/guards.test.ts`) and the full unit suite must stay green. Playwright e2e for the room must be updated to match the new layout.

## Brand look (found in the AVIOUS content skills, `avious-content-ideas`)

The AVIOUS visual language: autumn palette (oxblood, terracotta, sage, midnight, mustard, espresso, cotton), grain and worn paper, mid-century structure, rounded capsules, warm not glossy. Avi's steer: **70s**. Type energy in the brand notes is "Mosvita Sans"; the font is not in the repo, so the builder keeps the site's existing fonts unless the owner supplies it. Exact hex values are not recorded anywhere; the builder picks from the named colours and shows the owner a swatch before wiring them in (the room's current cool charcoal and walnut shift warm).

The plugin screen keeps Premonition's own Warm Analog look (a product, with its own design system); only the room around it is AVIOUS.

## Part A: The room (builds first, owns the scene)

**Changes**
- **Desk:** straight, not L-shaped. Remove the return leg (`DESK_LEG` in `src/room/layout.ts`, `addDesk` in `furniture.ts`) and its collision box. The main run stays against the far wall.
- **Speakers:** one on each side of the desk, both clearly visible. Today the room already has a left and a right box; the owner reads it as one, so check visually and make both unmistakable. They sit on stands or the desk (builder's call) and must not overlap the keyboard.
- **Speakers aim at the visitor** at every moment: both toe in toward wherever the visitor is standing, turning smoothly as they walk (a short ease, no snapping). Pure function `aimYaw(speakerPos, listenerPos)` plus an `updateRoom(room, pose, dt)` that the room loop calls each frame (see handshake).
- **Keyboard:** a white 88-key keyboard on a stand, **to the left of the desk and perpendicular to it** (its long axis runs out from the far wall toward the viewer, between the desk's left end and the left wall). Seen from the side it is a real instrument: key bed with white keys and black keys in the right pattern, stand legs. Not pure white (an off-white, per the no-pure-white rule). It is a solid for collision.
- **iPod cable:** a visible cable plugged into the iPod's port. The far end runs along the desk and behind it to the computer (builder's call, clearly connected, drooping naturally).
- **Retro and grain:** warm AVIOUS palette across materials and light, a subtle vignette, and **film grain** over the room. Grain must be cheap (a tiled noise texture or small canvas overlay, not a heavy post-processing pass) and must not wash out the plugin screen text.
- **Headphones model** (built here so it is available): a pair of over-ear headphones as a reusable object the sequence lowers into view.

**Audio placement (acceptance)**
- `TrackPlayer`'s two panners sit exactly at the two speakers' cabinet centres (x, z from `layout.ts`; y equal to the tweeter height, about 1.1 m, not the current 1.0), taken from one source of truth in `layout.ts` so they cannot drift from the visible speakers.
- A test proves left and right: with the listener at the start pose facing the desk (yaw 0, forward is -z), the left speaker is to the listener's left and the right to the right; with the listener turned 90 degrees the mapping rotates correctly.
- The iPod music audibly pans between speakers as the visitor walks and turns (verify by ear and in the browser).

## Part B: The real Premonition (builds in parallel, owns `src/premonition/`)

Follow Tasks 1 to 5 of `docs/superpowers/plans/2026-10-20-ipod-room-and-real-premonition.md` (spike is done and passed; Task 1 is satisfied by `spike-2026-10-20-wasm-result.md`, but the pin test run it lists as open must still be done). Differences from that plan, which this document overrides:

- **Sources are three shipped dry sounds, no file drop.** The visitor picks one of three; there is no decode-a-user-file path, no clip-length cropping UI. Samples are mono or stereo, 48 kHz, 3 to 5 seconds, under about 150 KB each as mp3 or ogg. The owner supplies the three dry hits (decided: three samples; the owner's call which ones). Until they arrive the builder synthesises three clearly labelled placeholders (`placeholder: true`), as the site does for songs.
- **Mode:** reverse (Natural). The reverb type defaults to Hall or Plate per the plugin's own defaults, chosen by the builder from `PRODUCT.md`.
- **Re-render on knob change** (debounced about 150 ms after the last change, cancel a render in flight), and the first render happens on pick.
- **No render allowance.** The 10-render cap in the old plan guarded visitor-uploaded abuse; with shipped samples the cost is local CPU only. Keep the worker cancellation and the `MAX_CLIP_SECONDS` guard; drop `allowance.ts`. (My call, see list below.)
- **The face** starts from the replica already built in this working tree (`src/demo/DawScreen.tsx`, `Knob.tsx`, `PluginCanvases.tsx`, `pluginViz.ts`, `plugin.module.css`, drawn from the plugin's Mockup O Console skin). The builder moves it into `src/premonition/`, replaces the fake visuals with ones driven by the real render (real waveform of the source, real waveform of the render, terrain from the rendered audio), and drops the controls that do nothing. The face is drawn from the plugin's current UI source, not the stale `Premonition-current-ui.png`.
- **Audio out:** the rendered preview plays through a plain stereo path into the headphones (no spatial panner, no room) on the plugin's own `AudioContext`, created inside the seating gesture (see "Calls after the builder check", 4).

## Part C: The sequence (builds in parallel with stand-ins, owns `RoomExperience.tsx`)

The sequence is the story glue and the only part that edits the room's main loop file.

States: `walk -> seating -> headphones -> boot -> plugin -> portal -> leaving`. Escape from `boot` or `plugin` runs the reverse (`standing`) back to `walk`.

- **Seating:** the existing ease to the desk pose; on arrival the headphones lower into view from above over about 0.8 s, then come to rest framing the screen edges.
- **Silence:** on seating, call `TrackPlayer.hold()` (room audio off; the visitor's own pause preserved). On standing, `release()`. The visitor's iPod pause is never undone.
- **Boot:** a green phosphor terminal in the style of the Matrix: scrolling code and log lines that report the **real** loading of the WASM engine and the three samples (minimum about 2.5 s so it reads, longer only if loading is slower; never fake a failure). The existing `BootSequence.tsx` is the starting point; the look is green on black here, deliberately a break from the warm room (this is "the machine").
- **Played tracking:** a sound counts when its rendered preview plays to the end once. Played sounds are dimmed (reduced opacity plus a small "heard" mark, still clickable). The count lives in the sequence, not the plugin.
- **Portal:** when the third sound finishes (and only then), the plugin fades out, the screen becomes a swirling spacey portal in the AVIOUS palette (a canvas or shader tunnel, builder's design, owner reviews a still or short clip first), the camera dollies forward into it with acceleration, a short whoosh in the headphones (optional, quiet), then `router.push` or `window.location` to the Premonition site (`LINKS.premonitionStore`, currently the placeholder `https://premonition.avious.co`). `room:left` is set so a return does not replay the opener.
- **Skip:** `Skip to site` is never gated and works in every state, including mid-portal.
- **Failure:** if the engine fails to load, the plugin area says so plainly, the visitor can still `Skip to site`, and the portal does not fire.

## The handshake (the shared contract; each part builds to it)

Names are my call; the builders may refine them provided every consumer is updated in the same change.

```ts
// Part A exports (src/room/layout.ts and buildRoom.ts)
export const SEAT_POSE: { x: number; z: number; yaw: number; pitch: number };   // camera when seated
export const SPEAKERS: readonly [{ x: number; y: number; z: number }, { x: number; y: number; z: number }];
export function aimYaw(from: { x: number; z: number }, to: { x: number; z: number }): number;
export type Room = { /* existing fields */ headphones: THREE.Object3D; screen: THREE.Object3D };
export function updateRoom(room: Room, listener: { x: number; z: number; yaw: number }, dt: number): void; // aims speakers

// Part B exports (src/premonition/PluginScreen.tsx)
export type DrySource = { id: string; label: string; src: string; placeholder: boolean };
export function PluginScreen(props: {
  sources: readonly DrySource[];            // exactly three
  playedIds: ReadonlySet<string>;           // owned by the sequence; played ones render dimmed
  onSoundPlayed(id: string): void;          // fired once a preview has played to the end
  onReady?(): void;                         // engine and samples loaded (the boot waits for this)
  onLoadError?(reason: string): void;
  // No audio context prop: the plugin creates its OWN AudioContext inside the seating gesture (see "Calls after the builder check", 4).
  onClose?(): void;
}): JSX.Element;

// Part C owns: the state machine, the boot, the portal, played tracking, grain mounting if Part A has not.
```

**File ownership (to avoid collisions):** Part A: `src/room/layout.ts`, `furniture.ts`, `buildRoom.ts`, `palette.ts`, `audioEngine.ts` (panner positions), their tests, and a new `FilmGrain` component. Part B: `src/premonition/**`, `scripts/build-dsp-wasm.sh`, `public/premonition/**`. Part C: `src/room/RoomExperience.tsx`, `RoomGate.tsx` only if the opener changes, new `src/room/sequence/**` (boot, portal, headphones overlay, state machine), `room.module.css` additions. Only Part C edits `RoomExperience.tsx`; if Part A needs a line there (mounting the grain, calling `updateRoom`) it hands Part C the exact snippet. Merge order: A, then B, then C, rebasing each onto the last. Shared files (`package.json`, `tests/guards.test.ts`) are append-only.

## Uncommitted state to commit first

The working tree has uncommitted, tested work that these parts build on: immediate (no-crossfade) track switching in `audioEngine.ts` and its tests, smooth movement in `RoomExperience.tsx`, and the plugin face in `src/demo/` plus fonts in `layout.tsx` and a frame-width change in `room.module.css`. It must be committed before the worktrees are cut, or the sessions will not see it.

## Decisions by the owner

- Real Premonition DSP in WebAssembly (not a Web Audio imitation).
- Three shipped dry samples, no file drop.
- The room goes quiet when the headphones go on; the plugin plays inside the ears.
- The portal destination is the already-built Premonition site.
- Order and parallelism: room, plugin, sequence as three parts built at the same time in separate sessions.

## Calls I made (the owner can overrule any of them)

- Headphones come down from above and stay as a frame; they lift when the visitor stands up.
- The sequence triggers the portal when the third sound **finishes**, and a sound counts when it plays to the end once.
- The render allowance is dropped.
- The boot terminal reports real loading and is green on black, a deliberate contrast to the warm room.
- The plugin keeps Warm Analog; only the room is AVIOUS.
- The iPod cable runs to the computer.
- The speakers' toe-in is a smooth ease, not a snap.
- Part A merges first, Part C last, and only Part C edits `RoomExperience.tsx`.
- Fixed 120 BPM and a fixed three-source list.

## Left to the builders

Exact geometry and materials of the keyboard, stand, cable and headphones; hex values within the named AVIOUS colours; the grain technique; the portal's look (shown to the owner as a still or clip before it ships); the terminal's content and timing; the DSP wrapper and the knob-to-parameter mapping read from `Parameters.h` and `BuildPipelineConfig` at the pinned commit; Playwright updates for the new layout.

## How we will know it works

- Unit: a left/right panning test, an `aimYaw` test, desk collision without the leg, plugin params and render client tests, a played-tracking test (three finishes fire the portal once; two do not; a replay does not double count), Skip works in every state.
- In the browser (screenshots to the owner): the room from the doorway and from the seat, the keyboard and both speakers visible, the cable on the iPod, the headphones down, the terminal, the dimmed buttons after one sound, the portal mid-pull, and the Premonition site arrival.
- By ear (the owner): the iPod pans between speakers as they walk; the room is silent with headphones on; the render sounds like the real plugin.

## Calls after the builder check

A reviewer read this document cold and asked the questions below. The answers are my calls unless marked as the owner's.

1. **Portal destination.** A hard navigation to `LINKS.premonitionStore`, which stays configurable through `NEXT_PUBLIC_PREMONITION_URL`. The placeholder `https://premonition.avious.co` is not confirmed live, so the Playwright check asserts that the navigation to the configured URL is requested (the request is intercepted); it cannot assert that the Premonition site rendered. The owner supplies the final address (open, see below).
2. **State after leaving.** The played set lives in memory only and resets on reload. `room:left` stays in `sessionStorage` exactly as today, so a visitor who returns or presses Back lands on the normal page and the room is not offered again that session. They never have to hear the three sounds twice.
3. **What counts as heard.** A sound is heard when one render's preview plays to its natural end. A knob change or a switch of sound during playback cancels that play and does not count it. Once a sound is counted it stays counted even if it is re-rendered later. The portal fires at the moment the heard set reaches three, whichever sound is selected, so a visitor cannot be trapped and cannot trigger it early. A third play that is cut off by a re-render does not count.
4. **Audio contexts.** `TrackPlayer.hold()` suspends the room's `AudioContext`, which would silence a plugin sharing it. So the plugin owns a separate `AudioContext`, created inside the seating gesture (the `E` press or click, a user gesture, so autoplay is allowed) and closed on stand-up or leave. Its output goes straight to its own destination: no room panners, no room master gain, so nothing from the room leaks into the headphones. This replaces the `audioContext` prop in the handshake above.
5. **When loading starts.** On the `E` press, as seating begins. The boot state waits for the engine and samples to report ready (never less than about 2.5 s). A load failure during the camera ease is held and shown when the boot state starts. No prefetch hint near the desk (keeps the room chunk and budget clean).
6. **Colours and font.** Not a blocking gate. Part A proceeds with its own pick from the named AVIOUS colours and shows swatches and screenshots at its checkpoint; the owner can revise afterwards. The existing fonts stay unless the owner supplies Mosvita Sans.
7. **Plugin pin.** The builder runs the plugin's DSP tests in a copy (needs Catch2; `cmake` is installed, Catch2 may need `brew install catch2`) and pins the newest commit where they pass. If none passes, pin the spike's commit `b2e58d1`, record which tests failed in `PLUGIN_COMMIT.md`, and tell the owner. This does not block Part B.
8. **Reduced motion.** The portal becomes a cross-fade with no camera dolly, then the navigation.
9. **Review gates.** Owner review is required before anything merges to `main`, not per part. Builders keep going on these assumptions and send stills, clips and screenshots at checkpoints; the owner overrules afterwards.

## Open for the owner

- The real address of the Premonition site (and whether it is live yet).
- The three dry sample files (or where they are).
- Permission to commit the current working-tree work so the part sessions can branch from it.
