# audio-content

Runtime-loaded audio **content** for the Strudel song engine — kept separate from the engine
source (the "wad" boundary; see the AGPL/Doom-model note in the repo LICENSE + `docs/audio-direction.md`).

## soundfonts/

- **`GeneralUser-GS.sf2`** — the game's vendored General MIDI soundfont (S. Christian Collins /
  mrbumpy409 fork). Its 287 presets are registered by `js/audio/strudel/soundfont.js` as distinct
  **`gus_*`** named Strudel sounds (e.g. `gus_warm_pad`, `gus_tine_electric_piano`). These are a
  **separate, non-fungible instrument set** — deliberately NOT aliased to strudel.cc's `gm_*` (those
  are a different soundfont; do not treat them as interchangeable).
- **`GeneralUser-GS.LICENSE.txt`** — its license: free for any use (private/commercial), modifiable,
  bundlable. Clean to ship. (Chosen over strudel.cc's default WebAudioFont `gm_*`, whose provenance
  is murky — WebAudioFont is itself derived from GeneralUser GS + FluidR3; we use the clean source.)

## Authoring parity

To hear in strudel.cc what the game will play, load the same soundfont there and reference the same
`gus_*` names. (The published manifest + authoring prelude land with the preview tool / linter.)
