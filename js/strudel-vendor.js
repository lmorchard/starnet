// Vendor entry for the Strudel runtime — bundled by esbuild into dist/strudel.js (ESM).
// The sole audio vendor bundle (the Tone.js engine + its dist/tone.js were retired in #267).
// Strudel + superdough are AGPL-3.0; bundling them makes the combined work AGPL-3.0 (see LICENSE).
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

// Bundle @strudel/soundfonts TOGETHER with @strudel/web so they share the same @strudel/core +
// @strudel/webaudio singletons (separate bundles would each get their own copies, and the sound
// registry / audio context wouldn't be shared). Attach the loader to window for the runtime to use.
// GeneralUser GS (clean license) is loaded via loadSoundfont(); presets are registered under
// distinct game-specific names (NOT strudel.cc's gm_* — a separate, non-fungible instrument set).
import * as __soundfonts from "@strudel/soundfonts";
if (typeof window !== "undefined") window.__soundfonts = __soundfonts;

