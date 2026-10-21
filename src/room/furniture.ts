// Primitive kit and room dressing for buildRoom. Boxes, cylinders and planes
// only, flat-shaded, no textures, so it all builds in Node without a DOM.
// Coordinates follow layout.ts: metres, x right, z toward the viewer, y up,
// floor at y = 0, far wall at z = -3.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROOM_COLORS } from './palette';
import { RUG, TWEETER_Y } from './layout';
import type { Box } from './movement';

export type V3 = [number, number, number];

type MatOpts = { emissive?: number; emissiveIntensity?: number; roughness?: number; side?: THREE.Side };

/** Builds meshes from a few shared geometries and tracks what it made so it can be freed. */
export class Kit {
  readonly geometries = new Set<THREE.BufferGeometry>();
  readonly materials = new Set<THREE.Material>();
  private readonly unitBox = this.track(new THREE.BoxGeometry(1, 1, 1));
  private readonly unitPlane = this.track(new THREE.PlaneGeometry(1, 1));
  private readonly cylinders = new Map<string, THREE.CylinderGeometry>();
  private readonly leaves = new Map<string, THREE.BufferGeometry>();

  private track<T extends THREE.BufferGeometry>(g: T): T {
    this.geometries.add(g);
    return g;
  }

  /** Flat-shaded, matte, non-emissive unless told otherwise. */
  mat(color: number, o: MatOpts = {}): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: o.roughness ?? 0.9,
      metalness: 0,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 0,
      side: o.side ?? THREE.FrontSide,
    });
    this.materials.add(m);
    return m;
  }

  private place(mesh: THREE.Mesh, parent: THREE.Object3D, pos: V3, rot?: V3, name?: string): THREE.Mesh {
    mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    if (name) mesh.name = name;
    parent.add(mesh);
    return mesh;
  }

  /** Axis-aligned (before rotation) box centred on pos with full size. */
  box(parent: THREE.Object3D, m: THREE.Material, pos: V3, size: V3, rot?: V3, name?: string): THREE.Mesh {
    const mesh = this.place(new THREE.Mesh(this.unitBox, m), parent, pos, rot, name);
    mesh.scale.set(...size);
    return mesh;
  }

  /** Box from min/max corners, for pieces whose extents must match layout data. */
  span(parent: THREE.Object3D, m: THREE.Material, min: V3, max: V3, name?: string): THREE.Mesh {
    const c: V3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    return this.box(parent, m, c, [max[0] - min[0], max[1] - min[1], max[2] - min[2]], undefined, name);
  }

  /** Plane facing +z before rotation. */
  plane(parent: THREE.Object3D, m: THREE.Material, pos: V3, w: number, h: number, rot?: V3): THREE.Mesh {
    const mesh = this.place(new THREE.Mesh(this.unitPlane, m), parent, pos, rot);
    mesh.scale.set(w, h, 1);
    return mesh;
  }

  /** A flat 2D outline pushed out along z (front face at z = depth / 2), for body shapes. A material pair is [faces, edges]. */
  extrude(parent: THREE.Object3D, m: THREE.Material | THREE.Material[], outline: ReadonlyArray<readonly [number, number]>, depth: number, pos: V3, rot?: V3, scale = 1): THREE.Mesh {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = this.track(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }));
    geo.translate(0, 0, -depth / 2);
    const mesh = this.place(new THREE.Mesh(geo, m), parent, pos, rot);
    mesh.scale.set(scale, scale, 1);
    return mesh;
  }

  /**
   * A folded leaf blade from base (0,0,0) to tip (0,length,droop): two wings that
   * meet along a raised mid-rib, so flat shading catches a crease down the middle.
   */
  leaf(parent: THREE.Object3D, m: THREE.Material, length: number, width: number, pos: V3, rot?: V3, droop = 0.18): THREE.Mesh {
    const key = `${length}|${width}|${droop}`;
    let g = this.leaves.get(key);
    if (!g) {
      const l = length;
      const w = width / 2;
      const v = [
        0, 0, 0, // 0 base
        -w, l * 0.42, -w * 0.15, // 1 left shoulder
        w, l * 0.42, -w * 0.15, // 2 right shoulder
        0, l, l * droop * -1, // 3 tip, drooping away
        0, l * 0.42, w * 0.35, // 4 raised mid-rib
        -w * 0.55, l * 0.78, -l * droop * 0.45, // 5 left upper edge
        w * 0.55, l * 0.78, -l * droop * 0.45, // 6 right upper edge
      ];
      // 6 triangles: base wings, shoulders to upper edges, and the tip fan.
      const tris = [0, 1, 4, 0, 4, 2, 1, 5, 4, 2, 4, 6, 5, 3, 4, 6, 4, 3];
      g = this.track(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(tris);
      g.computeVertexNormals();
      this.leaves.set(key, g);
    }
    return this.place(new THREE.Mesh(g, m), parent, pos, rot);
  }

  /** Cylinder (or cone, with rTop 0) along y before rotation. */
  cyl(parent: THREE.Object3D, m: THREE.Material, rTop: number, rBot: number, h: number, seg: number, pos: V3, rot?: V3): THREE.Mesh {
    const key = `${rTop}|${rBot}|${h}|${seg}`;
    let g = this.cylinders.get(key);
    if (!g) {
      g = this.track(new THREE.CylinderGeometry(rTop, rBot, h, seg));
      this.cylinders.set(key, g);
    }
    return this.place(new THREE.Mesh(g, m), parent, pos, rot);
  }
}

const C = ROOM_COLORS;
const HALF_PI = Math.PI / 2;

