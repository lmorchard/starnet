// Vendor entry for the Strudel runtime — bundled by esbuild into dist/strudel.js (ESM).
// Mirrors js/tone-vendor.js. Strudel + superdough are AGPL-3.0; bundling them makes the
// combined work AGPL-3.0 (see LICENSE).
//
// @strudel/web@1.3.0 (matches the strudel.cc dialect: native `$:`, `setcpm`, the current
// transpiler) — chosen for no-drift between strudel.cc authoring and in-game playback. Its
// initStrudel() registers the pattern/synth globals on window ASYNCHRONOUSLY; the engine boot
// polls for them (js/audio/strudel/runtime.js) rather than awaiting.
//
// NOTE: @strudel/core@1.2.6 depends on @kabelsalat/web, whose ESM named export fails under *node*
// (not the browser). esbuild bundles it fine for the browser. Any node-side song validator must
// pin @strudel/* to 1.2.5, pre-bundle, or run headless — see the song-playback session notes.
export * from "@strudel/web";
