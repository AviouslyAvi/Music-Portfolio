'use client';

// The walk-in room. Only ever loaded through next/dynamic (ssr: false) by
// RoomGate after the visitor clicks Enter, so three.js stays out of every
// other bundle. Pure logic lives in movement.ts and layout.ts; this file wires
// it to the renderer, the input devices and the HUD.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { PremonitionDemo } from '@/demo/PremonitionDemo';
import { ROOM } from '@/content/copy';
import { buildRoom, type Room } from './buildRoom';
import { stepPlayer, normalizeYaw, type PlayerState } from './movement';
import {
  SOLIDS, ROOM_BOUNDS, START, IPOD_POS, COMPUTER_POS, INTERACT_RADIUS, nearestInteractable, type Interactable,
} from './layout';
import { isAudioUnavailable, DEFAULT_VOLUME, type TrackPlayer } from './audioEngine';
import { TRACKS } from '@/content/tracks';
import { Hud } from './Hud';
import { InteractPrompt } from './InteractPrompt';
import { IpodScreen } from './ipod/IpodScreen';
import type { IpodAction } from './ipod/menu';
import styles from './room.module.css';

export type RoomAudio = { ctx: AudioContext; player: TrackPlayer };

const EYE_HEIGHT = 1.6;
const FOV = 70;
const MAX_PIXEL_RATIO = 1.5;
const LOOK_SPEED = 0.0025; // radians per pixel of mouse travel
const MAX_PITCH = 1.2;
const DRAG_THRESHOLD = 4; // pixels before a press counts as a drag, not a click
const CLICK_RANGE = INTERACT_RADIUS * 1.5;
const EASE_MS = 1100;
// Walking and turning ramp toward the held keys instead of snapping to them.
const MOVE_RESPONSE = 9; // 1/s; about 110 ms to settle
// Mouse look is spread over a few frames so it glides rather than steps.
const LOOK_RESPONSE = 22; // 1/s
const MAX_FRAME_DT = 0.05; // a hitch must not become a lurch
// Seated in front of the screen, looking down at it a little.
const DESK_POSE = { x: COMPUTER_POS.x, z: -1.85, yaw: 0, pitch: -0.5 };

// Close in front of the iPod, looking down at its screen.
const IPOD_POSE = { x: IPOD_POS.x, z: -2.05, yaw: 0, pitch: -1.0 };
const VOLUME_STEP = 0.05;

type Pose = { x: number; z: number; yaw: number; pitch: number };
type Mode = 'walk' | 'easing' | 'demo' | 'ipod';
type Api = { interact(t: Interactable): void; closeDemo(): void; closeIpod(): void; ipodToComputer(): void };

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

const NO_FAILURES: string[] = [];

const smootherstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function RoomExperience({
  onLeave,
  onFail,
  audio = null,
  audioFailures = NO_FAILURES,
}: {
  onLeave: () => void;
  onFail: () => void;
  audio?: RoomAudio | null;
  /** Track ids (or 'audio-context') the player reported through onError. */
  audioFailures?: string[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const ipodPromptRef = useRef<HTMLButtonElement>(null);
  const computerPromptRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [demoOpen, setDemoOpen] = useState(false);
  const [ipodOpen, setIpodOpen] = useState(false);
  const wasOpen = useRef(false);
  const wasIpodOpen = useRef(false);

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
      let ease: { from: PlayerState; fromPitch: number; start: number; to: Pose; then: 'demo' | 'ipod' | 'walk' } | null = null;
      let returnPose: Pose = { x: START.pos.x, z: START.pos.z, yaw: START.yaw, pitch: 0 };
      const keys = new Set<string>();
      // Input as the player feels it (ramped), and mouse travel not yet applied.
      const felt = { forward: 0, strafe: 0, turn: 0 };
      let lookX = 0;
      let lookY = 0;
      let locked = false;
      let drag: { x: number; y: number; moved: boolean; wasLocked: boolean } | null = null;
      let lastNearby: Interactable | null = null;
      let lastTitle = '';
      let lastPlaying = false;
      let lastVolume = DEFAULT_VOLUME;
      // Where each floating prompt hangs: just above the object, in world space.
      built.group.updateMatrixWorld(true);
      const anchorOf = (o: THREE.Object3D) => {
        const box = new THREE.Box3().setFromObject(o);
        const c = box.getCenter(new THREE.Vector3());
        return new THREE.Vector3(c.x, box.max.y + 0.12, c.z);
      };
      const ipodAnchor = anchorOf(built.ipod);
      const computerAnchor = anchorOf(built.computer);
      const projected = new THREE.Vector3();
      let lastAttrs = '';

      // Hidden tab or an overlay: hold the audio. A visitor's own pause is never undone by release.
      const suspendAudio = () => audioRef.current?.player.hold();
      const resumeAudio = () => audioRef.current?.player.release();

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

      const openIpod = () => {
        mode = 'ipod';
        ease = null;
        setIpodOpen(true);
      };

      const startEase = (to: Pose, then: 'demo' | 'ipod' | 'walk') => {
        exitLock();
        keys.clear();
        felt.forward = felt.strafe = felt.turn = 0;
        lookX = lookY = 0;
        drag = null;
        mode = 'easing';
        ease = { from: { pos: { ...player.pos }, yaw: player.yaw }, fromPitch: pitch, start: -1, to, then };
      };

      // Pressing E (or clicking the object or its prompt) zooms the camera in; the
      // computer opens the plugin screen, the iPod opens the click-wheel iPod.
      const interact = (t: Interactable) => {
        if (mode !== 'walk') return;
        returnPose = { x: player.pos.x, z: player.pos.z, yaw: player.yaw, pitch };
        startEase(t === 'ipod' ? IPOD_POSE : DESK_POSE, t === 'ipod' ? 'ipod' : 'demo');
      };

      apiRef.current = {
        interact,
        closeIpod() {
          if (mode !== 'ipod') return;
          setIpodOpen(false);
          startEase(returnPose, 'walk');
        },
        ipodToComputer() {
          if (mode !== 'ipod') return;
          setIpodOpen(false);
          startEase(DESK_POSE, 'demo');
        },
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
        lookX += dx;
        lookY += dy;
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
          const mx = e.movementX || 0;
          const my = e.movementY || 0;
          // Looking around between press and release is not a click.
          if (drag && (mx || my)) drag.moved = true;
          look(mx, my);
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

      // Move a floating prompt to its object's screen position, or hide it.
      const placePrompt = (el: HTMLButtonElement | null, anchor: THREE.Vector3, show: boolean) => {
        if (!el) return;
        let visible = false;
        if (show) {
          projected.copy(anchor).project(camera);
          // In front of the camera: hang the label on the object, kept inside the
          // screen (up close the object can sit just below the view).
          if (projected.z > -1 && projected.z < 1) {
            const cx = Math.max(-0.85, Math.min(0.85, projected.x));
            const cy = Math.max(-0.7, Math.min(0.8, projected.y));
            const x = (cx * 0.5 + 0.5) * window.innerWidth;
            const y = (-cy * 0.5 + 0.5) * window.innerHeight;
            el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
            visible = true;
          }
        }
        const want = visible ? 'true' : 'false';
        if (el.dataset.visible !== want) el.dataset.visible = want;
      };

      let last = 0;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        try {
          const dt = last ? Math.min((now - last) / 1000, MAX_FRAME_DT) : 0;
          last = now;
          if (mode === 'walk') {
            const has = (s: Set<string>) => [...s].some((k) => keys.has(k));
            const want = {
              forward: (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0),
              strafe: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0),
              turn: (has(TURN_LEFT) ? 1 : 0) - (has(TURN_RIGHT) ? 1 : 0),
            };
            const a = reduced ? 1 : 1 - Math.exp(-dt * MOVE_RESPONSE);
            for (const axis of ['forward', 'strafe', 'turn'] as const) {
              felt[axis] += (want[axis] - felt[axis]) * a;
              if (Math.abs(felt[axis] - want[axis]) < 0.001) felt[axis] = want[axis];
            }
            if (felt.forward || felt.strafe || felt.turn) player = stepPlayer(player, felt, dt, SOLIDS, ROOM_BOUNDS);
            if (lookX || lookY) {
              const l = reduced ? 1 : 1 - Math.exp(-dt * LOOK_RESPONSE);
              const dx = Math.abs(lookX) < 0.05 ? lookX : lookX * l;
              const dy = Math.abs(lookY) < 0.05 ? lookY : lookY * l;
              lookX -= dx;
              lookY -= dy;
              player = { pos: player.pos, yaw: normalizeYaw(player.yaw - dx * LOOK_SPEED) };
              pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch - dy * LOOK_SPEED));
            }
          } else if (mode === 'easing' && ease) {
            if (ease.start < 0) ease.start = now;
            const t = reduced ? 1 : Math.min(1, (now - ease.start) / EASE_MS);
            const k = smootherstep(t);
            const to = ease.to;
            const dYaw = normalizeYaw(to.yaw - ease.from.yaw);
            player = {
              pos: { x: lerp(ease.from.pos.x, to.x, k), z: lerp(ease.from.pos.z, to.z, k) },
              yaw: normalizeYaw(ease.from.yaw + dYaw * k),
            };
            pitch = lerp(ease.fromPitch, to.pitch, k);
            if (t >= 1) {
              const then = ease.then;
              ease = null;
              if (then === 'demo') openDemo();
              else if (then === 'ipod') openIpod();
              else {
                mode = 'walk';
                keys.clear();
              }
            }
          }

          camera.position.set(player.pos.x, EYE_HEIGHT, player.pos.z);
          camera.rotation.set(pitch, player.yaw, 0);
          r.render(scene, camera);

          const near = mode === 'walk' ? nearestInteractable(player.pos) : null;
          lastNearby = near;
          placePrompt(ipodPromptRef.current, ipodAnchor, near === 'ipod');
          placePrompt(computerPromptRef.current, computerAnchor, near === 'computer');
          const a = audioRef.current;
          const tt = a ? a.player.title : '';
          if (tt !== lastTitle) {
            lastTitle = tt;
            setTitle(tt);
            setTrackIndex(a ? a.player.index : 0);
          }
          const isPlaying = a ? a.player.playing : false;
          if (isPlaying !== lastPlaying) {
            lastPlaying = isPlaying;
            setPlaying(isPlaying);
          }
          const vol = a ? a.player.volume : DEFAULT_VOLUME;
          if (vol !== lastVolume) {
            lastVolume = vol;
            setVolume(vol);
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
        } catch {
          // A broken frame hands back to the normal site once.
          stopLoop();
          fail();
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

  // Focus: into the room on mount, into the demo or the iPod when it opens,
  // back to the room when it closes.
  useEffect(() => {
    rootRef.current?.focus();
  }, []);
  useEffect(() => {
    if (ipodOpen) {
      wasIpodOpen.current = true;
      // Escape anywhere puts the iPod down (the iPod itself steps back first when it has focus).
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') apiRef.current?.closeIpod();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    if (wasIpodOpen.current) {
      wasIpodOpen.current = false;
      rootRef.current?.focus();
    }
  }, [ipodOpen]);
  useEffect(() => {
    if (demoOpen) {
      wasOpen.current = true;
      overlayRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        // The demo's own Skip, so demo_skipped is tracked and its audio stops.
        const skip = overlayRef.current?.querySelector<HTMLButtonElement>('[data-demo-skip]');
        if (skip) skip.click();
        else apiRef.current?.closeDemo();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      rootRef.current?.focus();
    }
  }, [demoOpen]);

  const onInteract = useCallback((t: Interactable) => apiRef.current?.interact(t), []);
  const leaveRef0 = useRef(onLeave);
  leaveRef0.current = onLeave;
  const onIpodAction = useCallback(
    (a: IpodAction) => {
      const player = audioRef.current?.player;
      switch (a.type) {
        case 'select-track':
          void player?.select(a.trackIndex).catch(() => {});
          break;
        case 'toggle-play':
          void player?.togglePlay().catch(() => {});
          break;
        case 'step':
          void player?.step(a.dir).catch(() => {});
          break;
        case 'volume':
          if (player) player.setVolume(Math.round((player.volume + a.delta * VOLUME_STEP) * 100) / 100);
          break;
        case 'computer':
          apiRef.current?.ipodToComputer();
          break;
        case 'leave':
          leaveRef0.current();
          break;
        case 'link':
          leaveRef0.current();
          router.push(a.href);
          break;
        case 'close':
          apiRef.current?.closeIpod();
          break;
      }
    },
    [router],
  );
  // After the demo, finished or skipped, the full site opens: the same path as
  // "Leave the room" (room:left is set and the room unmounts).
  const leaveRef = useRef(onLeave);
  leaveRef.current = onLeave;
  const onFinish = useCallback(() => leaveRef.current(), []);

  return (
    <div ref={rootRef} className={styles.room} role="dialog" aria-modal="true" aria-label="AVIOUS studio room" tabIndex={-1}>
      <div inert={demoOpen || ipodOpen}>
        <div ref={wrapRef} className={styles.canvasWrap} data-testid="room-canvas" role="img" aria-label={ROOM.canvasLabel} />
        <InteractPrompt ref={ipodPromptRef} target="ipod" onActivate={() => onInteract('ipod')} />
        <InteractPrompt ref={computerPromptRef} target="computer" onActivate={() => onInteract('computer')} />
      </div>
      <Hud
        trackTitle={playing ? title : ''}
        audioError={isAudioUnavailable(audioFailures, TRACKS, trackIndex)}
        onSkip={onLeave}
      />
      {ipodOpen && (
        <div className={styles.ipodOverlay} role="dialog" aria-modal="true" aria-label={ROOM.ipodLabel}>
          <IpodScreen tracks={TRACKS} currentIndex={trackIndex} playing={playing} volume={volume} onAction={onIpodAction} />
        </div>
      )}
      {demoOpen && (
        <div ref={overlayRef} className={styles.demoOverlay} role="dialog" aria-modal="true" aria-label={ROOM.demoLabel} tabIndex={-1}>
          <div className={styles.demoFrame}>
            <PremonitionDemo bootSequence onFinish={onFinish} />
          </div>
        </div>
      )}
    </div>
  );
}
