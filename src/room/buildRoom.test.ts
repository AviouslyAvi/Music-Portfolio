// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { buildRoom } from './buildRoom';
import { IPOD_POS, COMPUTER_POS, SOLIDS, RUG } from './layout';

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
    const origin = new THREE.Vector3(COMPUTER_POS.x, target.y, -1.2);
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
});
