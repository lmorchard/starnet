# Soundfont Seam + Cull — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the rich, in-flux *authoring* soundfont from a tiny, culled *deployment* soundfont, via a reproducible Node build step; vendor MuseScore_General as a second font to prove it end-to-end.

**Architecture:** A manifest lists fonts by non-fungible prefix (`gus_`, `msg_`), each with an authoring path and a deploy path. The runtime loader prefers the (small, committed) deploy font and falls back to the (large, local/gitignored) authoring font. A `make cull-soundfonts` step scans song content for used sounds, parses each authoring SF2 with `soundfont2`, prunes to the reachable preset→instrument→sample graph, and serializes a minimal SF2 with our own pure writer — validated by re-parsing the output.

**Tech Stack:** Vanilla ES modules (`@ts-check` JSDoc), `node:test` + `node:assert/strict`, `soundfont2` (parse only — our `sf2-writer` handles serialization), Makefile targets, `sf3convert` (one-time `.sf3`→`.sf2` conversion, external CLI).

**Base branch:** `soundfont-seam-cull`, off `retire-tonejs` (has `soundfont.js`, prebake, songs).

**A note on the SF2-writer tasks:** SF2 binary layout is fixed by the SF2.01 spec (record byte-sizes given in Task 0.3's reference table), but `soundfont2`'s parsed *object* field names must be observed, not guessed. So the writer is built TDD-first: the tests below are the concrete behavioral contract, and the serializer body is written to pass them during the Phase 0 spike. This is deliberate — Phase 0 exists to absorb exactly this discovery cheaply, before the surrounding machinery depends on it.

---

## File Structure

**Created:**
- `audio-content/soundfonts/manifest.js` — the font registry (prefix → authoring/deploy/license paths). Single source of truth; imported by the loader, the cull script, and the prebake generator.
- `js/audio/soundfont/sf2-writer.js` — pure module: pruned structured object → SF2 `ArrayBuffer`. The riskiest unit; pure and testable.
- `js/audio/soundfont/sf2-prune.js` — pure module: given a parsed font + a set of kept preset names, return a pruned structure (reachable instruments/samples, remapped indices).
- `scripts/cull-soundfonts.js` — orchestration: manifest → scan → parse → prune → write → validate → log.
- `scripts/soundfont-scan-used.js` — pure-ish module: scan song/data files for `<prefix>…` tokens → set of used sound names. Reused by the cull script; unit-tested directly.
- `scripts/fetch-authoring-soundfonts.js` — fetch each manifest font's authoring `.sf2` from its host URL to its (gitignored) local path.
- `tests/sf2-writer.test.js`, `tests/sf2-prune.test.js`, `tests/soundfont-manifest.test.js`, `tests/soundfont-scan-used.test.js` — unit tests.
- `audio-content/soundfonts/MuseScore_General.deploy.sf2` + `MuseScore_General.LICENSE.txt` — committed (Phase 5).

**Modified:**
- `js/audio/strudel/soundfont.js` — generalized from one hardcoded font to manifest-driven, multi-font, deploy-first-with-fallback. Keeps `loadGameSoundfont()` / `soundfontNames()` signatures (callers: `js/ui/song-preview.js:46`, `js/audio/strudel/index.js:43`).
- `audio-content/strudel-prebake.js` — regenerated from the manifest so `msg_` appears and the gus/msg blocks never drift from `soundfont.js` (Phase 5).
- `Makefile` — add `cull-soundfonts`, `fetch-soundfonts`, `sf3-to-sf2` targets.
- `.gitignore` — ignore the large authoring `.sf2` inputs (keep deploy fonts tracked).
- `MANUAL.md` / `docs/audio-direction.md` — document the two-font model + `msg_` palette.

---

## Phase 0 — De-risk spikes (front-loaded)

Two independent risks resolved before building the machinery: the SF2 writer, and the MuseScore license/host. Do 0.6 (investigation) in parallel with the writer tasks.

### Task 0.1: Install deps and record the `soundfont2` object shape

**Files:**
- Create: `docs/dev-sessions/2026-07-01-1708-soundfont-seam-cull/sf2-shape.md` (scratch notes)

- [ ] **Step 1: Install dependencies in this worktree**

Run: `make install` (or `npm ci` if a lockfile is present)
Expected: `node_modules/` populated; `node -e "require('soundfont2')"` exits 0.

- [ ] **Step 2: Dump the parsed shape from the real font**

Run:
```bash
node -e '
const { SoundFont2 } = require("soundfont2");
const fs = require("fs");
const sf = new SoundFont2(new Uint8Array(fs.readFileSync("audio-content/soundfonts/GeneralUser-GS.sf2")));
console.log("top keys:", Object.keys(sf));
console.log("presets:", sf.presets.length, "instruments:", sf.instruments.length, "samples:", sf.samples.length);
console.log("preset[0] keys:", Object.keys(sf.presets[0]));
console.log("preset[0].header:", JSON.stringify(sf.presets[0].header));
console.log("preset[0].zones[0] keys:", Object.keys(sf.presets[0].zones[0]));
console.log("instrument[0] keys:", Object.keys(sf.instruments[0]));
console.log("sample[0].header:", JSON.stringify(sf.samples[0].header));
console.log("sample[0].data:", sf.samples[0].data.constructor.name, sf.samples[0].data.length);
console.log("raw chunk access?:", Object.keys(sf.chunk || {}), Object.keys(sf.presetData || {}), Object.keys(sf.sampleData || {}));
'
```
Expected: prints the field names. **Record them in `sf2-shape.md`** — especially how zones link to instruments/samples (object refs vs. index), where generators (keyRange/velRange/sampleID/instrument) live, and whether raw chunk tables (`sf.chunk`, `sf.presetData`) are reachable. These names are what the writer/prune code references.

- [ ] **Step 3: Commit the shape notes**

```bash
git add docs/dev-sessions/2026-07-01-1708-soundfont-seam-cull/sf2-shape.md
git commit -m 'Soundfont cull: record soundfont2 parsed object shape (spike)'
```

### Task 0.2: Round-trip harness + identity-write test (writer proves itself before pruning)

De-risk strategy: prove the serializer can round-trip a font **unchanged** before adding any pruning. If identity-write reparses cleanly with identical preset/sample counts, the byte-layout is correct; pruning is then just choosing fewer rows.

**Files:**
- Create: `tests/sf2-writer.test.js`

- [ ] **Step 1: Write the failing identity round-trip test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SoundFont2 } from "soundfont2";
import { writeSf2 } from "../js/audio/soundfont/sf2-writer.js";