/** Shared warm 70s palette, created once per room so materials are reused. */
export function makeMaterials(k: Kit) {
  return {
    wall: k.mat(0x4a3529),
    ceiling: k.mat(0x2e221b),
    floor: k.mat(0x3d2c21),
    walnut: k.mat(C.walnut, { roughness: 0.8 }),
    walnutDark: k.mat(0x402c20, { roughness: 0.8 }),
    slatBacking: k.mat(0x1e1612),
    black: k.mat(0x1a1512, { roughness: 0.7 }),
    deskMat: k.mat(0x17110e),
    rug: k.mat(C.rug, { roughness: 1 }),
    rugEdge: k.mat(C.oxblood, { roughness: 1 }),
    speaker: k.mat(0x20181a, { roughness: 0.7 }),
    cabinet: k.mat(0x6b4630, { roughness: 0.7 }),
    cone: k.mat(0x3a2e29),
    pot: k.mat(C.terracotta),
    clockFace: k.mat(0x9a8c74),
    posterA: k.mat(C.oxblood),
    posterA2: k.mat(C.mustard),
    posterB: k.mat(C.midnight),
    posterB2: k.mat(C.terracotta),
    book1: k.mat(0x4d3b2e),
    book2: k.mat(0x3c4a52),
    book3: k.mat(0x6a5a44),
    guitarBody: k.mat(0xa05f2c, { roughness: 0.6 }),
    leaf: k.mat(C.sage, { side: THREE.DoubleSide }),
    leafDark: k.mat(0x6a7d5c, { side: THREE.DoubleSide }),
    soil: k.mat(0x2a1d16),
    // Ibanez RGA42AH: black stained ash, jatoba board, black hardware.
    eAsh: k.mat(0x5d6063, { roughness: 0.85, emissive: 0x30363a, emissiveIntensity: 0.7 }),
    eAshEdge: k.mat(0x2b2927, { roughness: 0.85 }),
    eGrain: k.mat(0x2c2d2f, { roughness: 0.9 }),
    eHead: k.mat(0x2a2826, { roughness: 0.6 }),
    eBoard: k.mat(0x7a4636, { roughness: 0.65 }),
    eNeck: k.mat(0xb99a6c, { roughness: 0.6 }),
    eMetal: k.mat(0xb4b0a6, { roughness: 0.3 }),
    eGold: k.mat(0xb08a3a, { roughness: 0.35 }),
    eBlack: k.mat(0x0c0a09, { roughness: 0.5 }),
    // Martin GPC-X2E: satin sapele top, ziricote-pattern sides, dark board, abalone ring.
    mTop: k.mat(0x9a5538, { roughness: 0.8 }),
    mSide: k.mat(0x3a2a20, { roughness: 0.7 }),
    mNeck: k.mat(0x7c4a33, { roughness: 0.7 }),
    mBoard: k.mat(0x2a1912, { roughness: 0.6 }),
    mShell: k.mat(0x9fb4a6, { roughness: 0.3, emissive: 0x2a3a34, emissiveIntensity: 0.3 }),
    guitarHole: k.mat(0x120e0c),
    windowPane: k.mat(C.midnight, { emissive: 0x2e3f58, emissiveIntensity: 0.3, roughness: 0.3 }),
    lampBulb: k.mat(C.lamp, { emissive: C.lamp, emissiveIntensity: 0.5 }),
    lampShade: k.mat(C.mustard, { side: THREE.DoubleSide }),
    keyWhite: k.mat(C.cotton, { emissive: 0x8a7c62, emissiveIntensity: 0.4, roughness: 0.55 }),
    keyBlack: k.mat(0x1c1714, { roughness: 0.5 }),
    keyCase: k.mat(0x2a211b, { roughness: 0.7 }),
    cable: k.mat(C.terracotta, { roughness: 0.6 }),
    espresso: k.mat(C.espresso, { roughness: 0.75 }),
    mustard: k.mat(C.mustard, { roughness: 0.6 }),
  };
}
export type Mats = ReturnType<typeof makeMaterials>;

/** Floor, ceiling and four walls; wall boxes sit outside the walkable bounds. */
export function addShell(k: Kit, g: THREE.Object3D, m: Mats, H: number) {
  const T = 0.1;
  k.span(g, m.floor, [-2, -T, -3], [2, 0, 3], 'floor');
  k.span(g, m.ceiling, [-2, H, -3], [2, H + T, 3], 'ceiling');
  k.span(g, m.wall, [-2, 0, -3 - T], [2, H, -3], 'wall-far');
  k.span(g, m.wall, [-2, 0, 3], [2, H, 3 + T], 'wall-door');
  k.span(g, m.wall, [-2 - T, 0, -3], [-2, H, 3], 'wall-left');
  k.span(g, m.wall, [2, 0, -3], [2 + T, H, 3], 'wall-right');
  // Dark skirting so walls and floor read apart in the dim light.
  k.span(g, m.black, [-2, 0, -3], [-1.98, 0.08, 3]);
  k.span(g, m.black, [1.98, 0, -3], [2, 0.08, 3]);
  k.span(g, m.black, [-2, 0, 2.98], [2, 0.08, 3]);
  // Door at the viewer's end.
  k.span(g, m.walnutDark, [-0.45, 0, 2.97], [0.45, 2.05, 3]);
  k.box(g, m.black, [0.33, 1.0, 2.955], [0.1, 0.025, 0.03]);
}

