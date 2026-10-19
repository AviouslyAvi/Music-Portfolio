# AVIOUS site

imavious.org rebuilt as a Next.js (App Router, TypeScript) portfolio. On a capable desktop the home page offers a walk-in three.js music room (the iPod on the desk is the portfolio, the computer beside it runs a Premonition demo). Everyone else, and anyone who clicks Skip, gets the normal site. Services, work, Premonition, about and contact are ordinary server-rendered pages that never load three.js.

Design spec: `docs/superpowers/specs/2026-10-18-avious-site-design.md`. Current status and open items: `HANDOFF.md`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Unit tests (Vitest, includes the copy/palette guards and the budget script helpers) |
| `npm run e2e` | Playwright end-to-end tests (builds and starts the server itself, reuses one already on port 3000) |
| `npm run budget` | Budget check; run it after `npm run build` |

Full check before a deploy: `npx vitest run && npm run build && npm run budget && npx playwright test`.

## Environment variables

Copy `.env.example` to `.env.local`. All of these have safe defaults except the Resend ones.

| Variable | Used for | Default |
| --- | --- | --- |
| `RESEND_API_KEY` | Contact form email (Resend) | none; the form returns an error until set |
| `CONTACT_TO` | Where contact messages are delivered | none |
| `CONTACT_FROM` | Sender address (a verified Resend domain) | none |
| `NEXT_PUBLIC_PREMONITION_URL` | Premonition store link (Nav "buy" link) | `https://premonition.avious.co` |
| `NEXT_PUBLIC_PREMONITION_ACCOUNT_URL` | Premonition account link | `https://premonition.avious.co/account` |
| `NEXT_PUBLIC_AVIOUS_URL` | avious.co link (footer) | `https://avious.co` |
| `NEXT_PUBLIC_DEMO_DOWNLOAD_URL` | Free Premonition demo download | `/downloads/premonition-demo.zip` |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for sitemap, robots and metadata | `https://imavious.org` |

`NEXT_PUBLIC_*` values are inlined at build time, so rebuild after changing them. The defaults live in `src/content/site.ts`.

## Architecture

- Every route is a server-rendered page. `/` renders the normal home plus `RoomGate` (`src/room/RoomGate.tsx`).
- `RoomGate` decides whether to offer the room (`src/lib/capability.ts`: desktop pointer, WebGL available, no reduced-motion preference). If so it shows an Enter dialog with a Skip button that always works.
- `RoomExperience` (`src/room/RoomExperience.tsx`) and everything three.js is loaded with `next/dynamic` only after the visitor clicks Enter. It ends up in its own chunk; phones, reduced-motion visitors, non-WebGL browsers, Skip users and every other route never download it. A "Leave the room" control is always present in the room and returns to the normal home.
- If the room chunk fails to load, WebGL context setup fails, or the context is lost, the room unmounts and the normal home remains.
- The room is built from code with simple shapes (`src/room/buildRoom.ts`, `furniture.ts`); no imported 3D models. Movement and collision (`movement.ts`), layout (`layout.ts`) and the crossfading playlist (`audioEngine.ts`) are framework-free modules with unit tests.
- The Premonition demo (`src/demo/`) is one component used both full-screen inside the room and on `/premonition`. It plays pre-rendered audio files, about 3 seconds, ending on the downbeat.
- Copy and data live in `src/content/` (`copy.ts`, `tracks.ts`, `sounds.ts`, `plugins.ts`, `site.ts`). Adding a second plugin is a data addition in `plugins.ts`.
- Contact: `POST /api/contact` (`src/app/api/contact/route.ts`) sends email through Resend. No file upload, database or accounts.
- `/contact.html` redirects permanently to `/contact` (`next.config.mjs`).

## Budget check

`npm run budget` (`scripts/check-budget.mjs`) reads the build output and fails with exit code 1 when:

1. The gzipped size of the room chunk(s) (JS chunks under `.next/static/chunks` containing `WebGLRenderer`) plus `public/audio/tracks/*` and `public/audio/demo/*` exceeds 2 MB.
2. Any route other than `/` references a room chunk.
3. `/` itself references a room chunk (it must be dynamic-only).

Routes are read from the prerendered HTML in `.next/server/app` (script tags, preloads and chunk URLs in the payload). The script names the route and chunk on failure. If it is ever over budget, cut geometry in `buildRoom.ts`; do not raise the limit. The helpers are unit-tested in `scripts/check-budget.test.ts`.

