# Authoring Starnet songs in strudel.cc

Starnet's music is **Strudel content** (the "wad" model). Compose a song in
[strudel.cc](https://strudel.cc) using the game's sound set, then drop the file into the repo —
it plays in-game **unchanged**. A song relies on two game-owned names — the `gus_*` instruments and
the `gameProgress` / `gameThreat` signals — which resolve identically in the editor and the game.
(Instruments in the editor are a known gap — see below.)

## One-time setup: the prebake

1. Open strudel.cc → **Settings** → the **prebake** script area (code that runs before every song).
2. Paste the entire contents of [`audio-content/strudel-prebake.js`](../audio-content/strudel-prebake.js).

That stubs the game signals as **sliders** you can drag while composing.

## Compose

- **Instruments:** plain synth waveforms (`sawtooth`/`square`/`triangle`/…) and drum samples
  (`bd`/`sd`/`hh`/…) — strudel.cc has these natively. The game's `gus_*` presets are **not yet
  loadable in the editor** (see the known limitation below); they resolve in-game.
- **React to game state:** reference the signals directly —
  `.lpf(gameThreat.range(400, 6000))`, `.gain(gameProgress.range(0, 0.8))`, etc.
- **Hear it react:** drag the `gameProgress` / `gameThreat` sliders. (Prefer hands-free? Swap the
  prebake's slider lines for the commented `sine`-sweep or `mousex/mousey` alternatives.)

## Check it carries to the game

Open [`preview/music.html`](../preview/music.html) (the game's preview harness), paste your song, and
**PLAY**. Unlike strudel.cc, the preview harness loads the full `gus_*` set, so this is where you
confirm a `gus_*`-using song actually sounds right, and the in-set **linter** flags any sound name
not in the kosher set (so paste-parity holds).

## Add it to the game

1. Save the song as `audio-content/songs/<id>.strudel`.
2. Add a manifest entry in `js/audio/strudel/songs/index.js` (`SONG_MANIFEST`:
   `{ id, name, file }`).

It then joins the run rotation and appears in the preview picker.

## Known limitation: `gus_*` instruments in the editor

Loading the game's GeneralUser GS set into strudel.cc from the prebake is **not working yet**. The
prelude below registers the `gus_*` names correctly (verified: it produces the same 287 names as the
game), but running it in strudel.cc's prebake trips a Repl render error — `can't access property
"length", i.fonts is undefined` — apparently because the manual `registerSound(..., {type:'soundfont'})`
path leaves strudel.cc's soundfont UI in a state it can't render. Tracked in #265.

Until that's resolved: author with synth waveforms + drums + the signals in strudel.cc, and use
`preview/music.html` (which loads `gus_*`) to audition anything that uses the game presets.

<details>
<summary>Experimental gus_* prelude (currently errors in strudel.cc)</summary>

```js
// Loads Starnet's vendored GeneralUser GS v2.0.3 and registers the gus_* names, mirroring
// js/audio/strudel/soundfont.js. Produces names identical to the game — but currently trips
// a strudel.cc Repl error (i.fonts undefined). See #265.
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
      }, { type: 'soundfont', prebake: false });
    });
  });
```
</details>

## Notes

- **Song files carry no setup** — no soundfont load, no signal stubs. The prebake (editor) and the
  engine (game) provide those. Keep songs as pure patterns so they stay portable both ways.
- The prebake's signal list must stay in sync with
  [`js/audio/signal-registry.js`](../js/audio/signal-registry.js) (currently: `gameProgress`,
  `gameThreat`). Add a game signal there → add the matching stub in the prebake.
- `gus_*` is a **distinct** set from strudel.cc's built-in `gm_*` (a different soundfont) — do not
  substitute.