/** Tall walnut slats on the far wall behind the desk. */
export function addSlatWall(k: Kit, g: THREE.Object3D, m: Mats, H: number) {
  const x0 = -0.9, x1 = 0.9, top = H - 0.1;
  k.span(g, m.slatBacking, [x0, 0.1, -3], [x1, top, -2.99]);
  const w = 0.045, pitch = 0.085;
  for (let x = x0 + w / 2 + 0.02; x < x1 - w / 2; x += pitch) {
    k.box(g, m.walnut, [x, (0.1 + top) / 2, -2.975], [w, top - 0.1, 0.03]);
  }
}

/** Straight desk: the top carries userData.solid and matches the layout box exactly. */
export function addDesk(k: Kit, g: THREE.Object3D, m: Mats, desk: Box, top: number) {
  const th = 0.045;
  const a = k.span(g, m.walnut, [desk.minX, top - th, desk.minZ], [desk.maxX, top, desk.maxZ], 'desk');
  a.userData.solid = true;
  // Slab legs and a modesty panel, all inside the desk footprint.
  const lh = top - th;
  k.span(g, m.walnutDark, [desk.minX, 0, desk.minZ + 0.02], [desk.minX + 0.04, lh, desk.maxZ - 0.02]);
  k.span(g, m.walnutDark, [desk.maxX - 0.04, 0, desk.minZ + 0.02], [desk.maxX, lh, desk.maxZ - 0.02]);
  k.span(g, m.walnutDark, [desk.minX + 0.04, 0.3, desk.minZ + 0.02], [desk.maxX - 0.04, lh, desk.minZ + 0.05]);
  // Black desk mat under the iPod, keyboard and computer.
  k.span(g, m.deskMat, [desk.minX + 0.05, top, desk.minZ + 0.05], [desk.maxX - 0.05, top + 0.005, desk.minZ + 0.57], 'desk-mat');
}

/** Studio monitor on a stand. The floor plate is the solid and matches the footprint. */
export function addSpeaker(k: Kit, g: THREE.Object3D, m: Mats, name: string, foot: Box, toe: number): THREE.Object3D {
  const s = new THREE.Group();
  s.name = name;
  const cx = (foot.minX + foot.maxX) / 2, cz = (foot.minZ + foot.maxZ) / 2;
  s.position.set(cx, 0, cz);
  g.add(s);
  const plate = k.span(s, m.black, [foot.minX - cx, 0, foot.minZ - cz], [foot.maxX - cx, 0.025, foot.maxZ - cz]);
  plate.userData.solid = true;
  k.box(s, m.black, [0, 0.46, 0], [0.05, 0.88, 0.05]);
  k.box(s, m.black, [0, 0.89, 0], [0.22, 0.02, 0.22]);
  const cab = new THREE.Group();
  cab.name = `${name}-cabinet`;
  cab.position.set(0, TWEETER_Y, 0);
  cab.rotation.y = toe;
  s.add(cab);
  k.box(cab, m.cabinet, [0, 0, 0], [0.24, 0.4, 0.3]);
  const face: V3 = [HALF_PI, 0, 0];
  k.cyl(cab, m.cone, 0.085, 0.085, 0.012, 18, [0, -0.06, 0.152], face);
  k.cyl(cab, m.black, 0.035, 0.035, 0.014, 12, [0, -0.06, 0.155], face);
  k.cyl(cab, m.cone, 0.03, 0.03, 0.012, 12, [0, 0.12, 0.152], face);
  return s;
}

/** Height of the keyboard stand's top rails, metres. */
export const KEYBOARD_STAND_TOP = 0.78;

/** Keyboard stand: four legs, a top frame and a floor plate. The plate is the solid and matches the footprint. */
export function addKeyboardStand(k: Kit, g: THREE.Object3D, m: Mats, stand: Box) {
  const plate = k.span(g, m.black, [stand.minX, 0, stand.minZ], [stand.maxX, 0.02, stand.maxZ], 'keyboard-stand');
  plate.userData.solid = true;
  const t = 0.035, top = KEYBOARD_STAND_TOP;
  const x0 = stand.minX + 0.04, x1 = stand.maxX - 0.04, z0 = stand.minZ + 0.04, z1 = stand.maxZ - 0.04;
  for (const x of [x0, x1])
    for (const z of [z0, z1]) k.span(g, m.black, [x - t / 2, 0.02, z - t / 2], [x + t / 2, top, z + t / 2]);
  // Rails along the long sides and a cross brace at each end.
  for (const x of [x0, x1]) k.span(g, m.black, [x - t / 2, top - 0.03, z0], [x + t / 2, top, z1]);
  for (const z of [z0, z1]) k.span(g, m.black, [x0, top - 0.03, z - t / 2], [x1, top, z + t / 2]);
}

/** Window on the left wall: dim bluish pane (dusk), black frame and mullions. */
export function addWindow(k: Kit, g: THREE.Object3D, m: Mats) {
  const x = -1.995, z0 = 0.2, z1 = 1.4, y0 = 1.0, y1 = 2.15;
  const zc = (z0 + z1) / 2, yc = (y0 + y1) / 2;
  k.plane(g, m.windowPane, [x + 0.005, yc, zc], z1 - z0, y1 - y0, [0, HALF_PI, 0]);
  const f = 0.05;
  k.box(g, m.black, [x + 0.02, y1, zc], [0.04, f, z1 - z0 + f]);
  k.box(g, m.black, [x + 0.02, y0, zc], [0.04, f, z1 - z0 + f]);
  k.box(g, m.black, [x + 0.02, yc, z0], [0.04, y1 - y0, f]);
  k.box(g, m.black, [x + 0.02, yc, z1], [0.04, y1 - y0, f]);
  k.box(g, m.black, [x + 0.02, yc, zc], [0.03, y1 - y0, 0.025]);
  k.box(g, m.black, [x + 0.02, yc, zc], [0.03, 0.025, z1 - z0]);
  k.box(g, m.black, [x + 0.07, y0 - 0.03, zc], [0.14, 0.03, z1 - z0 + 0.1]);
}

