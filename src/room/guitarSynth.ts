// The two guitars on the wall can be strummed, and the keyboard plays a short
// three-chord progression, one chord per press, each press lifting the last
// chord off like releasing a sustain pedal.
// The guitars: Each string is a Karplus-Strong
// pluck (a burst of noise circulating through a short, slightly damped delay
// line), rendered once into a buffer and played with a small stagger so the
// strings fan out like a real strum. The electric is in standard tuning and
// the acoustic is in open D (D A D F# A D). Sound comes from the guitar's spot
// on the wall through the same HRTF positioning and room reverb as the music,
// on its own audio context so the iPod's pause never silences it.
import { roomImpulse } from './acoustics';
import type { Vec3 } from './layout';

export type GuitarKind = 'electric' | 'acoustic';
export type InstrumentKind = GuitarKind | 'piano';

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** MIDI notes, lowest string first. */
export const TUNINGS: Record<GuitarKind, readonly number[]> = {
  electric: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4: standard tuning
  acoustic: [38, 45, 50, 54, 57, 62], // D2 A2 D3 F#3 A3 D4: open D
};

export const STRING_NAMES: Record<GuitarKind, readonly string[]> = {
  electric: ['E', 'A', 'D', 'G', 'B', 'E'],
  acoustic: ['D', 'A', 'D', 'F#', 'A', 'D'],
};

export const tuningHz = (kind: GuitarKind): number[] => TUNINGS[kind].map(midiToHz);

/**
 * The keyboard's chords as MIDI notes, low to high, played in turn:
 *   F maj9 (the 9 is the 2):   F2 C3 | F3 G3 A3 | C4 E4
 *   E, D, Ab, C, D, G:         E2 | D3 Ab3 C4 D4 G4
 *   A minor 9 (A and E bass):  A2 E3 | G3 B3 C4 E4
 */
export const PIANO_CHORDS: ReadonlyArray<{ name: string; notes: readonly number[] }> = [
  { name: 'F maj9', notes: [41, 48, 53, 55, 57, 60, 64] },
  { name: 'E D Ab C D G', notes: [40, 50, 56, 60, 62, 67] },
  { name: 'A min9', notes: [45, 52, 55, 59, 60, 64] },
];

const PIANO_SECONDS = 5;
const PIANO_NOTE_GAIN = 0.1;
const PIANO_STAGGER = 0.008; // a chord is nearly together, not rolled
const PEDAL_LIFT = 0.22; // seconds for the last chord to damp when the next is played

/**
 * One piano note as samples: a handful of slightly stretched partials, the
 * higher ones dying faster, under a quick hammer attack. Low notes ring longer.
 */
export function pianoNote(midi: number, sampleRate: number, seconds: number): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  const f0 = midiToHz(midi);
  const base = Math.max(1.6, 5.2 - (midi - 36) * 0.06); // seconds for the fundamental to fall about 60 dB
  const partials = Math.min(12, Math.floor((sampleRate * 0.45) / f0));
  const B = 0.0004;
  for (let k = 1; k <= partials; k++) {
    const f = k * f0 * Math.sqrt(1 + B * k * k);
    const w = (2 * Math.PI * f) / sampleRate;
    const amp = (1 / Math.pow(k, 1.2)) * (k % 2 === 0 ? 0.85 : 1);
    const tau = base / (1 + 0.7 * (k - 1)); // time to -60 dB
    const decay = Math.exp(-6.908 / (tau * sampleRate));
    // sin(w i) by recurrence, times an exponential envelope.
    const c = 2 * Math.cos(w);
    let y1 = Math.sin(-w);
    let y2 = Math.sin(-2 * w);
    let env = amp;
    for (let i = 0; i < n; i++) {
      const y = c * y1 - y2;
      out[i] += y * env;
      y2 = y1;
      y1 = y;
      env *= decay;
    }
  }
  // Hammer: a few milliseconds of soft noise, then a fast attack on the whole note.
  let seed = (0x9e3779b9 ^ Math.imul(midi + 1, 0x85ebca6b)) >>> 0;
  const thump = Math.floor(sampleRate * 0.012);
  for (let i = 0; i < thump; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    out[i] += (seed / 0x80000000 - 1) * 0.35 * Math.exp((-6 * i) / thump);
  }
  const attack = Math.floor(sampleRate * 0.003);
  for (let i = 0; i < attack; i++) out[i] *= i / attack;
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] /= peak;
  return out;
}

const SECONDS = 2.8;
const STRUM_STAGGER = 0.026; // seconds between strings
const STRING_GAIN = 0.13; // six strings sum to well under full scale
const STRUM_LEVEL = 0.9;

