# AVIOUS site: design

Branch: `experiment/new-architecture` (separate from `main`, which still serves the current static site).
Status: draft for the owner's approval. Nothing is built.

## Intent

AVIOUS is Avi's music business and portfolio in one site. It replaces the current cream-and-maroon one-pager ("Avi, The Alchemist") at imavious.org.

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
- Live in-browser audio processing for the demo.
- User accounts, license keys, in-site checkout, order history, or any database for Premonition. Purchase happens on a third-party store (decided). If accounts come later, that is a new project.

## Anti-goals

- A gate that blocks the site until the demo ends. The skip control is not optional.
- A site that is slow, or fails to load, on a modest laptop or phone.
- A room so busy that the iPod and the computer stop being the focus.
- Anything that reads as hype or manufactured urgency.
- A 3D-only site that search engines and shared links cannot read.

## Constraints and decisions

Decided by Avi: **the site ships with the free Premonition demo and a "Buy" link out to a third-party store, with no accounts**; Next.js and three.js; the walk-in room concept; keyboard and mouse movement; mobile gets the normal site; charcoal and walnut; the computer boots into Premonition and a DAW; a few chosen sounds; about 3 seconds; skip stays; the room is built from simple shapes; Premonition is the only plugin shown; the six DAWs are listed; business and portfolio together.

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

## Left to the builder

Scene composition and camera feel, collision and movement tuning, the boot sequence's look, the exact fallback detection, audio loading and cross-fading between tracks, loading states, accessibility of the room (keyboard focus on the two interactive objects, a way to reach the same content without 3D), and the page structure of the normal site.

## Open items

Listed so the plan can account for them: which tracks go on the iPod and whether Avi has masters ready; which three or so sounds to render for the demo; which third-party store sells Premonition (the Buy link needs a destination; the builder uses a placeholder until Avi picks one); where the free demo file is hosted (builder's call: a direct download from the site unless the chosen store hosts it); when the launch price moves from $19.99 to $24.99, which the store controls; the domain and hosting switch from imavious.org on GitHub Pages.
