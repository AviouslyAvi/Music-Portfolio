import { describe, it, expect } from 'vitest';
import { ROOM_BOUNDS, SOLIDS, START, IPOD_POS, COMPUTER_POS, INTERACT_RADIUS, nearestInteractable } from './layout';
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
});
