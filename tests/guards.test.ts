// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { JAM_REMOTE, PURE_WHITE, EMOJI, EXCLAMATION, WINDOWS, REALTIME } from './guard-patterns';

const ROOT = join(__dirname, '..');
const TEXT_EXT = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.txt', '.html', '.svg']);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const allFiles = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'public'))];
const textFiles = allFiles.filter((f) =>
  TEXT_EXT.has(extname(f)),
);
// Test files may mention forbidden terms in order to assert against them.
const sourceFiles = textFiles.filter((f) => !/\.test\.tsx?$/.test(f));
const codeFiles = sourceFiles.filter((f) => /\.(css|ts|tsx)$/.test(f));
const contentFiles = sourceFiles.filter((f) => relative(ROOT, f).split(sep).slice(0, 2).join('/') === 'src/content');

function offenders(files: string[], re: RegExp): string[] {
  return files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
}

describe('design tokens', () => {
  it('globals.css defines the palette', () => {
    const css = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8');
    for (const t of ['--charcoal: #23262a', '--charcoal-2: #2d3136', '--walnut: #5b3f2c', '--lamp: #e9a85f', '--text: #efe6d8', '--muted: #b9ad9c', '--accent-maroon: #6e2330']) {
      expect(css).toContain(t);
    }
  });
});

describe('guard patterns can fail', () => {
  it('pure white', () => {
    for (const bad of ['color: white', 'white;', '#fff', '#FFFFFF', '0xffffff', 'rgb(255, 255, 255)']) expect(PURE_WHITE.test(bad)).toBe(true);
    for (const ok of ['white-space: nowrap', 'whitespace', 'off-white', '#fffaf0', '0xffffff0']) expect(PURE_WHITE.test(ok)).toBe(false);
  });
  it('emoji', () => {
    expect(EMOJI.test('hello \u{1F680}')).toBe(true);
    for (const ok of ['\u00A9 AVIOUS', '\u00AE', '\u2122', 'plain']) expect(EMOJI.test(ok)).toBe(false);
  });
  it('jam room / remote recording', () => {
    for (const bad of ['Jam Room', 'jamroom', 'jam-room', 'jam_room', 'Remote Recording', 'remote-record', 'remoterecord']) expect(JAM_REMOTE.test(bad)).toBe(true);
    expect(JAM_REMOTE.test('jam session')).toBe(false);
    expect(JAM_REMOTE.test('jam.room')).toBe(false);
  });
  it('windows and real-time', () => {
    expect(WINDOWS.test('Works on Windows')).toBe(true);
    expect(WINDOWS.test('mac only')).toBe(false);
    for (const bad of ['real-time', 'Real time', 'realtime', 'real_time']) expect(REALTIME.test(bad)).toBe(true);
    expect(REALTIME.test('really timely')).toBe(false);
  });
  it('exclamation', () => {
    expect(EXCLAMATION.test('Hello!')).toBe(true);
    expect(EXCLAMATION.test('Hello.')).toBe(false);
  });
});

describe('content guards', () => {
  it('scans a non-empty src/content (guards are not vacuous)', () => {
    expect(contentFiles.length).toBeGreaterThan(0);
  });
  it('never mentions the Jam Room or remote recording', () => {
    expect(offenders(sourceFiles, JAM_REMOTE)).toEqual([]);
  });
  it('has no jam-room or remote-recording filenames', () => {
    expect(allFiles.map((f) => relative(ROOT, f)).filter((f) => JAM_REMOTE.test(f))).toEqual([]);
  });
  it('uses no pure white', () => {
    expect(offenders(codeFiles, PURE_WHITE)).toEqual([]);
  });
  it('uses no emoji', () => {
    expect(offenders(sourceFiles, EMOJI)).toEqual([]);
  });
  it('has no exclamation marks in src/content', () => {
    expect(offenders(contentFiles, EXCLAMATION)).toEqual([]);
  });
  it('makes no Windows claim in src/content', () => {
    expect(offenders(contentFiles, WINDOWS)).toEqual([]);
  });
  it('makes no real-time claim in src/content', () => {
    expect(offenders(contentFiles, REALTIME)).toEqual([]);
  });
});

describe('premonition is listen only', () => {
  const premonitionFiles = sourceFiles.filter((f) => relative(ROOT, f).split(sep).slice(0, 2).join('/') === 'src/premonition');
  it('scans the plugin sources (guard is not vacuous)', () => {
    expect(premonitionFiles.length).toBeGreaterThan(0);
  });
  it('never offers a download, a blob URL or a drag-out', () => {
    expect(offenders(premonitionFiles, /\bdownload\b|createObjectURL|blob:|draggable|DownloadURL/i)).toEqual([]);
  });
});
