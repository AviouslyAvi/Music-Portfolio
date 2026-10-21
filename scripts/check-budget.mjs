// Budget check, run after `npm run build`.
//  (a) gzip total of the room chunk(s) plus the FIRST track (the one the iPod loads when play is pressed; every other
//      track loads one at a time, on demand, never preloaded) plus public/audio/demo must be <= 2 MB.
//  (a2) every single track must be <= MAX_TRACK_BYTES (4 MB) so an on-demand load stays quick.
//  (b) no route other than `/` may reference a chunk containing three.js (WebGLRenderer).
//  (c) `/` must not reference it either: the room chunk is dynamic-only (loaded after Enter).
// Routes are read from the prerendered HTML in .next/server/app, using every
// /_next/static/chunks/*.js URL it mentions (script tags, preloads, inline payload).
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUDGET_BYTES = 2 * 1024 * 1024;
export const ROOM_MARKER = 'WebGLRenderer';
export const MAX_TRACK_BYTES = 4 * 1024 * 1024;

export function gzipSize(buf) {
  return gzipSync(buf).length;
}

/** chunkMap: { fileName: contents(string|Buffer) } -> names of chunks that contain three.js. */
export function findRoomChunks(chunkMap) {
  return Object.keys(chunkMap).filter((name) => String(chunkMap[name]).includes(ROOM_MARKER));
}

/** routeToChunks: { route: [chunkName] } -> list of { route, chunk, message }. */
export function checkRoutes(routeToChunks, roomChunks) {
  const room = new Set(roomChunks);
  const violations = [];
  for (const [route, chunks] of Object.entries(routeToChunks)) {
    for (const chunk of chunks) {
      if (!room.has(chunk)) continue;
      const message =
        route === '/'
          ? `Route / statically includes room chunk ${chunk}; the room chunk must be dynamic-only`
          : `Route ${route} includes room chunk ${chunk} (three.js must only load on /)`;
      violations.push({ route, chunk, message });
    }
  }
  return violations;
}

/** Unique chunk file names for every /_next/static/chunks/*.js (or static/chunks/*.js) mention. */
export function extractChunkUrls(html) {
  const found = new Set();
  for (const m of html.matchAll(/static\/chunks\/([^"'\\\s?>]+\.js)/g)) found.add(m[1]);
  return [...found];
}

/** Path relative to .next/server/app (e.g. `work/slug.html`, `work/index.html`) -> route. */
export function routeFromHtmlPath(file) {
  const parts = file.split(/[\\/]+/).filter(Boolean);
  parts[parts.length - 1] = parts[parts.length - 1].replace(/\.html$/, '');
  if (parts[parts.length - 1] === 'index') parts.pop();
  return '/' + parts.join('/');
}

/** Vacuous-pass guards: returns a list of failure messages (empty when fine). */
export function assertRoutesNonEmpty(routeToChunks) {
  const routes = Object.keys(routeToChunks);
  if (routes.length === 0) return ['No prerendered routes found; refusing to pass without checking anything'];
  const problems = [];
  if (!routes.includes('/')) problems.push('Route / is missing from the routes found');
  for (const r of routes) {
    if (routeToChunks[r].length === 0) problems.push(`Route ${r} yielded zero chunk URLs; the HTML scan is not working`);
  }
  return problems;
}

/** Recursively list .html files under dir, as paths relative to dir. */
export function listHtml(dir, rel = '') {
  const out = [];
  for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listHtml(dir, r));
    else if (entry.name.endsWith('.html')) out.push(r);
  }
  return out;
}

/** The part named `<dir>/<id>.<ext>` for the first track id in src/content/tracks.ts source text; [] when none matches. */
export function firstTrackPart(parts, tracksSource) {
  const m = /T\('([^']+)'/.exec(tracksSource);
  if (!m) return [];
  const id = m[1];
  return parts.filter((p) => p.name.split('/').pop().replace(/\.[^.]+$/, '') === id).slice(0, 1);
}

/** Names of parts bigger than the per-track cap. */
export function oversizedTracks(parts, cap = MAX_TRACK_BYTES) {
  return parts.filter((p) => p.bytes > cap).map((p) => p.name);
}

export function checkTotal(totalBytes) {
  return { ok: totalBytes <= BUDGET_BYTES, total: totalBytes, limit: BUDGET_BYTES };
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function gzipDir(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => statSync(join(dir, f)).isFile())
    .map((f) => ({ name: `${basename(dir)}/${f}`, bytes: gzipSize(readFileSync(join(dir, f))) }));
}

export function run(root = process.cwd()) {
  const chunkDir = join(root, '.next/static/chunks');
  const appDir = join(root, '.next/server/app');
  if (!existsSync(chunkDir) || !existsSync(appDir)) {
    console.error('No build output found. Run `npm run build` first.');
    return 1;
  }
  // three.js's WebGLRenderer class name survives minification of the room chunk; zero matches means this marker broke.
  const chunkMap = {};
  for (const f of readdirSync(chunkDir)) {
    if (f.endsWith('.js')) chunkMap[f] = readFileSync(join(chunkDir, f), 'utf8');
  }
  const roomChunks = findRoomChunks(chunkMap);
  if (roomChunks.length === 0) {
    console.error('FAIL: no room chunk (WebGLRenderer) found under .next/static/chunks; is three.js bundled?');
    return 1;
  }

  const trackParts = gzipDir(join(root, 'public/audio/tracks'));
  const tracksFile = join(root, 'src/content/tracks.ts');
  const tracksSource = existsSync(tracksFile) ? readFileSync(tracksFile, 'utf8') : '';
  const parts = [
    ...roomChunks.map((c) => ({ name: `room chunk ${c}`, bytes: gzipSize(Buffer.from(chunkMap[c])) })),
    ...firstTrackPart(trackParts, tracksSource).map((p) => ({ ...p, name: `audio (first track) ${p.name}` })),
    ...gzipDir(join(root, 'public/audio/demo')).map((p) => ({ ...p, name: `audio ${p.name}` })),
  ];
  console.log('Gzipped budget parts:');
  for (const p of parts) console.log(`  ${p.name.padEnd(48)} ${kb(p.bytes).padStart(10)}`);
  const total = parts.reduce((s, p) => s + p.bytes, 0);
  const t = checkTotal(total);
  console.log(`Total: ${kb(total)} of ${kb(t.limit)} (${((total / t.limit) * 100).toFixed(1)}%)`);

  let failed = false;
  if (!t.ok) {
    console.error(`FAIL: gzipped total ${kb(total)} exceeds the 2 MB budget`);
    failed = true;
  }

  const tooBig = oversizedTracks(trackParts);
  for (const name of tooBig) console.error(`FAIL: ${name} is over the ${kb(MAX_TRACK_BYTES)} per-track cap`);
  if (tooBig.length) failed = true;

  const routeToChunks = {};
  for (const f of listHtml(appDir)) {
    routeToChunks[routeFromHtmlPath(f)] = extractChunkUrls(readFileSync(join(appDir, f), 'utf8'));
  }
  console.log('Routes checked: ' + Object.keys(routeToChunks).sort().join(', '));
  const problems = assertRoutesNonEmpty(routeToChunks);
  for (const p of problems) console.error(`FAIL: ${p}`);
  if (problems.length) failed = true;
  const violations = checkRoutes(routeToChunks, roomChunks);
  for (const v of violations) console.error(`FAIL: ${v.message}`);
  if (violations.length) failed = true;

  if (!failed) console.log('Budget OK');
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run());
}
