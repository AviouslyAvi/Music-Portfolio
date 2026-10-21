# Handoff: AVIOUS portfolio site rebuild

Date: 2026-10-18. Repo: `/Users/aviouslyavi/Claude/Projects/Music-Portfolio` (GitHub: AviouslyAvi/Music-Portfolio). Branch: `experiment/new-architecture` (off `main`; `main` still serves the old static site on GitHub Pages at imavious.org via `CNAME`).

## State (updated after Task 11)

Tasks 1-11 are done on `experiment/new-architecture`: the full Next.js app (all routes, contact, Premonition demo, walk-in room, HUD, gate, audio engine), unit and e2e tests, and the budget check. Task 11 added `scripts/check-budget.mjs` (`npm run budget`: room chunk plus audio under 2 MB gzipped, and no room chunk on any route including `/`; helpers tested in `scripts/check-budget.test.ts`), a full `README.md` rewrite (old static-site notes kept under "Legacy static site"), `tests/e2e/room-timing.spec.ts` (room readiness under 4x CPU throttling, soft limit 15 s), and this update. Current numbers: room chunk about 136 KB gzipped, audio about 511 KB gzipped, total about 648 KB of 2048 KB; measured room readiness under 4x CPU throttling about 1 s on localhost with software GL.

- Deployed 2026-10-18 (owner approved "preview only"): Vercel project `avious-site` (scope abenabram613-7835s-projects), deployment `https://avious-site-pc1x6bmhp-abenabram613-7835s-projects.vercel.app`, aliases `https://avious-site.vercel.app` and `https://avious-site-abenabram613-7835s-projects.vercel.app`. Vercel labelled it target `production` because it was the project's first deploy; it is not on imavious.org and no DNS or domain was changed. It sits behind Vercel Authentication (visitors get a Vercel login redirect); turning that off in Settings, Deployment Protection, is the owner's call. `vercel link` also connected the GitHub repo AviouslyAvi/Music-Portfolio to the project and added `.vercel` to `.gitignore` (uncommitted edit). Redeploy with `vercel deploy` from the repo root; never `--prod` without the owner's yes.
- Last verified commit on the branch: `9c0c9d3` (tsc clean, 202 unit tests, 42 e2e, budget 647.7 KB of 2048 KB). Untracked: `AGENTS.md` (written by `next dev`; owner to decide commit vs ignore).
- Entry screen behaviour to know when testing: Skip or Leave the room (and, since the final fix wave, finishing or skipping the demo) sets `sessionStorage['room:left']='1'`, which hides the Enter screen for the rest of that tab session. Clear it (`sessionStorage.removeItem('room:left')`) or open a new tab to see the Enter screen again.

Not done:
- Domain switch and any production promotion (the Vercel deploy above is the only publish; nothing is on imavious.org).
- Domain switch from GitHub Pages to Vercel (steps in README).
- Real audio swap: tracks and the three rendered Premonition sounds are placeholders (`placeholder: true`).
- Free demo zip at `public/downloads/premonition-demo.zip` (absent, link 404s until supplied).
- Analytics provider choice and script tag (README, Analytics).
- Resend credentials (`RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`).
- Owner inputs still open: what avious.co holds, which tracks go on the iPod, which sounds get rendered.

Original pre-build status (kept for the record): brainstorming finished and the design approved by the owner; nothing was built at that point. Approved design: `docs/superpowers/specs/2026-10-18-avious-site-design.md` (committed on the branch). It holds intent, goals, non-goals, anti-goals, the owner's decisions, my calls, what is left to the builder, and open items.

## One-paragraph summary

imavious.org becomes a portfolio built in Next.js with a three.js walk-in room. On desktop (WebGL, no reduced-motion) the visitor clicks Enter, then walks a low-poly, vintage, charcoal-and-walnut music-production room with keyboard and mouse. Speakers play the owner's music, an iPod on the desk changes tracks (the iPod is the portfolio), and a computer beside it boots into Premonition running in a generic DAW screen with a few chosen sounds and a roughly 3 second riser demo. A Skip control always works. The room is muted so the iPod and computer glow. Mobile and non-WebGL visitors get the normal site, and the 3D code never loads for them. Services and contact stay on this site. Selling, accounts and device activation are separate projects: premonition.avious.co (Premonition's store, accounts, activations) and avious.co (selling side; contents undecided). This site only links to them. Do not mention the Jam Room or remote-recording projects anywhere.

## New direction (2026-10-19): changes to the 3D space (not started, needs brainstorming first)

