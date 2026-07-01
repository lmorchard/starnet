// Starnet — strudel.cc PREBAKE
// =====================================================================================
// Paste this into strudel.cc → Settings → "prebake" (the script that runs before every
// song). It defines the game's live signals so a Starnet song copied straight out of the
// repo plays UNCHANGED in the editor.
//
// In the game these same names are injected live by the engine
// (js/audio/strudel/signal-bridge.js, from js/audio/signal-registry.js), so the song files
// themselves never carry any stub — this prebake is the editor-side half of that contract.
// Keep the signal list here in sync with signal-registry.js (currently: gameProgress, gameThreat).
//
//   gameProgress = fraction of the LAN owned            (0..1)
//   gameThreat   = alert ladder + injury pressure        (0..1)
//
// Pick ONE driver per signal below. Default is sliders (verified working in strudel.cc: they render
// as draggable widgets you steer while the song plays). Assigned onto `window.` — NOT `let` (a `let`
// binding wouldn't be visible to the separately-evaluated song, and bare assignment throws under
// strict mode). Swap to sweep or mouse for hands-free / pointer control.

// --- sliders (default): draggable widgets for deliberate values --------------------------------
window.gameProgress = slider(0.5, 0, 1)
window.gameThreat   = slider(0.5, 0, 1)

// --- auto-sweep: phased sines drift the two axes across their range hands-free ------------------
// window.gameProgress = sine.range(0, 1).slow(64)
// window.gameThreat   = sine.range(0, 1).slow(37)

// --- mouse drive: X = gameProgress, Y = gameThreat (move the pointer to steer) ------------------
// window.gameProgress = mousex
// window.gameThreat   = mousey