const SRC = "audio-content/soundfonts/GeneralUser-GS.sf2";

test("identity write round-trips: reparse yields same preset & sample counts + names", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));
  const bytes = writeSf2(src);                 // no pruning: re-emit everything
  const out = new SoundFont2(new Uint8Array(bytes));
  assert.equal(out.presets.length, src.presets.length, "preset count preserved");
  assert.equal(out.samples.length, src.samples.length, "sample count preserved");
  assert.deepEqual(
    out.presets.map((p) => p.header.name),
    src.presets.map((p) => p.header.name),
    "preset names preserved in order",
  );
});
```

- [ ] **Step 2: Run it, expect failure (module missing)**

Run: `node --test tests/sf2-writer.test.js`
Expected: FAIL — cannot find `../js/audio/soundfont/sf2-writer.js`.

### Task 0.3: Implement `sf2-writer.js` (identity serialize) until Task 0.2 passes

**Files:**
- Create: `js/audio/soundfont/sf2-writer.js`

**SF2.01 record layout reference (fixed sizes — the concrete contract for the packing code):**

| Chunk | Record | Bytes | Fields |
|---|---|---|---|
| `phdr` | preset header | 38 | name[20], preset u16, bank u16, presetBagNdx u16, library u32, genre u32, morphology u32 |
| `pbag` | preset zone | 4 | genNdx u16, modNdx u16 |
| `pmod` | preset modulator | 10 | (carry through unchanged) |
| `pgen` | preset generator | 4 | oper u16, amount u16/s16 |
| `inst` | instrument | 22 | name[20], instBagNdx u16 |
| `ibag` | instrument zone | 4 | genNdx u16, modNdx u16 |
| `imod` | instrument modulator | 10 | (carry through unchanged) |
| `igen` | instrument generator | 4 | oper u16, amount u16/s16 |
| `shdr` | sample header | 46 | name[20], start u32, end u32, startLoop u32, endLoop u32, sampleRate u32, originalPitch u8, pitchCorrection s8, sampleLink u16, sampleType u16 |
| `smpl` | sample data | — | Int16 LE PCM, **46 zero-samples between each sample** |

Terminal sentinel records are mandatory: a final `phdr` "EOP", `inst` "EOI", `shdr` "EOS" whose bag/start indices bound the last real record. RIFF structure: `RIFF`→`sfbk` containing `LIST INFO`, `LIST sdta` (`smpl`), `LIST pdta` (phdr,pbag,pmod,pgen,inst,ibag,imod,igen,shdr). All chunks word-aligned (pad odd byte counts with a trailing `\0`).

- [ ] **Step 1: Implement `writeSf2(font, opts)` against the layout table**

Export `writeSf2(font)` returning an `ArrayBuffer`. Implementation approach: emit `INFO` from `font.metaData`; emit `smpl` by concatenating each sample's Int16 data with 46 zero-samples between, recording new start/end/loop offsets; regenerate `shdr` from `font.samples` headers using the recomputed offsets; regenerate `phdr`/`pbag`/`pgen` and `inst`/`ibag`/`igen` from `font.presets`/`font.instruments` (carry `pmod`/`imod` through); append the three sentinels. Use a `DataView` + a growable byte buffer helper. Reference the exact field names recorded in `sf2-shape.md` (Task 0.1). Keep it one focused module.

- [ ] **Step 2: Run the identity test until it passes**

Run: `node --test tests/sf2-writer.test.js`
Expected: PASS. If it fails, the failure is in byte layout — debug against the reference table, not by weakening the assertions.

- [ ] **Step 3: Commit**

```bash
git add js/audio/soundfont/sf2-writer.js tests/sf2-writer.test.js
git commit -m 'Soundfont cull: sf2-writer identity round-trip (spike)'
```

### Task 0.4: Prune module + subset round-trip

**Files:**
- Create: `js/audio/soundfont/sf2-prune.js`, `tests/sf2-prune.test.js`

- [ ] **Step 1: Write the failing prune test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SoundFont2 } from "soundfont2";
import { prunePresets } from "../js/audio/soundfont/sf2-prune.js";
import { writeSf2 } from "../js/audio/soundfont/sf2-writer.js";

const SRC = "audio-content/soundfonts/GeneralUser-GS.sf2";

test("prune to a subset: only kept presets survive, orphan samples dropped, file shrinks", () => {
  const src = new SoundFont2(new Uint8Array(readFileSync(SRC)));
  const keepNames = src.presets.slice(0, 3).map((p) => p.header.name);
  const pruned = prunePresets(src, new Set(keepNames));
  const out = new SoundFont2(new Uint8Array(writeSf2(pruned)));
  assert.deepEqual(out.presets.map((p) => p.header.name).sort(), [...keepNames].sort());
  assert.ok(out.samples.length <= src.samples.length, "sample count not larger");
  assert.ok(out.samples.length > 0, "kept presets still reference samples");
});
```

