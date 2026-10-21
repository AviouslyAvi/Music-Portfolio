import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../params';
import { MAX_CLIP_SECONDS, RenderError, createRenderClient, type RenderRequest } from './renderClient';
import type { FromWorker, ToWorker } from './types';

class FakeWorker {
  sent: ToWorker[] = [];
  terminated = false;
  private listeners: Record<string, ((e: unknown) => void)[]> = {};
  postMessage(msg: ToWorker) {
    this.sent.push(msg);
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener() {}
  terminate() {
    this.terminated = true;
  }
  emit(data: FromWorker) {
    for (const fn of this.listeners['message'] ?? []) fn({ data });
  }
  fail() {
    for (const fn of this.listeners['error'] ?? []) fn({ message: 'boom' });
  }
  renders() {
    return this.sent.filter((m): m is Extract<ToWorker, { type: 'render' }> => m.type === 'render');
  }
}

const req = (seconds = 1): RenderRequest => ({
  channels: [new Float32Array(Math.round(48000 * seconds)).fill(0.1)],
  sampleRate: 48000,
  params: DEFAULT_PARAMS,
});

function setup() {
  const w = new FakeWorker();
  const client = createRenderClient(() => w as unknown as Worker);
  return { w, client };
}

async function ready(w: FakeWorker, client: ReturnType<typeof createRenderClient>) {
  const p = client.ready();
  w.emit({ type: 'ready' });
  await p;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('createRenderClient', () => {
  it('rejects longer than 15 s with too-long', async () => {
    const { w, client } = setup();
    await ready(w, client);
    await expect(client.render(req(MAX_CLIP_SECONDS + 1), new AbortController().signal)).rejects.toMatchObject({ code: 'too-long' });
    expect(w.renders()).toHaveLength(0);
  });

  it('rejects zero-length with empty', async () => {
    const { w, client } = setup();
    await ready(w, client);
    const r: RenderRequest = { ...req(), channels: [new Float32Array(0)] };
    await expect(client.render(r, new AbortController().signal)).rejects.toMatchObject({ code: 'empty' });
  });

  it('resolves with the worker result', async () => {
    const { w, client } = setup();
    await ready(w, client);
    const p = client.render(req(), new AbortController().signal);
    await tick();
    const [m] = w.renders();
    w.emit({ type: 'result', id: m.id, channels: [new Float32Array(4), new Float32Array(4)], sampleRate: 48000 });
    await expect(p).resolves.toMatchObject({ sampleRate: 48000 });
  });

  it('aborting rejects with cancelled and the next render still works', async () => {
    const { w, client } = setup();
    await ready(w, client);
    const ac = new AbortController();
    const p = client.render(req(), ac.signal);
    await tick();
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: 'cancelled' });
    const first = w.renders()[0];
    // a late result for the cancelled render is ignored
    w.emit({ type: 'result', id: first.id, channels: [new Float32Array(1)], sampleRate: 48000 });
    const p2 = client.render(req(), new AbortController().signal);
    await tick();
    const second = w.renders()[1];
    w.emit({ type: 'result', id: second.id, channels: [new Float32Array(2)], sampleRate: 48000 });
    await expect(p2).resolves.toMatchObject({ channels: [expect.any(Float32Array)] });
  });

  it('an already-aborted signal rejects with cancelled without posting', async () => {
    const { w, client } = setup();
    await ready(w, client);
    const ac = new AbortController();
    ac.abort();
    await expect(client.render(req(), ac.signal)).rejects.toMatchObject({ code: 'cancelled' });
    expect(w.renders()).toHaveLength(0);
  });

  it('a second render cancels the first', async () => {
    const { w, client } = setup();
    await ready(w, client);
    const p1 = client.render(req(), new AbortController().signal);
    const p1Settled = p1.catch((e: RenderError) => e.code);
    await tick();
    const p2 = client.render(req(), new AbortController().signal);
    await expect(p1Settled).resolves.toBe('cancelled');
    await tick();
    const second = w.renders()[1];
    w.emit({ type: 'result', id: second.id, channels: [new Float32Array(2)], sampleRate: 48000 });
    await expect(p2).resolves.toBeDefined();
  });

  it('copies the input so the caller keeps its buffers', async () => {
    const { w, client } = setup();
    await ready(w, client);
    const r = req();
    void client.render(r, new AbortController().signal).catch(() => {});
    await tick();
    expect(w.renders()[0].channels[0]).not.toBe(r.channels[0]);
  });

  it('a missing Worker maps ready() to unsupported', async () => {
    const client = createRenderClient(() => {
      throw new Error('no Worker here');
    });
    await expect(client.ready()).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('a wasm load failure rejects ready() with failed', async () => {
    const { w, client } = setup();
    const p = client.ready();
    w.emit({ type: 'init-error', message: 'dsp.js 404' });
    await expect(p).rejects.toMatchObject({ code: 'failed' });
  });

  it('a worker error event before ready rejects ready() with failed', async () => {
    const { w, client } = setup();
    const p = client.ready();
    w.fail();
    await expect(p).rejects.toMatchObject({ code: 'failed' });
  });

  it('dispose terminates the worker and rejects pending renders', async () => {
    const { w, client } = setup();
    await ready(w, client);
    const p = client.render(req(), new AbortController().signal);
    await tick();
    client.dispose();
    await expect(p).rejects.toBeInstanceOf(RenderError);
    expect(w.terminated).toBe(true);
  });
});
