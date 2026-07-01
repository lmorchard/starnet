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
// Pick ONE driver per signal below. Default is an auto-sweep so you can hear a song move
// across its full reactive range hands-free; swap to mouse or sliders for deliberate control.

// --- auto-sweep (default): phased sines, so the two axes drift against each other ----------
gameProgress = sine.range(0, 1).slow(64)
gameThreat   = sine.range(0, 1).slow(37)

// --- mouse drive: X = gameProgress, Y = gameThreat (move the pointer to steer) ---------------------
// gameProgress = mousex
// gameThreat   = mousey

// --- sliders: deliberate values (if strudel renders slider widgets from the prebake) ------
// gameProgress = slider(0.5, 0, 1)
// gameThreat   = slider(0.5, 0, 1)
