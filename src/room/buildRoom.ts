// Builds the walk-in room from primitives. Pure three.js scene graph: no DOM,
// canvas or texture loading, so it runs (and is tested) in Node.
// The room is muted and dim; only the iPod and the computer screen glow.
import * as THREE from 'three';
import { ROOM_COLORS } from './palette';
import { DESK, KEYBOARD_STAND, SPEAKER_LEFT, SPEAKER_RIGHT, IPOD_POS, COMPUTER_POS } from './layout';
import {
  Kit, makeMaterials, addShell, addSlatWall, addDesk, addKeyboardStand, addSpeaker, addWindow, addShelves, addPlant,
  addGuitar, addClock, addPosters, addRug, addChair, addDeskLamp, addKeyboard88, addIpodCable, addHeadphones, type V3,
} from './furniture';

export type Room = {
  group: THREE.Group;
  ipod: THREE.Object3D;
  computer: THREE.Object3D;
  /** The computer's glowing screen plane, for the portal. */
  screen: THREE.Object3D;
  /** Detached over-ear headphones; the sequence adds and animates them. */
  headphones: THREE.Object3D;
  speakers: [THREE.Object3D, THREE.Object3D];
  triangleCount: number;
  dispose(): void;
};

export const ROOM_HEIGHT = 2.7;
export const DESK_TOP = 0.76;
const MAT_TOP = DESK_TOP + 0.005;
export const MAT_TOP_Y = MAT_TOP;

// The glow tier: everything else in the room stays below GLOW_MIN.
const GLOW_MIN = 0.9;

/** iPod leaning back on a small stand. Body, screen and click wheel all glow. */
function addIpod(k: Kit, g: THREE.Object3D): THREE.Object3D {
  const ipod = new THREE.Group();
  ipod.name = 'ipod';
  ipod.userData.interactive = 'ipod';
  ipod.position.set(IPOD_POS.x, MAT_TOP, IPOD_POS.z);
  ipod.rotation.y = 0.12; // turned a touch toward the room's centre line
  g.add(ipod);

  const stand = k.mat(0x1d1c1b, { roughness: 0.6 });
  const body = k.mat(0xcfc6b8, { emissive: 0xb8ad9c, emissiveIntensity: GLOW_MIN, roughness: 0.4 });
  const screen = k.mat(0x8fb3bd, { emissive: 0x9cc2cc, emissiveIntensity: 1.6, roughness: 0.3 });
  const wheel = k.mat(0x9d968b, { emissive: 0x8c8579, emissiveIntensity: GLOW_MIN });

  k.box(ipod, stand, [0, 0.01, 0], [0.15, 0.02, 0.09]);
  k.box(ipod, stand, [0, 0.03, -0.03], [0.15, 0.03, 0.025]);

  const lean = new THREE.Group();
  lean.position.set(0, 0.02, -0.005);
  lean.rotation.x = -0.22;
  ipod.add(lean);
  const W = 0.12, H = 0.2, D = 0.022;
  // Two crossed boxes leave the corners notched, which reads as rounded at a distance.
  const r = 0.008;
  k.box(lean, body, [0, H / 2, 0], [W, H - 2 * r, D]);
  k.box(lean, body, [0, H / 2, 0], [W - 2 * r, H, D]);
  const front = D / 2 + 0.0035;
  k.plane(lean, screen, [0, H * 0.72, front], W * 0.78, H * 0.35);
  const face: V3 = [Math.PI / 2, 0, 0];
  k.cyl(lean, wheel, 0.039, 0.039, 0.004, 24, [0, H * 0.27, D / 2], face);
  k.cyl(lean, body, 0.013, 0.013, 0.006, 16, [0, H * 0.27, D / 2 + 0.001], face);
  // Dock port on the bottom edge, where the cable plugs in.
  k.box(lean, stand, [0.035, 0, 0.004], [0.022, 0.004, 0.01]);
  const port = new THREE.Object3D();
  port.name = 'ipod-port';
  port.position.set(0.035, -0.003, 0.004);
  lean.add(port);
  return ipod;
}

