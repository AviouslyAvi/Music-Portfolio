import type { PluginParams } from '../params';

export const MAX_CLIP_SECONDS = 15;

export type RenderRequest = { channels: Float32Array[]; sampleRate: number; params: PluginParams };
export type RenderResult = { channels: Float32Array[]; sampleRate: number };
export type RenderErrorCode = 'too-long' | 'empty' | 'unsupported' | 'failed' | 'cancelled';

export class RenderError extends Error {
  code: RenderErrorCode;
  constructor(code: RenderErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'RenderError';
    this.code = code;
  }
}

// Messages between the client and the worker.
export type ToWorker =
  | { type: 'init' }
  | { type: 'render'; id: number; channels: Float32Array[]; sampleRate: number; params: PluginParams };
export type FromWorker =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'result'; id: number; channels: Float32Array[]; sampleRate: number }
  | { type: 'render-error'; id: number; code: RenderErrorCode };
