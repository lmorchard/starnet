# Session notes — Soundfont authoring/deployment seam + cull build-step

**Branch:** `soundfont-seam-cull`
**Date:** 2026-07-01
**Status:** shipped (core deliverables done; two tasks deferred — see below)

## What shipped

A two-font seam separating large authoring soundfonts from tiny committed deployment fonts, with a reproducible Node build step that distills one into the other.

### Manifest (`audio-content/soundfonts/manifest.js`)

Single source of truth listing both fonts by non-fungible prefix. Each entry carries `prefix`, `authoringPath`, `deployPath`, `license`, `host`, and an `allow` escape-hatch list. The prefix is load-bearing: `gus_warm_pad` and `msg_warm_pad` are distinct instruments from distinct fonts, never aliased.

### Loader (`js/audio/strudel/soundfont.js`)

Generalized from one hardcoded URL to a manifest-driven loop. For each manifest entry: HEAD-probe the `deployPath`, prefer it if found, fall back to `authoringPath`. Registers presets under the entry's `prefix`. Paths are resolved module-relative via `import.meta.url` so they survive GitHub Pages subpath hosting.

### SF2 pure modules

- `js/audio/soundfont/sf2-writer.js` — `writeSf2(font)` → `ArrayBuffer`. Serializes a `soundfont2`-shaped structure to a valid uncompressed SF2.
- `js/audio/soundfont/sf2-prune.js` — `prunePresets(font, keepNameSet)` → subsetted structure. Walks the preset→instrument→sample reachability graph, remaps all index references (bag ranges, `sampleID`/`instrument` generators, loop points, `sampleLink`), and returns a new structure for the writer.

Both pure, no I/O, fully unit-tested.

### Build scripts

- `scripts/soundfont-scan-used.js` — `scanUsedNames(text, prefix, allow)` + `gatherContent(dirs)`. Scans `audio-content/songs/*.strudel` and `js/audio/strudel/data/*` for `<prefix>*` tokens; unions with the manifest `allow` list.
- `scripts/cull-soundfonts.js` — orchestration: for each manifest entry with an authoring font present → scan → parse (soundfont2) → prune → write (sf2-writer) → validate (reparse) → log kept/dropped/sizes. Exported `cullFont(entry, usedNames)` is unit-tested separately.
- `scripts/fetch-authoring-soundfonts.js` — downloads each manifest font from its `host` to its `authoringPath`, skipping if already present.

### Makefile targets

`cull-soundfonts`, `fetch-soundfonts`, `sf3-to-sf2` (all added to `.PHONY`). `cull-soundfonts` passes `--max-old-space-size=4096` to Node — required to parse the 206 MB MuseScore font.

### Fonts committed

| Prefix | Font | Authoring size | Deploy size | Kept presets |
|--------|------|---------------|-------------|--------------|
| `gus_` | GeneralUser GS | 32.3 MB | 2.49 MB | `gus_synth_bass_1`, `gus_warm_pad` |
| `msg_` | MuseScore_General (MIT) | 215.6 MB | 2.95 MB | `msg_halo_pad` |

The authoring GeneralUser GS (32.3 MB) stays committed — small enough. The authoring MuseScore font (215.6 MB) is gitignored + fetched from OSUOSL on demand.

The `msg_` deploy font includes `msg_halo_pad` (used by `hub.strudel`). MIT license text committed at `audio-content/soundfonts/MuseScore_General.LICENSE.txt` with the required attribution block.

### Scanner finding: only 2 gus_ sounds in production content

The scanner found `gus_synth_bass_1` and `gus_warm_pad` in songs + data, not 3. The spec named `gus_tine_electric_piano` as a third candidate — it appears in docs/tests/comments but not in any `.strudel` song file or audio data file. The cull correctly dropped it. If a song later uses it, the next `make cull-soundfonts` run will pick it up automatically.

---

## Technical gotchas (future-maintainer reading)

### `soundfont2` is CommonJS-only

The package exports a CommonJS module. Import it as:
```js
import sf2pkg from "soundfont2";
const { SoundFont2 } = sf2pkg;
```
`import { SoundFont2 } from "soundfont2"` fails with a named-export error.

### `soundfont2` cannot read `.sf3` (compressed soundfonts)

