import { describe, it, expect } from 'vitest';
import * as L from './layout';
import {
  ROOM_BOUNDS, SOLIDS, START, IPOD_POS, COMPUTER_POS, INTERACT_RADIUS, nearestInteractable,
  DESK, SPEAKER_LEFT, SPEAKER_RIGHT, KEYBOARD_STAND, SPEAKERS, TWEETER_Y, SEAT_POSE,
} from './layout';
import type { Box } from './movement';
import { ROOM_COLORS } from './palette';
import { PLAYER_RADIUS } from './movement';

const inSolid = (x: number, z: number, r = PLAYER_RADIUS) =>
  SOLIDS.some((b) => x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r);

describe('layout', () => {
  it('is a narrow room about 4 m by 6 m', () => {
    expect(ROOM_BOUNDS.maxX - ROOM_BOUNDS.minX).toBe(4);
    expect(ROOM_BOUNDS.maxZ - ROOM_BOUNDS.minZ).toBe(6);
  });
  it('START is inside bounds, clear of solids, faces -z', () => {
    expect(START.pos.x).toBeGreaterThan(ROOM_BOUNDS.minX + PLAYER_RADIUS);
    expect(START.pos.z).toBeLessThan(ROOM_BOUNDS.maxZ - PLAYER_RADIUS);
    expect(inSolid(START.pos.x, START.pos.z)).toBe(false);
    expect(START.yaw).toBe(0);
  });
  it('solids sit inside the room', () => {
    for (const b of SOLIDS) {
      expect(b.minX).toBeGreaterThanOrEqual(ROOM_BOUNDS.minX);
      expect(b.maxX).toBeLessThanOrEqual(ROOM_BOUNDS.maxX);
      expect(b.minZ).toBeGreaterThanOrEqual(ROOM_BOUNDS.minZ);
      expect(b.maxZ).toBeLessThanOrEqual(ROOM_BOUNDS.maxZ);
    }
  });
  it('interactables are on the desk, not walkable, but reachable from a walkable spot', () => {
    for (const p of [IPOD_POS, COMPUTER_POS]) {
      expect(SOLIDS.some((b) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ)).toBe(true);
    }
    const spot = { x: 0.1, z: -2.1 };
    expect(inSolid(spot.x, spot.z)).toBe(false);
    expect(Math.hypot(spot.x - IPOD_POS.x, spot.z - IPOD_POS.z)).toBeLessThanOrEqual(INTERACT_RADIUS);
    expect(Math.hypot(spot.x - COMPUTER_POS.x, spot.z - COMPUTER_POS.z)).toBeLessThanOrEqual(INTERACT_RADIUS);
  });
  it('nearestInteractable picks ipod, computer, or null', () => {
    expect(nearestInteractable(IPOD_POS)).toBe('ipod');
    expect(nearestInteractable(COMPUTER_POS)).toBe('computer');
    expect(nearestInteractable(START.pos)).toBeNull();
    expect(nearestInteractable({ x: -0.6, z: -2.1 })).toBe('ipod');
    expect(nearestInteractable({ x: 0.8, z: -2.1 })).toBe('computer');
  });
  it('an exact tie goes to the ipod', () => {
    const mid = { x: (IPOD_POS.x + COMPUTER_POS.x) / 2, z: -2.1 };
    expect(nearestInteractable(mid)).toBe('ipod');
  });
  it('palette has no pure white and no duplicates of white', () => {
    for (const c of Object.values(ROOM_COLORS)) {
      expect(c).not.toBe(0xffffff);
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
    expect(ROOM_COLORS.charcoal).toBe(0x23262a);
    expect(ROOM_COLORS.walnut).toBe(0x5b3f2c);
    expect(ROOM_COLORS.lamp).toBe(0xe9a85f);
    expect(ROOM_COLORS.offWhite).toBe(0xefe6d8);
  });

  it('has no desk leg export', () => {
    expect('DESK_LEG' in L).toBe(false);
    expect('DESK_MAIN' in L).toBe(false);
  });

  // Boxes may touch (flush against each other or a wall) but never overlap.
  const overlap = (a: Box, b: Box) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

  it('solids sit inside the room and none overlap each other', () => {
    expect(SOLIDS).toEqual([DESK, SPEAKER_LEFT, SPEAKER_RIGHT, KEYBOARD_STAND]);
    for (let i = 0; i < SOLIDS.length; i++)
      for (let j = i + 1; j < SOLIDS.length; j++) expect(overlap(SOLIDS[i], SOLIDS[j])).toBe(false);
  });

  it('keyboard stand is left of the desk and its long side runs along z', () => {
    const k = KEYBOARD_STAND;
    expect(k.maxZ - k.minZ).toBeGreaterThan(k.maxX - k.minX);
    expect(k.maxX).toBeLessThanOrEqual(DESK.minX);
    expect(k.maxZ - k.minZ).toBeGreaterThanOrEqual(1.25);
  });

  it('every gap between solids, and between a solid and a wall, is closed or wide enough to walk', () => {
    // A gap is either flush/decor-thin (at most 0.1 m, nobody walks there) or at
    // least the player's diameter; anything between is a pinch the player jams in.
    const open = 2 * PLAYER_RADIUS;
    const okGap = (g: number) => g <= 0.1 || g >= open - 1e-9;
    const b = ROOM_BOUNDS;
    for (const s of SOLIDS) {
      // The strip from a solid to a wall, unless another solid already fills it.
      const strips: [Box, number][] = [
        [{ minX: b.minX, maxX: s.minX, minZ: s.minZ, maxZ: s.maxZ }, s.minX - b.minX],
        [{ minX: s.maxX, maxX: b.maxX, minZ: s.minZ, maxZ: s.maxZ }, b.maxX - s.maxX],
        [{ minX: s.minX, maxX: s.maxX, minZ: b.minZ, maxZ: s.minZ }, s.minZ - b.minZ],
        [{ minX: s.minX, maxX: s.maxX, minZ: s.maxZ, maxZ: b.maxZ }, b.maxZ - s.maxZ],
      ];
      for (const [strip, g] of strips) {
        if (SOLIDS.some((o) => o !== s && overlap(o, strip))) continue;
        expect(okGap(g)).toBe(true);
      }
    }
    const zOverlap = (a: Box, c: Box) => a.minZ < c.maxZ && a.maxZ > c.minZ;
    const xOverlap = (a: Box, c: Box) => a.minX < c.maxX && a.maxX > c.minX;
    for (let i = 0; i < SOLIDS.length; i++)
      for (let j = 0; j < SOLIDS.length; j++) {
        if (i === j) continue;
        const a = SOLIDS[i], c = SOLIDS[j];
        if (zOverlap(a, c) && c.minX >= a.maxX) expect(okGap(c.minX - a.maxX)).toBe(true);
        if (xOverlap(a, c) && c.minZ >= a.maxZ) expect(okGap(c.minZ - a.maxZ)).toBe(true);
      }
  });

  it('speakers flank the desk', () => {
    expect(SPEAKERS[0].x).toBeLessThan(DESK.minX);
    expect(SPEAKERS[1].x).toBeGreaterThan(DESK.maxX);
    expect(SPEAKERS[0].x).toBeCloseTo((SPEAKER_LEFT.minX + SPEAKER_LEFT.maxX) / 2);
    expect(SPEAKERS[1].z).toBeCloseTo((SPEAKER_RIGHT.minZ + SPEAKER_RIGHT.maxZ) / 2);
  });

  it('SPEAKERS y equals TWEETER_Y', () => {
    expect(TWEETER_Y).toBe(1.1);
    for (const s of SPEAKERS) expect(s.y).toBe(TWEETER_Y);
  });

  it('SEAT_POSE is walkable, inside bounds, faces the desk and is within reach of the computer', () => {
    expect(inSolid(SEAT_POSE.x, SEAT_POSE.z)).toBe(false);
    expect(SEAT_POSE.x).toBeGreaterThan(ROOM_BOUNDS.minX + PLAYER_RADIUS);
    expect(SEAT_POSE.x).toBeLessThan(ROOM_BOUNDS.maxX - PLAYER_RADIUS);
    expect(SEAT_POSE.z).toBeGreaterThan(ROOM_BOUNDS.minZ);
    expect(SEAT_POSE.z).toBeLessThan(ROOM_BOUNDS.maxZ - PLAYER_RADIUS);
    expect(SEAT_POSE.yaw).toBe(0);
    expect(Math.hypot(SEAT_POSE.x - COMPUTER_POS.x, SEAT_POSE.z - COMPUTER_POS.z)).toBeLessThanOrEqual(INTERACT_RADIUS);
  });
});
