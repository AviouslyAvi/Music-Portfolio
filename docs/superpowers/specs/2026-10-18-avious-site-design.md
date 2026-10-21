# AVIOUS site: design

Branch: `experiment/new-architecture` (separate from `main`, which still serves the current static site).
Status: the original design was approved and built (Tasks 1-11). **Revision 2026-10-20 (below, "Revision 2026-10-20: iPod-driven room and the real Premonition") changes the room and the demo; it is a draft for the owner's approval and nothing in it is built.** Where the revision contradicts the text above it, the revision wins; the older text is kept for the record and marked "superseded" in place.

## Intent

This site is Avi's portfolio, at imavious.org. It replaces the current cream-and-maroon one-pager ("Avi, The Alchemist"). **Three sites, three jobs:**

| Site | Job | In scope here |
|---|---|---|
| imavious.org | Portfolio: the walk-in room and the normal site behind it | Yes, this project |
| avious.co | The selling side of the business. Exactly what it holds beyond Premonition's store is undecided. | No, separate project |
| premonition.avious.co | Premonition's own site: store, accounts, device activations | No, separate project |

This site links out to the other two.

The one thing a visitor should do before leaving is **see Premonition**, Avi's offline reverse-reverb riser plugin. Avi would accept making this close to unavoidable, as long as the visitor can still skip it.

The site presents Avi as a producer who builds worlds out of texture, a motivator, and someone who makes production efficient. Premonition is the proof of that last trait: it replaces a manual bounce, reverse and nudge routine with one render.

## The experience

### Desktop (WebGL available): a walk-in room

1. The visitor lands on a short "Enter" screen. The click is required anyway, because browsers block audio until a user interacts, and it starts the music.
2. They are inside a small, dark, stylized music-production room, and they walk through it with the **keyboard and mouse** (free movement, not a fixed path).
3. Speakers on stands are already playing Avi's music as the visitor passes.
4. On the desk or a table there is an **iPod**. Clicking it changes the track. The tracks are Avi's finished work, so the iPod is the portfolio.
5. Beside it is a **computer**. Clicking it boots the machine (a vintage-style boot sequence) into **Premonition running inside a DAW**.
6. On that screen a few sounds are offered. The visitor picks one and it runs through the plugin: a riser of about **3 seconds** that swells in and lands on the downbeat.
7. A visible **Skip** control is always available. After the demo (or a skip) the full site opens: services, work, about, contact, and the Premonition page.

### Everything else: the normal site