type Voice = { damping: number; bright: number };
const VOICES: Record<GuitarKind, Voice> = {
  electric: { damping: 0.9985, bright: 0.7 }, // long sustain, bright pick
  acoustic: { damping: 0.9972, bright: 0.5 }, // dies away sooner, warmer
};

/**
 * One plucked string as samples, deterministic for a given seed. The loop's
 * averaging filter makes the highs die away faster than the lows, as on a
 * real string; `bright` is how much of the initial burst is left sharp.
 */
export function pluck(freq: number, sampleRate: number, seconds: number, voice: Voice, seed: number): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  const period = Math.max(2, Math.round(sampleRate / freq));
  const line = new Float32Array(period);
  let s = (0x9e3779b9 ^ Math.imul(seed + 1, 0x85ebca6b)) >>> 0;
  let prev = 0;
  for (let i = 0; i < period; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const noise = s / 0x80000000 - 1;
    prev += (voice.bright + 0.25) * (noise - prev); // soften the burst a little
    line[i] = prev;
  }
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const a = line[idx];
    const b = line[(idx + 1) % period];
    out[i] = a;
    line[idx] = voice.damping * 0.5 * (a + b);
    idx = (idx + 1) % period;
  }
  // A short fade-in avoids a click at the very start.
  const fade = Math.floor(sampleRate * 0.002);
  for (let i = 0; i < fade; i++) out[i] *= i / fade;
  return out;
}

export class GuitarSynth {
  private ctx: AudioContext | null = null;
  private out: AudioNode | null = null;
  private readonly panners: Record<InstrumentKind, PannerNode | null> = { electric: null, acoustic: null, piano: null };
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly lastDir: Record<GuitarKind, 1 | -1> = { electric: 1, acoustic: 1 };
  private listener = { x: 0, z: 0, yaw: 0 };
  private held = false;
  private disposed = false;

  constructor(
    private readonly positions: Record<InstrumentKind, Vec3>,
    private readonly createContext: () => AudioContext | null = () => {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext ?? w.webkitAudioContext;
      return AC ? new AC() : null;
    },
  ) {}