- [ ] **Step 2: Run, expect failure (module missing).** Run: `node --test tests/sf2-prune.test.js` → FAIL.

- [ ] **Step 3: Implement `prunePresets(font, keepNameSet)`**

Return a new structure shaped like `font` but keeping only presets whose `header.name ∈ keepNameSet`, the instruments those presets' zones reference, and the samples those instruments' zones reference. Remap `sampleID`/`instrument` generator indices and bag ranges to the compacted arrays. Pure; no I/O.

- [ ] **Step 4: Run both writer + prune tests until green.** Run: `node --test tests/sf2-writer.test.js tests/sf2-prune.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add js/audio/soundfont/sf2-prune.js tests/sf2-prune.test.js
git commit -m 'Soundfont cull: prune-to-subset with round-trip validation (spike)'
```

### Task 0.5: Spike gate (checkpoint)

- [ ] Confirm both round-trip tests pass and the pruned output is dramatically smaller than 32 MB (add a temporary `console.log(bytes.byteLength)` or assert `< 5_000_000`). If the writer proved intractable, STOP and raise the Polyphone-stopgap fallback with Les before continuing. Otherwise proceed.

### Task 0.6: MuseScore_General license + host verification (parallel investigation)

**Files:**
- Create: `docs/dev-sessions/2026-07-01-1708-soundfont-seam-cull/musescore-sourcing.md`

- [ ] **Step 1: Verify license.** Locate the MuseScore_General distribution, confirm the license is MIT (or record what it actually is), and save the license text. Record source URL in `musescore-sourcing.md`.
- [ ] **Step 2: Verify a fetchable host for the uncompressed `.sf2`** (or the `.sf3` + confirm `sf3convert` is installable). Record the exact URL and whether it serves CORS headers (needed for the strudel.cc prebake, not for the Node build). `curl -sI <url>` and note `access-control-allow-origin`.
- [ ] **Step 3: Commit findings.** `git add docs/.../musescore-sourcing.md && git commit -m 'Soundfont cull: MuseScore_General license + host findings'`
- [ ] If the license is not permissive or no fetchable host exists, STOP and bring options to Les before Phase 5.

