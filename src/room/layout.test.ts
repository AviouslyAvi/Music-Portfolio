import { describe, it, expect } from 'vitest';
import * as L from './layout';
import {
  GUITAR_ACOUSTIC, GUITAR_ELECTRIC, GUITAR_RADIUS, PIANO, DOOR, LAMP_POS, LIGHT_SWITCH, ROOM_BOUNDS, SOLIDS, START, IPOD_POS, COMPUTER_POS, INTERACT_RADIUS, nearestInteractable,
  DESK, SPEAKER_LEFT, SPEAKER_RIGHT, KEYBOARD_STAND, SPEAKERS, TWEETER_Y, SEAT_POSE, aimYaw,
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
    expect(nearestInteractable({ x: 0.5, z: 0.5 })).toBeNull(); // the start is beside the door now
    expect(nearestInteractable({ x: -0.6, z: -2.1 })).toBe('ipod');
    expect(nearestInteractable({ x: 0.1, z: -2.1 })).toBe('computer');
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
  it('palette carries the named AVIOUS colours, all distinct, none white', () => {
    const names = ['oxblood', 'terracotta', 'sage', 'midnight', 'mustard', 'espresso', 'cotton'] as const;
    const hexes = names.map((n) => ROOM_COLORS[n]);
    for (const h of hexes) {
      expect(typeof h).toBe('number');
      expect(h).not.toBe(0xffffff);
    }
    expect(new Set(Object.values(ROOM_COLORS)).size).toBe(Object.values(ROOM_COLORS).length);
    // cotton is the lightest and still clearly off-white
    expect(ROOM_COLORS.cotton & 0xff).toBeLessThan(0xf0);
    expect(Math.max(...hexes)).toBe(ROOM_COLORS.cotton);
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

  it('aimYaw faces the listener straight on from every compass point', () => {
    // A cabinet facing +z turned by yaw faces (sin yaw, cos yaw).
    for (let deg = 0; deg < 360; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const dir = { x: Math.sin(a) * 3, z: Math.cos(a) * 3 };
      const y = aimYaw({ x: 0.4, z: -1 }, { x: 0.4 + dir.x, z: -1 + dir.z });
      expect(Math.sin(y)).toBeCloseTo(Math.sin(a), 9);
      expect(Math.cos(y)).toBeCloseTo(Math.cos(a), 9);
      expect(y).toBeGreaterThan(-Math.PI);
      expect(y).toBeLessThanOrEqual(Math.PI);
    }
    expect(aimYaw({ x: 0, z: 0 }, { x: 0, z: 5 })).toBe(0);
    expect(aimYaw({ x: 0, z: 0 }, { x: 0, z: -5 })).toBeCloseTo(Math.PI);
  });

  it('aimYaw is finite and 0 when from equals to', () => {
    expect(aimYaw({ x: 1, z: 2 }, { x: 1, z: 2 })).toBe(0);
    expect(Number.isFinite(aimYaw({ x: 1, z: 2 }, { x: 1 + 1e-300, z: 2 }))).toBe(true);
    expect(aimYaw({ x: NaN, z: 0 }, { x: 0, z: 0 })).toBe(0);
  });
});

describe('wall guitars', () => {
  it('can be reached from the lane in front of each, and the nearer one wins', () => {
    expect(nearestInteractable({ x: -1.0, z: GUITAR_ACOUSTIC.z })).toBe('acoustic');
    expect(nearestInteractable({ x: -1.0, z: GUITAR_ELECTRIC.z })).toBe('electric');
    expect(nearestInteractable({ x: -1.0, z: -0.95 })).toBe('electric'); // 0.40 from one, 0.45 from the other
    expect(nearestInteractable({ x: -1.0, z: -1.05 })).toBe('acoustic');
  });

  it('are out of reach from the middle of the room', () => {
    expect(nearestInteractable({ x: 0.5, z: 1.0 })).toBeNull();
    expect(Math.hypot(0.5 - GUITAR_ACOUSTIC.x, 1.0 - GUITAR_ACOUSTIC.z)).toBeGreaterThan(GUITAR_RADIUS);
  });

  it('hang on the left wall clear of the keyboard stand and the window', () => {
    for (const g of [GUITAR_ACOUSTIC, GUITAR_ELECTRIC]) {
      expect(g.x).toBeLessThan(-1.9);
      expect(g.z).toBeGreaterThan(-1.7 + 0.2); // beyond the stand's front edge
      expect(g.z).toBeLessThan(0.2 - 0.2); // before the window
    }
  });
});

describe('keyboard', () => {
  it('can be played from the lane beside it', () => {
    expect(nearestInteractable({ x: -1.3, z: PIANO.z })).toBe('piano');
  });
  it('sits in the middle of its stand', () => {
    expect(PIANO.x).toBeCloseTo(-1.825);
    expect(PIANO.z).toBeCloseTo(-2.35);
  });
});

describe('door, lamp and light switch', () => {
  it('the door can be used from just inside it, including where the visitor starts', () => {
    expect(nearestInteractable({ x: 0, z: 2.5 })).toBe('door');
    expect(nearestInteractable(START.pos)).toBe('door');
    expect(DOOR.z).toBe(3);
  });

  it('the switch can be reached from the lane beside the right wall', () => {
    expect(nearestInteractable({ x: 1.6, z: LIGHT_SWITCH.z })).toBe('switch');
  });

  it('the lamp can be used from beside it, where the computer or iPod are not nearer', () => {
    expect(nearestInteractable({ x: LAMP_POS.x + 0.1, z: -2.1 })).toBe('lamp');
  });

  it('the lamp, switch and door are out of reach from the middle of the room', () => {
    expect(nearestInteractable({ x: 0.5, z: 0.5 })).toBeNull();
  });
});
