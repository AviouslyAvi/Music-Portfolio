import type { Track } from '@/content/tracks';
import { SPEAKERS } from './layout';

// Design decisions (each one is asserted in audioEngine.test.ts):
//  a) Track changes are immediate: select(), step() and next() cut the old source
//     and start the new one as soon as its audio is decoded, with no fade. The
//     latest request wins: a click while an earlier one is still loading
//     supersedes it, and the superseded load never starts a source.
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
//  e) dispose() is idempotent: it stops sources, disconnects nodes, and a fetch
//     or decode that resolves afterwards is dropped.
//  f) While a track plays, the bytes of its two neighbours are fetched in the
//     background (not decoded, to keep memory low) so a step lands quickly.
//     A failed prefetch is silent; the real load retries and reports.
// Routing: source -> gain -> master gain -> two panners at the speaker
// positions -> out (the caller passes ctx.destination).

export const DEFAULT_VOLUME = 0.8;

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

export class TrackPlayer {
  private readonly master: GainNode;
  private readonly panners: PannerNode[] = [];
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly errorCbs: Array<(e: { trackId: string }) => void> = [];
  private current: Live | null = null;
  private startPromise: Promise<void> | null = null;
  private readonly rawBytes = new Map<string, Promise<ArrayBuffer>>();
  // Bumped by every step/select/next; a load that finds it changed has been superseded.
  private switchToken = 0;
  // Where the latest step/select is headed, so a second click steps from there.
  private pending: number | null = null;
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
    for (const c of SPEAKERS) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 1.5;
      p.rolloffFactor = 1;
      if (p.positionX) {
        p.positionX.value = c.x;
        p.positionY.value = c.y;
        p.positionZ.value = c.z;
      } else {
        p.setPosition(c.x, c.y, c.z);
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
    this.userPaused = false;
    this.applySuspension();
    return this.stepFromPending(dir);
  }

  /** Play track `index` now: starts it, or cuts straight to it, or resumes it if it is already current. */
  select(index: number): Promise<void> {
    if (this.disposed || !Number.isInteger(index) || index < 0 || index >= this.tracks.length) return Promise.resolve();
    if (!this.startPromise) {
      this._index = index;
      return this.play();
    }
    if (index === this._index && this.pending === null) return this.play();
    this.userPaused = false;
    this.applySuspension();
    this.pending = index;
    return this.switchWith((token) => this.doSelect(index, token));
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
    if (this.disposed || this.tracks.length < 2) return Promise.resolve();
    // Serialized with start(): next() first awaits start() (calling it when it
    // has not been called yet), then advances, so exactly one source plays.
    return this.stepFromPending(1);
  }

  private stepFromPending(dir: 1 | -1): Promise<void> {
    const n = this.tracks.length;
    const from = this.pending ?? this._index;
    this.pending = (from + dir + n) % n; // claimed now, so a second click steps from here
    return this.switchWith((token) => this.doStep(dir, from, token));
  }

  private switchWith(fn: (token: number) => Promise<void>): Promise<void> {
    const token = ++this.switchToken;
    return this.start()
      .then(() => fn(token))
      .finally(() => {
        if (this.switchToken === token) this.pending = null;
      });
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
    this.errorCbs.length = 0;
    for (const p of this.panners) p.disconnect();
    this.master.disconnect();
    this.buffers.clear();
    this.rawBytes.clear();
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
      this.prefetchNeighbours();
      return;
    }
  }

  private async doSelect(index: number, token: number): Promise<void> {
    if (this.disposed || !this.current) return;
    const buf = await this.load(this.tracks[index]);
    if (this.disposed || !buf || token !== this.switchToken) return;
    this.swapTo(buf, index);
  }

  private async doStep(dir: 1 | -1, from: number, token: number): Promise<void> {
    if (this.disposed || !this.current) return; // nothing playing: stay silent
    const n = this.tracks.length;
    for (let step = 1; step < n; step++) {
      const i = (((from + dir * step) % n) + n) % n;
      this.pending = i;
      const buf = await this.load(this.tracks[i]);
      if (this.disposed || token !== this.switchToken) return;
      if (!buf) continue;
      this.swapTo(buf, i);
      return;
    }
  }

  private fetchBytes(track: Track): Promise<ArrayBuffer> {
    let p = this.rawBytes.get(track.id);
    if (!p) {
      p = this.fetchFn(track.src).then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.arrayBuffer();
      });
      this.rawBytes.set(track.id, p);
    }
    return p;
  }

  private async load(track: Track): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(track.id);
    if (cached) return cached;
    try {
      const data = await this.fetchBytes(track);
      // decodeAudioData detaches its input, so decode a copy and keep the bytes for a retry.
      const buf = await this.ctx.decodeAudioData(data.slice(0));
      if (this.disposed) return null;
      this.rawBytes.delete(track.id);
      this.buffers.set(track.id, buf);
      return buf;
    } catch {
      this.rawBytes.delete(track.id);
      if (!this.disposed) this.emitError(track.id);
      return null;
    }
  }

  /** Warm the bytes of the previous and next tracks; failures are left for load() to report. */
  private prefetchNeighbours(): void {
    const n = this.tracks.length;
    if (n < 2) return;
    for (const d of [1, -1]) {
      const t = this.tracks[(((this._index + d) % n) + n) % n];
      if (this.buffers.has(t.id) || this.rawBytes.has(t.id)) continue;
      this.fetchBytes(t).catch(() => this.rawBytes.delete(t.id));
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

  private swapTo(buffer: AudioBuffer, index: number): void {
    const old = this.current;
    this.current = this.startSource(buffer, 1);
    this._index = index;
    this.pending = null;
    if (old) this.teardown(old);
    this.prefetchNeighbours();
  }
}