---

## Phase 1 — The seam

### Task 1.1: Soundfont manifest

**Files:**
- Create: `audio-content/soundfonts/manifest.js`, `tests/soundfont-manifest.test.js`

- [ ] **Step 1: Write the failing manifest test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { SOUNDFONTS } from "../audio-content/soundfonts/manifest.js";

test("manifest entries are well-formed and prefixes are unique", () => {
  assert.ok(Array.isArray(SOUNDFONTS) && SOUNDFONTS.length >= 1);
  const prefixes = new Set();
  for (const f of SOUNDFONTS) {
    assert.match(f.prefix, /^[a-z]+_$/, "prefix is lowercase + trailing underscore");
    assert.ok(f.authoringPath && f.deployPath && f.license, "paths present");
    assert.ok(!prefixes.has(f.prefix), "prefix is unique");
    prefixes.add(f.prefix);
    assert.ok(Array.isArray(f.allow), "allow is an array");
  }
});
```

- [ ] **Step 2: Run, expect failure.** `node --test tests/soundfont-manifest.test.js` → FAIL (module missing).

- [ ] **Step 3: Create the manifest**

```js
// @ts-check
/** @typedef {{ prefix: string, authoringPath: string, deployPath: string, license: string, host?: string, allow: string[] }} SoundfontEntry */

/** The game's soundfonts. Each is a distinct, NON-FUNGIBLE set under its own prefix — never aliased
 *  across sets. The loader prefers `deployPath` (culled, committed) and falls back to `authoringPath`
 *  (full, local/gitignored). The cull build-step reads this to know what to prune and where to write.
 *  @type {SoundfontEntry[]} */
export const SOUNDFONTS = [
  {
    prefix: "gus_",
    authoringPath: "audio-content/soundfonts/GeneralUser-GS.sf2",
    deployPath: "audio-content/soundfonts/GeneralUser-GS.deploy.sf2",
    license: "audio-content/soundfonts/GeneralUser-GS.LICENSE.txt",
    host: "https://raw.githubusercontent.com/lmorchard/starnet/main/audio-content/soundfonts/GeneralUser-GS.sf2",
    allow: [],
  },
];
```

- [ ] **Step 4: Run until green.** `node --test tests/soundfont-manifest.test.js` → PASS.
- [ ] **Step 5: Commit.** `git add audio-content/soundfonts/manifest.js tests/soundfont-manifest.test.js && git commit -m 'Soundfont seam: font manifest'`

### Task 1.2: Generalize the loader (deploy-first, multi-font)

**Files:**
- Modify: `js/audio/strudel/soundfont.js`
- Test: `tests/soundfont-loader.test.js` (create)

The current `soundfont.js` hardcodes one URL + prefix. Generalize: loop `SOUNDFONTS`, attempt `deployPath`, on fetch failure fall back to `authoringPath`, register each font's presets under its own prefix. `loadGameSoundfont()` (no args) loads all; `soundfontNames()` returns all registered names. Keep `sanitize()` exported and prefix-parameterized.

- [ ] **Step 1: Write a failing test for prefix-parameterized `sanitize` + resolve order**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitize, resolveFontUrl } from "../js/audio/strudel/soundfont.js";

test("sanitize applies the given prefix", () => {
  assert.equal(sanitize("Warm Pad", 0, "gus_"), "gus_warm_pad");
  assert.equal(sanitize("Warm Pad", 0, "msg_"), "msg_warm_pad");
});

test("resolveFontUrl prefers deploy, falls back to authoring on failed probe", async () => {
  const entry = { deployPath: "D", authoringPath: "A" };
  assert.equal(await resolveFontUrl(entry, async (u) => u === "D"), "D");   // deploy exists
  assert.equal(await resolveFontUrl(entry, async (u) => u === "A"), "A");   // deploy 404 → authoring
});
```

- [ ] **Step 2: Run, expect failure** (`sanitize` arity / `resolveFontUrl` missing). `node --test tests/soundfont-loader.test.js` → FAIL.

- [ ] **Step 3: Refactor `soundfont.js`**

Change `sanitize(name, i)` → `sanitize(name, i, prefix)`. Add `export async function resolveFontUrl(entry, probe = defaultProbe)` where `defaultProbe(url)` does a `fetch(url, { method: "HEAD" })` and returns `res.ok`; returns `entry.deployPath` if the probe passes else `entry.authoringPath`. Rewrite `loadGameSoundfont()` to `for (const entry of SOUNDFONTS)`: resolve URL, `loadSoundfont`, register presets under `entry.prefix`. Accumulate names across fonts into `_names`. Import `SOUNDFONTS` from the manifest.

