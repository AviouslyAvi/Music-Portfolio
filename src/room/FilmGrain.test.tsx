import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { FilmGrain } from './FilmGrain';

type Ctx = {
  createImageData: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
  createPattern: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  fillStyle: unknown;
};

function fakeCtx(): Ctx {
  return {
    createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
    putImageData: vi.fn(),
    createPattern: vi.fn(() => ({})),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillStyle: '',
  };
}

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

let ctx: Ctx;
let raf: ReturnType<typeof vi.fn>;
let caf: ReturnType<typeof vi.fn>;

beforeEach(() => {
  ctx = fakeCtx();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
  raf = vi.fn(() => 7);
  caf = vi.fn();
  vi.stubGlobal('requestAnimationFrame', raf);
  vi.stubGlobal('cancelAnimationFrame', caf);
  mockMatchMedia(false);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('FilmGrain', () => {
  it('renders null when canvas getContext is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => null) as never);
    const { container } = render(<FilmGrain />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null and does not throw when matchMedia is missing', () => {
    // @ts-expect-error simulating an old browser
    delete window.matchMedia;
    expect(() => render(<FilmGrain />)).not.toThrow();
    expect(document.body.querySelector('canvas')).toBeNull();
  });

  it('draws once and does not start an animation loop when prefers-reduced-motion matches', () => {
    mockMatchMedia(true);
    render(<FilmGrain />);
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(raf).not.toHaveBeenCalled();
  });

  it('animates with requestAnimationFrame otherwise, redrawing only every ~80 ms', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    render(<FilmGrain />);
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    const tick = raf.mock.calls[0][0] as (t: number) => void;
    now += 16;
    tick(now);
    expect(ctx.putImageData).toHaveBeenCalledTimes(1);
    now += 100;
    tick(now);
    expect(ctx.putImageData).toHaveBeenCalledTimes(2);
    expect(raf.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('is aria-hidden and ignores pointer events', () => {
    const { container } = render(<FilmGrain />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.style.pointerEvents).toBe('none');
    expect(container.querySelector('canvas')).not.toBeNull();
  });

  it('cleans up its animation frame on unmount', () => {
    const { unmount } = render(<FilmGrain />);
    unmount();
    expect(caf).toHaveBeenCalledWith(7);
  });

  it('colours the noise warm and never pure white', () => {
    render(<FilmGrain />);
    const img = ctx.putImageData.mock.calls[0][0] as ImageData;
    for (let i = 0; i < img.data.length; i += 4) {
      expect(img.data[i] === 255 && img.data[i + 1] === 255 && img.data[i + 2] === 255).toBe(false);
    }
  });
});