/** Two floating walnut shelves on black brackets, on the right wall, with a few books and a plant. */
export function addShelves(k: Kit, g: THREE.Object3D, m: Mats) {
  const z0 = -1.45, z1 = -0.35, d = 0.22;
  for (const y of [1.45, 1.85]) {
    k.span(g, m.walnut, [2 - d, y - 0.03, z0], [2, y, z1]);
    for (const z of [z0 + 0.15, z1 - 0.15]) {
      k.box(g, m.black, [2 - 0.09, y - 0.045, z], [0.18, 0.02, 0.02]);
      k.box(g, m.black, [2 - 0.01, y - 0.1, z], [0.02, 0.12, 0.02]);
    }
  }
  // Lower shelf: a row of books and records.
  const books = [m.book1, m.book2, m.book3, m.book1, m.book3, m.book2];
  let z = z0 + 0.08;
  books.forEach((b, i) => {
    const t = 0.035 + (i % 3) * 0.012, h = 0.2 + ((i * 7) % 5) * 0.02;
    k.box(g, b, [2 - 0.11, 1.45 + h / 2, z + t / 2], [0.16, h, t]);
    z += t + 0.004;
  });
  k.box(g, m.book2, [2 - 0.11, 1.45 + 0.08, z1 - 0.2], [0.17, 0.16, 0.16], [0.1, 0, 0]);
  // Upper shelf: small plant and a stack.
  addPlant(k, g, m, [2 - 0.11, 1.85, z1 - 0.2], 0.6);
  k.box(g, m.book3, [2 - 0.11, 1.85 + 0.02, z0 + 0.2], [0.16, 0.04, 0.22]);
  k.box(g, m.book1, [2 - 0.11, 1.85 + 0.055, z0 + 0.2], [0.15, 0.03, 0.2]);
}

/** Potted plant: a tapered pot with a rim and soil, and a fan of folded leaf blades on thin stems. */
export function addPlant(k: Kit, g: THREE.Object3D, m: Mats, base: V3, s: number) {
  const p = new THREE.Group();
  p.position.set(...base);
  p.scale.setScalar(s);
  g.add(p);
  k.cyl(p, m.pot, 0.1, 0.07, 0.15, 12, [0, 0.075, 0]);
  k.cyl(p, m.pot, 0.108, 0.108, 0.02, 12, [0, 0.155, 0]); // rim
  k.cyl(p, m.soil, 0.092, 0.092, 0.01, 12, [0, 0.16, 0]);
  // Leaves leave the soil at spread angles around the pot, each leaning out and drooping.
  // [heading, lean, length, width, height of the stem top]
  const blades: [number, number, number, number, number][] = [
    [0.0, 0.25, 0.3, 0.085, 0.12],
    [1.3, 0.4, 0.26, 0.08, 0.1],
    [2.5, 0.3, 0.32, 0.09, 0.13],
    [3.7, 0.45, 0.24, 0.075, 0.09],
    [4.9, 0.35, 0.28, 0.085, 0.11],
    [0.65, 0.7, 0.2, 0.07, 0.06],
    [3.1, 0.75, 0.21, 0.07, 0.06],
    [5.5, 0.65, 0.19, 0.065, 0.05],
  ];
  blades.forEach(([heading, lean, len, wid, h], i) => {
    const stem = new THREE.Group();
    stem.position.set(Math.sin(heading) * 0.015, 0.16, Math.cos(heading) * 0.015);
    stem.rotation.set(0, heading, 0);
    p.add(stem);
    k.cyl(stem, m.leafDark, 0.004, 0.005, h, 5, [0, h / 2, 0.012 * lean * 4], [lean * 0.5, 0, 0]);
    // A blade rises from the stem top; pitch leans it outward (+z before heading).
    k.leaf(stem, i % 2 ? m.leafDark : m.leaf, len, wid, [0, h, h * lean * 0.5], [lean, 0, 0], 0.22);
  });
}

/**
 * Avi's own guitar, a Martin GPC-X2E (ziricote pattern): Grand Performance
 * cutaway body, satin sapele top, dark ziricote-pattern sides, abalone-ringed
 * soundhole, black pickguard, 25.4 inch scale. Local axes: y up the neck (0 at
 * the bridge), z out of the wall; the cutaway is on the treble (right) side.
 */