- [ ] **Step 4: Run until green.** `node --test tests/soundfont-loader.test.js` → PASS.
- [ ] **Step 5: Lint.** Run: `make lint` → no new errors.
- [ ] **Step 6: Commit.** `git add js/audio/strudel/soundfont.js tests/soundfont-loader.test.js && git commit -m 'Soundfont seam: manifest-driven, deploy-first, multi-font loader'`

---

## Phase 2 — Usage scanner

### Task 2.1: Scan song + data content for used sound names

**Files:**
- Create: `scripts/soundfont-scan-used.js`, `tests/soundfont-scan-used.test.js`

- [ ] **Step 1: Write the failing scanner test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanUsedNames } from "../scripts/soundfont-scan-used.js";

test("scanUsedNames finds prefixed tokens in text and unions the allow list", () => {
  const text = `.s("gus_warm_pad") n("0 3").s("gus_synth_bass_1") sound("bd sd") .s("msg_atmosphere")`;
  const gus = scanUsedNames(text, "gus_", ["gus_manual_extra"]);
  assert.deepEqual([...gus].sort(), ["gus_manual_extra", "gus_synth_bass_1", "gus_warm_pad"]);
  const msg = scanUsedNames(text, "msg_", []);
  assert.deepEqual([...msg], ["msg_atmosphere"]);
});
```

- [ ] **Step 2: Run, expect failure.** `node --test tests/soundfont-scan-used.test.js` → FAIL.

- [ ] **Step 3: Implement `scanUsedNames(text, prefix, allow)`**

```js
// @ts-check
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Extract all `<prefix>...` sound tokens from a blob of text, unioned with an allow list.
 * @param {string} text @param {string} prefix @param {string[]} [allow] @returns {Set<string>} */
export function scanUsedNames(text, prefix, allow = []) {
  const re = new RegExp(`\\b${prefix}[a-z0-9_]+`, "g");
  const found = new Set(text.match(re) || []);
  for (const a of allow) found.add(a);
  return found;
}

/** Concatenate the text of every song + audio-data file the scanner should search.
 * @param {string[]} [dirs] @returns {string} */
export function gatherContent(dirs = ["audio-content/songs", "js/audio/strudel/data"]) {
  let out = "";
  for (const dir of dirs) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isFile()) out += "\n" + readFileSync(join(dir, e.name), "utf8");
    }
  }
  return out;
}
```

- [ ] **Step 4: Run until green.** `node --test tests/soundfont-scan-used.test.js` → PASS.
- [ ] **Step 5: Commit.** `git add scripts/soundfont-scan-used.js tests/soundfont-scan-used.test.js && git commit -m 'Soundfont cull: usage scanner (song + data content)'`

---

## Phase 3 — Cull script

### Task 3.1: Orchestrate scan → parse → prune → write → validate

**Files:**
- Create: `scripts/cull-soundfonts.js`
- Test: `tests/cull-soundfonts.test.js` (integration; guarded to skip if authoring font absent)

- [ ] **Step 1: Write the integration test (guarded)**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { SoundFont2 } from "soundfont2";
import { cullFont } from "../scripts/cull-soundfonts.js";

const AUTHORING = "audio-content/soundfonts/GeneralUser-GS.sf2";

test("cullFont writes a minimal deploy SF2 containing exactly the used gus_ presets", { skip: !existsSync(AUTHORING) && "authoring font absent" }, () => {
  const outPath = "audio-content/soundfonts/__test.deploy.sf2";
  const used = new Set(["gus_warm_pad", "gus_synth_bass_1"]);
  const result = cullFont({ authoringPath: AUTHORING, deployPath: outPath, prefix: "gus_" }, used);
  try {
    const out = new SoundFont2(new Uint8Array(readFileSync(outPath)));
    const names = out.presets.map((p) => p.header.name);
    assert.ok(names.includes("gus_warm_pad") && names.includes("gus_synth_bass_1"));
    assert.ok(out.presets.length <= 3, "orphans dropped");
    assert.ok(result.deployBytes < result.authoringBytes / 4, "meaningful shrink");
  } finally { rmSync(outPath, { force: true }); }
});
```
Note: `cullFont` maps `used` (sanitized `gus_*` names) back to raw preset names using the same `sanitize()` the loader uses, so the comparison is name-consistent.

