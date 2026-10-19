# Handoff: AVIOUS portfolio site rebuild

Date: 2026-10-18. Repo: `/Users/aviouslyavi/Claude/Projects/Music-Portfolio` (GitHub: AviouslyAvi/Music-Portfolio). Branch: `experiment/new-architecture` (off `main`; `main` still serves the old static site on GitHub Pages at imavious.org via `CNAME`).

## State (updated after Task 11)

Tasks 1-11 are done on `experiment/new-architecture`: the full Next.js app (all routes, contact, Premonition demo, walk-in room, HUD, gate, audio engine), unit and e2e tests, and the budget check. Task 11 added `scripts/check-budget.mjs` (`npm run budget`: room chunk plus audio under 2 MB gzipped, and no room chunk on any route including `/`; helpers tested in `scripts/check-budget.test.ts`), a full `README.md` rewrite (old static-site notes kept under "Legacy static site"), `tests/e2e/room-timing.spec.ts` (room readiness under 4x CPU throttling, soft limit 15 s), and this update. Current numbers: room chunk about 136 KB gzipped, audio about 511 KB gzipped, total about 648 KB of 2048 KB; measured room readiness under 4x CPU throttling about 1 s on localhost with software GL.

- Preview URL: not deployed.

Not done:
- Vercel preview deploy (deliberately skipped; no deploy, DNS, domain or git remote changes were made).
- Domain switch from GitHub Pages to Vercel (steps in README).
- Real audio swap: tracks and the three rendered Premonition sounds are placeholders (`placeholder: true`).
- Free demo zip at `public/downloads/premonition-demo.zip` (absent, link 404s until supplied).
- Analytics provider choice and script tag (README, Analytics).
- Resend credentials (`RESEND_API_KEY`, `CONTACT_TO`, `CONTACT_FROM`).
- Owner inputs still open: what avious.co holds, which tracks go on the iPod, which sounds get rendered.

Original pre-build status (kept for the record): brainstorming finished and the design approved by the owner; nothing was built at that point. Approved design: `docs/superpowers/specs/2026-10-18-avious-site-design.md` (committed on the branch). It holds intent, goals, non-goals, anti-goals, the owner's decisions, my calls, what is left to the builder, and open items.

## One-paragraph summary

imavious.org becomes a portfolio built in Next.js with a three.js walk-in room. On desktop (WebGL, no reduced-motion) the visitor clicks Enter, then walks a low-poly, vintage, charcoal-and-walnut music-production room with keyboard and mouse. Speakers play the owner's music, an iPod on the desk changes tracks (the iPod is the portfolio), and a computer beside it boots into Premonition running in a generic DAW screen with a few chosen sounds and a roughly 3 second riser demo. A Skip control always works. The room is muted so the iPod and computer glow. Mobile and non-WebGL visitors get the normal site, and the 3D code never loads for them. Services and contact stay on this site. Selling, accounts and device activation are separate projects: premonition.avious.co (Premonition's store, accounts, activations) and avious.co (selling side; contents undecided). This site only links to them. Do not mention the Jam Room or remote-recording projects anywhere.

## Next step

Owner review of the build, then (with owner approval) a Vercel preview deploy, supplying real audio and the demo zip, choosing an analytics provider, and the domain switch. Original pre-build instruction, now superseded: invoke `superpowers:writing-plans` and write the implementation plan from the approved design doc; do not scaffold until the plan exists. The room is built from code with simple shapes (no imported 3D models).

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
