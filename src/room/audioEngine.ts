import type { Track } from '@/content/tracks';
import { SPEAKER_LEFT, SPEAKER_RIGHT } from './layout';

// Design decisions (each one is asserted in audioEngine.test.ts):
//  a) While a crossfade is in flight (fetch, decode and fade included) further
//     next() calls are ignored and return the same in-flight promise, so the
//     playlist advances exactly once per completed fade.
//  b) A track that fails to fetch or decode fires onError once with its id and
//     the player moves on to the next track that works. If every track fails,
//     onError fires once per track and playback stays silent; no retry loop,
//     no throw. During next(), if no other track works, the current one keeps
//     playing.
//     next() before or during start() waits for start() (calling it if needed)
//     and then advances, so only one source ever plays.
//  c) The playlist loops (next() wraps to the first track). Each track also
//     loops until next() is called. With a single track next() does nothing.
//  d) start() resumes a suspended context. A rejected resume is reported
//     through onError with trackId 'audio-context' and start() still returns
//     normally.
//  e) dispose() is idempotent: it stops sources, disconnects nodes, settles any
//     pending fade, and a fetch or decode that resolves afterwards is dropped.
// Fades use setValueCurveAtTime with curves sampled from crossfadeGains, so the
// gain automation is equal-power on both sides of the fade.
// Routing: source -> fade gain -> master gain -> two panners at the speaker
// positions -> out (the caller passes ctx.destination).

export const CROSSFADE_SECONDS = 1.5;
export const DEFAULT_VOLUME = 0.8;
const CURVE_POINTS = 64;
const SPEAKER_HEIGHT = 1.0;

export function crossfadeGains(t: number, duration: number): { out: number; in: number } {
  const p = duration > 0 ? Math.min(Math.max(t, 0), duration) / duration : 1;
  return { out: Math.cos((p * Math.PI) / 2), in: Math.sin((p * Math.PI) / 2) };
}

/** Id reported through onError when the audio context could not be resumed. */
export const AUDIO_CONTEXT_ERROR = 'audio-context';

/**
 * True when the HUD should say audio is unavailable instead of naming a track:
 * the context could not resume, the current track failed, or every track failed.
 */
export function isAudioUnavailable(
  failures: readonly string[],
  tracks: ReadonlyArray<{ id: string }>,
  index: number,
): boolean {
  if (failures.length === 0) return false;
  const failed = new Set(failures);
  if (failed.has(AUDIO_CONTEXT_ERROR)) return true;
  const current = tracks[index];
  if (current && failed.has(current.id)) return true;
  return tracks.length > 0 && tracks.every((t) => failed.has(t.id));
}

type Live = { source: AudioBufferSourceNode; gain: GainNode };
type FetchFn = (url: string) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;

function center(b: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
}