The owner's words, kept verbatim: "I wanna make some changes to the 3d space. I want to have to interact with the iPod to do things. On the computer I wanted the premonition plugin how it is actually built to be on the screen. I wanted to build what the actual premonition plugin is like so people can test out the plugin on the computer."

Earlier the same day the owner also said they wanted the 3D walkthrough to be "the opening of the site" (after seeing that the Enter screen did not appear because of the `room:left` flag, and that today it is a dimmed panel over the normal home page). The three options offered and not yet chosen: (1) opaque full-screen opener with the home content still in the HTML for search engines, (2) Skip/Leave only hides the Enter screen until the next page load instead of the whole tab session, (3) finishing the demo returns to the room instead of opening the site (the spec's step 7 says the site opens; the final fix wave implemented that, so (3) means reverting it).

What this means for the build (my reading; confirm with the owner):
- **iPod-driven interaction.** Today the HUD shows three always-present buttons ("Play next track (iPod)", "Use the computer", "Leave the room") plus an E key and clicking objects. The owner wants the iPod to be the thing you interact with to do things. Unclear what "things" covers; candidates: the iPod becomes the menu for the whole experience (tracks, work, services, about, contact, Leave, opening the computer), shown as an iPod UI zoomed in or on the HUD, instead of separate HUD buttons. Needs the owner's answer. Constraint from the approved spec that still stands unless the owner changes it: an always-available Skip / Leave must exist (the spec's anti-goal is a gate that blocks the site), and keyboard-reachable controls for accessibility.
- **Real Premonition on the computer.** Today the computer boots into `src/demo/PremonitionDemo.tsx`: a generic DAW-style screen with three sounds and pre-rendered placeholder risers (decided earlier: pre-rendered, no live in-browser processing; spec "Non-goals" lists "Live in-browser audio processing for the demo"). The owner now wants the plugin as it is actually built, on the screen, so visitors can test it. That reverses a spec non-goal and needs a decision on how. Facts about the real plugin (`/Users/aviouslyavi/Claude/Projects/premonition-vst`): iPlug2 C++17, VST3/AU/CLAP/standalone, native UI in `Premonition/Premonition.cpp` and related headers (`Theme.h`, `SettingsAccordion.h`, `FxRackLayout.h`, `Presets.h`, etc.); UI spec in `docs/PREMONITION-UI-SPEC.md` and `GUI_DESIGN_BRIEF.md`; screenshots `Premonition-current-ui.png`, `docs/premonition-window.png`, `docs/premonition-canvas.png`; a recent commit adds a UI Size setting (75-150 %); 10 colour palettes (Warm Analog default); it is an offline renderer (drop a sample, render, drag out), not live. The plugin repo also has `web/` (Vite app) and `site-next/` (Next.js marketing site, owned by the separate premonition.avious.co project); I did not inspect what `web/` does.
- Options to put to the owner (comparison, not yet decided):

| Option | What visitors get | Cost / risk |
|---|---|---|
| A. Faithful HTML/CSS/canvas replica of the real UI driven by pre-rendered audio per control setting | Looks identical, a few controls audibly work | Cheapest; only a fixed set of settings can be audible; must be honest that it is a demo |
| B. Real DSP compiled to WebAssembly with the real UI replica, rendering in the browser | A true test of the plugin | Needs the plugin's DSP separable from iPlug2 and portable to WASM; large effort; reverses the spec's non-goal; check licensing and the plugin repo owner's other chats |
| C. Real plugin UI captured as video/frames from the actual app | Authentic look, no interaction | Not a test; cheap |

- Related project concerns: the licensing/sales work is a separate effort (`premonition-vst/HANDOFF.md`, `docs/superpowers/specs/2026-10-17-licensing-and-sales-design.md`); another chat has the DSP work active and has uncommitted edits in `Premonition/Premonition.cpp` and `SettingsAccordion.h`. Do not edit the plugin repo from the site chat; read only.
- Next skill to use: `superpowers:brainstorming` (this changes behaviour and reverses a spec non-goal), then update the design doc, then `superpowers:writing-plans`. Do not build before the owner approves.

### Decisions made 2026-10-20 (brainstorming done; design and plan written, awaiting owner approval, nothing built)

