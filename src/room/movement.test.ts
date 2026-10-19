import { describe, it, expect } from 'vitest';
import { stepPlayer, normalizeYaw, PLAYER_RADIUS, WALK_SPEED, TURN_SPEED, type Box, type PlayerState } from './movement';
import { ROOM_BOUNDS, SOLIDS, START } from './layout';

const NONE = { forward: 0, strafe: 0, turn: 0 };
const open: Box = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
const at = (x: number, z: number, yaw = 0): PlayerState => ({ pos: { x, z }, yaw });
const hit = (p: PlayerState, boxes: Box[]) =>
  boxes.some((b) => p.pos.x > b.minX - PLAYER_RADIUS && p.pos.x < b.maxX + PLAYER_RADIUS && p.pos.z > b.minZ - PLAYER_RADIUS && p.pos.z < b.maxZ + PLAYER_RADIUS);
const outside = (p: PlayerState, b: Box) =>
  p.pos.x < b.minX + PLAYER_RADIUS - 1e-9 || p.pos.x > b.maxX - PLAYER_RADIUS + 1e-9 || p.pos.z < b.minZ + PLAYER_RADIUS - 1e-9 || p.pos.z > b.maxZ - PLAYER_RADIUS + 1e-9;

describe('stepPlayer', () => {
  it('forward at yaw 0 moves along -z by WALK_SPEED*dt', () => {
    const r = stepPlayer(at(0, 0), { ...NONE, forward: 1 }, 0.5, [], open);
    expect(r.pos.x).toBeCloseTo(0);
    expect(r.pos.z).toBeCloseTo(-WALK_SPEED * 0.5);
  });
  it('yaw convention: positive turn is left, forward then moves toward -x', () => {
    const t = stepPlayer(at(0, 0), { ...NONE, turn: 1 }, 0.1, [], open);
    expect(t.yaw).toBeCloseTo(TURN_SPEED * 0.1);
    const r = stepPlayer(at(0, 0, Math.PI / 2), { ...NONE, forward: 1 }, 0.5, [], open);
    expect(r.pos.x).toBeCloseTo(-WALK_SPEED * 0.5);
    expect(r.pos.z).toBeCloseTo(0);
  });
  it('strafe 1 at yaw 0 moves toward +x', () => {
    const r = stepPlayer(at(0, 0), { ...NONE, strafe: 1 }, 0.5, [], open);
    expect(r.pos.x).toBeCloseTo(WALK_SPEED * 0.5);
    expect(r.pos.z).toBeCloseTo(0);
  });
  it('diagonal is not faster than WALK_SPEED', () => {
    const r = stepPlayer(at(0, 0, 0.7), { forward: 1, strafe: 1, turn: 0 }, 0.5, [], open);
    expect(Math.hypot(r.pos.x, r.pos.z)).toBeCloseTo(WALK_SPEED * 0.5, 5);
  });
  it('dt = 0 changes nothing', () => {
    const s = at(0.3, 1.1, 0.4);
    expect(stepPlayer(s, { forward: 1, strafe: 1, turn: 1 }, 0, SOLIDS, ROOM_BOUNDS)).toEqual(s);
  });
  it('negative, NaN and Infinity dt are harmless', () => {
    const s = at(0, 0);
    for (const dt of [-1, NaN, -Infinity]) expect(stepPlayer(s, { ...NONE, forward: 1 }, dt, [], open)).toEqual(s);
    const r = stepPlayer(s, { ...NONE, forward: 1 }, Infinity, [], open);
    expect(Number.isFinite(r.pos.z)).toBe(true);
  });
  it('stops at bound minus PLAYER_RADIUS', () => {
    const r = stepPlayer(at(0, 0), { ...NONE, forward: 1 }, 1, [], { minX: -5, maxX: 5, minZ: -1, maxZ: 5 });
    expect(r.pos.z).toBeCloseTo(-1 + PLAYER_RADIUS);
  });
  it('slides along a wall when walking diagonally into it', () => {
    const b: Box = { minX: -5, maxX: 5, minZ: -1, maxZ: 5 };
    const r = stepPlayer(at(0, -0.65, Math.PI / 4), { ...NONE, forward: 1 }, 0.5, [], b);
    expect(r.pos.z).toBeCloseTo(-1 + PLAYER_RADIUS);
    expect(r.pos.x).toBeLessThan(0); // moved along the wall, not stuck
  });
  it('slides along a solid instead of sticking', () => {
    const wall: Box = { minX: -1, maxX: 1, minZ: -1, maxZ: -0.5 };
    // facing diagonally up-left (-x, -z), approaching the wall's +z face
    const r = stepPlayer(at(0.5, 0.0, Math.PI / 4), { ...NONE, forward: 1 }, 1, [wall], open);
    expect(hit(r, [wall])).toBe(false);
    expect(r.pos.z).toBeGreaterThanOrEqual(wall.maxZ + PLAYER_RADIUS - 1e-9);
    expect(r.pos.x).toBeLessThan(0.5);
  });
  it('a 1 s dt cannot tunnel through a 0.3 m solid', () => {
    const thin: Box = { minX: -2, maxX: 2, minZ: -0.55, maxZ: -0.25 };
    const r = stepPlayer(at(0, 0.5), { ...NONE, forward: 1 }, 1, [thin], open);
    expect(hit(r, [thin])).toBe(false);
    expect(r.pos.z).toBeGreaterThanOrEqual(thin.maxZ + PLAYER_RADIUS - 1e-9);
  });
  it('a huge dt never leaves the player inside a solid or out of bounds', () => {
    for (const input of [
      { forward: 1, strafe: 0, turn: 0 },
      { forward: -1, strafe: 1, turn: 0.5 },
      { forward: 1, strafe: -1, turn: -1 },
    ]) {
      for (const dt of [1, 5, 1e6]) {
        const r = stepPlayer(START, input, dt, SOLIDS, ROOM_BOUNDS);
        expect(hit(r, SOLIDS)).toBe(false);
        expect(outside(r, ROOM_BOUNDS)).toBe(false);
      }
    }
  });
  it('walking from START straight ahead is stopped by the desk, not through it', () => {
    let s = START;
    for (let k = 0; k < 200; k++) s = stepPlayer(s, { ...NONE, forward: 1 }, 1 / 60, SOLIDS, ROOM_BOUNDS);
    expect(hit(s, SOLIDS)).toBe(false);
    expect(s.pos.z).toBeCloseTo(-2.4 + PLAYER_RADIUS);
  });
  it('random walk stays legal', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    let s = START;
    for (let k = 0; k < 2000; k++) {
      s = stepPlayer(s, { forward: rnd(), strafe: rnd(), turn: rnd() }, Math.abs(rnd()) * 0.5, SOLIDS, ROOM_BOUNDS);
      expect(hit(s, SOLIDS)).toBe(false);
      expect(outside(s, ROOM_BOUNDS)).toBe(false);
    }
  });
});

describe('yaw normalization', () => {
  it('wraps into (-PI, PI]', () => {
    expect(normalizeYaw(0)).toBe(0);
    expect(normalizeYaw(Math.PI * 2 + 0.5)).toBeCloseTo(0.5);
    expect(normalizeYaw(-Math.PI * 2 - 0.5)).toBeCloseTo(-0.5);
    expect(normalizeYaw(Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeYaw(-Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeYaw(NaN)).toBe(0);
  });
  it('turning for a long time keeps yaw bounded', () => {
    let s = at(0, 0);
    for (let k = 0; k < 1000; k++) s = stepPlayer(s, { ...NONE, turn: 1 }, 0.5, [], open);
    expect(Math.abs(s.yaw)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});
