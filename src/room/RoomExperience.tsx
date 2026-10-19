'use client';

// The walk-in room. Only ever loaded through next/dynamic (ssr: false) by
// RoomGate after the visitor clicks Enter, so three.js stays out of every
// other bundle. Pure logic lives in movement.ts and layout.ts; this file wires
// it to the renderer, the input devices and the HUD.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PremonitionDemo } from '@/demo/PremonitionDemo';
import { ROOM } from '@/content/copy';
import { buildRoom, type Room } from './buildRoom';
import { stepPlayer, normalizeYaw, type PlayerState } from './movement';
import {
  SOLIDS, ROOM_BOUNDS, START, IPOD_POS, COMPUTER_POS, INTERACT_RADIUS, nearestInteractable,
} from './layout';
import type { TrackPlayer } from './audioEngine';
import { Hud, type Interactable } from './Hud';
import styles from './room.module.css';

export type RoomAudio = { ctx: AudioContext; player: TrackPlayer };

const EYE_HEIGHT = 1.6;
const FOV = 70;
const MAX_PIXEL_RATIO = 1.5;
const LOOK_SPEED = 0.0025; // radians per pixel of mouse travel
const MAX_PITCH = 1.2;
const DRAG_THRESHOLD = 4; // pixels before a press counts as a drag, not a click
const CLICK_RANGE = INTERACT_RADIUS * 1.5;
const EASE_MS = 800;
// Seated in front of the screen, looking down at it a little.
const DESK_POSE = { x: COMPUTER_POS.x, z: -1.85, yaw: 0, pitch: -0.5 };

type Mode = 'walk' | 'easing' | 'demo';
type Api = { interact(t: Interactable): void; closeDemo(): void };

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA']);
const RIGHT = new Set(['KeyD']);
const TURN_LEFT = new Set(['ArrowLeft']);
const TURN_RIGHT = new Set(['ArrowRight']);
const KEY_TO_CODE: Record<string, string> = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', e: 'KeyE',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
};