Phones and tablets, browsers without WebGL, visitors with `prefers-reduced-motion`, and (builder's call) slow devices get the normal site straight away, with no room. The 3D code is never downloaded for them. The normal site is the computer's screen at full size: real pages, with real URLs, that search engines and shared links can reach without the room.

## Look

- **Palette:** charcoal and walnut with warm lamp glow. Text is a warm off-white on charcoal. The current maroon is retired or reduced to a tiny accent; cream is gone.
- **Room:** low-poly and stylized with a vintage feel, kept light to load. It is **muted** (dusty, dim) so that the **iPod and the computer are the two things that glow** and pull the eye.
- **Reference room:** a narrow production room. Charcoal walls, tall walnut slat panels behind an L-shaped walnut desk with a black mat, a window on one side, two floating shelves on black brackets, a shaggy grey rug and a black ergonomic chair. Dressing seen in the reference photos: studio monitors on stands, a guitar on the wall, plants, an analog clock, posters.
- **Type (builder's call, confirm):** a serif for headlines, a clean sans for business details. The normal site follows the plugin's own design system where it can (Premonition Design System, Warm Analog is the plugin's default identity), adapted to charcoal and walnut.
- **No pure white**, no emoji, no exclamation marks.

## Content

| Area | What it holds |
|---|---|
| Work (portfolio) | Finished tracks people can play. Reachable in the room through the iPod and on the normal site as a page. |
| Services (business) | Production and arrangement, sound design, finishing and finalization, teaching and mentorship. Carried over from the current site. |
| Plugins | **Premonition only.** Built so a second plugin could be added later without a redesign. |
| About | The Alchemist story (worlds from texture, human fingerprint), Avi as motivator, efficiency. **Experience with FL Studio, Ableton, Studio One, Logic Pro, Cubase and Reaper.** |
| Contact | Send a rough idea, a voice note, or a mood. |

Existing copy to reuse and adapt from the current site (`index.html`): the hero ("I don't make beats. I build worlds you can live in."), the philosophy cards, the emotional palette, the services descriptions, the legacy pillars.

**Facts about Premonition the site may state** (from `premonition-vst/PRODUCT.md`): offline renderer, not a live insert effect; VST3, AU and CLAP; drop, render, drag; tagline "Echoes of the future."; launch price $19.99 then $24.99, with a free demo. Wordmark is the uppercase tracked PREMONITION. The site must not invent testimonials, press or benchmarks, and must not call the plugin real-time. The Windows claim only holds once a Windows build ships.

## Premonition demo

**Superseded 2026-10-20 by "Revision 2026-10-20" below: the screen is now the real plugin UI, rendering in the browser with the plugin's own DSP, with the visitor's own sounds and no download. Experience steps 4 to 6 above change likewise: the iPod (a click-wheel menu) operates the room, and the computer opens the real plugin. The text below is kept for the record.**

- A few sounds, chosen by the visitor, each shown running through the plugin in a generic DAW-style screen.
- The audio is **pre-rendered real output of the actual plugin**, played back as files (builder's call: not live browser processing). Roughly 3 seconds each, ending on the downbeat.
- The sounds to render still need to be produced.
- The DAW screen is **generic**, not a copy of any real DAW (builder's call).

## Goals

- A visitor sees and hears Premonition within their first visit, on desktop and on the normal site.
- The room feels like a place Avi works: warm, a little worn, specific.
- The normal site is complete and fast without the room.
- One look across the room, the computer screen and the normal site.

## Non-goals

- The Jam Room and remote-recording projects. They are **not mentioned anywhere**, including in links or code comments visible to visitors.
- A 3D version for phones.
- Photoreal rendering, or imported 3D models. The room is built in code from **simple shapes**.
- Live in-browser audio processing for the demo. **(Superseded 2026-10-20: the demo now renders in the browser with the plugin's real DSP compiled to WebAssembly. Still a non-goal: *live* insert-effect processing; Premonition renders offline and the site must keep saying so.)**
- User accounts, device activations, license keys, checkout, order history, or any database. All of that belongs to premonition.avious.co, a separate project. This site only links to it.

## Anti-goals

- A gate that blocks the site until the demo ends. The skip control is not optional.
- A site that is slow, or fails to load, on a modest laptop or phone.
- A room so busy that the iPod and the computer stop being the focus.
- Anything that reads as hype or manufactured urgency.
- A 3D-only site that search engines and shared links cannot read.

## Constraints and decisions

Decided by Avi: **services and contact stay on this portfolio site**; **this site is the portfolio at imavious.org, and ships with the Premonition demo plus Buy and account links out to premonition.avious.co (selling, accounts, device activation), with no accounts here; avious.co is the separate business site**; Next.js and three.js; the walk-in room concept; keyboard and mouse movement; mobile gets the normal site; charcoal and walnut; the computer boots into Premonition and a DAW; a few chosen sounds; about 3 seconds; skip stays; the room is built from simple shapes; Premonition is the only plugin shown; the six DAWs are listed; business and portfolio together.

My calls (Avi to confirm or change):
- **Stack:** Next.js (App Router) with the 3D room as a client-only, lazily loaded route using three.js, so phones never download it. Hosting on Vercel, matching Premonition's own decision. The current GitHub Pages deploy of `main` stays untouched until the owner switches the domain.
- The iPod's tracks are the portfolio, and they come from Avi's finished work.
- Fallback also covers no-WebGL and reduced-motion, and builder decides the threshold for slow devices.
- Generic DAW screen; pre-rendered demo audio; serif plus sans type.
- **Routing:** the room lives only at `/`. Every other URL (`/services`, `/work`, `/premonition`, `/about`, `/contact`) is a normal page that never loads 3D, so deep links and search results land on readable content. The Enter screen shows only at `/`. A persistent "Leave the room" control goes to the normal site at any time, not only through the computer.
- **Loading budget:** the 3D route loads only after the visitor chooses Enter, targets about 2 MB or less gzipped for code plus assets, and should be walkable within about 5 seconds on a laptop five or more years old. Builder tunes the exact numbers; going over means cutting geometry, not shipping.
- **Assets:** build with placeholder audio and a clearly marked swap step. Avi owns the rights to the tracks and demo sounds; anything with samples or client rights stays off the iPod until Avi says so.
- **Hosting and review:** Vercel preview URLs are fine for review. The old site has only `/` and `/contact.html`, so `contact.html` redirects to `/contact`. No other SEO continuity work is needed.
- **Contact:** a simple form that sends an email to Avi, with no file upload. The "voice note" line becomes an invitation to include a link to one. No account or database is needed for this.
- **Analytics:** basic privacy-friendly page and event counts only (demo played, skipped, Premonition page viewed), with no cookies and so no consent banner. This measures whether visitors see Premonition.
- **Windows:** the site leaves out any Windows claim until a Windows build ships.

## Revision 2026-10-20: iPod-driven room and the real Premonition

Status: draft for the owner's approval; not built. Reached by brainstorming with the owner on 2026-10-20. The owner's words are quoted; everything marked "my call" is the author's and the owner may change it.

### Why

The owner's words: "I want to have to interact with the iPod to do things. On the computer I wanted the premonition plugin how it is actually built to be on the screen. I wanted to build what the actual premonition plugin is like so people can test out the plugin on the computer." The first build has three always-visible HUD buttons and a generic DAW screen playing pre-rendered placeholder risers. The owner wants the room to be operated through one object, and the computer to be a true test of the plugin, not a picture of it.

### What the owner decided

- **The iPod is a classic click-wheel iPod** (chosen over a touch iPod; mockup `ipod-ui.html` in `.superpowers/brainstorm/`). Clicking it in the room zooms it to the middle of the screen. The owner: "they can swipe and tap on different songs." Dragging around the wheel scrolls a list, clicking the centre chooses, a Menu control goes back.
- **The iPod is how you do things in the room.** The three separate HUD buttons ("Play next track (iPod)", "Use the computer", "Leave the room") go away. The owner approved the menu below.
- **The computer shows the real Premonition, working, with the visitor's own sounds.** The owner: "yes for real with their own real sounds." The visitor drops their own audio, sets the real controls, renders and listens.
- **Visitors cannot download the rendered riser.** Listen only.
- **The room is the site's front door.** A full-screen opener covers the home page; Skip or Leave hides it only until the next page load (not for the whole tab session); finishing the demo opens the site (the spec's step 7 stands). The home page content stays in the HTML underneath for search engines and shared links.

### Interaction prompt and zoom (owner, later on 2026-10-20; supersedes the HUD and click behaviour above)

The owner's words: "I like the fact that the character zooms into the computer when tapping use the computer, but instead of the buttons on the bottom left saying change the song on the ipod or use the computer, I want a button that says e to interact when the person gets close to the computer. it should be floating near the computer. Same thing for the ipod. Also the character would kind of zoom into the ipod screen and it could be used to change the song. No buttons in the bottom left." They shared a reference image: a Roblox "E circle prompt", a small dark rounded label floating on the object with a circled **E** key and the word "Press".

- **No buttons in the bottom left.** The HUD no longer has "Play next track (iPod)", "Use the computer" or "Leave the room" buttons. Nothing clickable sits there.
- **Floating proximity prompt.** When the visitor is within interaction range of the computer, a small dark rounded label appears floating beside the computer: a circled **E** and a short verb phrase. Same for the iPod when near it. It follows the object on screen as the camera moves (a DOM element positioned from the object's projected position), and hides when the visitor walks away or while in a zoom. The existing proximity check (`INTERACT_RADIUS`) and the E key stay. Wording is my call: "E  Use the computer" and "E  Use the iPod" (the reference says "Press"; the owner may prefer "Press").
- **Pressing E zooms in, for both objects.** The computer keeps today's camera ease to the desk pose, then the real Premonition screen opens. The iPod now does the same: the camera eases to a close pose in front of the iPod screen, then the click-wheel iPod UI opens centred (my call: a DOM overlay on top of the zoomed view, because a wheel drawn on the small 3D model would be too small to operate). Changing the song, and everything else on the iPod menu, happens there. Escape puts the iPod or computer down and eases the camera back to walking.
- **Still allowed (my call):** clicking the iPod or computer in the room does the same as pressing E when in range. The floating prompt is also clickable, so a mouse-only visitor is not stuck.
- **Skip to site** stays visible at all times as a small link in the top-right corner (my call; it is the one always-visible control, kept because the original anti-goal forbids a gate). The now-playing line stays as plain text (not a button).
- Accessibility: the prompt is a real focusable element with an accessible name ("Use the iPod, press E"); E works with the keyboard with or without pointer lock.

### The iPod

Menu (the owner approved this list; the contents of each page are my call):

| Entry | What it does |
|---|---|
| Music | Track list (the portfolio). Choosing a track plays it through the speakers. |
| Services | A short text page on the iPod screen, with a link to the full `/services` page. |
| About | Same, linking `/about`. |
| Contact | Same, linking `/contact`. |
| Computer | Puts the iPod down and moves the camera to the computer. |
| Leave the room | Opens the normal site. |

My calls on behaviour:
- Keyboard: arrow keys scroll, Enter chooses, Escape goes back; Escape at the top level puts the iPod down and returns to walking. The wheel is also reachable by keyboard and screen reader (focusable list with labels), since the room still needs a way to reach the same content without a pointer.
- Pages that are text-only on the iPod screen must stay short; the full page on the site is the real content.
- The always-visible **Skip to site** link stays in a screen corner at all times (top-right; see "Interaction prompt and zoom"). It is the one control that is not on the iPod, because the original anti-goal (a gate that blocks the site) still stands.
- Looks: the iPod is one of the two glowing objects (with the computer). The click wheel sound or tick is optional and the builder's call; the audio engine's mute rules still apply.

### The computer: the real Premonition

What it is (my call where marked):
- A faithful replica of the plugin window as built today (960 by 720 design size; drop zone, queue, waveform, Render and Preview, Type switch Hall / Plate / Spring / Room / Custom, Stretch, Size, Decay, Tail and Mix knobs, Mode, Normalize, A/B result slots, preset row, status bar). The source of truth is the plugin repo, read only: `Premonition/Premonition.cpp`, `Theme.h`, `Parameters.h`, `docs/product/PREMONITION-UI-SPEC.md`, `docs/product/GUI_DESIGN_BRIEF.md`, and the screenshot `docs/product/Premonition-current-ui.png`. Default look is Warm Analog. The plugin's parameters, ranges, defaults and labels are copied from `Parameters.h`, not invented.
- **The render is the plugin's own DSP.** The code in `Premonition/dsp/` (header-only C++ with no iPlug2 dependency; uses signalsmith-stretch and WDL FFT; the file loaders `AudioLoader.mm` and `AudioLoader_win.cpp` are platform-specific and are not needed because the browser decodes audio) is compiled to WebAssembly and run in a Web Worker. The page decodes the dropped file, hands samples to the worker, and plays the result with Web Audio. Compiling and running it is **unverified**; Emscripten is not installed on this machine (`emcc` not found).
- The visitor drops their own file onto the drop zone, or picks one of 2 or 3 starter sounds (my call). Audio is processed in their browser and never uploaded. The page must say so in one line.
- Clip length limit: the plugin allows 120 seconds; the site caps the visitor's clip near 10 to 15 seconds so Render stays quick on a modest laptop (my call; the builder tunes it after measuring).
- **Listen only.** Preview plays the rendered riser. The "Drag into your DAW" card is shown disabled with a line saying the full plugin does this. There is no download, no save, no export button, and the rendered buffer is not exposed as a file.
- The site keeps the product facts: Premonition is an offline renderer, not a live insert effect; it must not claim anything the plugin cannot do. The wording on the screen follows `docs/product/premonition-product-copy.md` where it applies.
- A boot sequence into the plugin may stay if it is quick; the generic DAW frame from the first build is dropped (the real plugin is the screen). Whether to keep a DAW-like frame around the plugin window is the builder's call.

### What this changes in the first build

- `src/demo/` (BootSequence, DawScreen, PremonitionDemo, machine, useRenderedAudio) is replaced or heavily reworked; its tests change with it. The "pre-rendered placeholder risers" path and the `placeholder: true` rendered sounds go away. The tracks on the iPod remain placeholders until real masters are supplied.
- `src/room/Hud.tsx` loses its three buttons; the floating proximity prompts (see "Interaction prompt and zoom") replace them, and Skip to site moves to the top-right. Pressing E (or clicking) at the iPod eases the camera to the iPod and opens the iPod UI instead of advancing a track.
- `src/room/RoomGate.tsx` and the `room:left` session flag change: Skip or Leave hides the opener only until the next page load. The opener becomes opaque and full screen, with the home content still present in the HTML.
- Loading budget: the original ceiling (about 2 MB gzipped for room code plus audio, with no room chunk on any route) still applies to the room. The WebAssembly module and its worker load only after the visitor sits down at the computer and are budgeted separately; the builder measures and proposes a number (my call: aim for the WASM plus UI under about 1.5 MB gzipped). `npm run budget` and its tests extend to cover this.
- The room-readiness timing test still applies; add a timing check that a short clip renders under throttling within a soft limit.

### Goals, non-goals, anti-goals for this revision

Goals: a visitor operates the whole room through the iPod; a visitor tests the real plugin with their own sound and hears a real render; the site still opens when they are done or skip.

Non-goals: downloading, saving or exporting any render; real-time or live processing; accounts, activation, licensing or checkout on this site (premonition.avious.co owns those); Windows claims; porting every feature of the plugin (the FX rack cards and presets are shown only if the builder finds them cheap and faithful; see below); any change to the plugin repo.

Anti-goals: a screen that looks like the plugin but plays something else (it must be the plugin's own DSP, or the screen must say plainly that it is a demo of a limited set of settings); a render that freezes the page (it runs in a worker with a visible progress state and a cancel); any upload of a visitor's audio; a gate on the site (Skip stays).

### Risks and fallbacks

- The WebAssembly compile of `Premonition/dsp/` may fail or may be too slow in a browser. **First step of the plan is a throwaway spike** to compile the DSP and render a 5 second clip in a worker, measuring time and size. If the spike fails, the owner decides between: (A) the faithful UI with audio pre-rendered by the real plugin for a fixed set of settings (cheaper, but only some settings audible, and the screen must say so), or (C) a video capture of the real app (not a test). This fallback is the owner's call, not the builder's.
- The plugin repo changes while this is built (another chat has active DSP and UI work, and the repo was reorganised on 2026-10-20: docs moved into `docs/product/` and others). The build pins to a specific plugin commit and records it. Updating to newer DSP is a later, separate task.
- Third-party code: signalsmith-stretch and WDL FFT travel with the compiled DSP. The plugin's `THIRD-PARTY-NOTICES.txt` lists what must be acknowledged; the builder carries those notices onto the site (for example a credits link). The plugin source is "all rights reserved" by Avious; Avi is the owner, so this is permitted, but the compiled module is public once shipped, so anything in the DSP Avi does not want public must be flagged before the spike ships.
- Browser audio: processing and playback need a user gesture; the click that sits down at the computer or presses Render provides it.

### Calls made after the builder check (my calls; the owner may change them)

- **What "finishing the demo" means.** The plugin is open-ended, so nothing yanks the visitor out. The site opens only when they choose Leave the room (iPod), Skip to site, or follow a link on an iPod page. After the first successful Preview, a quiet line appears on the computer screen ("Like it? Continue to the site") with a link; it never auto-redirects. Analytics: "demo played" fires on the first successful Preview, "skipped" on Skip, "left" on Leave; the original step 7 ("after the demo the site opens") is replaced by this.
- **Plugin source.** Read-only, at `/Users/aviouslyavi/Claude/Projects/premonition-vst`. The build pins to the latest commit where the plugin's own DSP tests pass (the builder records the hash in the repo and the plan), not to a mid-change working tree. A later DSP update is a separate task.
- **Spike pass bar** (before the owner decides between A, C, or continuing): a 5 second clip renders in under about 5 seconds on a typical laptop in a Web Worker, with the WebAssembly plus UI under about 1.5 MB gzipped. The builder reports measured numbers; the owner decides on a borderline result.
- **Mitigations** that cost almost nothing and are in scope regardless of the owner's answer on public exposure (below): the clip cap is enforced inside the worker, not only in the UI; the module exposes no function that returns a rendered file; the "Custom" impulse-response path is left out unless the owner asks for it.

### Owner answers after the builder check (2026-10-20)

- **The working plugin also goes on the `/premonition` page** ("it could go on the page"). It is built as a standalone page component, not as a room texture, and the room's computer embeds the same component. It loads its WebAssembly only when the visitor opens it, never in the room chunk or on other routes. Small-screen layout: the 960 by 720 design scales down and needs a usable layout for phones (builder's call), and it stays muted until the visitor acts. Phone, no-WebGL and reduced-motion visitors who reach `/premonition` can therefore try it; the old pre-rendered `src/demo/` path is retired for them too.
- **The renderer is time limited** (the owner's words: "time limited"). My reading, which the owner should confirm when reading this: each visit gets a limited allowance, not an unlimited free renderer. Concretely: the clip cap (10 to 15 seconds) enforced in the worker, plus a small per-session render allowance (about 10 renders, then a line saying the full plugin has no limit, with a link to premonition.avious.co). The count is kept in the page's memory and session storage, so it is a friction limit, not security; a determined visitor can reset it, and that is accepted. If the owner meant a time-based limit (for example a countdown) instead of a render count, the builder swaps the counter for a timer; nothing else changes.
- **Public exposure of the renderer is accepted** with the time limit and the cheap safeguards above. The spike itself stays local until it meets the pass bar; the first public deploy is a Vercel preview behind login, like the current one, and anything production is the owner's separate yes.
- **The owner permits installing Emscripten** on the build machine for the spike. The plan asks once more at that step before running the install, and installs only in a project-local or tool directory, never changing system settings.

### Left to the builder for this revision

The iPod's visual design and wheel feel, the exact page content on the iPod screen, how much of the plugin UI (FX rack, presets, A/B slots) to include, worker and WASM packaging, memory and clip cap, progress and error states, the starter sounds' choice with the owner, accessibility of the iPod and the plugin screen.

### Open items

- Which 2 or 3 starter sounds to include, and the list of tracks on the iPod (carried from before).
- The owner's call on AGENTS.md (below).
- My call, unconfirmed: commit `AGENTS.md`. It is a short, generated note that `next dev` re-adds each run; committing it keeps the tree clean and it helps future agents. The owner may prefer to ignore it instead.

## Left to the builder

Scene composition and camera feel, collision and movement tuning, the boot sequence's look, the exact fallback detection, audio loading and cross-fading between tracks, loading states, accessibility of the room (keyboard focus on the two interactive objects, a way to reach the same content without 3D), and the page structure of the normal site.

## Open items

Listed so the plan can account for them: which tracks go on the iPod and whether Avi has masters ready; which three or so sounds to render for the demo; the premonition.avious.co and avious.co links need destinations (the builder uses placeholders until those sites exist); where the free demo file is hosted (builder's call: a direct download from this site unless premonition.avious.co hosts it); when the launch price moves from $19.99 to $24.99, which premonition.avious.co controls; what avious.co holds, since services and contact stay on this site (decided), and so what this site links to on avious.co until that is settled (builder uses a placeholder); the domain and hosting switch from imavious.org on GitHub Pages.