  /** Make the audio context now (inside a click) so a later strum is allowed to sound. */
  prepare(): AudioContext | null {
    if (this.disposed) return null;
    if (this.ctx) return this.ctx;
    const ctx = this.createContext();
    if (!ctx) return null;
    this.ctx = ctx;
    const bus = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    bus.connect(limiter);
    limiter.connect(ctx.destination);
    this.out = bus;
    // The same small-room reverb as the music.
    if (typeof ctx.createConvolver === 'function' && typeof ctx.createBuffer === 'function') {
      const ir = roomImpulse(ctx.sampleRate || 48000);
      const buf = ctx.createBuffer(2, ir[0].length, ctx.sampleRate || 48000);
      ir.forEach((d, c) => buf.getChannelData(c).set(d));
      const conv = ctx.createConvolver();
      conv.buffer = buf;
      const send = ctx.createGain();
      send.gain.value = 0.22;
      send.connect(conv);
      conv.connect(bus);
      this.reverbSend = send;
    }
    for (const kind of ['electric', 'acoustic', 'piano'] as const) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 1.5;
      p.rolloffFactor = 1;
      const pos = this.positions[kind];
      if (p.positionX) {
        p.positionX.value = pos.x;
        p.positionY.value = pos.y;
        p.positionZ.value = pos.z;
      } else p.setPosition(pos.x, pos.y, pos.z);
      p.connect(bus);
      if (this.reverbSend) p.connect(this.reverbSend);
      this.panners[kind] = p;
    }
    this.applyListener();
    return ctx;
  }

  private reverbSend: GainNode | null = null;

  setListenerPose(x: number, z: number, yaw: number): void {
    this.listener = { x, z, yaw };
    this.applyListener();
  }

  private applyListener(): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed) return;
    const { x, z, yaw } = this.listener;
    const l = ctx.listener;
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

  private buffer(kind: GuitarKind, string: number, freq: number): AudioBuffer {
    const ctx = this.ctx!;
    const key = `${kind}|${string}`;
    let b = this.buffers.get(key);
    if (!b) {
      const sr = ctx.sampleRate || 48000;
      const data = pluck(freq, sr, SECONDS, VOICES[kind], string + (kind === 'electric' ? 0 : 17));
      b = ctx.createBuffer(1, data.length, sr);
      b.getChannelData(0).set(data);
      this.buffers.set(key, b);
    }
    return b;
  }

  /**
   * Strum a guitar (all six strings, alternating down and up) or play the keyboard's
   * next chord. Returns the pitches in Hz, or null when nothing could sound.
   */
  strum(kind: InstrumentKind): number[] | null {
    const ctx = this.prepare();
    const panner = this.panners[kind];
    if (!ctx || !panner || this.disposed) return null;
    if (ctx.state === 'suspended' && !this.held) void ctx.resume()?.catch?.(() => {});
    if (kind === 'piano') return this.playChord(ctx, panner);
    const hz = tuningHz(kind);
    const dir = (this.lastDir[kind] = this.lastDir[kind] === 1 ? -1 : 1);
    const t0 = ctx.currentTime + 0.01;
    const order = dir === 1 ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
    order.forEach((s, i) => {
      const src = ctx.createBufferSource();
      src.buffer = this.buffer(kind, s, hz[s]);
      const g = ctx.createGain();
      const jitter = 1 + 0.1 * Math.sin(s * 12.9898 + i);
      g.gain.value = STRING_GAIN * STRUM_LEVEL * (kind === 'electric' ? 1.1 : 1) * jitter;
      src.connect(g);
      g.connect(this.shaper(kind, panner));
      src.start(t0 + i * STRUM_STAGGER);
      src.onended = () => {
        src.disconnect();
        g.disconnect();
      };
    });
    return hz;
  }

  private chordIndex = 0;
  private sounding: { gain: GainNode; sources: AudioBufferSourceNode[] } | null = null;

  /** Play the next chord, lifting the last one off first, like letting go of the sustain pedal. */
  private playChord(ctx: AudioContext, panner: PannerNode): number[] {
    const now = ctx.currentTime;
    const prev = this.sounding;
    if (prev) {
      const g = prev.gain.gain;
      if (typeof g.cancelScheduledValues === 'function') g.cancelScheduledValues(now);
      if (typeof g.setValueAtTime === 'function') g.setValueAtTime(g.value, now);
      if (typeof g.linearRampToValueAtTime === 'function') g.linearRampToValueAtTime(0, now + PEDAL_LIFT);
      else g.value = 0;
      for (const s of prev.sources) {
        try {
          s.stop(now + PEDAL_LIFT + 0.02);
        } catch {
          // already stopped
        }
      }
    }
    const chord = PIANO_CHORDS[this.chordIndex % PIANO_CHORDS.length];
    this.chordIndex = (this.chordIndex + 1) % PIANO_CHORDS.length;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(this.shaper('piano', panner));
    const sources: AudioBufferSourceNode[] = [];
    chord.notes.forEach((midi, i) => {
      const src = ctx.createBufferSource();
      src.buffer = this.pianoBuffer(midi);
      const g = ctx.createGain();
      g.gain.value = PIANO_NOTE_GAIN * (1.15 - (midi - 36) / 80); // the low notes carry a little more
      src.connect(g);
      g.connect(gain);
      src.start(now + 0.01 + i * PIANO_STAGGER);
      src.onended = () => {
        src.disconnect();
        g.disconnect();
      };
      sources.push(src);
    });
    this.sounding = { gain, sources };
    return chord.notes.map(midiToHz);
  }

  /** The chord that the next press will play. */
  get nextChord(): string {
    return PIANO_CHORDS[this.chordIndex % PIANO_CHORDS.length].name;
  }

  private pianoBuffer(midi: number): AudioBuffer {
    const ctx = this.ctx!;
    const key = `piano|${midi}`;
    let b = this.buffers.get(key);
    if (!b) {
      const sr = ctx.sampleRate || 48000;
      const data = pianoNote(midi, sr, PIANO_SECONDS);
      b = ctx.createBuffer(1, data.length, sr);
      b.getChannelData(0).set(data);
      this.buffers.set(key, b);
    }
    return b;
  }

  private readonly tones = new Map<InstrumentKind, AudioNode>();
  /** Each instrument's tone shaping: warm body for the acoustic, a little bite for the electric, a soft top for the piano. */
  private shaper(kind: InstrumentKind, panner: PannerNode): AudioNode {
    let head = this.tones.get(kind);
    if (head) return head;
    const ctx = this.ctx!;
    const input = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = kind === 'acoustic' ? 4200 : kind === 'piano' ? 6000 : 7000;
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = kind === 'acoustic' ? 210 : kind === 'piano' ? 300 : 2400;
    body.Q.value = 0.9;
    body.gain.value = kind === 'acoustic' ? 5 : kind === 'piano' ? 2 : 3;
    input.connect(body);
    body.connect(lp);
    lp.connect(panner);
    this.tones.set(kind, input);
    return input;
  }

  /** The room suspends audio (hidden tab, overlay); a held guitar stays quiet. */
  hold(): void {
    this.held = true;
    if (this.ctx?.state === 'running') void this.ctx.suspend()?.catch?.(() => {});
  }

  release(): void {
    this.held = false;
    if (this.ctx?.state === 'suspended') void this.ctx.resume()?.catch?.(() => {});
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.buffers.clear();
    try {
      void this.ctx?.close().catch(() => {});
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}
