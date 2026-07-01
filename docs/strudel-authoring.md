# Authoring Starnet songs in strudel.cc

Starnet's music is **Strudel content** (the "wad" model). Compose a song in
[strudel.cc](https://strudel.cc) using the game's sound set, then drop the file into the repo —
it plays in-game **unchanged**. The two names a song relies on — the `gus_*` instruments and the
`gameProgress` / `gameThreat` signals — resolve identically in the editor and the game.

## One-time setup: the prebake

1. Open strudel.cc → **Settings** → the **prebake** script area (code that runs before every song).
2. Paste the entire contents of [`audio-content/strudel-prebake.js`](../audio-content/strudel-prebake.js).

That loads the game's `gus_*` instruments (GeneralUser GS v2.0.3, fetched from this repo so it's the
exact same sound set) and stubs the game signals as **sliders** you can drag.

## Compose

- **Instruments:** the game's `.s("gus_warm_pad")` etc. (`gus_*`), and/or plain synth waveforms
  (`sawtooth`/`square`/`triangle`/…) and drum samples (`bd`/`sd`/`hh`/…).
- **React to game state:** reference the signals directly —
  `.lpf(gameThreat.range(400, 6000))`, `.gain(gameProgress.range(0, 0.8))`, etc.
- **Hear it react:** drag the `gameProgress` / `gameThreat` sliders. (Prefer hands-free? Swap the
  prebake's slider lines for the commented `sine`-sweep or `mousex/mousey` alternatives.)

> `gus_*` is a **distinct** set from strudel.cc's built-in `gm_*` (a different soundfont) — do not
> substitute, or the sound won't carry to the game.

## Check it carries to the game

Open [`preview/music.html`](../preview/music.html) (the game's preview harness), paste your song, and
**PLAY**. It runs through the game's own runtime + `gus_*` + signal sliders, and the in-set **linter**
flags any sound name not in the kosher set (so paste-parity holds).

## Add it to the game

1. Save the song as `audio-content/songs/<id>.strudel`.
2. Add a manifest entry in `js/audio/strudel/songs/index.js` (`SONG_MANIFEST`:
   `{ id, name, file }`).

It then joins the run rotation and appears in the preview picker.

## Notes

- **Song files carry no setup** — no soundfont load, no signal stubs. The prebake (editor) and the
  engine (game) provide those. Keep songs as pure patterns so they stay portable both ways.
- The prebake's signal list must stay in sync with
  [`js/audio/signal-registry.js`](../js/audio/signal-registry.js) (currently: `gameProgress`,
  `gameThreat`). Add a game signal there → add the matching stub in the prebake.
- The `gus_*` registration in the prebake mirrors `js/audio/strudel/soundfont.js`; if that changes
  (naming, note trigger), update the prebake to match. The `fonts: []` option on the prebake's
  `registerSound` is required only for strudel.cc's soundfont UI (it reads `options.fonts.length`);
  the game runtime has no such UI and doesn't need it.
