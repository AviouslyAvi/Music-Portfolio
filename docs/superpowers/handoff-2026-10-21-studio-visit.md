# Studio visit: Part C (sequence) handoff

Date: 2026-10-21. Branch: experiment/new-architecture (local only, not pushed).

## What shipped
- `src/room/sequence/machine.ts`: pure visit state machine (walk, seating, headphones, boot, plugin, portal, leaving) and the in-memory heard set. The portal fires once, when the third distinct sound has played to its end. A load failure blocks the portal.
- `Terminal.tsx`: green boot that waits on the real engine load (minimum 2.5 s) and prints `engine failed to load` on failure.
- `headphones.ts`: drop and lift curve and camera attach (the model from Part A, scaled up near the lens).
- `Portal.tsx` and `portalMath.ts`: canvas tunnel over 3 s with an accelerating dolly; reduced motion is a 400 ms cross-fade with no dolly.
- `src/room/RoomExperience.tsx`: drives all of it. `E` or click at the computer runs the seating ease to `SEAT_POSE`; `TrackPlayer.hold()` and `release()` follow the stage; Escape stands up; `Skip to site` works in every stage; the portal sets `room:left` then hard-navigates to `LINKS.premonitionStore` (injectable `navigate` prop for tests). The plugin is lazy-loaded and mounts at the `E` press so its engine loads then.
- Old demo (`src/demo/**`, `src/content/sounds.ts`) removed. `public/audio/demo/` placeholder rivers still ship and count in the budget; remove them if nothing uses them.

## Checks run
- tsc clean; vitest 331 passed.
- `npm run budget`: OK (774.8 KB of 2048 KB; room chunk 145.8 KB, plugin UI and wasm not in it).
- Playwright `room.spec.ts` on port 3100: all pass; one iPod-menu test flaked once under swiftshader load and passed on rerun. Three "no overlay" tests hardcode `localhost:3000`; they pass when the server is on 3000.

## For the owner to look at
Stills and a clip in `docs/superpowers/screens/part-c/` (the clip `portal-and-visit.webm` is about 10 MB and is not committed).

## Open items
- Real Premonition address (placeholder `https://premonition.avious.co`, set `NEXT_PUBLIC_PREMONITION_URL`).
- The three dry samples (placeholders in use).
- Mosvita Sans font (not in the repo).
- Headphones look crude up close; the room hint text shows faintly behind the plugin.

## Run it
`npm run build && npm run start`, open http://localhost:3000, press Enter, walk to the computer (W then D), press E. Tests: `./node_modules/.bin/vitest run`; e2e: `npx playwright test tests/e2e/room.spec.ts`.
