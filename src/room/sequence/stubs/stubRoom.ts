// Stand-in for Part A's room contract. Replaced by the real exports at integration.
import * as THREE from 'three';
import { COMPUTER_POS } from '../../layout';

export type SeatPose = { x: number; z: number; yaw: number; pitch: number };
export type Listener = { x: number; z: number; yaw: number };

/** Copy of the old DESK_POSE. */
export const SEAT_POSE: SeatPose = { x: COMPUTER_POS.x, z: -1.85, yaw: 0, pitch: -0.5 };

/** Part A will aim the speakers here; the stand-in does nothing. */
export function updateRoom(_room: unknown, _listener: Listener, _dt: number): void {}

/** A plain box standing in for the over-ear headphones Part A will build. */
export function makeHeadphones(): THREE.Object3D {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.08, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x2a2018 }),
  );
  const g = new THREE.Group();
  g.add(box);
  return g;
}

/** Three clearly labelled placeholders, matching Part B's DrySource shape. */
export type DrySource = { id: string; label: string; src: string; placeholder: boolean };
export const STUB_SOURCES: readonly DrySource[] = [
  { id: 'stub-a', label: 'Sound one', src: '', placeholder: true },
  { id: 'stub-b', label: 'Sound two', src: '', placeholder: true },
  { id: 'stub-c', label: 'Sound three', src: '', placeholder: true },
];
