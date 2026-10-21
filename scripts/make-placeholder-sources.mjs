// Synthesises the three PLACEHOLDER dry sounds for the Premonition plugin screen
// (48 kHz mono, about 3 seconds, mp3). The owner replaces them with real dry hits;
// keep the file names or update src/premonition/sources.ts.
// Usage: node scripts/make-placeholder-sources.mjs   (needs ffmpeg on PATH)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SR = 48000;
const SECONDS = 3;
const OUT = join(process.cwd(), 'public/audio/premonition');

let seed = 7;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 2 ** 32) * 2 - 1;
};

// One-pole low-pass for shaping the noise.
function lowpass(x, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  return x.map((v) => (y += a * (v - y)));
}

function snare() {
  const n = SR * SECONDS;
  const noise = Array.from({ length: n }, rand);
  const body = lowpass(noise, 6000);
  return Float32Array.from(body, (v, i) => {
    const t = i / SR;
    const tone = Math.sin(2 * Math.PI * (190 - 40 * Math.min(t * 8, 1)) * t) * Math.exp(-t * 28);
    return 0.8 * v * Math.exp(-t * 18) + 0.4 * tone;
  });
}

function pluck() {
  const n = SR * SECONDS;
  const f0 = 330;
  return Float32Array.from({ length: n }, (_, i) => {
    const t = i / SR;
    let s = 0;
    for (let h = 1; h <= 6; h++) s += (Math.sin(2 * Math.PI * f0 * h * t) / h) * Math.exp(-t * (3 + h * 2.5));
    return 0.6 * s * Math.min(t * 800, 1);
  });
}

function vocal() {
  const n = SR * SECONDS;
  const f0 = 196;
  const formants = [[700, 1], [1100, 0.6], [2600, 0.25]];
  return Float32Array.from({ length: n }, (_, i) => {
    const t = i / SR;
    const env = Math.min(t * 40, 1) * Math.exp(-t * 4.5);
    let s = 0;
    for (let h = 1; h <= 30; h++) {
      const f = f0 * h;
      let gain = 0;
      for (const [fc, g] of formants) gain += g * Math.exp(-(((f - fc) / 220) ** 2));
      s += (gain / h) * Math.sin(2 * Math.PI * f * t);
    }
    return 0.5 * env * s;
  });
}

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const g = peak > 0 ? 0.8 / peak : 1;
  samples.forEach((v, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * g)) * 32767), 44 + i * 2));
  return buf;
}

mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'premo-src-'));
try {
  for (const [name, make] of [['placeholder-snare', snare], ['placeholder-pluck', pluck], ['placeholder-vocal', vocal]]) {
    const wavPath = join(tmp, name + '.wav');
    writeFileSync(wavPath, wav(make()));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-ar', String(SR), '-ac', '1', '-b:a', '96k', join(OUT, name + '.mp3')]);
    console.log('wrote', name + '.mp3');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