## Replacing placeholder audio

Everything under `public/audio/` is generated placeholder audio (sine and noise sweeps).
Replace each file at the same path with the real one, then set `placeholder: false` on its
entry in `src/content/tracks.ts` (tracks) or `src/content/sounds.ts` (demo renders).

- `public/audio/tracks/placeholder-{1,2,3}.mp3`: portfolio tracks, any length.
- `public/audio/demo/placeholder-riser-{1,2,3}.mp3`: pre-rendered Premonition risers, about 3 seconds, ending on the downbeat.

Update the matching `id`, `title` and `label` fields when swapping in real material. Run `npm run budget` afterwards; the audio counts toward the 2 MB budget.

## Premonition and avious.co links

This site only links out. Selling, accounts and device activation live on premonition.avious.co; avious.co is the selling side (contents undecided). Until those sites exist the links point at placeholder URLs. When they are live, set `NEXT_PUBLIC_PREMONITION_URL`, `NEXT_PUBLIC_PREMONITION_ACCOUNT_URL` and `NEXT_PUBLIC_AVIOUS_URL` in the hosting environment and rebuild.

## Free demo download

Default: the file is served directly from this site. Put the zip at `public/downloads/premonition-demo.zip` (the `public/downloads/` folder does not exist yet, so the link returns 404 until the file is supplied). To host it on premonition.avious.co instead, set `NEXT_PUBLIC_DEMO_DOWNLOAD_URL` to that full URL and rebuild.

## Analytics

Cookieless event counts only, no consent banner: `room_entered`, `demo_played`, `demo_skipped`, `premonition_viewed`. `src/lib/analytics.ts` calls `window.plausible(name)` if it exists and silently does nothing otherwise. `src/app/layout.tsx` does not load any analytics script today, so no events are recorded yet. Once a provider is chosen (a Plausible-compatible one, self-hosted or hosted), add its script tag in `layout.tsx`, for example with `next/script`: `<Script defer data-domain="imavious.org" src="https://<provider>/js/script.js" />`. The events then flow with no other change. Do not add anything that sets cookies or sends personal data.

## Switching the domain (not performed)

imavious.org still serves the old static site from GitHub Pages on `main` (via `CNAME`). Nothing below has been done:

1. Deploy this branch to Vercel (previews first; no production alias until the owner approves).
2. Set the environment variables above in the Vercel project, including `NEXT_PUBLIC_SITE_URL=https://imavious.org`.
3. Add imavious.org to the Vercel project and update DNS as Vercel instructs.
4. Merge `experiment/new-architecture` into `main` and remove the GitHub Pages deploy and the `CNAME` file once the owner approves.
5. Confirm `/contact.html` redirects to `/contact`, and that the sitemap and robots output use the final origin.

## Known placeholders

- All audio under `public/audio/` (tracks and demo risers), flagged `placeholder: true` in `src/content/tracks.ts` and `src/content/sounds.ts`.
- Link defaults in `src/content/site.ts` (premonition.avious.co, its account page, avious.co), marked `PLACEHOLDER`.
- The free demo zip at `public/downloads/premonition-demo.zip` (absent).
- Resend credentials and recipient addresses (`RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`).
- No analytics provider chosen (see Analytics).
- What avious.co will hold, which tracks go on the iPod, and which sounds get rendered through the real Premonition plugin are owner decisions still open.

## Windows

Windows claims stay off the site until a Windows build ships. Premonition is described as VST3, AU and CLAP only, and as an offline renderer, not a live insert effect.

## Legacy static site

The previous site is still in the repo root and still deployed from `main` to imavious.org on GitHub Pages (`CNAME` contains `imavious.org`). It stays untouched until the owner switches the domain and approves removal. Notes from the old README:

Title: Avi, The Alchemist (Portfolio).

Preview locally:

1. Open `index.html` in your browser.
2. Or serve the folder with a static server (recommended):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Files:
- `index.html`: main page
- `contact.html`: contact page (redirects to `/contact` in the new app)
- `styles.css`: styles
- `script.js`: small behavior

The old README's "next steps" list (kept for the record): add audio examples and embedded players, replace the placeholder email with the real contact, create a downloadable EPK and social links. The old README's local path was `c:\Users\Avious\VSCODE\portfolio`. Earlier commits (`a82e9c2`, `48b83df`) removed portfolio details from that README.
