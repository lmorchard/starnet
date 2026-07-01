// Starnet — strudel.cc PREBAKE  (one-paste authoring block)
// =====================================================================================
// Paste this ONCE into strudel.cc → Settings → "prebake" (the script that runs before every
// song). It sets up BOTH halves of the game's sound world so a Starnet song copied straight out
// of the repo plays UNCHANGED in the editor:
//
//   1. Instruments — the game's `gus_*` GeneralUser GS presets (a DISTINCT set, not strudel's
//      built-in `gm_*`; do not substitute).
//   2. Signals — the live game variables `gameProgress` / `gameThreat`, stubbed here as sliders
//      you drag to hear a song react.
//
// In the game these same names are provided by the engine (js/audio/strudel/soundfont.js registers
// the identical `gus_*`; js/audio/strudel/signal-bridge.js injects the same signals), so song files
// carry no setup of their own — this prebake is the editor-side mirror of that contract.

// ── 1. Instruments: load the game's vendored GeneralUser GS v2.0.3 + register the gus_* names ──
// Loads Starnet's OWN vendored SF2 (raw.githubusercontent serves it CORS-enabled), so the sound set
// is byte-identical to the game — no upstream drift. The naming (sanitize + dedup) and the note
// trigger MIRROR js/audio/strudel/soundfont.js exactly; keep them in sync if that file changes.
// `fonts: []` is required so strudel.cc's soundfont UI can render the entry (it reads
// options.fonts.length); our trigger closes over `preset`, so the array itself is unused for audio.
await loadSoundfont('https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/GeneralUser-GS.sf2')
  .then((sf) => {
    const used = new Set();
    sf.presets.forEach((preset, i) => {
      const cleaned = String(preset.header?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      let name = 'gus_' + (cleaned || 'preset_' + i);
      if (used.has(name)) { const base = name; let n = 2; while (used.has(name)) name = base + '_' + n++; }
      used.add(name);
      registerSound(name, (time, value) => {
        const ctx = getAudioContext();
        const note = value?.note ?? 'c3';
        const midi = typeof note === 'number' ? note : noteToMidi(note);
        const stop = startPresetNote(ctx, preset, midi, time);
        stop(time + (typeof value?.duration === 'number' ? value.duration : 0.5));
        return { node: undefined, stop };
      }, { type: 'soundfont', prebake: false, fonts: [] });
    });
  });

// ── 2. Signals: stub gameProgress / gameThreat so reactive songs play + react while authoring ──
// Keep this list in sync with js/audio/signal-registry.js (currently: gameProgress, gameThreat).
// Assigned onto `window.` — NOT `let` (a let binding wouldn't be visible to the separately-evaluated
// song, and bare assignment throws under strict mode). Default is sliders (draggable widgets);
// swap to sweep or mouse below for hands-free / pointer control.

// --- sliders (default): draggable widgets for deliberate values --------------------------------
window.gameProgress = slider(0.5, 0, 1)
window.gameThreat   = slider(0.5, 0, 1)

// --- auto-sweep: phased sines drift the two axes across their range hands-free ------------------
// window.gameProgress = sine.range(0, 1).slow(64)
// window.gameThreat   = sine.range(0, 1).slow(37)

// --- mouse drive: X = gameProgress, Y = gameThreat (move the pointer to steer) ------------------
// window.gameProgress = mousex
// window.gameThreat   = mousey
