import { MAX_CLIP_SECONDS, RenderError, type FromWorker, type RenderRequest, type RenderResult, type ToWorker } from './types';

export { MAX_CLIP_SECONDS, RenderError };
export type { RenderRequest, RenderResult, RenderErrorCode } from './types';

type Job = { id: number; cancel(): void; fail(err: RenderError): void };

function defaultFactory(): Worker {
  if (typeof Worker === 'undefined') throw new RenderError('unsupported');
  return new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
}

export function createRenderClient(workerFactory: () => Worker = defaultFactory): {
  ready(): Promise<void>;
  render(req: RenderRequest, signal: AbortSignal): Promise<RenderResult>;
  dispose(): void;
} {
  let worker: Worker | null = null;
  let readyPromise: Promise<void> | null = null;
  let disposed = false;
  let nextId = 1;
  const jobs = new Map<number, { resolve(r: RenderResult): void; reject(e: RenderError): void }>();
  let active: Job | null = null;

  function failAll(err: RenderError) {
    for (const [, j] of [...jobs]) j.reject(err);
    jobs.clear();
  }

  function ready(): Promise<void> {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise<void>((resolve, reject) => {
      let w: Worker;
      try {
        w = workerFactory();
      } catch {
        reject(new RenderError('unsupported'));
        return;
      }
      worker = w;
      let isReady = false;
      w.addEventListener('message', (e: Event) => {
        const msg = (e as MessageEvent<FromWorker>).data;
        if (msg.type === 'ready') {
          isReady = true;
          resolve();
        } else if (msg.type === 'init-error') {
          reject(new RenderError('failed', msg.message));
        } else if (msg.type === 'result') {
          jobs.get(msg.id)?.resolve({ channels: msg.channels, sampleRate: msg.sampleRate });
          jobs.delete(msg.id);
        } else if (msg.type === 'render-error') {
          jobs.get(msg.id)?.reject(new RenderError(msg.code));
          jobs.delete(msg.id);
        }
      });
      w.addEventListener('error', () => {
        const err = new RenderError('failed', 'render worker error');
        if (!isReady) reject(err);
        failAll(err);
      });
      const init: ToWorker = { type: 'init' };
      w.postMessage(init);
    });
    return readyPromise;
  }

  function render(req: RenderRequest, signal: AbortSignal): Promise<RenderResult> {
    const frames = req.channels[0]?.length ?? 0;
    if (frames === 0) return Promise.reject(new RenderError('empty'));
    if (frames / req.sampleRate > MAX_CLIP_SECONDS) return Promise.reject(new RenderError('too-long'));
    if (disposed) return Promise.reject(new RenderError('cancelled'));
    if (signal.aborted) return Promise.reject(new RenderError('cancelled'));

    active?.cancel();

    return new Promise<RenderResult>((resolve, reject) => {
      const id = nextId++;
      let settled = false;
      const onAbort = () => job.cancel();
      const finish = () => {
        settled = true;
        jobs.delete(id);
        signal.removeEventListener('abort', onAbort);
        if (active === job) active = null;
      };
      const job: Job = {
        id,
        cancel: () => {
          if (settled) return;
          finish();
          reject(new RenderError('cancelled'));
        },
        fail: (err) => {
          if (settled) return;
          finish();
          reject(err);
        },
      };
      active = job;
      signal.addEventListener('abort', onAbort);
      jobs.set(id, {
        resolve: (r) => {
          if (settled) return;
          finish();
          resolve(r);
        },
        reject: (e) => job.fail(e),
      });
      ready().then(
        () => {
          if (settled || !worker) return;
          // Copies, so the caller keeps its source buffers (the originals would be detached by the transfer).
          const channels = req.channels.map((c) => c.slice());
          const msg: ToWorker = { type: 'render', id, channels, sampleRate: req.sampleRate, params: req.params };
          worker.postMessage(msg, channels.map((c) => c.buffer));
        },
        (err: unknown) => job.fail(err instanceof RenderError ? err : new RenderError('failed')),
      );
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    active?.cancel();
    failAll(new RenderError('cancelled'));
    worker?.terminate();
    worker = null;
  }

  return { ready, render, dispose };
}
