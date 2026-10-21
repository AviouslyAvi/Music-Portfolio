import type * as THREE from 'three';

export const HEADPHONE_DROP_MS = 800;

// Camera-space metres: the band rests across the top of the view, just ahead of the lens.
const REST_Y = 0;
// The model is life size (a 0.1 m band); close to the lens it is scaled up so the cups frame the screen edges.
const SCALE = 3;
const START_Y = 0.7;
const START_PITCH = 0.9;
const OFFSET_Z = -0.35;

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Vertical offset and pitch for the drop, t 0..1. Ends at rest; never undershoots it. */
export function headphonePose(t: number): { y: number; pitch: number } {
  const c = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const k = smootherstep(c);
  return { y: START_Y + (REST_Y - START_Y) * k, pitch: START_PITCH * (1 - k) };
}

/** Parents the headphones to the camera at the rest offset. Returns a detach function that is safe to call twice. */
export function attachHeadphones(camera: THREE.Camera, obj: THREE.Object3D): () => void {
  const start = headphonePose(0);
  obj.position.set(0, start.y, OFFSET_Z);
  obj.rotation.set(start.pitch, 0, 0);
  obj.scale.setScalar(SCALE);
  camera.add(obj);
  return () => {
    if (obj.parent === camera) camera.remove(obj);
  };
}

/** Apply the drop curve to an attached object. */
export function poseHeadphones(obj: THREE.Object3D, t: number): void {
  const p = headphonePose(t);
  obj.position.set(0, p.y, OFFSET_Z);
  obj.rotation.set(p.pitch, 0, 0);
}
