import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs module without types
import { gzipSize, findRoomChunks, checkRoutes, extractChunkUrls, routeFromHtmlPath, checkTotal, BUDGET_BYTES, assertRoutesNonEmpty, run } from './check-budget.mjs';

describe('gzipSize', () => {
  it('shrinks repetitive data and is positive', () => {
    const size = gzipSize(Buffer.from('a'.repeat(10000)));
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(200);
  });
});

describe('findRoomChunks', () => {
  it('returns only chunks containing WebGLRenderer', () => {
    const map = { 'a.js': 'function x(){}', 'b.js': 'class WebGLRenderer{}', 'c.js': 'other' };
    expect(findRoomChunks(map)).toEqual(['b.js']);
  });
  it('returns empty when none match', () => {
    expect(findRoomChunks({ 'a.js': 'nothing' })).toEqual([]);
  });
});

describe('checkRoutes', () => {
  const room = ['room.js'];
  it('passes when no route includes a room chunk', () => {
    expect(checkRoutes({ '/': ['a.js'], '/services': ['a.js', 'b.js'] }, room)).toEqual([]);
  });
  it('reports the route and chunk for a non-home route', () => {
    const v = checkRoutes({ '/': ['a.js'], '/services': ['a.js', 'room.js'] }, room);
    expect(v).toHaveLength(1);
    expect(v[0].route).toBe('/services');
    expect(v[0].chunk).toBe('room.js');
    expect(v[0].message).toContain('/services');
  });
  it('also reports the home route if it statically includes the room chunk', () => {
    const v = checkRoutes({ '/': ['room.js'] }, room);
    expect(v[0].route).toBe('/');
    expect(v[0].message).toContain('dynamic');
  });
});

describe('extractChunkUrls', () => {
  it('finds script, preload and inline chunk references once each', () => {
    const html = '<script src="/_next/static/chunks/a.js"></script><link rel="preload" as="script" href="/_next/static/chunks/b.js"/> "static/chunks/a.js" <link href="/_next/static/chunks/s.css">';
    expect(extractChunkUrls(html).sort()).toEqual(['a.js', 'b.js']);
  });
});

describe('routeFromHtmlPath', () => {
  it('maps index to / and names to /name', () => {
    expect(routeFromHtmlPath('index.html')).toBe('/');
    expect(routeFromHtmlPath('services.html')).toBe('/services');
  });
});

describe('checkTotal', () => {
  it('fails over 2 MB and passes at or under', () => {
    expect(BUDGET_BYTES).toBe(2 * 1024 * 1024);
    expect(checkTotal(BUDGET_BYTES + 1).ok).toBe(false);
    expect(checkTotal(BUDGET_BYTES).ok).toBe(true);
  });
});

describe('nested route mapping', () => {
  it('maps nested html paths', () => {
    expect(routeFromHtmlPath('work/index.html')).toBe('/work');
    expect(routeFromHtmlPath('work/slug.html')).toBe('/work/slug');
    expect(routeFromHtmlPath('a/b/index.html')).toBe('/a/b');
  });
});

describe('assertRoutesNonEmpty', () => {
  it('fails on an empty route list', () => {
    expect(assertRoutesNonEmpty({})).toHaveLength(1);
  });
  it('names a route with zero chunks', () => {
    const p = assertRoutesNonEmpty({ '/': ['a.js'], '/about': [] });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('/about');
  });
  it('fails when / is missing', () => {
    expect(assertRoutesNonEmpty({ '/about': ['a.js'] }).join()).toContain('Route / is missing');
  });
  it('passes a healthy set', () => {
    expect(assertRoutesNonEmpty({ '/': ['a.js'], '/about': ['a.js'] })).toEqual([]);
  });
});

describe('run exit paths', () => {
  const tmp = () => mkdtempSync(join(tmpdir(), 'budget-'));
  it('exits 1 when there is no build', () => {
    expect(run(tmp())).toBe(1);
  });
  it('exits 1 when no chunk contains WebGLRenderer', () => {
    const root = tmp();
    mkdirSync(join(root, '.next/static/chunks'), { recursive: true });
    mkdirSync(join(root, '.next/server/app'), { recursive: true });
    writeFileSync(join(root, '.next/static/chunks/a.js'), 'nothing');
    writeFileSync(join(root, '.next/server/app/index.html'), '<script src="/_next/static/chunks/a.js"></script>');
    expect(run(root)).toBe(1);
  });
});