Design: `docs/superpowers/specs/2026-10-18-avious-site-design.md`, section "Revision 2026-10-20". Plan: `docs/superpowers/plans/2026-10-20-ipod-room-and-real-premonition.md`. Owner decided: click-wheel iPod (option B) operating the room (menu: Music, Services, About, Contact, Computer, Leave the room; HUD keeps only Skip to site); the computer runs the real Premonition DSP compiled to WebAssembly on the visitor's own sounds, listen only (no download), also on the `/premonition` page, time limited (my reading: 15 s clips and about 10 renders per session; owner to confirm); opaque full-screen opener, Skip hides it only until the next page load; public renderer accepted; Emscripten install allowed (ask once more at Task 1). Plan starts with a throwaway spike; if it fails the owner chooses between a faithful UI with pre-rendered audio or a video. AGENTS.md: my default is to commit it. Plugin repo was reorganised 2026-10-20 (docs under `docs/product/`); read only.

### Built 2026-10-20 (room side of the plan; the plugin tasks are not started)

Done and tested on `experiment/new-architecture`: 19 songs on the iPod (transcoded mp3s), no autoplay, floating "Press E to interact" prompts, camera zoom into the iPod, click-wheel iPod with previous, next, play and pause, volume and menu, Skip to site top-right, no bottom-left buttons, budget script counts the first track plus a 4 MB per-track cap. Unit 238, e2e room 23 and rest pass, `npm run budget` OK. Not done: plan Tasks 2 to 5 (real Premonition WASM engine, plugin screen, `/premonition` page), Task 8 (opaque per-page-load opener), Task 9 (budget for WASM, credits). The computer still opens the old generic demo. The spike result and scripts are in `docs/superpowers/spike-2026-10-20*`.

## Next step

(Superseded by "New direction" above for the room changes; the list below still applies to launch work.) Owner review of the build, then (with owner approval) a Vercel preview deploy, supplying real audio and the demo zip, choosing an analytics provider, and the domain switch. Original pre-build instruction, now superseded: invoke `superpowers:writing-plans` and write the implementation plan from the approved design doc; do not scaffold until the plan exists. The room is built from code with simple shapes (no imported 3D models).

## Open items (from the design doc)

- What avious.co holds; this site uses placeholder links until premonition.avious.co and avious.co exist.
- Which tracks go on the iPod; which ~3 sounds get rendered through the real Premonition plugin for the demo (placeholder audio until then).
- Where the free demo file is hosted (builder's call: direct download here unless premonition.avious.co hosts it).
- Domain and hosting switch from GitHub Pages to Vercel (previews fine for review; `contact.html` redirects to `/contact`).
- Windows claim stays off the site until a Windows build ships.

## References

- Current site (to reuse copy from): `index.html`, `contact.html`, `styles.css`, `script.js` in the repo root. Palette there (cream and maroon) is being retired.
- Premonition product facts: `/Users/aviouslyavi/Claude/Projects/premonition-vst/PRODUCT.md`, `README.md`, `docs/landing-page-wireframe.md`, `docs/premonition-demo.mp4`, `docs/premonition-window.png`.
- Other owner projects, **not to be mentioned on the site**: `/Users/aviouslyavi/Claude/Projects/jam-room/`, `/Users/aviouslyavi/Claude/Projects/remote-recording/`, `/Users/aviouslyavi/Claude/Projects/remote-recording-spec/` (the last two share one GitHub remote).
- Room reference photos (session image files): `/private/tmp/claude-501/-Users-aviouslyavi-Claude/49c71403-4690-49fc-bec8-b7ba7cd1e776/images/1.webp`, `3.webp`, `4.webp` (`2.png` came through blank). Pinterest pins the owner shared, not opened: https://www.pinterest.com/pin/719731584239050672/ , https://www.pinterest.com/pin/1115696507720472869/ , https://www.pinterest.com/pin/906701337497948629/ , https://www.pinterest.com/pin/1106689308463907048/ , https://www.pinterest.com/pin/1089589703630045526/ , https://www.pinterest.com/pin/1089871178603096752/ .- Direction mockups made this session (private artifact): https://claude.ai/artifact/WTWqPKqkpiVbKzVhsrqtbC . The owner chose B (walk-in world) with a fallback site.
- Reference room, as seen in the photos: charcoal walls, tall walnut slat panels, L-shaped walnut desk with a black mat, window on one side, two floating shelves on black brackets, shaggy grey rug, black ergonomic chair, studio monitors on stands, guitar on the wall, plants, analog clock, Helvetica and Dieter Rams posters, warm lamp light.

## Housekeeping

- `.superpowers/` (visual companion scratch) is gitignored; its server is stopped.
- Commit trailer used: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- The owner prefers: plain explanation first, analogy second; comparison tables for X-vs-Y; never silently drop hard data from saved docs.
