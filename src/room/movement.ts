// Pure player movement and collision. No three.js, React or DOM.
// Coordinates: x right, z toward the viewer, metres. Yaw 0 faces -z; positive
// yaw turns left (counter-clockwise seen from above), so at yaw = +PI/2 the
// player faces -x. Forward vector = (-sin yaw, -cos yaw); right = (cos yaw, -sin yaw).
export type Vec2 = { x: number; z: number };
export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };
export type PlayerState = { pos: Vec2; yaw: number };
// Each -1..1. turn > 0 turns left.
export type MoveInput = { forward: number; strafe: number; turn: number };

export const PLAYER_RADIUS = 0.3;
export const WALK_SPEED = 1.6;
export const TURN_SPEED = 1.8;

const MAX_DT = 1; // a stalled tab must not teleport the player
const MAX_STEP = 0.05; // metres per sub-step, well under any solid's thickness

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Wrap an angle into (-PI, PI]. */
export function normalizeYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) return 0;
  const tau = Math.PI * 2;
  let y = yaw % tau;
  if (y > Math.PI) y -= tau;
  else if (y <= -Math.PI) y += tau;
  return y;
}

function inside(b: Box, x: number, z: number, r: number): boolean {
  return x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r;
}

export function stepPlayer(s: PlayerState, i: MoveInput, dt: number, solids: Box[], bounds: Box): PlayerState {
  const r = PLAYER_RADIUS;
  const t = Number.isFinite(dt) ? clamp(dt, 0, MAX_DT) : 0;
  const f = clamp(Number.isFinite(i.forward) ? i.forward : 0, -1, 1);
  const st = clamp(Number.isFinite(i.strafe) ? i.strafe : 0, -1, 1);
  const tn = clamp(Number.isFinite(i.turn) ? i.turn : 0, -1, 1);

  let yaw = normalizeYaw(s.yaw + tn * TURN_SPEED * t);
  let x = s.pos.x;
  let z = s.pos.z;

  // Diagonal input is normalised so it is never faster than WALK_SPEED.
  const mag = Math.hypot(f, st);
  const scale = mag > 1 ? 1 / mag : 1;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const vx = (-sin * f + cos * st) * scale * WALK_SPEED;
  const vz = (-cos * f - sin * st) * scale * WALK_SPEED;

  const dist = Math.hypot(vx, vz) * t;
  const n = dist > 0 ? Math.ceil(dist / MAX_STEP) : 0;
  for (let k = 0; k < n; k++) {
    const dx = (vx * t) / n;
    const dz = (vz * t) / n;

    // Axis-separated: resolve x, then z, so the player slides along surfaces.
    x = clamp(x + dx, bounds.minX + r, bounds.maxX - r);
    for (const b of solids) {
      if (inside(b, x, z, r)) x = dx > 0 ? b.minX - r : dx < 0 ? b.maxX + r : x;
    }
    z = clamp(z + dz, bounds.minZ + r, bounds.maxZ - r);
    for (const b of solids) {
      if (inside(b, x, z, r)) z = dz > 0 ? b.minZ - r : dz < 0 ? b.maxZ + r : z;
    }
  }
  return { pos: { x, z }, yaw };
}
