// Premonition's offline pipeline as one C entry point, for the browser.
// Built by scripts/build-dsp-wasm.sh against the commit named in
// src/premonition/PLUGIN_COMMIT.md. The wiring follows
// Premonition::BuildPipelineConfig(). No file I/O lives here.
#include "Premonition/dsp/OfflinePipeline.h"
#include "Premonition/ReverbRouting.h"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <exception>
#include <emscripten/emscripten.h>

using namespace premonition;

extern "C" EMSCRIPTEN_KEEPALIVE
int premonition_render(const float* inL, const float* inR, int frames, int sampleRate, float bpm,
                       int mode, int reverbType, float stretch, float bloom, float size,
                       float overhangBars, float diffusion, float bars,
                       float* outL, float* outR, int outCapacity)
{
  if (!inL || !inR || !outL || !outR || frames <= 0 || sampleRate <= 0) return -1;
  try {
    dsp::StereoBuffer src;
    src.L.assign(inL, inL + frames);
    src.R.assign(inR, inR + frames);

    dsp::PipelineConfig cfg;
    cfg.stretchRatio = stretch;
    cfg.roomSize = size;
    cfg.damping = 0.5f;
    cfg.mix = 1.0f;
    cfg.lengthBars = bars;
    cfg.bpm = bpm;
    cfg.beatsPerBar = 4;
    const double barSeconds = (double)bars * 4.0 * (60.0 / (double)bpm);
    cfg.rt60Seconds = (float)std::clamp(barSeconds * ranges::kDecayBarFraction,
                                        ranges::kDecayMinSec, ranges::kDecayMaxSec);
    cfg.mode = mode == 1 ? kModeForward : kModeNatural;
    cfg.normalize = false;
    cfg.edgeFades = true;
    cfg.crossfadeIntoSource = true;
    cfg.bloom = bloom;
    cfg.diffusion = diffusion;
    cfg.lowpassHz = ranges::kLowpassDefaultHz;
    cfg.filterPreStage = false;
    cfg.tailOverhangBars = overhangBars;
    cfg.tailHighpassHz = (float)ranges::kTailHighpassDefaultHz;
    cfg.hybrid = false;

    // Hall and Plate render on the vintage engine and need no impulse response.
    routeReverbType(cfg, reverbType == 0 ? kTypeHall : kTypePlate, kEraColorNow,
                    nullptr, 0.f, nullptr, nullptr, 0);

    dsp::StereoBuffer out = dsp::renderRiser(src, (float)sampleRate, cfg);
    if (out.frames() == 0) return -1;
    if ((int)out.frames() > outCapacity) return -2;
    const int n = (int)out.frames();
    std::memcpy(outL, out.L.data(), n * sizeof(float));
    std::memcpy(outR, out.R.data(), n * sizeof(float));
    return n;
  } catch (...) {
    return -1;
  }
}