function keyCode(e: KeyboardEvent): string {
  return e.code || KEY_TO_CODE[e.key.length === 1 ? e.key.toLowerCase() : e.key] || '';
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function interactableOf(o: THREE.Object3D | null): Interactable | null {
  for (let n = o; n; n = n.parent) {
    const t = n.userData?.interactive;
    if (t === 'ipod' || t === 'computer') return t;
  }
  return null;
}

function inClickRange(p: PlayerState['pos'], t: Interactable): boolean {
  const target = t === 'ipod' ? IPOD_POS : COMPUTER_POS;
  return Math.hypot(p.x - target.x, p.z - target.z) <= CLICK_RANGE;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function RoomExperience({
  onLeave,
  onFail,
  audio = null,
}: {
  onLeave: () => void;
  onFail: () => void;
  audio?: RoomAudio | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const [nearby, setNearby] = useState<Interactable | null>(null);
  const [title, setTitle] = useState('');
  const [demoOpen, setDemoOpen] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cleanups: Array<() => void> = [];
    let failed = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      failRef.current();
    };
    // Every listener goes through here so cleanup removes all of them.
    const listen = <E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) => {
      const h = fn as unknown as EventListener;
      target.addEventListener(type, h);
      cleanups.push(() => target.removeEventListener(type, h));
    };

    let renderer: THREE.WebGLRenderer | null = null;
    let room: Room | null = null;
    let raf = 0;

    try {
      if (process.env.NODE_ENV !== 'production' && (window as unknown as { __ROOM_FAIL__?: boolean }).__ROOM_FAIL__) {
        throw new Error('room test failure');
      }

      const r = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      renderer = r;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
      r.setSize(window.innerWidth, window.innerHeight, false);
      const canvas = r.domElement;
      wrap.appendChild(canvas);
      cleanups.push(() => canvas.remove());
      listen(canvas, 'webglcontextlost', (e: Event) => {
        e.preventDefault();
        fail();
      });

      const built = buildRoom();
      room = built;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1c1f);
      scene.add(built.group);

      const camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.05, 30);
      camera.rotation.order = 'YXZ';

      const reduced = prefersReducedMotion();
      let player: PlayerState = { pos: { ...START.pos }, yaw: START.yaw };
      let pitch = 0;
      let mode: Mode = 'walk';
      let ease: { from: PlayerState; fromPitch: number; start: number } | null = null;
      const keys = new Set<string>();
      let locked = false;
      let drag: { x: number; y: number; moved: boolean; wasLocked: boolean } | null = null;
      let lastNearby: Interactable | null = null;
      let lastTitle = '';
      let lastAttrs = '';

      const ctx = () => audioRef.current?.ctx ?? null;
      const suspendAudio = () => void ctx()?.suspend().catch(() => {});
      const resumeAudio = () => {
        const c = ctx();
        if (c && c.state === 'suspended') void c.resume().catch(() => {});
      };

      const exitLock = () => {
        try {
          if (document.pointerLockElement === canvas) document.exitPointerLock();
        } catch {
          // ignore
        }
      };
      const requestLock = () => {
        try {
          const res = canvas.requestPointerLock?.() as unknown;
          if (res && typeof (res as Promise<void>).then === 'function') (res as Promise<void>).catch(() => {});
        } catch {
          // refused: drag-look stays available
        }
      };

      const openDemo = () => {
        mode = 'demo';
        ease = null;
        suspendAudio();
        setDemoOpen(true);
      };

      const interact = (t: Interactable) => {
        if (mode !== 'walk') return;
        if (t === 'ipod') {
          void audioRef.current?.player.next().catch(() => {});
          return;
        }
        exitLock();
        keys.clear();
        drag = null;
        mode = 'easing';
        ease = { from: { pos: { ...player.pos }, yaw: player.yaw }, fromPitch: pitch, start: -1 };
      };

      apiRef.current = {
        interact,
        closeDemo() {
          if (mode !== 'demo') return;
          mode = 'walk';
          keys.clear();
          if (!document.hidden) resumeAudio();
          setDemoOpen(false);
        },
      };
      cleanups.push(() => {
        apiRef.current = null;
      });

      // Keyboard: always available, with or without the pointer lock.
      listen(window, 'keydown', (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const code = keyCode(e);
        if (mode !== 'walk') return;
        if (code === 'KeyE') {
          if (!e.repeat) {
            const near = nearestInteractable(player.pos);
            if (near) interact(near);
          }
          return;
        }
        if (code.startsWith('Arrow')) e.preventDefault();
        keys.add(code);
      });
      listen(window, 'keyup', (e: KeyboardEvent) => keys.delete(keyCode(e)));
      listen(window, 'blur', () => keys.clear());

      // Mouse: pointer-locked look, or click-drag look when the lock is unavailable.
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const pick = (clientX: number | null, clientY: number | null) => {
        if (clientX === null || clientY === null) ndc.set(0, 0);
        else {
          const rect = canvas.getBoundingClientRect();
          ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        }
        raycaster.setFromCamera(ndc, camera);
        const hit = raycaster.intersectObjects([built.ipod, built.computer], true)[0];
        return hit ? interactableOf(hit.object) : null;
      };
      const look = (dx: number, dy: number) => {
        if (mode !== 'walk') return;
        player = { pos: player.pos, yaw: normalizeYaw(player.yaw - dx * LOOK_SPEED) };
        pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch - dy * LOOK_SPEED));
      };
      listen(document, 'pointerlockchange', () => {
        locked = document.pointerLockElement === canvas;
        wrap.dataset.locked = String(locked);
      });
      listen(canvas, 'mousedown', (e: MouseEvent) => {
        if (e.button !== 0) return;
        drag = { x: e.clientX, y: e.clientY, moved: false, wasLocked: locked };
      });
      listen(window, 'mousemove', (e: MouseEvent) => {
        if (locked) {
          look(e.movementX || 0, e.movementY || 0);
          return;
        }
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        drag.moved = true;
        look(dx, dy);
        drag.x = e.clientX;
        drag.y = e.clientY;
      });
      listen(window, 'mouseup', (e: MouseEvent) => {
        const d = drag;
        drag = null;
        if (!d || d.moved || e.button !== 0 || mode !== 'walk') return;
        const t = d.wasLocked ? pick(null, null) : pick(e.clientX, e.clientY);
        if (t && inClickRange(player.pos, t)) interact(t);
        else if (!d.wasLocked) requestLock();
      });

      const onResize = () => {
        r.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      };
      listen(window, 'resize', onResize);

      let last = 0;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = last ? (now - last) / 1000 : 0;
        last = now;
        if (mode === 'walk') {
          const has = (s: Set<string>) => [...s].some((k) => keys.has(k));
          const input = {
            forward: (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0),
            strafe: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
            turn: (has(TURN_LEFT) ? 1 : 0) - (has(TURN_RIGHT) ? 1 : 0),
          };
          if (input.forward || input.strafe || input.turn) player = stepPlayer(player, input, dt, SOLIDS, ROOM_BOUNDS);
        } else if (mode === 'easing' && ease) {
          if (ease.start < 0) ease.start = now;
          const t = reduced ? 1 : Math.min(1, (now - ease.start) / EASE_MS);
          const k = smoothstep(t);
          const dYaw = normalizeYaw(DESK_POSE.yaw - ease.from.yaw);
          player = {
            pos: { x: lerp(ease.from.pos.x, DESK_POSE.x, k), z: lerp(ease.from.pos.z, DESK_POSE.z, k) },
            yaw: normalizeYaw(ease.from.yaw + dYaw * k),
          };
          pitch = lerp(ease.fromPitch, DESK_POSE.pitch, k);
          if (t >= 1) openDemo();
        }

        camera.position.set(player.pos.x, EYE_HEIGHT, player.pos.z);
        camera.rotation.set(pitch, player.yaw, 0);
        r.render(scene, camera);

        const near = mode === 'walk' ? nearestInteractable(player.pos) : lastNearby;
        if (near !== lastNearby) {
          lastNearby = near;
          setNearby(near);
        }
        const a = audioRef.current;
        const tt = a ? a.player.title : '';
        if (tt !== lastTitle) {
          lastTitle = tt;
          setTitle(tt);
        }
        const x = player.pos.x.toFixed(3);
        const z = player.pos.z.toFixed(3);
        const y = player.yaw.toFixed(3);
        const attrs = `${x}|${z}|${y}`;
        if (attrs !== lastAttrs) {
          lastAttrs = attrs;
          wrap.dataset.playerX = x;
          wrap.dataset.playerZ = z;
          wrap.dataset.playerYaw = y;
          a?.player.setListenerPose(player.pos.x, player.pos.z, player.yaw);
        }
      };

      const startLoop = () => {
        if (raf) return;
        last = 0;
        raf = requestAnimationFrame(frame);
      };
      const stopLoop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };
      listen(document, 'visibilitychange', () => {
        if (document.hidden) {
          stopLoop();
          keys.clear();
          suspendAudio();
        } else {
          startLoop();
          if (mode !== 'demo') resumeAudio();
        }
      });
      cleanups.push(stopLoop, exitLock);
      if (!document.hidden) startLoop();
    } catch {
      // Set up as far as it got; tear it down and hand back to the normal site.
      queueMicrotask(fail);
    }

    return () => {
      failed = true; // no failure reports once the room is going away
      for (const c of cleanups.reverse()) {
        try {
          c();
        } catch {
          // keep cleaning up
        }
      }
      try {
        renderer?.dispose();
        renderer?.forceContextLoss();
      } catch {
        // ignore
      }
      room?.dispose();
    };
  }, []);

  // Focus: into the room on mount, into the demo when it opens, back to the
  // computer button when it closes.
  useEffect(() => {
    rootRef.current?.focus();
  }, []);
  useEffect(() => {
    if (demoOpen) {
      wasOpen.current = true;
      overlayRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        const skip = [...(overlayRef.current?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === 'Skip');
        if (skip) skip.click();
        else apiRef.current?.closeDemo();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      rootRef.current?.querySelector<HTMLButtonElement>('[data-hud-computer]')?.focus();
    }
  }, [demoOpen]);

  const onInteract = useCallback((t: Interactable) => apiRef.current?.interact(t), []);
  const onFinish = useCallback(() => apiRef.current?.closeDemo(), []);

  return (
    <div ref={rootRef} className={styles.room} role="dialog" aria-modal="true" aria-label="AVIOUS studio room" tabIndex={-1}>
      <div inert={demoOpen}>
        <div ref={wrapRef} className={styles.canvasWrap} data-testid="room-canvas" role="img" aria-label={ROOM.canvasLabel} />
        <Hud nearby={nearby} trackTitle={title} onInteract={onInteract} onLeave={onLeave} />
      </div>
      {demoOpen && (
        <div ref={overlayRef} className={styles.demoOverlay} role="dialog" aria-modal="true" aria-label={ROOM.demoLabel} tabIndex={-1}>
          <div className={styles.demoBar}>
            <button type="button" className={styles.hudBtn} onClick={onLeave}>
              {ROOM.leaveButton}
            </button>
          </div>
          <div className={styles.demoFrame}>
            <PremonitionDemo bootSequence onFinish={onFinish} />
          </div>
        </div>
      )}
    </div>
  );
}