- [ ] **Step 2: Run, expect failure.** `node --test tests/cull-soundfonts.test.js` → FAIL (module missing).

- [ ] **Step 3: Implement `cull-soundfonts.js`**

```js
// @ts-check
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { SoundFont2 } from "soundfont2";
import { prunePresets } from "../js/audio/soundfont/sf2-prune.js";
import { writeSf2 } from "../js/audio/soundfont/sf2-writer.js";
import { sanitize } from "../js/audio/strudel/soundfont.js";
import { scanUsedNames, gatherContent } from "./soundfont-scan-used.js";
import { SOUNDFONTS } from "../audio-content/soundfonts/manifest.js";

/** Cull one font down to the presets whose sanitized names are in `usedNames`.
 * @returns {{ kept: string[], dropped: number, authoringBytes: number, deployBytes: number }} */
export function cullFont(entry, usedNames) {
  const authoringBytes = readFileSync(entry.authoringPath).length;
  const src = new SoundFont2(new Uint8Array(readFileSync(entry.authoringPath)));
  const used = new Set();
  const keepRawNames = new Set();
  src.presets.forEach((p, i) => {
    const s = sanitize(p.header.name, i, entry.prefix);
    if (usedNames.has(s) && !used.has(s)) { used.add(s); keepRawNames.add(p.header.name); }
  });
  const pruned = prunePresets(src, keepRawNames);
  const bytes = writeSf2(pruned);
  writeFileSync(entry.deployPath, Buffer.from(bytes));
  return { kept: [...used], dropped: src.presets.length - pruned.presets.length, authoringBytes, deployBytes: bytes.byteLength };
}

/** CLI: cull every manifest font whose authoring input is present. */
export function main() {
  const content = gatherContent();
  for (const entry of SOUNDFONTS) {
    if (!existsSync(entry.authoringPath)) { console.log(`[cull] skip ${entry.prefix} — authoring font absent (${entry.authoringPath})`); continue; }
    const used = scanUsedNames(content, entry.prefix, entry.allow);
    const r = cullFont(entry, used);
    console.log(`[cull] ${entry.prefix}: kept ${r.kept.length} (${r.kept.join(", ")}), dropped ${r.dropped} presets, ${(r.authoringBytes/1e6).toFixed(1)}MB → ${(r.deployBytes/1e6).toFixed(2)}MB → ${entry.deployPath}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run until green.** `node --test tests/cull-soundfonts.test.js` → PASS.
- [ ] **Step 5: Run the real cull + eyeball the log.** Run: `node scripts/cull-soundfonts.js` → prints `gus_` kept set (the ~3 used) + a 32MB → sub-MB shrink; writes `GeneralUser-GS.deploy.sf2`.
- [ ] **Step 6: Commit** (including the generated `gus_` deploy font). `git add scripts/cull-soundfonts.js tests/cull-soundfonts.test.js audio-content/soundfonts/GeneralUser-GS.deploy.sf2 && git commit -m 'Soundfont cull: orchestration + real gus_ deploy font'`

### Task 3.2: `make cull-soundfonts` target

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Add the target** (place near `bundle-vendor`):

```makefile
# Cull each authoring soundfont down to only the presets songs use → *.deploy.sf2
cull-soundfonts:
	node scripts/cull-soundfonts.js
```
Add `cull-soundfonts` to `.PHONY`.

- [ ] **Step 2: Verify.** Run: `make cull-soundfonts` → same output as Task 3.1 Step 5.
- [ ] **Step 3: Commit.** `git add Makefile && git commit -m 'Soundfont cull: make cull-soundfonts target'`

### Task 3.3: Verify the game still plays on the deploy font (browser)

- [ ] **Step 1:** `make bundle-vendor && make serve`, open the game, arm audio, start a run, confirm music plays. Because `GeneralUser-GS.deploy.sf2` now exists, the loader's HEAD probe passes and it loads the *deploy* font; songs referencing `gus_warm_pad`/`gus_synth_bass_1`/`gus_tine_electric_piano` must still sound correct. (Uses the browser-playtest API from memory: `window.starnet`.)
- [ ] **Step 2:** Note the result in `notes.md`. If a used sound is silent, the scanner missed a name → add it to the manifest `allow` list, re-cull, re-verify.

---

## Phase 4 — Automation glue

### Task 4.1: Fetch authoring fonts from their hosts

**Files:**
- Create: `scripts/fetch-authoring-soundfonts.js`
- Modify: `Makefile`, `.gitignore`

