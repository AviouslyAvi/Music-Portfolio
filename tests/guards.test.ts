// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

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

const textFiles = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'public'))].filter((f) =>
  TEXT_EXT.has(extname(f)),
);
// Test files may mention forbidden terms in order to assert against them.
const sourceFiles = textFiles.filter((f) => !/\.test\.tsx?$/.test(f));
const codeFiles = sourceFiles.filter((f) => /\.(css|ts|tsx)$/.test(f));
const contentFiles = sourceFiles.filter((f) => relative(ROOT, f).startsWith(join('src', 'content') + '/'));

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

describe('content guards', () => {
  it('never mentions the Jam Room or remote recording', () => {
    expect(offenders(sourceFiles, /jam[ -]?room|remote[ -]?record/i)).toEqual([]);
  });
  it('uses no pure white', () => {
    expect(offenders(codeFiles, /#fff\b|#ffffff|(?<![-\w])white(?![-\w])|rgb\(255,\s*255,\s*255\)/i)).toEqual([]);
  });
  it('uses no emoji', () => {
    expect(offenders(sourceFiles, /\p{Extended_Pictographic}/u)).toEqual([]);
  });
  it('has no exclamation marks in src/content', () => {
    expect(offenders(contentFiles, /!/)).toEqual([]);
  });
  it('makes no Windows claim in src/content', () => {
    expect(offenders(contentFiles, /windows/i)).toEqual([]);
  });
  it('makes no real-time claim in src/content', () => {
    expect(offenders(contentFiles, /real-?time/i)).toEqual([]);
  });
});
