// @ts-check
// Reactive Strudel songs as content (the "wad" — separately-licensable data the engine interprets).
// Each song is strudel.cc-dialect code that references the game's kosher set: gus_* instruments
// (js/audio/strudel/soundfont.js) + the game signals (progress/threat, js/audio/signal-registry.js).
// Played via the repl (evaluate); stopped via evaluate("hush()").
//
// Ported Tone scores (Dread/Neon/Glitch/Cold/Noir) land here as they're converted (issue #269).
// Composition is tuned by ear in song-preview.html — mechanical/structure-first here.

/** @typedef {{ id: string, name: string, code: string }} Song */

/** Calm overworld theme. */
export const HUB_SONG = {
  id: "hub",
  name: "Hub Ambient",
  code: `
setcpm(55/4)
$: note("<c3 eb3 g3 bb3>").s("gus_warm_pad").gain(0.35).room(0.7).slow(2)
$: note("c2 ~ ~ g2 ~ ~ eb2 ~").s("gus_synth_bass_1").lpf(700).gain(0.3)
`,
};

/** Run scores (keyed by id). More get added as the Tone scores are ported (#269). */
export const SONGS = {
  "corporate-dread": {
    id: "corporate-dread",
    name: "Corporate — Dread",
    code: `
setcpm(60/4)
$: note("<c2 c2 g1 c2>").s("gus_synth_bass_1").lpf(threat.range(300, 3000)).gain(0.6)
$: note("c4 eb4 g4 bb4").s("gus_warm_pad").gain(progress.range(0.1, 0.6)).room(0.5)
$: sound("bd sd").gain(threat.range(0, 0.85))
`,
  },
};

/** @returns {Song[]} all run songs. */
export function songList() { return Object.values(SONGS); }

/** Pick a run song by id (exact, else the first). @param {string} [id] @returns {Song} */
export function pickSong(id) { return SONGS[id] || songList()[0]; }