- [ ] **Step 1: Implement the fetcher**

```js
// @ts-check
import { writeFileSync, existsSync } from "node:fs";
import { SOUNDFONTS } from "../audio-content/soundfonts/manifest.js";

/** Download each manifest font's authoring .sf2 from its `host` to `authoringPath` (skips if present). */
export async function main() {
  for (const entry of SOUNDFONTS) {
    if (!entry.host) { console.log(`[fetch] ${entry.prefix}: no host, skip`); continue; }
    if (existsSync(entry.authoringPath)) { console.log(`[fetch] ${entry.prefix}: present, skip`); continue; }
    console.log(`[fetch] ${entry.prefix}: ${entry.host} → ${entry.authoringPath}`);
    const res = await fetch(entry.host);
    if (!res.ok) throw new Error(`fetch ${entry.host} → ${res.status}`);
    writeFileSync(entry.authoringPath, Buffer.from(await res.arrayBuffer()));
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 2: Makefile target + PHONY**

```makefile
# Download authoring soundfonts (large; gitignored) from their hosts
fetch-soundfonts:
	node scripts/fetch-authoring-soundfonts.js
```

- [ ] **Step 3: .gitignore the large authoring inputs, keep deploy fonts tracked**

Append to `.gitignore`:
```
# Large authoring soundfonts — fetched via `make fetch-soundfonts`, never committed.
# Deploy fonts (*.deploy.sf2) ARE committed.
/audio-content/soundfonts/MuseScore_General.sf2
```
(GeneralUser-GS.sf2 stays committed — small enough — so it is not ignored.)

- [ ] **Step 4: Commit.** `git add scripts/fetch-authoring-soundfonts.js Makefile .gitignore && git commit -m 'Soundfont cull: fetch-soundfonts target + gitignore authoring inputs'`

### Task 4.2: `.sf3`→`.sf2` conversion wrapper

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Add a documented target** (only needed if a font is sourced as `.sf3`):

```makefile
# One-time: convert a compressed .sf3 to the uncompressed .sf2 our runtime parser requires.
# Requires `sf3convert` (MuseScore tools). Usage: make sf3-to-sf2 IN=foo.sf3 OUT=foo.sf2
sf3-to-sf2:
	sf3convert "$(IN)" "$(OUT)"
```
Add to `.PHONY`. Document the `sf3convert` dependency in `docs/audio-direction.md`.

- [ ] **Step 2: Commit.** `git add Makefile && git commit -m 'Soundfont cull: sf3-to-sf2 conversion target'`

---

## Phase 5 — Vendor MuseScore_General (`msg_`)

Prerequisite: Task 0.6 confirmed license + host.

### Task 5.1: Add the `msg_` manifest entry + license

**Files:**
- Modify: `audio-content/soundfonts/manifest.js`
- Create: `audio-content/soundfonts/MuseScore_General.LICENSE.txt`

- [ ] **Step 1:** Save the verified license text to `MuseScore_General.LICENSE.txt`.
- [ ] **Step 2:** Append to `SOUNDFONTS`:
```js
  {
    prefix: "msg_",
    authoringPath: "audio-content/soundfonts/MuseScore_General.sf2",
    deployPath: "audio-content/soundfonts/MuseScore_General.deploy.sf2",
    license: "audio-content/soundfonts/MuseScore_General.LICENSE.txt",
    host: "<verified host URL from Task 0.6>",
    allow: [],
  },