export function addGuitar(k: Kit, g: THREE.Object3D, m: Mats, pos: V3): THREE.Group {
  const gr = new THREE.Group();
  gr.name = 'guitar-acoustic';
  gr.position.set(...pos);
  gr.rotation.set(0, HALF_PI, 0.04);
  gr.userData = { interactive: 'acoustic', baseRotZ: 0.04 };
  g.add(gr);
  const body: Array<[number, number]> = [
    [-0.045, 0.222], [-0.11, 0.208], [-0.145, 0.16], [-0.15, 0.1], [-0.14, 0.05], [-0.133, 0.0], [-0.15, -0.045],
    [-0.19, -0.1], [-0.2, -0.16], [-0.185, -0.225], [-0.12, -0.268], [0, -0.28], [0.12, -0.268], [0.185, -0.225],
    [0.2, -0.16], [0.19, -0.1], [0.15, -0.045], [0.135, 0.0], [0.148, 0.06], [0.14, 0.11], [0.105, 0.15],
    [0.07, 0.19], [0.045, 0.222],
  ];
  k.extrude(gr, [m.mTop, m.mSide], body, 0.11, [0, 0, 0]);
  const front = 0.056;
  // Soundhole: abalone ring around black, set a little above the middle of the top.
  const holeY = 0.074;
  const flat: V3 = [HALF_PI, 0, 0];
  k.cyl(gr, m.mShell, 0.062, 0.062, 0.002, 20, [0, holeY, front], flat);
  k.cyl(gr, m.guitarHole, 0.052, 0.052, 0.003, 20, [0, holeY, front + 0.001], flat);
  // Black pickguard on the treble side of the hole.
  k.extrude(
    gr,
    m.black,
    [[0.052, 0.12], [0.1, 0.112], [0.12, 0.07], [0.112, 0.0], [0.082, -0.03], [0.058, -0.01], [0.052, 0.03]],
    0.002,
    [0, 0, front + 0.001],
  );
  // Bridge with saddle and six pins.
  k.box(gr, m.mBoard, [0, 0.0, front + 0.006], [0.15, 0.036, 0.012]);
  k.box(gr, m.keyWhite, [0, 0.008, front + 0.0125], [0.12, 0.004, 0.003]);
  for (let i = 0; i < 6; i++) k.cyl(gr, m.keyWhite, 0.0035, 0.0035, 0.003, 6, [-0.04 + i * 0.016, -0.01, front + 0.0128], flat);
  // Neck: hardwood back, dark board with 20 frets and dots, nut to bridge is 0.645 m.
  const SCALE = 0.645;
  const nutY = SCALE + 0.0;
  const fretY = (n: number) => nutY - SCALE * (1 - Math.pow(2, -n / 12));
  const neckEnd = 0.2;
  k.box(gr, m.mNeck, [0, (nutY + neckEnd) / 2, 0.036], [0.044, nutY - neckEnd, 0.04]);
  k.extrude(gr, m.mBoard, [[-0.0225, nutY], [0.0225, nutY], [0.029, neckEnd], [-0.029, neckEnd]], 0.007, [0, 0, 0.0575]);
  for (let n = 1; n <= 20; n++) k.box(gr, m.eMetal, [0, fretY(n), 0.0615], [0.04 + n * 0.0007, 0.0022, 0.002]);
  const dot = (n: number, dx: number) => k.box(gr, m.mShell, [dx, (fretY(n) + fretY(n - 1)) / 2, 0.0615], [0.006, 0.006, 0.002]);
  for (const n of [3, 5, 7, 9, 15]) dot(n, 0);
  dot(12, -0.01);
  dot(12, 0.01);
  // Headstock with three chrome tuners a side.
  k.extrude(
    gr,
    m.mNeck,
    [[-0.026, nutY], [0.026, nutY], [0.038, nutY + 0.06], [0.04, nutY + 0.14], [0.026, nutY + 0.18], [-0.026, nutY + 0.18], [-0.04, nutY + 0.14], [-0.038, nutY + 0.06]],
    0.018,
    [0, 0, 0.05],
  );
  for (let i = 0; i < 3; i++)
    for (const sx of [-1, 1]) {
      k.cyl(gr, m.eMetal, 0.005, 0.005, 0.02, 6, [sx * 0.046, nutY + 0.04 + i * 0.045, 0.05], [0, 0, HALF_PI]);
      k.box(gr, m.eMetal, [sx * 0.058, nutY + 0.04 + i * 0.045, 0.05], [0.012, 0.016, 0.006]);
    }
  // Strings from nut to bridge, and the end-pin jack.
  for (let i = 0; i < 6; i++) {
    const xn = -0.0185 + i * 0.0074, xb = -0.04 + i * 0.016;
    const len = nutY - 0.01;
    k.box(gr, m.eMetal, [(xn + xb) / 2, (nutY + 0.01) / 2, 0.0655], [0.0012, len, 0.0012], [0, 0, Math.atan2(xb - xn, len)]);
  }
  k.cyl(gr, m.eMetal, 0.01, 0.01, 0.012, 8, [0, -0.28, 0.0], [0, 0, HALF_PI]);
  // Hook yoke behind the headstock.
  k.box(gr, m.black, [0, nutY + 0.12, 0.0], [0.07, 0.02, 0.05]);
  return gr;
}

/**
 * Ibanez RGA42AH Black Stained, traced from the Guitar Center product photo:
 * weathered grey-black open-grain ash body with two long hooked horns, a jatoba
 * board with pale dot inlays and 24 frets, two humbuckers, a black F106 hardtail
 * bridge, two knobs and a switch. Local axes: y up the neck (0 at the 24th fret),
 * z out of the wall. The 25.5 inch scale puts the bridge 0.167 m below y = 0.
 */
