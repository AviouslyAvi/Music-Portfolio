import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { headphonePose, attachHeadphones, HEADPHONE_DROP_MS } from './headphones';

describe('headphonePose', () => {
  it('headphonePose(0) starts above the view and headphonePose(1) is at rest', () => {
    const start = headphonePose(0);
    const rest = headphonePose(1);
    expect(start.y).toBeGreaterThan(rest.y);
    expect(start.y).toBeGreaterThan(0.2);
    expect(rest.y).toBeLessThanOrEqual(0.2);
  });

  it('it is monotonic and never overshoots below the rest height', () => {
    const rest = headphonePose(1);
    let prev = Infinity;
    for (let i = 0; i <= 100; i++) {
      const p = headphonePose(i / 100);
      expect(p.y).toBeLessThanOrEqual(prev + 1e-12);
      expect(p.y).toBeGreaterThanOrEqual(rest.y - 1e-12);
      prev = p.y;
    }
  });

  it('t outside 0..1 is clamped', () => {
    expect(headphonePose(-5)).toEqual(headphonePose(0));
    expect(headphonePose(9)).toEqual(headphonePose(1));
    expect(Number.isFinite(headphonePose(NaN).y)).toBe(true);
  });

  it('drops over 800 ms', () => {
    expect(HEADPHONE_DROP_MS).toBe(800);
  });
});

describe('attachHeadphones', () => {
  it('attachHeadphones parents to the camera and the detach function removes it', () => {
    const camera = new THREE.PerspectiveCamera();
    const obj = new THREE.Group();
    const detach = attachHeadphones(camera, obj);
    expect(obj.parent).toBe(camera);
    detach();
    expect(obj.parent).toBeNull();
  });

  it('detach twice is safe', () => {
    const camera = new THREE.PerspectiveCamera();
    const obj = new THREE.Group();
    const detach = attachHeadphones(camera, obj);
    detach();
    expect(() => detach()).not.toThrow();
    expect(obj.parent).toBeNull();
  });

  it('a second detach does not pull the object off a new parent', () => {
    const camera = new THREE.PerspectiveCamera();
    const other = new THREE.Group();
    const obj = new THREE.Group();
    const detach = attachHeadphones(camera, obj);
    detach();
    other.add(obj);
    detach();
    expect(obj.parent).toBe(other);
  });
});
