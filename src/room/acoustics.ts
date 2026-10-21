// What the room sounds like, worked out from its size. Pure data and maths so it
// can be tested without a browser: audioEngine turns roomImpulse() into the
// convolution reverb.
import { ROOM_BOUNDS, ROOM_HEIGHT, SPEAKERS, START } from './layout';

const SPEED_OF_SOUND = 343; // m/s
const EAR_OFFSET = 0.09; // listener's ears are this far either side of the head centre

const W = ROOM_BOUNDS.maxX - ROOM_BOUNDS.minX;
const D = ROOM_BOUNDS.maxZ - ROOM_BOUNDS.minZ;
const H = ROOM_HEIGHT;

// Mid-frequency absorption coefficients (fraction of sound energy a surface soaks up).
const ALPHA = {
  floor: 0.1, // sealed wood
  rug: 0.35, // the shaggy rug
  ceiling: 0.1,
  slatWall: 0.4, // slats over an absorbent backing
  sideWall: 0.08, // painted plaster with a window and shelves
  doorWall: 0.06,
} as const;
const RUG_AREA = 2.4 * 2.2;
// Chair, books, posters, plants, the keyboard, a person: soft things in a small room.
const SOFT_FURNISHINGS_SABINS = 4.5;

const area = {
  floor: W * D,
  ceiling: W * D,
  slatWall: W * H, // far wall
  doorWall: W * H,
  sideWalls: 2 * D * H,
};

/** Total absorption in sabins (square metres of perfectly absorbing surface). */
const ABSORPTION =
  (area.floor - RUG_AREA) * ALPHA.floor +
  RUG_AREA * ALPHA.rug +
  area.ceiling * ALPHA.ceiling +
  area.slatWall * ALPHA.slatWall +
  area.doorWall * ALPHA.doorWall +
  area.sideWalls * ALPHA.sideWall +
  SOFT_FURNISHINGS_SABINS;

const VOLUME = W * D * H;

export const ROOM_ACOUSTICS = {
  volume: VOLUME,
  absorption: ABSORPTION,
  /** Sabine: time for the reverb to fall 60 dB. About half a second for this furnished 4 x 6 x 2.7 m room. */
  rt60: (0.161 * VOLUME) / ABSORPTION,
} as const;

type Image = { delay: number; gain: number; side: number };

/** First-order reflections off the six surfaces for a speaker at the middle of the pair and a listener at the start pose. */
function earlyReflections(): Image[] {
  const src = { x: (SPEAKERS[0].x + SPEAKERS[1].x) / 2, y: SPEAKERS[0].y, z: SPEAKERS[0].z };
  const ear = { x: START.pos.x, y: 1.6, z: START.pos.z };
  const direct = Math.hypot(src.x - ear.x, src.y - ear.y, src.z - ear.z);
  const walls: Array<{ image: { x: number; y: number; z: number }; alpha: number }> = [
    { image: { ...src, x: 2 * ROOM_BOUNDS.minX - src.x }, alpha: ALPHA.sideWall },
    { image: { ...src, x: 2 * ROOM_BOUNDS.maxX - src.x }, alpha: ALPHA.sideWall },
    { image: { ...src, z: 2 * ROOM_BOUNDS.maxZ - src.z }, alpha: ALPHA.doorWall },
    { image: { ...src, y: -src.y }, alpha: ALPHA.floor },
    { image: { ...src, y: 2 * H - src.y }, alpha: ALPHA.ceiling },
  ];
  return walls.map(({ image, alpha }) => {
    const path = Math.hypot(image.x - ear.x, image.y - ear.y, image.z - ear.z);
    return {
      delay: (path - direct) / SPEED_OF_SOUND, // after the direct sound
      gain: Math.sqrt(1 - alpha) * (direct / path),
      side: Math.sign(image.x - ear.x) || 1,
    };
  });
}

/**
 * Impulse response of this room as two channels (left and right ear), deterministic.
 * Discrete early reflections from the real walls and floor, then a diffuse tail
 * that decays 60 dB in ROOM_ACOUSTICS.rt60 and darkens as it fades, because air
 * and soft surfaces soak up the highs first.
 */
export function roomImpulse(sampleRate: number): Float32Array[] {
  const rt60 = ROOM_ACOUSTICS.rt60;
  const n = Math.max(2, Math.floor(sampleRate * rt60 * 1.1));
  const early = earlyReflections();
  const channels: Float32Array[] = [];
  for (let c = 0; c < 2; c++) {
    const ear = c === 0 ? -1 : 1;
    const data = new Float32Array(n);
    // The diffuse tail: noise under an exponential envelope, fading in over 12 ms.
    let seed = (0x9e3779b9 ^ Math.imul(c + 1, 0x85ebca6b)) >>> 0;
    let lp = 0;
    for (let i = 0; i < n; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = seed / 0x80000000 - 1;
      const t = i / sampleRate;
      lp += (0.12 + 0.45 * Math.exp(-t / 0.22)) * (noise - lp);
      const fadeIn = Math.min(1, t / 0.012);
      data[i] = lp * Math.exp((-6.908 * t) / rt60) * fadeIn * 0.5;
    }
    // Early reflections, a touch louder on the ear nearer the wall they came off.
    for (const e of early) {
      const at = Math.floor(e.delay * sampleRate) + 24;
      if (at < 0 || at + 4 >= n) continue;
      const g = e.gain * (e.side === ear ? 1 : 0.8);
      data[at] += g * 0.6;
      data[at + 1] += g * 0.3;
      data[at + 2] += g * 0.1;
    }
    channels.push(data);
  }
  return channels;
}