export class TrackPlayer {
  private readonly master: GainNode;
  private readonly panners: PannerNode[] = [];
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly errorCbs: Array<(e: { trackId: string }) => void> = [];
  private current: Live | null = null;
  private inFlight: Promise<void> | null = null;
  private startPromise: Promise<void> | null = null;
  private settleFade: (() => void) | null = null;
  private disposed = false;
  private _index = 0;
  private _volume = DEFAULT_VOLUME;
  // Nothing plays until play() or select() is called (the iPod's play button).
  // userPaused is the visitor's pause; held is the room suspending audio while
  // the tab is hidden or an overlay is up. Neither may restart the other's pause.
  private userPaused = false;
  private held = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly tracks: Track[],
    out: AudioNode,
    private readonly fetchFn: FetchFn = (u) => fetch(u),
  ) {
    this.master = ctx.createGain();
    this.master.gain.value = DEFAULT_VOLUME;
    for (const box of [SPEAKER_LEFT, SPEAKER_RIGHT]) {
      const c = center(box);
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 1.5;
      p.rolloffFactor = 1;
      if (p.positionX) {
        p.positionX.value = c.x;
        p.positionY.value = SPEAKER_HEIGHT;
        p.positionZ.value = c.z;
      } else {
        p.setPosition(c.x, SPEAKER_HEIGHT, c.z);
      }
      this.master.connect(p);
      p.connect(out);
      this.panners.push(p);
    }
  }

  get index(): number {
    return this._index;
  }

  get title(): string {
    return this.tracks[this._index]?.title ?? '';
  }

  /** True while a track is sounding (started and not paused). */
  get playing(): boolean {
    return !this.disposed && this.current !== null && !this.userPaused;
  }

  get volume(): number {
    return this._volume;
  }

  /** 0 to 1; anything else is clamped, NaN becomes 0. */
  setVolume(v: number): void {
    if (this.disposed) return;
    const clamped = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
    this._volume = clamped;
    this.master.gain.value = clamped;
  }

  /** Start the selected track, or resume after pause(). */
  async play(): Promise<void> {
    if (this.disposed) return;
    this.userPaused = false;
    if (!this.startPromise) await this.start();
    this.applySuspension();
  }

  pause(): void {
    if (this.disposed || !this.current) return;
    this.userPaused = true;
    this.applySuspension();
  }

  togglePlay(): Promise<void> {
    if (this.playing) {
      this.pause();
      return Promise.resolve();
    }
    return this.play();
  }

  /**
   * Previous (-1) or next (+1) track. Before anything has played this only
   * moves the selection, so nothing is fetched or heard until play().
   */
  step(dir: 1 | -1): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const n = this.tracks.length;
    if (n < 2) return Promise.resolve();
    if (!this.startPromise) {
      this._index = (this._index + dir + n) % n;
      return Promise.resolve();
    }
    if (this.inFlight) return this.inFlight;
    this.userPaused = false;
    this.applySuspension();
    return this.track(() => this.doStep(dir));
  }

  /** Play track `index` now: starts it, or crossfades to it, or resumes it if it is already current. */
  select(index: number): Promise<void> {
    if (this.disposed || !Number.isInteger(index) || index < 0 || index >= this.tracks.length) return Promise.resolve();
    if (!this.startPromise) {
      this._index = index;
      return this.play();
    }
    if (index === this._index) return this.play();
    if (this.inFlight) return this.inFlight;
    this.userPaused = false;
    this.applySuspension();
    return this.track(() => this.doSelect(index));
  }

  /** The room suspends audio (hidden tab, overlay) without disturbing a visitor's pause. */
  hold(): void {
    this.held = true;
    this.applySuspension();
  }

  release(): void {
    this.held = false;
    this.applySuspension();
  }

  onError(cb: (e: { trackId: string }) => void): void {
    this.errorCbs.push(cb);
  }

  setListenerPose(x: number, z: number, yaw: number): void {
    if (this.disposed) return;
    const l = this.ctx.listener;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    if (l.positionX) {
      l.positionX.value = x;
      l.positionY.value = 1.6;
      l.positionZ.value = z;
      l.forwardX.value = fx;
      l.forwardY.value = 0;
      l.forwardZ.value = fz;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    } else {
      l.setPosition(x, 1.6, z);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  start(): Promise<void> {
    if (!this.startPromise) this.startPromise = this.doStart();
    return this.startPromise;
  }

  next(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    if (this.tracks.length < 2) return Promise.resolve();
    // Serialized with start(): next() first awaits start() (calling it when it
    // has not been called yet), then advances, so exactly one source plays.
    const run = this.start().then(() => this.doNext()).finally(() => {
      if (this.inFlight === run) this.inFlight = null;
    });
    this.inFlight = run;
    return run;
  }

  private track(fn: () => Promise<void>): Promise<void> {
    const run = this.start().then(fn).finally(() => {
      if (this.inFlight === run) this.inFlight = null;
    });
    this.inFlight = run;
    return run;
  }

  private applySuspension(): void {
    if (this.disposed || !this.startPromise) return;
    const want = this.userPaused || this.held;
    try {
      if (want && this.ctx.state === 'running') void this.ctx.suspend()?.catch?.(() => {});
      else if (!want && this.ctx.state === 'suspended') void this.ctx.resume()?.catch?.(() => {});
    } catch {
      // a context that cannot suspend or resume is left as it is
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.current) this.teardown(this.current);
    this.current = null;
    this.settleFade?.();
    this.errorCbs.length = 0;
    for (const p of this.panners) p.disconnect();
    this.master.disconnect();
    this.buffers.clear();
  }

  private emitError(trackId: string): void {
    for (const cb of [...this.errorCbs]) {
      try {
        cb({ trackId });
      } catch {
        // a faulty listener must not break playback
      }
    }
  }

  private async doStart(): Promise<void> {
    if (this.disposed) return;
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        this.emitError(AUDIO_CONTEXT_ERROR);
      }
    }
    const n = this.tracks.length;
    for (let k = 0; k < n; k++) {
      const i = (this._index + k) % n;
      if (this.disposed) return;
      const buf = await this.load(this.tracks[i]);
      if (this.disposed) return;
      if (!buf) continue;
      if (this.current) return; // never clobber a source something else claimed
      this._index = i;
      this.current = this.startSource(buf, 1);
      return;
    }
  }

  private doNext(): Promise<void> {
    return this.doStep(1);
  }

  private async doSelect(index: number): Promise<void> {
    if (this.disposed || !this.current) return;
    const buf = await this.load(this.tracks[index]);
    if (this.disposed || !buf) return;
    await this.fadeTo(buf, index);
  }

  private async doStep(dir: 1 | -1): Promise<void> {
    if (this.disposed || !this.current) return; // nothing playing: stay silent
    const n = this.tracks.length;
    for (let step = 1; step < n; step++) {
      const i = (((this._index + dir * step) % n) + n) % n;
      const buf = await this.load(this.tracks[i]);
      if (this.disposed) return;
      if (!buf) continue;
      await this.fadeTo(buf, i);
      return;
    }
  }

  private async load(track: Track): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(track.id);
    if (cached) return cached;
    try {
      const res = await this.fetchFn(track.src);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(data);
      if (this.disposed) return null;
      this.buffers.set(track.id, buf);
      return buf;
    } catch {
      if (!this.disposed) this.emitError(track.id);
      return null;
    }
  }

  private startSource(buffer: AudioBuffer, initialGain: number): Live {
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = initialGain;
    source.connect(gain);
    gain.connect(this.master);
    source.start();
    return { source, gain };
  }

  private teardown(l: Live): void {
    try {
      l.source.stop();
    } catch {
      // already stopped
    }
    l.source.disconnect();
    l.gain.disconnect();
  }

  private async fadeTo(buffer: AudioBuffer, index: number): Promise<void> {
    const old = this.current;
    const incoming = this.startSource(buffer, 0);
    const outCurve = new Float32Array(CURVE_POINTS);
    const inCurve = new Float32Array(CURVE_POINTS);
    for (let k = 0; k < CURVE_POINTS; k++) {
      const g = crossfadeGains((k / (CURVE_POINTS - 1)) * CROSSFADE_SECONDS, CROSSFADE_SECONDS);
      outCurve[k] = g.out;
      inCurve[k] = g.in;
    }
    const now = this.ctx.currentTime;
    incoming.gain.gain.setValueCurveAtTime(inCurve, now, CROSSFADE_SECONDS);
    old?.gain.gain.setValueCurveAtTime(outCurve, now, CROSSFADE_SECONDS);
    this.current = incoming;
    this._index = index;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, CROSSFADE_SECONDS * 1000);
      const self = this;
      function done() {
        clearTimeout(timer);
        self.settleFade = null;
        resolve();
      }
      this.settleFade = done;
    });
    if (old) this.teardown(old);
  }
}
