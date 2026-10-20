# Spike result: Premonition's real DSP in the browser (2026-10-20)

**Verdict: PASS.** The plugin's own offline pipeline (`Premonition/dsp/OfflinePipeline.h` `renderRiser`) compiles to WebAssembly and renders correctly in a Chromium Web Worker, far under the pass bar. No fallback decision (A or C) is needed.

## What was tested

- Plugin commit: `b2e58d1` ("Merge branch 'p8-site-launch'..."), the HEAD of `/Users/aviouslyavi/Claude/Projects/premonition-vst` on 2026-10-20. Taken with `git archive` of `Premonition/dsp`, `Premonition/vendor`, `Premonition/Parameters.h`, `Premonition/ReverbRouting.h`, plus WDL `fft.c/fft.h/wdltypes.h/denormal.h` from the `iPlug2/WDL` submodule. The plugin repo was only read. Its working tree has uncommitted edits, but none are in `dsp/`, `Parameters.h`, `ReverbRouting.h` or `vendor/` (checked with `git status`), so the archive equals the working DSP.
- **The plugin's own unit tests were NOT run** for this pin (building them needs Catch2 and about 100 s of Debug integration tests). The plan's rule "pin to a commit where the DSP tests pass" is therefore still open: Task 2 must run the plugin's test suite (in a copy, not in the plugin repo) before the pin is recorded as final.
- Toolchain: Emscripten (latest) installed into `~/.local/emsdk` only (no system changes).
- Wrapper: a throwaway C function `premonition_render(...)` building a `PipelineConfig` the way `Premonition::BuildPipelineConfig()` does (same fields, `routeReverbType`, `crossfadeIntoSource = true`, `rt60Seconds` from the bar length) and calling `renderRiser`. Files are in `.spike/` (gitignored, throwaway).

## Measured (5 s stereo test clip, 48 kHz, 120 BPM, Natural mode unless noted)

| Case | Output | Render time (Node WASM) |
|---|---|---|
| Hall, 2 bars | 192000 frames = exactly 4.000 s | 72 ms |
| Plate, 2 bars | 4.000 s | 35 ms |
| Hall, Stretch mode | 4.000 s | 125 ms |
| Hall, 4 bars | 8.000 s | 89 ms |
| Spring (bundled IR), 2 bars | 4.000 s | 248 ms |
| Room (bundled IR), 2 bars | 4.000 s | 125 ms |
| Hall, 2 bars, **in a Chromium Web Worker** (Playwright, Chromium 156) | 4.000 s, peak 0.67 | **70 ms** |

Output length equals the requested bar length exactly, peaks are sane (0.6 to 0.97), and the last samples sit at swell level as designed (the riser lands on the downbeat). Pass bar was under about 5 s and under about 1.5 MB gzipped.

## Size

- `spike.wasm` 224 KB raw, **about 92 KB gzipped**; JS glue 7 KB raw, about 2.5 KB gzipped.
- Hall and Plate need no impulse response (vintage engine). Spring and Room need their bundled IRs: `resources/ir/room.wav` and `spring.wav`, about 252 KB and 432 KB gzipped (float32 WAV; they can be re-encoded smaller).
- Worst case, all four types: about 0.8 MB gzipped, under the 1.5 MB target before the UI code.

## Findings that change the plan

1. **No threads and no cross-origin isolation needed, with one patch.** `dsp/Convolution.h` (line about 370) starts one `std::thread` to convolve the right channel; WebAssembly without pthreads throws "thread constructor failed". The DSP's own comment says the serial result is identical. The build script patches a **copy** of that file to run both channels serially; the plugin repo is untouched. The alternative (`-pthread`) would require COOP/COEP headers on the site and is not recommended. Cost: Spring and Room render about 2x slower than they could; still 248 ms.
2. **C++ exceptions** must be enabled (`-fexceptions`) so a throw inside the DSP is caught in the wrapper and reported as a `failed` render, not an abort.
3. **The "current UI" screenshot is stale.** `docs/product/Premonition-current-ui.png` shows an older layout (Decay knob and so on). The plugin's HEAD has `UIMockupL.h`, `UIMockupO.h` and an FX rack, and the working tree has uncommitted UI edits (`Theme.h`, `UIMockupL/O.h`, `UIView3D.h`, `UIWaveforms.h`). Task 4's replica must be drawn from the current UI source and shown to the owner before it ships (the plugin's own rule: "UI changes: show Avi first"). Which controls to include remains the builder's call per the spec.
4. **Decay is derived, not a knob, in `BuildPipelineConfig`**: `rt60Seconds = clamp(bar length x kDecayBarFraction, min, max)`; the user controls Tail length in bars. Task 3's parameter list must follow `Parameters.h` and `BuildPipelineConfig` at the pinned commit, not the older screenshot (the plan's Stretch/Size/Decay/Tail/Mix wording is superseded by what Task 3 reads there).
5. `src/spike_main.cpp` shows the exact wiring the real wrapper needs: build a `StereoBuffer` from samples, fill `PipelineConfig`, call `routeReverbType` with the IR buffers, call `renderRiser`. The IR sample rate is passed through; `effectiveIRTailSeconds` in the shell is the identity.

## Decision

Continue with Task 2 onward as planned, with findings 1 to 4 folded in. Not yet done: the plugin test run for the pin (above), and the owner's look at the UI replica.
