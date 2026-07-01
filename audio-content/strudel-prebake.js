// Starnet — strudel.cc PREBAKE
// =====================================================================================
// Paste this into strudel.cc → Settings → "prebake" (the script that runs before every song). It
// stubs the game's live signals so a Starnet song copied from the repo plays + reacts in the editor.
//
// In the game these same names are injected by the engine (js/audio/strudel/signal-bridge.js), so
// song files carry no setup of their own — this prebake is the editor-side mirror of that contract.
//
// SOUNDS: songs that use the game's `gus_*` instruments won't sound in strudel.cc yet — registering
// the soundfont from the prebake trips a strudel.cc Repl error (`i.fonts is undefined`). Author with
// synth waveforms (sawtooth/square/triangle/…) + drum samples (bd/sd/hh/…) + the signals for now;
// `gus_*` resolves in-game. Loading `gus_*` in the editor is tracked in #265. See
// docs/strudel-authoring.md.

// Keep this list in sync with js/audio/signal-registry.js (currently: gameProgress, gameThreat).
// Assigned onto `window.` — NOT `let` (a let binding wouldn't be visible to the separately-evaluated
// song, and bare assignment throws under strict mode). Default is sliders (draggable widgets); swap
// to sweep or mouse below for hands-free / pointer control.

// --- sliders (default): draggable widgets for deliberate values --------------------------------
window.gameProgress = slider(0.5, 0, 1)
window.gameThreat   = slider(0.5, 0, 1)

// --- auto-sweep: phased sines drift the two axes across their range hands-free ------------------
// window.gameProgress = sine.range(0, 1).slow(64)
// window.gameThreat   = sine.range(0, 1).slow(37)

// --- mouse drive: X = gameProgress, Y = gameThreat (move the pointer to steer) ------------------
// window.gameProgress = mousex
// window.gameThreat   = mousey
