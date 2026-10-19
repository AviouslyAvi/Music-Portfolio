// Room layout, shared by the collision code and the geometry builder.
// Coordinates: metres, x to the right, z toward the viewer (door end is +z,
// the far wall is -z). Yaw 0 faces -z. Pure data, no three.js.
import type { Box, PlayerState, Vec2 } from './movement';

export const ROOM_BOUNDS: Box = { minX: -2, maxX: 2, minZ: -3, maxZ: 3 };

// L-shaped walnut desk against the far wall: a main run plus a return leg.
export const DESK_MAIN: Box = { minX: -1.2, maxX: 1.6, minZ: -3, maxZ: -2.4 };
export const DESK_LEG: Box = { minX: 1.1, maxX: 1.6, minZ: -2.4, maxZ: -1.6 };
// Speakers on stands flanking the desk (footprint of stand and cabinet).
export const SPEAKER_LEFT: Box = { minX: -1.8, maxX: -1.4, minZ: -2.95, maxZ: -2.55 };
export const SPEAKER_RIGHT: Box = { minX: 1.7, maxX: 2, minZ: -2.95, maxZ: -2.55 };

// Not solids: the shaggy rug is walkable, and the two floating shelves hang
// above head height, so neither is in SOLIDS. A chair is also left out so the
// space in front of the desk stays free.
export const RUG: Box = { minX: -1.2, maxX: 1.2, minZ: -0.8, maxZ: 1.4 };

export const SOLIDS: Box[] = [DESK_MAIN, DESK_LEG, SPEAKER_LEFT, SPEAKER_RIGHT];

export const START: PlayerState = { pos: { x: 0, z: 2.2 }, yaw: 0 };

// Points on the desk surface.
export const IPOD_POS: Vec2 = { x: -0.5, z: -2.7 };
export const COMPUTER_POS: Vec2 = { x: 0.7, z: -2.7 };

export const INTERACT_RADIUS = 1.4;

/** Closest interactable within INTERACT_RADIUS. An exact tie goes to 'ipod'. */
export function nearestInteractable(p: Vec2): 'ipod' | 'computer' | null {
  const di = Math.hypot(p.x - IPOD_POS.x, p.z - IPOD_POS.z);
  const dc = Math.hypot(p.x - COMPUTER_POS.x, p.z - COMPUTER_POS.z);
  if (di <= dc) return di <= INTERACT_RADIUS ? 'ipod' : null;
  return dc <= INTERACT_RADIUS ? 'computer' : null;
}
