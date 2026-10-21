#!/bin/bash
# Builds Premonition's real offline DSP to WebAssembly.
# Reads the pinned plugin commit from src/premonition/PLUGIN_COMMIT.md, exports
# only the files the render needs with `git archive` (the plugin repo is read
# only), and writes public/premonition/dsp.js and dsp.wasm.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="${PREMONITION_PLUGIN_REPO:-/Users/aviouslyavi/Claude/Projects/premonition-vst}"
HASH="$(grep -m1 -oE '^Pinned commit: [0-9a-f]{7,40}' "$ROOT/src/premonition/PLUGIN_COMMIT.md" | awk '{print $3}')"
[ -n "$HASH" ] || { echo "no 'Pinned commit:' line in PLUGIN_COMMIT.md" >&2; exit 1; }

# shellcheck disable=SC1091
source "$HOME/.local/emsdk/emsdk_env.sh" >/dev/null 2>&1

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git -C "$PLUGIN" archive "$HASH" Premonition/dsp Premonition/vendor Premonition/Parameters.h Premonition/ReverbRouting.h | tar -x -C "$WORK"
git -C "$PLUGIN" archive "$HASH" iPlug2/WDL/fft.c iPlug2/WDL/fft.h iPlug2/WDL/wdltypes.h iPlug2/WDL/denormal.h | tar -x -C "$WORK"
cp "$ROOT/src/premonition/engine/wrapper.cpp" "$WORK/wrapper.cpp"

# WebAssembly without pthreads has no std::thread. If the pinned Convolution.h
# still starts one for the right channel, run both channels serially in this
# COPY (the DSP's own comment says the result is identical).
python3 - "$WORK/Premonition/dsp/Convolution.h" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
old = "std::thread right([&] { wetR = detail::convolveReal(inR, inN, irR, irN); });\n    wetL = detail::convolveReal(inL, inN, irL, irN);\n    right.join();"
new = "wetR = detail::convolveReal(inR, inN, irR, irN);\n    wetL = detail::convolveReal(inL, inN, irL, irN);"
s = s.replace(old, new)
open(p, 'w').write(s)
if 'std::thread' in s:
    sys.exit('Convolution.h still uses std::thread after patching')
PY

cd "$WORK"
INC=(-I. -IPremonition -IiPlug2 -IPremonition/vendor -IPremonition/vendor/signalsmith-stretch -IPremonition/vendor/signalsmith-linear)
emcc -O3 -fexceptions -std=c++17 -msimd128 "${INC[@]}" -c wrapper.cpp -o wrapper.o
emcc -O3 -c iPlug2/WDL/fft.c -I. -o wdl_fft.o
mkdir -p "$ROOT/public/premonition"
em++ -O3 -fexceptions wrapper.o wdl_fft.o -o "$ROOT/public/premonition/dsp.js" \
  -s MODULARIZE=1 -s EXPORT_NAME=PremonitionDsp -s ALLOW_MEMORY_GROWTH=1 -s ENVIRONMENT=worker,web,node \
  -s EXPORTED_FUNCTIONS=_premonition_render,_malloc,_free -s EXPORTED_RUNTIME_METHODS=HEAPF32
ls -la "$ROOT/public/premonition/"
echo "wasm gzipped bytes: $(gzip -c "$ROOT/public/premonition/dsp.wasm" | wc -c)"
echo "built from plugin commit $HASH"