```
- [ ] **Step 3:** `make install`-free check: `node --test tests/soundfont-manifest.test.js` → still PASS (two entries, unique prefixes).
- [ ] **Step 4: Commit.** `git add audio-content/soundfonts/manifest.js audio-content/soundfonts/MuseScore_General.LICENSE.txt && git commit -m 'Soundfont: add MuseScore_General (msg_) manifest entry + license'`

### Task 5.2: Fetch + (if needed) convert the authoring font

- [ ] **Step 1:** `make fetch-soundfonts` → downloads `MuseScore_General.sf2` (gitignored). If the host only serves `.sf3`, fetch that then `make sf3-to-sf2 IN=... OUT=audio-content/soundfonts/MuseScore_General.sf2`.
- [ ] **Step 2:** Sanity parse: `node -e "const {SoundFont2}=require('soundfont2');const fs=require('fs');console.log(new SoundFont2(new Uint8Array(fs.readFileSync('audio-content/soundfonts/MuseScore_General.sf2'))).presets.length)"` → prints a preset count (>0). No commit (font is gitignored).

### Task 5.3: Cull `msg_` and commit the deploy font

- [ ] **Step 1:** Add at least one `msg_` sound to a song (or to the manifest `allow`) so the scanner has something to keep — otherwise the cull correctly produces an empty set. Pick a `msg_` preset that fits the aesthetic (a pad / atmosphere / synth lead). Verify the sanitized name via the inspection one-liner.
- [ ] **Step 2:** `make cull-soundfonts` → now culls both fonts; writes `MuseScore_General.deploy.sf2`; logs the kept `msg_` set + shrink.
- [ ] **Step 3:** `node --test tests/cull-soundfonts.test.js` → PASS (gus_ case still green).
- [ ] **Step 4: Commit** deploy font + any song edit. `git add audio-content/soundfonts/MuseScore_General.deploy.sf2 audio-content/songs && git commit -m 'Soundfont: cull MuseScore_General deploy font + first msg_ use'`

### Task 5.4: Regenerate the prebake from the manifest (kill drift)

**Files:**
- Create: `scripts/gen-prebake.js`; Modify: `audio-content/strudel-prebake.js`, `Makefile`

The prebake currently hardcodes the `gus_` load block and warns "keep in sync with soundfont.js." With two fonts that drift risk doubles. Generate the instrument-loading blocks from the manifest so the prebake and loader share one source.

- [ ] **Step 1:** Write `scripts/gen-prebake.js` that emits the prebake text — the Firefox shim + signal stubs (static preamble/epilogue kept as string constants) plus one `loadSoundfont(<host>).then(...)` block per manifest entry, registering under each `prefix` using the SAME sanitize/dedup/trigger as `soundfont.js`. Blocks fetch the **authoring** `host` (full palette for authoring).
- [ ] **Step 2:** Add `make gen-prebake` (`node scripts/gen-prebake.js > audio-content/strudel-prebake.js`) to `.PHONY` + targets. Run it; diff to confirm the `gus_` block is unchanged in spirit and a `msg_` block was added.
- [ ] **Step 3:** Paste into strudel.cc, load a song using a `msg_` sound, confirm it plays (manual). Note in `notes.md`.
- [ ] **Step 4: Commit.** `git add scripts/gen-prebake.js audio-content/strudel-prebake.js Makefile && git commit -m 'Soundfont: generate strudel prebake from manifest (gus_ + msg_)'`

### Task 5.5: Docs + session retro

**Files:**
- Modify: `MANUAL.md`, `docs/audio-direction.md`, `CLAUDE.md` (audio section if warranted); Create/append: `notes.md`

- [ ] **Step 1:** Document the two-font model (authoring vs deploy), `make cull-soundfonts` / `fetch-soundfonts`, the `msg_` palette, and the `sf3convert` dependency in `docs/audio-direction.md`. Update `MANUAL.md` if the sound palette is player-visible anywhere.
- [ ] **Step 2:** Write the session summary in `notes.md`: what shipped, the measured sizes (gus_ + msg_ before/after), any scanner `allow` entries needed, and the SF2-writer gotchas discovered in the spike.
- [ ] **Step 3: Full check.** Run: `make check` → lint + tests green.
- [ ] **Step 4: Commit.** `git add MANUAL.md docs/audio-direction.md docs/dev-sessions && git commit -m 'Soundfont seam + cull: docs + session notes'`

---

## Self-review (completed during authoring)

- **Spec coverage:** seam (T1.1–1.2), cull build-step (T0.2–0.4 spike → T3.1–3.2), multi-font/non-fungible manifest (T1.1, T5.1), MuseScore vendoring (T5.*), automation-first (T3.2, T4.1–4.2, T5.4), aesthetic vector (informs T5.3 preset pick), moving-palette re-scan (T2.1 scans every run), SF2-writer risk + Polyphone fallback (T0.5 gate). All spec sections map to a task.
- **Placeholder scan:** the only intentionally-deferred values are the MuseScore host URL and license text (resolved by the Task 0.6 investigation before they are needed) and the SF2-writer body (TDD-gated by concrete tests, per the header note). No "TODO/handle edge cases" hand-waves.
- **Type/name consistency:** `sanitize(name, i, prefix)`, `resolveFontUrl(entry, probe)`, `writeSf2(font)`, `prunePresets(font, keepNameSet)`, `scanUsedNames(text, prefix, allow)`, `gatherContent(dirs)`, `cullFont(entry, usedNames)`, `SOUNDFONTS` — used consistently across tasks.
