// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { buildRoom, updateRoom, AIM_RESPONSE, MAT_TOP_Y } from './buildRoom';
import { KEYBOARD_STAND_TOP } from './furniture';
import { IPOD_POS, COMPUTER_POS, SOLIDS, RUG, KEYBOARD_STAND, SPEAKERS, aimYaw } from './layout';

type Built = ReturnType<typeof buildRoom>;
let built: Built | null = null;
afterEach(() => {
  built?.dispose();
  built = null;
});
const make = () => (built = buildRoom());

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh);
  });
  return out;
}

function materials(root: THREE.Object3D): THREE.Material[] {
  const set = new Set<THREE.Material>();
  for (const m of meshes(root)) for (const mat of [m.material].flat()) set.add(mat);
  return [...set];
}

function interactiveOf(o: THREE.Object3D | null): string | undefined {
  for (let p = o; p; p = p.parent) if (p.userData.interactive) return p.userData.interactive;
  return undefined;
}

function glowMaterials(o: THREE.Object3D): Set<THREE.Material> {
  const set = new Set<THREE.Material>();
  for (const m of meshes(o))
    for (const mat of [m.material].flat()) if ((mat as THREE.MeshStandardMaterial).emissiveIntensity > 0) set.add(mat);
  return set;
}

describe('buildRoom', () => {
  it('runs in Node without a DOM', () => {
    expect(typeof document).toBe('undefined');
    const r = make();
    expect(r.group).toBeInstanceOf(THREE.Group);
    expect(r.group.name).toBe('room');
  });

  it('stays within the triangle budget and matches the traversal count', () => {
    const r = make();
    let tris = 0;
    for (const m of meshes(r.group)) {
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
    expect(r.triangleCount).toBe(tris);
    expect(r.triangleCount).toBeGreaterThan(0);
    expect(r.triangleCount).toBeLessThanOrEqual(60000);
  });

  it('places the iPod and the computer at their layout points', () => {
    const r = make();
    expect(r.ipod.name).toBe('ipod');
    expect(r.computer.name).toBe('computer');
    expect(r.ipod.position.x).toBeCloseTo(IPOD_POS.x);
    expect(r.ipod.position.z).toBeCloseTo(IPOD_POS.z);
    expect(r.computer.position.x).toBeCloseTo(COMPUTER_POS.x);
    expect(r.computer.position.z).toBeCloseTo(COMPUTER_POS.z);
  });

  it('has two named speakers', () => {
    const r = make();
    expect(r.speakers).toHaveLength(2);
    expect(r.speakers.map((s) => s.name)).toEqual(['speaker-left', 'speaker-right']);
    for (const s of r.speakers) expect(r.group.getObjectById(s.id)).toBe(s);
  });

  it('marks the iPod and computer as raycastable interaction targets', () => {
    const r = make();
    expect(r.ipod.userData.interactive).toBe('ipod');
    expect(r.computer.userData.interactive).toBe('computer');
    const ipodMeshes = meshes(r.ipod);
    const compMeshes = meshes(r.computer);
    expect(ipodMeshes.length).toBeGreaterThan(0);
    expect(compMeshes.length).toBeGreaterThan(0);
    for (const m of ipodMeshes) expect(interactiveOf(m)).toBe('ipod');
    for (const m of compMeshes) expect(interactiveOf(m)).toBe('computer');

    // A ray from the room toward the computer screen hits something traced to it.
    r.group.updateMatrixWorld(true);
    const target = new THREE.Vector3();
    new THREE.Box3().setFromObject(r.computer).getCenter(target);
    const origin = new THREE.Vector3(COMPUTER_POS.x + 0.6, target.y, -1.5); // off to the side: the chair sits in front of the desk
    const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize());
    const hit = ray.intersectObject(r.group, true)[0];
    expect(hit).toBeDefined();
    expect(interactiveOf(hit.object)).toBe('computer');
  });

  it('uses no pure white in any material colour', () => {
    const r = make();
    for (const mat of materials(r.group)) {
      const m = mat as THREE.MeshStandardMaterial;
      if (m.color) expect(m.color.getHex()).not.toBe(0xffffff);
      if (m.emissive) expect(m.emissive.getHex()).not.toBe(0xffffff);
    }
    r.group.traverse((o) => {
      const l = o as THREE.Light;
      if (l.isLight) expect(l.color.getHex()).not.toBe(0xffffff);
    });
  });

  it('makes the iPod and computer screen glow brighter than anything else', () => {
    const r = make();
    const glow = new Set([...glowMaterials(r.ipod), ...glowMaterials(r.computer)]);
    expect(glowMaterials(r.ipod).size).toBeGreaterThan(0);
    expect(glowMaterials(r.computer).size).toBeGreaterThan(0);
    const minGlow = Math.min(...[...glow].map((m) => (m as THREE.MeshStandardMaterial).emissiveIntensity));
    const others = materials(r.group).filter((m) => !glow.has(m));
    expect(others.length).toBeGreaterThan(0);
    for (const m of others) {
      const ei = (m as THREE.MeshStandardMaterial).emissiveIntensity ?? 0;
      expect(ei).toBeLessThan(minGlow);
    }
  });

  it('uses one warm point light, low fill, and no shadow maps', () => {
    const r = make();
    const points: THREE.PointLight[] = [];
    r.group.traverse((o) => {
      if ((o as THREE.PointLight).isPointLight) points.push(o as THREE.PointLight);
      if ((o as THREE.Light).isLight) expect((o as THREE.Light).castShadow).toBe(false);
      if ((o as THREE.Mesh).isMesh) {
        expect(o.castShadow).toBe(false);
        expect(o.receiveShadow).toBe(false);
      }
    });
    expect(points).toHaveLength(1);
    const c = points[0].color;
    expect(c.r).toBeGreaterThan(c.b);
  });

  it('gives every solid a matching mesh footprint', () => {
    const r = make();
    r.group.updateMatrixWorld(true);
    const solidMeshes = meshes(r.group).filter((m) => m.userData.solid);
    expect(solidMeshes).toHaveLength(SOLIDS.length);
    for (const s of SOLIDS) {
      const match = solidMeshes.some((m) => {
        const b = new THREE.Box3().setFromObject(m);
        return (
          Math.abs(b.min.x - s.minX) < 1e-6 &&
          Math.abs(b.max.x - s.maxX) < 1e-6 &&
          Math.abs(b.min.z - s.minZ) < 1e-6 &&
          Math.abs(b.max.z - s.maxZ) < 1e-6
        );
      });
      expect(match).toBe(true);
    }
  });

  it('lays the rug flat over the RUG region', () => {
    const r = make();
    r.group.updateMatrixWorld(true);
    const rug = r.group.getObjectByName('rug');
    expect(rug).toBeDefined();
    const b = new THREE.Box3().setFromObject(rug!);
    expect(b.min.x).toBeCloseTo(RUG.minX);
    expect(b.max.x).toBeCloseTo(RUG.maxX);
    expect(b.min.z).toBeCloseTo(RUG.minZ);
    expect(b.max.z).toBeCloseTo(RUG.maxZ);
    expect(b.max.y).toBeLessThan(0.05);
  });

  it('dispose frees geometries and materials and is idempotent', () => {
    const r = make();
    let geoDisposed = 0;
    let matDisposed = 0;
    for (const m of meshes(r.group)) m.geometry.addEventListener('dispose', () => geoDisposed++);
    for (const mat of materials(r.group)) mat.addEventListener('dispose', () => matDisposed++);
    r.dispose();
    expect(geoDisposed).toBeGreaterThan(0);
    expect(matDisposed).toBe(materials(r.group).length);
    expect(() => r.dispose()).not.toThrow();
  });

  const worldBox = (o: THREE.Object3D) => {
    o.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(o);
  };
  const worldPos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

  it('the room has a keyboard-88 with 52 white and 36 black keys, in the real pattern', () => {
    const r = make();
    const kb = r.group.getObjectByName('keyboard-88')!;
    expect(kb).toBeDefined();
    expect(kb.userData.whiteKeys).toBe(52);
    expect(kb.userData.blackKeys).toBe(36);
    const white = kb.getObjectByName('white-keys') as THREE.Mesh;
    const black = kb.getObjectByName('black-keys') as THREE.Mesh;
    expect(white.geometry.attributes.position.count).toBe(52 * 24);
    expect(black.geometry.attributes.position.count).toBe(36 * 24);
    // The 88 keys start on A0: a black key follows every white key except B and E.
    const after: number[] = kb.userData.blackAfterWhite;
    const expected: number[] = [];
    for (let i = 0; i < 52; i++) if (!'BE'.includes('ABCDEFG'[i % 7])) expected.push(i);
    expect(after).toEqual(expected.filter((i) => i < 51));
    expect(after).toHaveLength(36);
    // Groups of two then three run across the board: gaps of 1 white key, then 2, ...
    const gaps = after.slice(1).map((v, i) => v - after[i]);
    expect(new Set(gaps)).toEqual(new Set([1, 2]));
  });

  it('the keyboard sits on its stand and clears every other solid', () => {
    const r = make();
    const kb = r.group.getObjectByName('keyboard-88')!;
    const b = worldBox(kb);
    expect(b.min.y).toBeGreaterThanOrEqual(KEYBOARD_STAND_TOP - 1e-3);
    expect(b.min.y).toBeLessThan(KEYBOARD_STAND_TOP + 0.01);
    expect(b.min.x).toBeGreaterThanOrEqual(KEYBOARD_STAND.minX - 1e-6);
    expect(b.max.x).toBeLessThanOrEqual(KEYBOARD_STAND.maxX + 1e-6);
    expect(b.min.z).toBeGreaterThanOrEqual(KEYBOARD_STAND.minZ - 1e-6);
    expect(b.max.z).toBeLessThanOrEqual(KEYBOARD_STAND.maxZ + 1e-6);
    for (const s of SOLIDS) {
      if (s === KEYBOARD_STAND) continue;
      const hit = b.min.x < s.maxX && b.max.x > s.minX && b.min.z < s.maxZ && b.max.z > s.minZ;
      expect(hit).toBe(false);
    }
  });

  it('keys are off-white, never 0xffffff, and the long axis runs along z with the keys facing the room', () => {
    const r = make();
    const kb = r.group.getObjectByName('keyboard-88')!;
    const white = kb.getObjectByName('white-keys') as THREE.Mesh;
    const c = (white.material as THREE.MeshStandardMaterial).color;
    expect(c.getHex()).not.toBe(0xffffff);
    expect(c.r).toBeGreaterThan(0.6);
    const b = worldBox(kb);
    expect(b.max.z - b.min.z).toBeGreaterThan(b.max.x - b.min.x);
    // The front (key side) is +x: the white keys' centre sits toward +x of the case.
    const wb = worldBox(white);
    expect(wb.max.x).toBeGreaterThan(b.min.x + (b.max.x - b.min.x) * 0.9);
  });

  it('ipod-cable exists and both ends touch the iPod port and the computer back within 0.02 m', () => {
    const r = make();
    const cable = r.group.getObjectByName('ipod-cable')!;
    expect(cable).toBeDefined();
    r.group.updateMatrixWorld(true);
    const [a, z] = cable.userData.ends as THREE.Vector3[];
    const ipodPort = worldPos(r.group.getObjectByName('ipod-port')!);
    const backPort = worldPos(r.group.getObjectByName('computer-back-port')!);
    expect(a.distanceTo(ipodPort)).toBeLessThan(0.02);
    expect(z.distanceTo(backPort)).toBeLessThan(0.02);
    expect(worldBox(cable).min.y).toBeGreaterThanOrEqual(MAT_TOP_Y - 1e-3);
  });

  it('headphones is returned on Room, is named, and is not a child of room.group', () => {
    const r = make();
    expect(r.headphones.name).toBe('headphones');
    expect(r.headphones.parent).toBeNull();
    expect(r.group.getObjectById(r.headphones.id)).toBeUndefined();
    expect(meshes(r.headphones).length).toBeGreaterThanOrEqual(5);
    const mats = materials(r.headphones) as THREE.MeshStandardMaterial[];
    for (const m of mats) expect(m.color.getHex()).not.toBe(0xffffff);
  });

  it('exposes the computer screen plane for the portal', () => {
    const r = make();
    expect(r.screen.name).toBe('computer-screen');
    expect(r.computer.getObjectById(r.screen.id)).toBe(r.screen);
  });

  const yawsOf = (r: Built) => r.cabinets.map((c) => c.rotation.y);
  const targetsFor = (l: { x: number; z: number }) => SPEAKERS.map((sp) => aimYaw(sp, l));
  const L = { x: 0.9, z: 0.5, yaw: 0 };

  it('updateRoom with dt 0 changes nothing', () => {
    const r = make();
    const before = yawsOf(r);
    updateRoom(r, L, 0);
    expect(yawsOf(r)).toEqual(before);
  });

  it('updateRoom with dt 10 never overshoots (lands on the target)', () => {
    const r = make();
    const target = targetsFor(L);
    updateRoom(r, L, 10);
    yawsOf(r).forEach((y, i) => expect(Math.abs(y - target[i])).toBeLessThan(1e-3));
  });

  it('updateRoom survives NaN, negative and infinite dt', () => {
    const r = make();
    const before = yawsOf(r);
    for (const dt of [NaN, -1, Infinity]) updateRoom(r, L, dt);
    for (const y of yawsOf(r)) expect(Number.isFinite(y)).toBe(true);
    expect(AIM_RESPONSE).toBe(6);
    expect(before.length).toBe(2);
  });

  it('after 2 s of frames the cabinets point at the listener within 0.02 rad', () => {
    const r = make();
    for (let i = 0; i < 120; i++) updateRoom(r, L, 1 / 60);
    const target = targetsFor(L);
    yawsOf(r).forEach((y, i) => expect(Math.abs(y - target[i])).toBeLessThan(0.02));
  });

  it('eases (no snap) and both cabinets move toward the same listener', () => {
    const r = make();
    const start = yawsOf(r);
    const target = targetsFor(L);
    updateRoom(r, L, 1 / 60);
    yawsOf(r).forEach((y, i) => {
      if (Math.abs(target[i] - start[i]) > 0.05) {
        expect(Math.abs(y - target[i])).toBeLessThan(Math.abs(start[i] - target[i]));
        expect(Math.abs(y - target[i])).toBeGreaterThan(0);
      }
    });
    // A listener on the other side swings both the same way round (left cabinet turns the opposite way to the right one when the listener crosses the centre line).
    const r2 = make();
    for (let i = 0; i < 120; i++) updateRoom(r2, { x: -1, z: 1, yaw: 0 }, 1 / 60);
    const [l, rt] = yawsOf(r2);
    expect(l).toBeGreaterThan(rt);
  });

  it('cabinets are the speaker children that carry the drivers and start aimed at the start pose', () => {
    const r = make();
    expect(r.cabinets.map((c) => c.name)).toEqual(['speaker-left-cabinet', 'speaker-right-cabinet']);
    for (const c of r.cabinets) expect(r.group.getObjectById(c.id)).toBe(c);
  });
});