export function addElectricGuitar(k: Kit, g: THREE.Object3D, m: Mats, pos: V3, yaw: number): THREE.Group {
  const gr = new THREE.Group();
  gr.name = 'guitar-electric';
  gr.position.set(...pos);
  gr.rotation.set(0, yaw, -0.03);
  gr.userData = { interactive: 'electric', baseRotZ: -0.03 };
  g.add(gr);
  // Body outline in photo pixels (neck centre x = 401, 24th fret y = 410), 1 px = 1.21 mm.
  const PX = 0.00121;
  const px = ([x, y]: readonly [number, number]): [number, number] => [(x - 401) * PX, (410 - y) * PX];
  const outline: Array<[number, number]> = (
    [
      [378, 385], [350, 360], [332, 320], [318, 285], [312, 258], [300, 268], [289, 290], [284, 320], [288, 350],
      [297, 385], [300, 420], [292, 455], [276, 500], [267, 545], [266, 585], [275, 622], [305, 645], [350, 653],
      [400, 656], [455, 653], [500, 640], [528, 610], [534, 575], [530, 535], [515, 495], [506, 455], [512, 420],
      [516, 385], [512, 350], [503, 322], [494, 345], [480, 375], [455, 398], [428, 408], [428, 380],
    ] as const
  ).map(px);
  k.extrude(gr, [m.eAsh, m.eAshEdge], outline, 0.045, [0, 0, 0]);
  // Open-grain streaks down the body, darker than the stain.
  const streaks: Array<[number, number, number, number, number]> = [
    [-0.08, -0.2, 0.3, 0.004, 0.03], [-0.045, -0.15, 0.26, 0.003, -0.02], [0.02, -0.24, 0.34, 0.005, 0.0],
    [0.07, -0.18, 0.28, 0.003, 0.02], [0.115, -0.2, 0.22, 0.004, -0.03], [-0.115, -0.22, 0.2, 0.003, 0.01],
  ];
  for (const [x, y, len, w, tilt] of streaks) k.box(gr, m.eGrain, [x, y + len / 2 - 0.1, 0.0235], [w, len, 0.001], [0, 0, tilt]);
  // Neck: maple back, tapered jatoba board, 24 frets, dot inlays.
  const SCALE = 0.648;
  const bridgeY = -0.167;
  const nutY = bridgeY + SCALE;
  const fretY = (n: number) => nutY - SCALE * (1 - Math.pow(2, -n / 12));
  const widthAt = (y: number) => 0.043 + (0.059 - 0.043) * ((nutY - y) / (nutY - fretY(24)));
  const neckEnd = -0.03;
  const neckLen = nutY - neckEnd;
  k.box(gr, m.eNeck, [0, (nutY + neckEnd) / 2, 0.004], [0.046, neckLen, 0.018]);
  k.extrude(gr, m.eBoard, [[-0.0215, nutY], [0.0215, nutY], [0.0295, neckEnd], [-0.0295, neckEnd]], 0.006, [0, 0, 0.017]);
  for (let n = 1; n <= 24; n++) k.box(gr, m.eMetal, [0, fretY(n), 0.0215], [widthAt(fretY(n)) - 0.002, 0.0025, 0.002]);
  const dot = (n: number, dx: number) => k.box(gr, m.keyWhite, [dx, (fretY(n) + fretY(n - 1)) / 2, 0.0215], [0.006, 0.006, 0.002]);
  for (const n of [3, 5, 7, 9, 15, 17, 19, 21]) dot(n, 0);
  for (const n of [12, 24]) {
    dot(n, -0.011);
    dot(n, 0.011);
  }
  // Headstock: dark, six tuners in a line down one edge.
  const headLen = 0.2;
  k.extrude(
    gr,
    m.eHead,
    [[-0.024, nutY], [0.024, nutY], [0.034, nutY + 0.09], [0.04, nutY + 0.16], [0.03, nutY + headLen], [-0.03, nutY + headLen], [-0.04, nutY + 0.15], [-0.032, nutY + 0.07]],
    0.016,
    [0, 0, 0.002],
  );
  for (let i = 0; i < 6; i++) k.cyl(gr, m.eMetal, 0.006, 0.006, 0.014, 6, [0.044, nutY + 0.045 + i * 0.027, 0.0], [0, 0, HALF_PI]);
  // Humbuckers: black covers with brass-coloured screws at the ends and chrome poles.
  for (const y of [-0.015, -0.105]) {
    k.box(gr, m.eBlack, [0, y, 0.0285], [0.087, 0.044, 0.012]);
    for (let i = 0; i < 6; i++) {
      k.box(gr, m.eMetal, [-0.026 + i * 0.0104, y + 0.009, 0.0355], [0.004, 0.004, 0.002]);
      k.box(gr, m.eMetal, [-0.026 + i * 0.0104, y - 0.009, 0.0355], [0.004, 0.004, 0.002]);
    }
    k.box(gr, m.eGold, [-0.046, y, 0.0285], [0.006, 0.014, 0.013]);
    k.box(gr, m.eGold, [0.046, y, 0.0285], [0.006, 0.014, 0.013]);
  }
  // F106 hardtail bridge and controls.
  k.box(gr, m.eBlack, [0, bridgeY, 0.0285], [0.065, 0.048, 0.012]);
  for (let i = 0; i < 6; i++) k.box(gr, m.eMetal, [-0.025 + i * 0.01, bridgeY + 0.004, 0.036], [0.003, 0.014, 0.003]);
  k.cyl(gr, m.eBlack, 0.0095, 0.0095, 0.016, 10, [0.073, -0.123, 0.03], [HALF_PI, 0, 0]);
  k.cyl(gr, m.eBlack, 0.0095, 0.0095, 0.016, 10, [0.131, -0.172, 0.03], [HALF_PI, 0, 0]);
  k.box(gr, m.eBlack, [0.105, -0.097, 0.026], [0.006, 0.026, 0.01], [0, 0, 0.5]);
  k.cyl(gr, m.eMetal, 0.007, 0.007, 0.012, 8, [0, -0.297, 0.0], [0, 0, HALF_PI]);
  // Strings, nut to bridge.
  for (let i = 0; i < 6; i++) {
    const xn = -0.0185 + i * 0.0074, xb = -0.025 + i * 0.01;
    const len = nutY - bridgeY;
    k.box(gr, m.eMetal, [(xn + xb) / 2, (nutY + bridgeY) / 2, 0.0245], [0.0013, len, 0.0013], [0, 0, Math.atan2(xb - xn, len)]);
  }
  // Wall hook yoke behind the headstock.
  k.box(gr, m.eBlack, [0, nutY + 0.1, -0.03], [0.09, 0.02, 0.06]);
  return gr;
}

