// Runs Premonition's real DSP (public/premonition/dsp.wasm). Loaded only by renderClient.
import { MAX_CLIP_SECONDS, type FromWorker, type RenderErrorCode, type ToWorker } from './types';
import type { PluginParams } from '../params';

type DspModule = {
  HEAPF32: Float32Array;
  _malloc(n: number): number;
  _free(p: number): void;
  _premonition_render(...args: number[]): number;
};

const BPM = 120;
const BASE = '/premonition/';

type Scope = {
  postMessage(msg: FromWorker, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};
const scope = self as unknown as Scope;

let loading: Promise<DspModule> | null = null;

function load(): Promise<DspModule> {
  if (!loading) {
    loading = (async () => {
      const res = await fetch(BASE + 'dsp.js');
      if (!res.ok) throw new Error('dsp.js ' + res.status);
      const src = await res.text();
      // The glue is a classic script that assigns module.exports; evaluate it here so it also works in a module worker.
      const mod: { exports: unknown } = { exports: {} };
      new Function('module', 'exports', src)(mod, mod.exports);
      const factory = mod.exports as (o: { locateFile(f: string): string }) => Promise<DspModule>;
      return factory({ locateFile: (f) => BASE + f });
    })();
  }
  return loading;
}

export function renderWith(
  m: DspModule,
  channels: Float32Array[],
  sampleRate: number,
  p: PluginParams,
): { channels: Float32Array[] } | { code: RenderErrorCode } {
  const frames = channels[0]?.length ?? 0;
  if (frames === 0) return { code: 'empty' };
  if (frames / sampleRate > MAX_CLIP_SECONDS) return { code: 'too-long' };
  const left = channels[0];
  const right = channels[1] ?? channels[0];
  const barSeconds = 4 * (60 / BPM);
  const capacity = Math.ceil(((p.bars + p.overhang) * barSeconds + 4) * sampleRate);
  const inL = m._malloc(frames * 4);
  const inR = m._malloc(frames * 4);
  const outL = m._malloc(capacity * 4);
  const outR = m._malloc(capacity * 4);
  try {
    m.HEAPF32.set(left, inL / 4);
    m.HEAPF32.set(right, inR / 4);
    const n = m._premonition_render(
      inL, inR, frames, sampleRate, BPM,
      p.direction === 'forward' ? 1 : 0,
      p.type === 'hall' ? 0 : 1,
      p.stretch, p.bloom, p.size, p.overhang, p.diffusion, p.bars,
      outL, outR, capacity,
    );
    if (n <= 0) return { code: 'failed' };
    // HEAPF32 may have been replaced by memory growth: read it fresh.
    return {
      channels: [
        m.HEAPF32.slice(outL / 4, outL / 4 + n),
        m.HEAPF32.slice(outR / 4, outR / 4 + n),
      ],
    };
  } finally {
    m._free(inL); m._free(inR); m._free(outL); m._free(outR);
  }
}

scope.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      await load();
      scope.postMessage({ type: 'ready' });
    } catch (err) {
      scope.postMessage({ type: 'init-error', message: err instanceof Error ? err.message : 'load failed' });
    }
    return;
  }
  if (msg.type === 'render') {
    try {
      const m = await load();
      const out = renderWith(m, msg.channels, msg.sampleRate, msg.params);
      if ('code' in out) {
        scope.postMessage({ type: 'render-error', id: msg.id, code: out.code });
      } else {
        scope.postMessage(
          { type: 'result', id: msg.id, channels: out.channels, sampleRate: msg.sampleRate },
          out.channels.map((c) => c.buffer),
        );
      }
    } catch {
      scope.postMessage({ type: 'render-error', id: msg.id, code: 'failed' });
    }
  }
};
