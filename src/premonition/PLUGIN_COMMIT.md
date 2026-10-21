# Pinned plugin commit

Pinned commit: 070c627

- Plugin repo: `/Users/aviouslyavi/Claude/Projects/premonition-vst` (read only), `main` HEAD on 2026-10-21 ("docs(handoff): UTF-8 file writes").
- Date pinned: 2026-10-21. The spike used `b2e58d1`; the DSP has changed since (unbundled hall/plate IRs, Kaiser window table, tail and stereo work), so the newest commit was tried first and passed. No walk-back was needed.
- How the tests were run: `git archive 070c627 | tar x` into a scratch folder, then
  `cmake -S . -B build-tests -DPREMONITION_BUILD_PLUGIN=OFF && cmake --build build-tests -j8 && ./build-tests/tests/premonition_tests`
  (Catch2 v3.5.3 is fetched by the plugin's own `tests/CMakeLists.txt` into the build folder; nothing was installed on the system).
- Result: PASS. All tests passed, 21875258 assertions in 421 test cases (the plugin's `tests/CONTEXT.md` expects 418 or more; no suite failed).
- The build script `scripts/build-dsp-wasm.sh` reads the hash above, so changing it here changes what ships.
- At this commit `dsp/` has no `std::thread`, so the serial `Convolution.h` patch from the spike is a no-op; the script still applies it when the pattern is present.