/** Analog clock: cylinder face, black rim and two box hands (about ten past ten). */
export function addClock(k: Kit, g: THREE.Object3D, m: Mats, pos: V3) {
  const c = new THREE.Group();
  c.position.set(...pos);
  c.rotation.y = -HALF_PI;
  g.add(c);
  const flat: V3 = [HALF_PI, 0, 0];
  k.cyl(c, m.black, 0.17, 0.17, 0.03, 20, [0, 0, 0.015], flat);
  k.cyl(c, m.clockFace, 0.15, 0.15, 0.032, 20, [0, 0, 0.018], flat);
  // Each hand hangs off a pivot at the centre; angle is clockwise from 12.
  const hand = (len: number, w: number, angle: number, z: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, z);
    pivot.rotation.z = -angle;
    c.add(pivot);
    k.box(pivot, m.black, [0, len / 2, 0], [w, len, 0.004]);
  };
  hand(0.11, 0.01, Math.PI / 3, 0.036); // minute hand on the 2
  hand(0.075, 0.016, -Math.PI / 3, 0.039); // hour hand near the 10
  k.cyl(c, m.black, 0.012, 0.012, 0.01, 8, [0, 0, 0.04], flat);
}

/** Two posters as flat coloured planes with a simple inner block each. */
export function addPosters(k: Kit, g: THREE.Object3D, m: Mats) {
  // Right wall, toward the door end.
  k.plane(g, m.posterB, [1.993, 1.6, 1.7], 0.6, 0.85, [0, -HALF_PI, 0]);
  k.plane(g, m.posterB2, [1.99, 1.68, 1.7], 0.4, 0.4, [0, -HALF_PI, 0]);
  // Left wall, between window and door.
  k.plane(g, m.posterA, [-1.993, 1.6, 2.3], 0.5, 0.7, [0, HALF_PI, 0]);
  k.plane(g, m.posterA2, [-1.99, 1.45, 2.3], 0.36, 0.06, [0, HALF_PI, 0]);
}

/** Shaggy grey rug as a flat low slab over the RUG region. */
export function addRug(k: Kit, g: THREE.Object3D, m: Mats) {
  k.span(g, m.rug, [RUG.minX, 0, RUG.minZ], [RUG.maxX, 0.02, RUG.maxZ], 'rug');
  k.span(g, m.rugEdge, [RUG.minX + 0.12, 0.02, RUG.minZ + 0.12], [RUG.maxX - 0.12, 0.024, RUG.maxZ - 0.12]);
}

/** Black ergonomic chair from boxes and cylinders, turned toward the desk. */
export function addChair(k: Kit, g: THREE.Object3D, m: Mats, x: number, z: number, yaw: number) {
  const c = new THREE.Group();
  c.position.set(x, 0, z);
  c.rotation.y = yaw;
  g.add(c);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.box(c, m.black, [Math.sin(a) * 0.14, 0.05, Math.cos(a) * 0.14], [0.04, 0.03, 0.28], [0, a, 0]);
    k.cyl(c, m.speaker, 0.025, 0.025, 0.04, 8, [Math.sin(a) * 0.27, 0.02, Math.cos(a) * 0.27]);
  }
  k.cyl(c, m.speaker, 0.025, 0.025, 0.36, 8, [0, 0.24, 0]);
  k.box(c, m.black, [0, 0.46, 0], [0.48, 0.07, 0.46]);
  k.box(c, m.black, [0, 0.76, 0.24], [0.44, 0.5, 0.05], [-0.12, 0, 0]);
  k.box(c, m.speaker, [0, 0.6, 0.22], [0.05, 0.25, 0.04]);
  for (const s of [-1, 1]) {
    k.box(c, m.speaker, [s * 0.24, 0.57, 0.02], [0.03, 0.18, 0.03]);
    k.box(c, m.black, [s * 0.24, 0.665, 0.02], [0.06, 0.025, 0.24]);
  }
}

/** Small desk lamp; returns the bulb position for the room's single point light. */
export function addDeskLamp(k: Kit, g: THREE.Object3D, m: Mats, x: number, z: number, top: number, yaw = 0): THREE.Vector3 {
  const l = new THREE.Group();
  l.position.set(x, top, z);
  l.rotation.y = yaw;
  g.add(l);
  k.cyl(l, m.black, 0.07, 0.08, 0.02, 14, [0, 0.01, 0]);
  k.box(l, m.black, [0.02, 0.2, 0], [0.018, 0.4, 0.018], [0, 0, -0.12]);
  k.box(l, m.black, [0.11, 0.42, 0.04], [0.018, 0.018, 0.22], [0, 0.9, 0.35]);
  const head = new THREE.Group();
  head.position.set(0.17, 0.42, 0.1);
  head.rotation.set(0.5, 0, -0.25);
  l.add(head);
  k.cyl(head, m.lampShade, 0.035, 0.1, 0.13, 14, [0, -0.04, 0]);
  k.cyl(head, m.lampBulb, 0.04, 0.04, 0.03, 10, [0, -0.08, 0]);
  // The bulb, turned with the lamp: local (0.17, 0.33, 0.14) about y.
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  return new THREE.Vector3(x + 0.17 * c + 0.14 * sn, top + 0.33, z - 0.17 * sn + 0.14 * c);
}

/** Merge boxes into one geometry (kept in the kit so dispose frees it). */
function mergedBoxes(k: Kit, boxes: { pos: V3; size: V3 }[]): THREE.BufferGeometry {
  const parts = boxes.map(({ pos, size }) => {
    const g = new THREE.BoxGeometry(...size);
    g.translate(...pos);
    return g;
  });
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  k.geometries.add(merged);
  return merged;
}

