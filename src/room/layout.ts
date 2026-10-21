// Room layout, shared by the collision code and the geometry builder.
// Coordinates: metres, x to the right, z toward the viewer (door end is +z,
// the far wall is -z). Yaw 0 faces -z. Pure data, no three.js.
import { normalizeYaw, type Box, type PlayerState, type Vec2 } from './movement';

export const ROOM_BOUNDS: Box = { minX: -2, maxX: 2, minZ: -3, maxZ: 3 };

export type Vec3 = { x: number; y: number; z: number };

// Straight walnut desk against the far wall, centred on the room's middle line (x = 0).
export const DESK: Box = { minX: -0.75, maxX: 0.75, minZ: -3, maxZ: -2.4 };
// Speakers on stands, one each side of the desk, flush against it (footprint of stand and cabinet).
export const SPEAKER_LEFT: Box = { minX: -1.05, maxX: -0.75, minZ: -2.95, maxZ: -2.55 };
export const SPEAKER_RIGHT: Box = { minX: 0.75, maxX: 1.05, minZ: -2.95, maxZ: -2.55 };
// 88-key keyboard on a stand, left of the desk, running out from the far wall.
// Its keys face the room (+x) so the player plays from the lane beside it.
export const KEYBOARD_STAND: Box = { minX: -2, maxX: -1.65, minZ: -3, maxZ: -1.7 };

/** Height of the speaker cabinet centre (the tweeter), metres. */
export const TWEETER_Y = 1.1;
const centre = (b: Box) => ({ x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 });
/** Cabinet centres: x, z from the footprints, so audio and geometry cannot drift apart. */
export const SPEAKERS: readonly [Vec3, Vec3] = [
  { ...centre(SPEAKER_LEFT), y: TWEETER_Y },
  { ...centre(SPEAKER_RIGHT), y: TWEETER_Y },
];

// Not solids: the shaggy rug is walkable, and the two floating shelves hang
// above head height, so neither is in SOLIDS. A chair is also left out so the
// space in front of the desk stays free.
export const RUG: Box = { minX: -1.2, maxX: 1.2, minZ: -0.8, maxZ: 1.4 };

export const SOLIDS: Box[] = [DESK, SPEAKER_LEFT, SPEAKER_RIGHT, KEYBOARD_STAND];

export const START: PlayerState = { pos: { x: 0, z: 2.2 }, yaw: 0 };

// Points on the desk surface.
export type Interactable = 'ipod' | 'computer';

export const IPOD_POS: Vec2 = { x: -0.4, z: -2.7 };
export const COMPUTER_POS: Vec2 = { x: 0.3, z: -2.7 };

export const INTERACT_RADIUS = 1.4;

/** Camera when seated at the computer (yaw 0 faces the desk). */
export const SEAT_POSE = { x: COMPUTER_POS.x, z: -1.85, yaw: 0, pitch: -0.5 };

/** Closest interactable within INTERACT_RADIUS. An exact tie goes to 'ipod'. */
export function nearestInteractable(p: Vec2): 'ipod' | 'computer' | null {
  const di = Math.hypot(p.x - IPOD_POS.x, p.z - IPOD_POS.z);
  const dc = Math.hypot(p.x - COMPUTER_POS.x, p.z - COMPUTER_POS.z);
  if (di <= dc) return di <= INTERACT_RADIUS ? 'ipod' : null;
  return dc <= INTERACT_RADIUS ? 'computer' : null;
}

/**
 * Yaw that turns a cabinet facing +z so it points from `from` toward `to`,
 * wrapped to (-PI, PI]. Returns 0 when the two coincide or an input is not finite.
 */
export function aimYaw(from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || Math.hypot(dx, dz) < 1e-9) return 0;
  return normalizeYaw(Math.atan2(dx, dz));
}