/** Boxy retro monitor with a glowing screen facing the room (+z), and a keyboard. */
function addComputer(k: Kit, g: THREE.Object3D): THREE.Object3D {
  const pc = new THREE.Group();
  pc.name = 'computer';
  pc.userData.interactive = 'computer';
  pc.position.set(COMPUTER_POS.x, MAT_TOP, COMPUTER_POS.z);
  pc.rotation.y = -0.1;
  g.add(pc);

  const shell = k.mat(0x857c6e, { roughness: 0.85 });
  const bezel = k.mat(0x2a2825, { roughness: 0.7 });
  const keys = k.mat(0x6f685d);
  const screen = k.mat(0xd8b27e, { emissive: 0xe3b57a, emissiveIntensity: 1.5, roughness: 0.3 });
  const glyph = k.mat(0x6a4a2c, { emissive: 0x8a5a2e, emissiveIntensity: GLOW_MIN });

  k.box(pc, shell, [0, 0.015, -0.02], [0.26, 0.03, 0.24]);
  k.box(pc, shell, [0, 0.05, -0.02], [0.1, 0.05, 0.1]);
  // Deep CRT case: a front block and a tapered back.
  k.box(pc, shell, [0, 0.27, 0.01], [0.46, 0.38, 0.22]);
  k.box(pc, shell, [0, 0.26, -0.15], [0.34, 0.3, 0.14]);
  k.box(pc, bezel, [0, 0.285, 0.121], [0.38, 0.29, 0.004]);
  const screenPlane = k.plane(pc, screen, [0, 0.285, 0.1235], 0.34, 0.25);
  screenPlane.name = 'computer-screen';
  // A few darker lines on the screen read as a boot prompt from across the room.
  for (let i = 0; i < 4; i++) {
    const w = 0.16 - i * 0.02;
    k.plane(pc, glyph, [-0.14 + w / 2 + i * 0.012, 0.36 - i * 0.03, 0.1245], w, 0.008);
  }
  k.box(pc, bezel, [0.17, 0.11, 0.122], [0.03, 0.012, 0.003]);
  const backPort = new THREE.Object3D();
  backPort.name = 'computer-back-port';
  backPort.position.set(0, 0.14, -0.22);
  pc.add(backPort);
  // Keyboard on the mat in front.
  k.box(pc, keys, [0, 0.012, 0.25], [0.42, 0.024, 0.14], [0.06, 0, 0]);
  k.box(pc, bezel, [0, 0.026, 0.25], [0.39, 0.006, 0.11], [0.06, 0, 0]);
  return pc;
}

function countTriangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    n += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  });
  return n;
}

export function buildRoom(): Room {
  const k = new Kit();
  const m = makeMaterials(k);
  const group = new THREE.Group();
  group.name = 'room';

  addShell(k, group, m, ROOM_HEIGHT);
  addSlatWall(k, group, m, ROOM_HEIGHT);
  addDesk(k, group, m, DESK, DESK_TOP);
  addKeyboardStand(k, group, m, KEYBOARD_STAND);
  addRug(k, group, m);
  addWindow(k, group, m);
  addShelves(k, group, m);
  addGuitar(k, group, m);
  addClock(k, group, m, [1.985, 1.85, 0.5]);
  addPosters(k, group, m);
  addChair(k, group, m, 0.15, -1.75, -0.25);
  addPlant(k, group, m, [1.5, MAT_TOP, -2.5], 1);
  addPlant(k, group, m, [-0.52, MAT_TOP, -2.9], 0.55);
  const speakers: [THREE.Object3D, THREE.Object3D] = [
    addSpeaker(k, group, m, 'speaker-left', SPEAKER_LEFT, 0.25),
    addSpeaker(k, group, m, 'speaker-right', SPEAKER_RIGHT, -0.25),
  ];
  const ipod = addIpod(k, group);
  const computer = addComputer(k, group);
  addKeyboard88(k, group, m, KEYBOARD_STAND);
  group.updateMatrixWorld(true);
  const at = (name: string): V3 => {
    const p = group.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
    return [p.x, p.y, p.z];
  };
  addIpodCable(k, group, m, at('ipod-port'), at('computer-back-port'), MAT_TOP + 0.004);
  const headphones = addHeadphones(k, m);

  // Lighting: one warm lamp, a dim cool/warm hemisphere fill. No shadow maps.
  const bulb = addDeskLamp(k, group, m, 1.12, -2.75, MAT_TOP);
  const lamp = new THREE.PointLight(ROOM_COLORS.lamp, 2.6, 0, 1.1);
  lamp.name = 'lamp-light';
  lamp.position.copy(bulb);
  group.add(lamp);
  const fill = new THREE.HemisphereLight(0x5a5e68, 0x3a2c20, 1.7);
  fill.name = 'fill-light';
  group.add(fill);

  let disposed = false;
  return {
    group,
    ipod,
    computer,
    screen: computer.getObjectByName('computer-screen')!,
    headphones,
    speakers,
    triangleCount: countTriangles(group),
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const geo of k.geometries) geo.dispose();
      for (const mat of k.materials) mat.dispose();
      lamp.dispose();
      fill.dispose();
    },
  };
}