export const KEYBOARD_KEY_W = 0.0236;
const WHITE_KEYS = 52;
const KEYBOARD_LEN = WHITE_KEYS * KEYBOARD_KEY_W;

/**
 * 88-key keyboard (A0 to C8) lying on its stand, long axis along z with the
 * keys facing +x. The light keys and the dark keys are one merged mesh each.
 * userData.blackAfterWhite lists the white-key indices (0 = A0) a black key follows.
 */
export function addKeyboard88(k: Kit, g: THREE.Object3D, m: Mats, stand: Box): THREE.Group {
  const kb = new THREE.Group();
  kb.name = 'keyboard-88';
  kb.userData = { interactive: 'piano' };
  kb.position.set((stand.minX + stand.maxX) / 2, KEYBOARD_STAND_TOP, (stand.minZ + stand.maxZ) / 2);
  // Local frame: x along the keys (treble at +x), front at +z. Turn so front is +x
  // in the room and the bass end is nearest the viewer.
  kb.rotation.y = HALF_PI;
  g.add(kb);

  const caseW = KEYBOARD_LEN + 0.04, depth = 0.3;
  k.box(kb, m.keyCase, [0, 0.03, 0], [caseW, 0.06, depth]);
  k.box(kb, m.keyCase, [0, 0.075, -0.1], [caseW, 0.03, 0.1]);
  for (const sx of [-1, 1]) k.box(kb, m.keyCase, [sx * (caseW / 2 - 0.015), 0.07, 0.03], [0.03, 0.04, 0.24]);

  const whiteBoxes: { pos: V3; size: V3 }[] = [];
  const blackBoxes: { pos: V3; size: V3 }[] = [];
  const blackAfter: number[] = [];
  for (let i = 0; i < WHITE_KEYS; i++) {
    const x = -KEYBOARD_LEN / 2 + (i + 0.5) * KEYBOARD_KEY_W;
    whiteBoxes.push({ pos: [x, 0.069, 0.05], size: [KEYBOARD_KEY_W - 0.0012, 0.018, 0.2] });
    if (i < WHITE_KEYS - 1 && !'BE'.includes('ABCDEFG'[i % 7])) {
      blackAfter.push(i);
      blackBoxes.push({ pos: [x + KEYBOARD_KEY_W / 2, 0.088, -0.0], size: [0.0135, 0.02, 0.12] });
    }
  }
  const wm = new THREE.Mesh(mergedBoxes(k, whiteBoxes), m.keyWhite);
  wm.name = 'white-keys';
  const bm = new THREE.Mesh(mergedBoxes(k, blackBoxes), m.keyBlack);
  bm.name = 'black-keys';
  kb.add(wm, bm);
  kb.userData.whiteKeys = whiteBoxes.length;
  kb.userData.blackKeys = blackBoxes.length;
  kb.userData.blackAfterWhite = blackAfter;
  return kb;
}

/**
 * Cable from the iPod's port to the back of the computer. It leaves to the right,
 * lies on the desk mat behind the computer and rises to the back port.
 * userData.ends holds the two end points (world, the room group sits at the origin).
 */
export function addIpodCable(k: Kit, g: THREE.Object3D, m: Mats, from: V3, to: V3, restY: number, lane = -2.945): THREE.Group {
  const cable = new THREE.Group();
  cable.name = 'ipod-cable';
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const curve = new THREE.CatmullRomCurve3(
    [
      v(...from),
      v(from[0] + 0.05, restY + 0.012, from[2] + 0.04),
      v(from[0] + 0.12, restY, from[2] - 0.03),
      v(from[0] + 0.2, restY, lane),
      v(to[0] - 0.3, restY, lane),
      v(to[0] - 0.12, restY, lane),
      v(to[0], to[1], to[2] + 0.002),
      v(...to),
    ],
    false,
    'centripetal',
  );
  // The spline can dip under the mat between the end points; resample and clamp it to rest on the desk.
  const dense = curve.getPoints(80).map((p) => v(p.x, Math.max(p.y, restY), p.z));
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dense, false, 'centripetal'), 80, 0.0035, 5, false);
  k.geometries.add(geo);
  cable.add(new THREE.Mesh(geo, m.cable));
  // Small plugs where it meets each device.
  for (const p of [from, to]) k.box(cable, m.black, p, [0.012, 0.01, 0.012]);
  cable.userData.ends = [v(...from), v(...to)];
  g.add(cable);
  return cable;
}

/**
 * Over-ear headphones, detached: centred on the head, front toward -z, band over
 * the top (+y). The sequence adds them to the scene and animates them.
 */
export function addHeadphones(k: Kit, m: Mats): THREE.Group {
  const h = new THREE.Group();
  h.name = 'headphones';
  const R = 0.1;
  const band = new THREE.TorusGeometry(R, 0.009, 6, 24, Math.PI);
  k.geometries.add(band);
  const bandMesh = new THREE.Mesh(band, m.espresso);
  bandMesh.name = 'headphones-band';
  h.add(bandMesh);
  const side: V3 = [0, 0, HALF_PI];
  for (const s of [-1, 1]) {
    // Cup: mustard shell, espresso cushion facing the head.
    k.cyl(h, m.mustard, 0.05, 0.05, 0.03, 18, [s * (R + 0.02), 0, 0], side);
    k.cyl(h, m.espresso, 0.046, 0.05, 0.022, 18, [s * (R - 0.004), 0, 0], side);
    k.box(h, m.espresso, [s * R, 0.03, 0], [0.012, 0.06, 0.012]);
  }
  return h;
}
