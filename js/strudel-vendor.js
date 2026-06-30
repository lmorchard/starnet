// Vendor entry for the Strudel runtime — bundled by esbuild into dist/strudel.js (ESM).
// Mirrors js/tone-vendor.js. Strudel + superdough are AGPL-3.0; bundling them makes the
// combined work AGPL-3.0 (see LICENSE).
//
// @strudel/web sets window.initStrudel at module load and, when initStrudel() is called,
// registers the pattern/synth globals (note/sound/stack/signal/superdough/evaluate/hush/
// getAudioContext/samples) on window ASYNCHRONOUSLY. The engine boot polls for them
// (js/audio/strudel/runtime.js) rather than awaiting — initStrudel() returns undefined.
//
// Re-export everything so callers may also import named bindings directly if needed.
export * from "@strudel/web";