The runtime parser uses `sfumato`, which reads raw Int16 PCM. It has no Ogg/Vorbis or zlib decompression path. `.sf3` (MuseScore's compressed format) silently produces garbage or throws. Must be converted to `.sf2` first with `sf3convert`. This applies to both the runtime loader and the cull build step — neither can consume `.sf3` directly.

### `soundfont2` loop points are relative to `start`, not absolute

`soundfont2` stores `sample.header.startLoop` and `sample.header.endLoop` RELATIVE to `sample.header.start`, not as absolute offsets into the `smpl` chunk. When building the new `smpl` block in the writer, loop points must be re-added to the new absolute `start` to recover the correct SF2 offsets. Getting this wrong produces looping artifacts or silence on sustained notes.

### `soundfont2` `sampleData` over-reads past the real PCM

`soundfont2` reads `sampleData` as a flat buffer covering the whole `smpl` chunk — it does not trim to individual sample boundaries. When writing, trim the output `smpl` block to `max(sample.header.end) * 2` bytes (Int16 = 2 bytes each), not to the full `sampleData` length. Using the raw buffer size inflates the deploy font.

### `sampleLink` (stereo partner index) must be remapped on prune

Each sample header carries a `sampleLink` field pointing to the index of its stereo partner sample. After pruning the sample table, those indices change. If `sampleLink` is not remapped to the new sample indices, the deploy font can have mismatched stereo pairs — one channel of a stereo instrument points to the wrong (or nonexistent) sample.

This was caught in review and fixed, with a regression test using a synthetic stereo font. MuseScore's Halo Pad (the `msg_` preset) happens to be mono so did not expose the bug in production, but the writer correctly remaps links for stereo instruments.

### Node heap limit for large fonts

Parsing a 206 MB SF2 into a JavaScript object crosses Node's default 2 GB heap limit on some builds. `make cull-soundfonts` passes `node --max-old-space-size=4096` to allocate 4 GB max. Without this, the MuseScore cull throws an out-of-memory error.

---

## Review catches (things found during implementation)

- **Stereo-link remapping** — `sf2-prune.js` initially did not remap `sampleLink` after compacting the sample table. Caught during a test with a synthetic stereo font. Fixed and added to the regression suite.
- **Over-wide `sampleData` slice** — initial writer used the full `sampleData` buffer size for the `smpl` chunk, producing a larger-than-necessary output. Fixed to trim at `max(end) * 2`.
- **Scanner: only 2 gus_ presets, not 3** — spec expected `gus_tine_electric_piano`; scanner correctly returned only the 2 actually referenced in song/data files. The scanner was right; the spec's candidate list was a guess.

---

## Deferred items / open decisions

### Task 3.3 — In-browser verify (pending, for Les)

Confirming that the game loads the deploy fonts and songs sound correct is deferred to a manual playtest. Recommended steps: `make serve`, arm audio, start a run, verify music plays correctly. The deploy-first HEAD-probe logic was validated by unit test but has not been visually confirmed in a real browser. If a sound is silent after the verify, add it to the relevant manifest `allow` list and re-run `make cull-soundfonts`.

### Task 5.4 — Regenerate the strudel.cc prebake from the manifest (deferred)

`audio-content/strudel-prebake.js` is a hand-maintained file with a `gus_` loading block and a comment "keep in sync with soundfont.js." It has not been updated to include a `msg_` block, nor has it been generated from the manifest.

The blocker: the `msg_` authoring font at OSUOSL has no CORS header, so a browser-side strudel.cc fetch of the full 206 MB file is not possible without self-hosting it. The prebake is designed for strudel.cc authoring (browser), so a `msg_` block there would only work against a CORS-enabled self-hosted copy. Options for Les:

1. Self-host the 206 MB authoring font with `Access-Control-Allow-Origin: *` (own domain, GH Pages, CDN). This unblocks full `msg_` authoring in strudel.cc.
2. Accept that `msg_` authoring in strudel.cc is limited to the culled deploy font (2.95 MB, small enough to serve from our origin with CORS), not the full 206-preset palette.
3. Leave the prebake as-is (gus_-only) until there's a reason to act.

See `docs/dev-sessions/2026-07-01-1708-soundfont-seam-cull/musescore-sourcing.md` for the full CORS investigation findings.

### Possible enhancement: pin sha256 of fetched authoring fonts

The MuseScore font has been stable on OSUOSL since 2020-07-10, but a pinned sha256 in the manifest would make `make fetch-soundfonts` reproducible against a silent upstream change. Noted as a future improvement, not implemented.

---

## Files changed

**Created:**
- `audio-content/soundfonts/manifest.js`
- `js/audio/soundfont/sf2-writer.js`
- `js/audio/soundfont/sf2-prune.js`
- `scripts/cull-soundfonts.js`
- `scripts/soundfont-scan-used.js`
- `scripts/fetch-authoring-soundfonts.js`
- `audio-content/soundfonts/GeneralUser-GS.deploy.sf2` (committed)
- `audio-content/soundfonts/MuseScore_General.deploy.sf2` (committed)
- `audio-content/soundfonts/MuseScore_General.LICENSE.txt` (committed)
- `tests/sf2-writer.test.js`
- `tests/sf2-prune.test.js`
- `tests/soundfont-manifest.test.js`
- `tests/soundfont-scan-used.test.js`
- `tests/soundfont-loader.test.js`
- `tests/cull-soundfonts.test.js`
- Session docs: `spec.md`, `plan.md`, `sf2-shape.md`, `musescore-sourcing.md`, `notes.md`

**Modified:**
- `js/audio/strudel/soundfont.js` — manifest-driven, deploy-first, multi-font
- `Makefile` — `cull-soundfonts`, `fetch-soundfonts`, `sf3-to-sf2` targets
- `.gitignore` — gitignore the large authoring MuseScore font
- `docs/audio-direction.md` — expanded soundfont tooling section
