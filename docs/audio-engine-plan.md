# Audio Engine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 reactive music engine for Starnet — a two-axis (progress + threat) layered Corporate score driven by live game state, with a standalone tuning harness.

**Architecture:** A new `js/audio/` subsystem. Pure, unit-tested logic (`signals.js` derives the two axis scalars from game state; `mixer.js` maps `(progress, threat)` + score data → per-layer gains and master-filter values). A Tone.js wrapper (`engine.js`) owns all Web Audio objects. An event-bus subscriber (`audio-renderer.js`, browser-only) wires game events → axis scalars → engine. Tone is vendored to `dist/tone.js`. A `preview/audio.html` harness drives the engine directly for tuning.

**Tech Stack:** Vanilla ES modules, Tone.js (vendored via esbuild), `node:test` for unit tests, JSDoc `@ts-check`.

**Reference:** `docs/audio-direction.md` (the approved design + guiding principle: *progression = reward via unfolding; threat = warning via urgency*).

---

## File Structure

| File | Responsibility | Type-checked? |
|---|---|---|
| `js/tone-vendor.js` | esbuild entry: re-export Tone | no (excluded, like `lit-vendor.js`) |
| `js/audio/signals.js` | pure: game state → `{progress, threat}` scalars | yes (`@ts-check`) |
| `js/audio/mixer.js` | pure: `(score, progress, threat)` → `{gains, masterCutoff, masterQ}` | yes |
| `js/audio/scores/corporate.js` | pure data: layer defs, patterns, synth configs, flavors | yes |
| `js/audio/engine.js` | Tone wrapper: synths, Transport, gains, master filter | no (`@ts-nocheck`, imports untyped Tone) |
| `js/audio/audio-renderer.js` | event-bus subscriber; gesture gating; drives engine | yes |
| `js/audio/playground.js` | tuning harness logic | no (`@ts-nocheck`) |
| `preview/audio.html` | tuning harness page | n/a |
| `tests/audio-signals.test.js` | unit tests for `signals.js` | n/a |
| `tests/audio-mixer.test.js` | unit tests for `mixer.js` | n/a |
| `tests/audio-score.test.js` | structural validation of `corporate.js` | n/a |

Canonical layer keys (used identically across score, mixer, engine):
`"drone"`, `"basePerc"`, `"doublePerc"`, `"bass"`, `"lead"`, `"backup"`, `"progArp"`, `"tensionDrone"`, `"urgencyArp"`.
(`progArp` — a celebratory progress-driven arp — was added during the by-ear tuning pass, as
were the section-breakdown automation and the hub ambient; this plan captures the original v1
scope. See `docs/audio-direction.md` for the shipped system.)

---

## Task 1: Vendor Tone.js → `dist/tone.js`

**Files:**
- Modify: `package.json` (add `tone` dependency)
- Create: `js/tone-vendor.js`
- Modify: `Makefile` (bundle target + lint exclude)

- [ ] **Step 1: Install Tone**

Run: `npm install --save tone@^15`
Expected: `tone` appears under `dependencies` in `package.json`, present in `node_modules/tone`.

- [ ] **Step 2: Create the vendor entry**

Create `js/tone-vendor.js`:

```js
// Tone.js vendor bundle entry point.
// Bundled with esbuild into dist/tone.js (ESM).
// Audio modules import from "/dist/tone.js" as: import * as Tone from "/dist/tone.js";
export * from "tone";
```

- [ ] **Step 3: Add the esbuild bundle to the Makefile**

In `Makefile`, find the `bundle-vendor:` target and add a third esbuild line:

```make
bundle-vendor:
	npx esbuild js/vendor.js --bundle --outfile=dist/vendor.js --format=iife --platform=browser --minify
	npx esbuild js/lit-vendor.js --bundle --outfile=dist/lit.js --format=esm --platform=browser --minify
	npx esbuild js/tone-vendor.js --bundle --outfile=dist/tone.js --format=esm --platform=browser --minify
```

Also add the same `dist/tone.js` line to the `all:` target's `dist/lit.js` rule block by adding a new rule after the `dist/lit.js` rule:

```make
dist/tone.js: js/tone-vendor.js node_modules
	npx esbuild js/tone-vendor.js --bundle --outfile=dist/tone.js --format=esm --platform=browser --minify
```

And add `dist/tone.js` to the `all:` prerequisites:

```make
all: node_modules dist/vendor.js dist/lit.js dist/tone.js
```

- [ ] **Step 4: Exclude the vendor entry from lint**

In `Makefile`, in the `lint:` target's `find` command, add `! -name 'tone-vendor.js'` alongside the existing `! -name 'lit-vendor.js'`:

```make
		$(shell find js -name '*.js' ! -name '*.test.js' ! -path '*/fixtures/*' ! -name 'graph.js' ! -name 'vendor.js' ! -name 'lit-vendor.js' ! -name 'tone-vendor.js')
```

- [ ] **Step 5: Build and verify the bundle exists**

Run: `make bundle-vendor && ls -la dist/tone.js`
Expected: `dist/tone.js` exists, non-trivial size (hundreds of KB).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json js/tone-vendor.js Makefile
git commit -m 'Vendor Tone.js to dist/tone.js'
```

---

## Task 2: Pure axis-signal derivation (`signals.js`)

Derives the two scalars from game state. No Tone, no DOM, no smoothing (smoothing lives in the engine).

**Files:**
- Create: `js/audio/signals.js`
- Test: `tests/audio-signals.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/audio-signals.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveProgress, deriveThreat } from "../js/audio/signals.js";

function nodes(spec) {
  // spec: array of accessLevel strings
  const out = {};
  spec.forEach((accessLevel, i) => { out["n" + i] = { accessLevel, visibility: "revealed" }; });
  return out;
}

test("deriveProgress is 0 when nothing is owned", () => {
  const state = { nodes: nodes(["locked", "locked", "open"]) };
  assert.equal(deriveProgress(state), 0);
});

test("deriveProgress is ownedCount/total", () => {
  const state = { nodes: nodes(["owned", "owned", "locked", "locked"]) };
  assert.equal(deriveProgress(state), 0.5);
});

test("deriveProgress returns 0 for empty/missing nodes", () => {
  assert.equal(deriveProgress({ nodes: {} }), 0);
  assert.equal(deriveProgress({}), 0);
});

test("deriveThreat maps alert levels to the ladder", () => {
  assert.equal(deriveThreat({ globalAlert: "green" }), 0);
  assert.equal(deriveThreat({ globalAlert: "yellow" }), 1 / 3);
  assert.equal(deriveThreat({ globalAlert: "red" }), 2 / 3);
  assert.equal(deriveThreat({ globalAlert: "trace" }), 1);
});

test("deriveThreat adds an injury term as health drops", () => {
  const hurt = { globalAlert: "green", player: { health: { current: 0, max: 100 }, deckIntegrity: { current: 100, max: 100 } } };
  // green=0 base, full injury on health contributes up to 0.25
  assert.ok(deriveThreat(hurt) > 0);
  assert.ok(deriveThreat(hurt) <= 1);
});

test("deriveThreat never exceeds 1", () => {
  const maxed = { globalAlert: "trace", player: { health: { current: 0, max: 100 }, deckIntegrity: { current: 0, max: 100 } } };
  assert.equal(deriveThreat(maxed), 1);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test tests/audio-signals.test.js`
Expected: FAIL — `Cannot find module '../js/audio/signals.js'`.

- [ ] **Step 3: Implement `signals.js`**

Create `js/audio/signals.js`:

```js
// @ts-check
// Pure derivation of the two music axes from game state. No Tone, no DOM, no smoothing.

/** Clamp x into [0,1]. @param {number} x @returns {number} */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Alert ladder → 0..1. */
const ALERT_LEVEL = { green: 0, yellow: 1 / 3, red: 2 / 3, trace: 1 };

/**
 * PROGRESS axis: how much of the LAN the player owns, 0..1.
 * @param {any} state
 * @returns {number}
 */
export function deriveProgress(state) {
  const nodes = state?.nodes;
  if (!nodes) return 0;
  const all = Object.values(nodes);
  if (all.length === 0) return 0;
  const owned = all.filter((n) => /** @type {any} */ (n).accessLevel === "owned").length;
  return clamp01(owned / all.length);
}

/**
 * THREAT axis: alert ladder blended with an injury term, 0..1.
 * @param {any} state
 * @returns {number}
 */
export function deriveThreat(state) {
  const alert = ALERT_LEVEL[state?.globalAlert] ?? 0;
  const p = state?.player;
  let injury = 0;
  if (p?.health?.max) injury += 0.25 * (1 - clamp01(p.health.current / p.health.max));
  if (p?.deckIntegrity?.max) injury += 0.25 * (1 - clamp01(p.deckIntegrity.current / p.deckIntegrity.max));
  return clamp01(alert + injury);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test tests/audio-signals.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add js/audio/signals.js tests/audio-signals.test.js
git commit -m 'Add pure audio axis-signal derivation (signals.js)'
```

---

## Task 3: Pure mixer (`mixer.js`)

Maps a score's layer axis-specs + the two scalars → per-layer gains + master-filter values.

**Files:**
- Create: `js/audio/mixer.js`
- Test: `tests/audio-mixer.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/audio-mixer.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMix, smoothstep } from "../js/audio/mixer.js";

const SCORE = {
  layers: [
    { key: "drone", axis: "base", baseGain: 0.6, progressBoost: 0.2 },
    { key: "bass", axis: "progress", lo: 0.2, hi: 0.5 },
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0 },
  ],
  masterFilter: { cutoffLo: 600, cutoffHi: 8600, qLo: 0.7, qHi: 4.7 },
};

test("smoothstep clamps and is monotone", () => {
  assert.equal(smoothstep(0.2, 0.5, 0.1), 0);
  assert.equal(smoothstep(0.2, 0.5, 0.6), 1);
  assert.ok(smoothstep(0.2, 0.5, 0.35) > 0 && smoothstep(0.2, 0.5, 0.35) < 1);
});

test("base layer gain = baseGain + progressBoost*progress", () => {
  assert.equal(computeMix(SCORE, 0, 0).gains.drone, 0.6);
  assert.ok(Math.abs(computeMix(SCORE, 1, 0).gains.drone - 0.8) < 1e-9);
});

test("progress layer fades across its lo..hi range", () => {
  assert.equal(computeMix(SCORE, 0.1, 0).gains.bass, 0);
  assert.equal(computeMix(SCORE, 0.6, 0).gains.bass, 1);
});

test("threat layer is driven by threat only", () => {
  assert.equal(computeMix(SCORE, 1, 0).gains.tensionDrone, 0);
  assert.equal(computeMix(SCORE, 0, 1).gains.tensionDrone, 1);
});

test("master filter lerps cutoff and Q with threat", () => {
  const m0 = computeMix(SCORE, 0, 0);
  assert.equal(m0.masterCutoff, 600);
  assert.equal(m0.masterQ, 0.7);
  const m1 = computeMix(SCORE, 0, 1);
  assert.equal(m1.masterCutoff, 8600);
  assert.ok(Math.abs(m1.masterQ - 4.7) < 1e-9);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test tests/audio-mixer.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `mixer.js`**

Create `js/audio/mixer.js`:

```js
// @ts-check
// Pure mixing logic: score + (progress, threat) → per-layer gains + master filter.

/** Clamp x into [0,1]. @param {number} x */
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Linear interpolate. @param {number} a @param {number} b @param {number} t */
const lerp = (a, b, t) => a + (b - a) * clamp01(t);

/**
 * Smooth Hermite ramp from 0 at `lo` to 1 at `hi`.
 * @param {number} lo @param {number} hi @param {number} x @returns {number}
 */
export function smoothstep(lo, hi, x) {
  if (hi <= lo) return x >= hi ? 1 : 0;
  const t = clamp01((x - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
}

/**
 * @typedef {Object} LayerSpec
 * @property {string} key
 * @property {"base"|"progress"|"threat"} axis
 * @property {number} [baseGain]
 * @property {number} [progressBoost]
 * @property {number} [lo]
 * @property {number} [hi]
 */

/**
 * @param {{layers: LayerSpec[], masterFilter: {cutoffLo:number,cutoffHi:number,qLo:number,qHi:number}}} score
 * @param {number} progress 0..1
 * @param {number} threat 0..1
 * @returns {{gains: Record<string, number>, masterCutoff: number, masterQ: number}}
 */
export function computeMix(score, progress, threat) {
  /** @type {Record<string, number>} */
  const gains = {};
  for (const layer of score.layers) {
    if (layer.axis === "base") {
      gains[layer.key] = clamp01((layer.baseGain ?? 0) + (layer.progressBoost ?? 0) * progress);
    } else {
      const axisVal = layer.axis === "threat" ? threat : progress;
      gains[layer.key] = smoothstep(layer.lo ?? 0, layer.hi ?? 1, axisVal);
    }
  }
  const mf = score.masterFilter;
  return {
    gains,
    masterCutoff: lerp(mf.cutoffLo, mf.cutoffHi, threat),
    masterQ: lerp(mf.qLo, mf.qHi, threat),
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test tests/audio-mixer.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add js/audio/mixer.js tests/audio-mixer.test.js
git commit -m 'Add pure audio mixer (mixer.js)'
```

---

## Task 4: Corporate score data (`scores/corporate.js`)

Pure data: tempo, the 8 layers (axis-spec + pattern + synth config), master-filter range, and flavors. Patterns lean static/modal A-minor with a Phrygian ♭2 turn (per the calibration note — avoids the "anthemic pop" trap). `null` = rest. Pitched patterns are 8th-note grids of 32 steps (4 bars); `urgencyArp` is a 16th grid of 64 steps. Sustained layers (`drone`, `tensionDrone`) carry `sustain: [...]` chords instead of a step pattern.

**Files:**
- Create: `js/audio/scores/corporate.js`
- Test: `tests/audio-score.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/audio-score.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { CORPORATE_SCORE, LAYER_KEYS } from "../js/audio/scores/corporate.js";
import { computeMix } from "../js/audio/mixer.js";

test("score defines exactly the canonical layer keys", () => {
  const keys = CORPORATE_SCORE.layers.map((l) => l.key).sort();
  assert.deepEqual(keys, [...LAYER_KEYS].sort());
});

test("every layer has a valid axis and a sound source", () => {
  for (const l of CORPORATE_SCORE.layers) {
    assert.ok(["base", "progress", "threat"].includes(l.axis), `bad axis for ${l.key}`);
    assert.ok(l.synth, `missing synth config for ${l.key}`);
    assert.ok(Array.isArray(l.pattern) || Array.isArray(l.sustain), `${l.key} needs pattern or sustain`);
  }
});

test("8th-grid patterns are 32 steps; urgencyArp is 64", () => {
  const byKey = Object.fromEntries(CORPORATE_SCORE.layers.map((l) => [l.key, l]));
  for (const k of ["basePerc", "doublePerc", "bass", "lead", "backup"]) {
    assert.equal(byKey[k].pattern.length, 32, `${k} wrong length`);
  }
  assert.equal(byKey.urgencyArp.pattern.length, 64);
});

test("computeMix accepts the real score and covers every layer", () => {
  const mix = computeMix(CORPORATE_SCORE, 0.5, 0.5);
  for (const k of LAYER_KEYS) assert.ok(k in mix.gains, `missing gain for ${k}`);
});

test("at least one flavor exists", () => {
  assert.ok(CORPORATE_SCORE.flavors.length >= 1);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test tests/audio-score.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scores/corporate.js`**

Create `js/audio/scores/corporate.js`:

```js
// @ts-check
// Corporate biome score — authored patterns-as-data. null = rest.
// Static/modal A-minor with a Phrygian ♭2 (Bb) turn for menace. See docs/audio-direction.md.

export const LAYER_KEYS = Object.freeze([
  "drone", "basePerc", "doublePerc", "bass", "lead", "backup", "tensionDrone", "urgencyArp",
]);

// 8th-note grid, 8 steps/bar, 4 bars = 32 steps.
const K = null; // rest alias for readability
const KICK = "C1", HAT = "hat", SNARE = "snare"; // perc tokens (engine maps to drum voices)

const basePerc = [
  KICK, K, K, K, HAT, K, K, K,   // bar 1
  KICK, K, K, K, HAT, K, K, K,   // bar 2
  KICK, K, K, K, HAT, K, K, K,   // bar 3
  KICK, K, K, K, HAT, K, K, K,   // bar 4
];
const doublePerc = [
  K, HAT, SNARE, HAT, K, HAT, SNARE, HAT,
  K, HAT, SNARE, HAT, K, HAT, SNARE, HAT,
  K, HAT, SNARE, HAT, K, HAT, SNARE, HAT,
  K, HAT, SNARE, HAT, K, HAT, SNARE, HAT,
];
// Mostly an A pedal (static dread); bar 4 leans to Bb (Phrygian ♭2).
const bass = [
  "A1", K, K, "A1", K, "A1", K, K,
  "A1", K, K, "A1", K, "A1", K, K,
  "A1", K, K, "A1", K, "A1", K, K,
  "Bb1", K, K, "Bb1", K, "A1", K, K,
];
// Sparse modal lead (A Aeolian / pentatonic), leaving space.
const lead = [
  "E4", K, K, "A4", K, K, "C5", K,
  K, "B4", K, "A4", K, K, K, K,
  "E4", K, "G4", K, "A4", K, K, K,
  "Bb4", K, "A4", K, "E4", K, K, K,
];
// Triad stabs: Am held three bars, Bb (♭2) on bar 4. Chords as arrays.
const backup = [
  ["A3","C4","E4"], K, K, K, ["A3","C4","E4"], K, K, K,
  ["A3","C4","E4"], K, K, K, ["A3","C4","E4"], K, K, K,
  ["A3","C4","E4"], K, K, K, ["A3","C4","E4"], K, K, K,
  ["Bb3","D4","F4"], K, K, K, ["Bb3","D4","F4"], K, K, K,
];
// 16th-note grid, 16 steps/bar, 4 bars = 64. Driving Am arp with ♭2 menace.
const urgencyArp = [
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","A4","C5","E5","Bb5",
  "A4","C5","E5","A5","E5","C5","A4","C5","E5","A5","E5","C5","Bb4","Bb5","A5","E5",
];

export const CORPORATE_SCORE = Object.freeze({
  biome: "corporate",
  bpm: 96,
  masterFilter: { cutoffLo: 600, cutoffHi: 8600, qLo: 0.7, qHi: 4.7 },
  layers: [
    // base
    { key: "drone", axis: "base", baseGain: 0.55, progressBoost: 0.2,
      sustain: ["A2", "E3"], synth: { type: "fatsawtooth", count: 3, spread: 18, attack: 2, release: 3, volume: -16 } },
    // progress (blossom)
    { key: "basePerc", axis: "progress", lo: 0.0, hi: 0.05, pattern: basePerc,
      synth: { kind: "drums", volume: -6 } },
    { key: "doublePerc", axis: "progress", lo: 0.3, hi: 0.7, pattern: doublePerc,
      synth: { kind: "drums", volume: -10 } },
    { key: "bass", axis: "progress", lo: 0.2, hi: 0.5, pattern: bass,
      synth: { type: "square", attack: 0.01, decay: 0.25, sustain: 0.3, release: 0.2, volume: -8 } },
    { key: "lead", axis: "progress", lo: 0.55, hi: 0.85, pattern: lead,
      synth: { type: "sawtooth", attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2, volume: -12 } },
    { key: "backup", axis: "progress", lo: 0.6, hi: 0.9, pattern: backup,
      synth: { kind: "poly", type: "triangle", attack: 0.02, decay: 0.4, sustain: 0.0, release: 0.3, volume: -18 } },
    // threat (alarm)
    { key: "tensionDrone", axis: "threat", lo: 0.0, hi: 1.0,
      sustain: ["A2", "Bb2"], synth: { type: "fatsawtooth", count: 3, spread: 30, attack: 0.8, release: 1.5, volume: -14 } },
    { key: "urgencyArp", axis: "threat", lo: 0.55, hi: 1.0, grid: "16n", pattern: urgencyArp,
      synth: { type: "sawtooth", attack: 0.005, decay: 0.12, sustain: 0.0, release: 0.08, volume: -16 } },
  ],
  flavors: [
    { id: "default", processing: null },
    // aged-media flavor deferred; placeholder id kept minimal for v1 (single flavor).
  ],
});
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test tests/audio-score.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add js/audio/scores/corporate.js tests/audio-score.test.js
git commit -m 'Add Corporate score data (8 layers, static modal A-minor)'
```

---

## Task 5: Tone engine wrapper (`engine.js`)

Owns all Web Audio. Builds synths from a score, runs all patterns on the Transport in sync, and on `setProgress/setThreat` recomputes the mix and `rampTo`s each layer gain + master filter. Threat ramps are asymmetric (fast up, slow down). Verified via the playground (Task 7), not unit tests — it needs a real AudioContext.

**Files:**
- Create: `js/audio/engine.js`

- [ ] **Step 1: Implement `engine.js`**

Create `js/audio/engine.js`:

```js
// @ts-nocheck
// Tone.js wrapper. The only module that touches Web Audio. Imports the vendored bundle.
import * as Tone from "/dist/tone.js";
import { computeMix } from "./mixer.js";

const GRID = "8n";          // default step grid
const RAMP_UP = 0.3;        // threat fast attack (s)
const RAMP_DOWN = 1.5;      // threat slow release (s)
const RAMP_PROGRESS = 1.0;  // progress crossfade (s)

export function createAudioEngine() {
  let started = false;
  let score = null;
  let progress = 0, threat = 0;
  let master, masterFilter, reverb;
  const layers = {};        // key → { gain, voice, seq, sustainSynth }
  const muted = {};         // key → bool (playground only)

  function buildMasterBus() {
    master = new Tone.Gain(0.9).toDestination();
    reverb = new Tone.Reverb({ decay: 2.4, wet: 0.16 }).connect(master);
    masterFilter = new Tone.Filter({ frequency: 8000, type: "lowpass", Q: 0.7 }).connect(reverb);
  }

  function drumVoices() {
    const kick = new Tone.MembraneSynth({ octaves: 6, envelope: { attack: 0.001, decay: 0.25, sustain: 0 } });
    const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } });
    const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } });
    snare.volume.value = -8; hat.volume.value = -20;
    return { kick, snare, hat };
  }

  function buildLayer(spec) {
    const gain = new Tone.Gain(0).connect(masterFilter);
    const grid = spec.grid || GRID;

    if (spec.sustain) {
      // continuously sustained chord, gain-controlled
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: spec.synth.type || "fatsawtooth", count: spec.synth.count, spread: spec.synth.spread },
        envelope: { attack: spec.synth.attack ?? 1, decay: 0.3, sustain: 1, release: spec.synth.release ?? 2 },
      }).connect(gain);
      if (spec.synth.volume != null) s.volume.value = spec.synth.volume;
      layers[spec.key] = { gain, sustainSynth: s, sustain: spec.sustain };
      return;
    }

    if (spec.synth.kind === "drums") {
      const voices = drumVoices();
      Object.values(voices).forEach((v) => v.connect(gain));
      if (spec.synth.volume != null) gain.gain.value = 0; // gain set by mix
      const seq = new Tone.Sequence((time, tok) => {
        if (!tok) return;
        if (tok === "snare") voices.snare.triggerAttackRelease("16n", time);
        else if (tok === "hat") voices.hat.triggerAttackRelease("32n", time);
        else voices.kick.triggerAttackRelease("C1", "8n", time);
      }, spec.pattern, grid);
      seq.start(0);
      layers[spec.key] = { gain, voices, seq };
      return;
    }

    if (spec.synth.kind === "poly") {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: spec.synth.type || "triangle" },
        envelope: { attack: spec.synth.attack, decay: spec.synth.decay, sustain: spec.synth.sustain, release: spec.synth.release },
      }).connect(gain);
      if (spec.synth.volume != null) s.volume.value = spec.synth.volume;
      const seq = new Tone.Sequence((time, note) => {
        if (note) s.triggerAttackRelease(note, grid, time);
      }, spec.pattern, grid);
      seq.start(0);
      layers[spec.key] = { gain, voice: s, seq };
      return;
    }

    // mono-ish synth (poly under the hood for safety on fast arps)
    const s = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: spec.synth.type || "sawtooth" },
      envelope: { attack: spec.synth.attack, decay: spec.synth.decay, sustain: spec.synth.sustain, release: spec.synth.release },
    }).connect(gain);
    if (spec.synth.volume != null) s.volume.value = spec.synth.volume;
    const seq = new Tone.Sequence((time, note) => {
      if (note) s.triggerAttackRelease(note, grid, time);
    }, spec.pattern, grid);
    seq.start(0);
    layers[spec.key] = { gain, voice: s, seq };
  }

  function applyMix(immediate) {
    if (!score) return;
    const mix = computeMix(score, progress, threat);
    for (const [key, layer] of Object.entries(layers)) {
      const target = muted[key] ? 0 : (mix.gains[key] ?? 0);
      const ramp = immediate ? 0.01 : RAMP_PROGRESS;
      layer.gain.gain.rampTo(target, ramp);
    }
    const tRamp = immediate ? 0.01 : (threat >= (applyMix._lastThreat ?? 0) ? RAMP_UP : RAMP_DOWN);
    masterFilter.frequency.rampTo(mix.masterCutoff, tRamp);
    masterFilter.Q.rampTo(mix.masterQ, tRamp);
    applyMix._lastThreat = threat;
  }

  return {
    /** @param {object} s score object */
    setScore(s) { score = s; },

    async start() {
      if (started) return;
      await Tone.start();
      buildMasterBus();
      Tone.Transport.bpm.value = score?.bpm ?? 100;
      for (const spec of score.layers) buildLayer(spec);
      // kick off sustained layers
      for (const layer of Object.values(layers)) {
        if (layer.sustainSynth) layer.sustainSynth.triggerAttack(layer.sustain);
      }
      applyMix(true);
      Tone.Transport.start();
      started = true;
    },

    stop() {
      if (!started) return;
      Tone.Transport.stop();
      for (const layer of Object.values(layers)) {
        if (layer.sustainSynth) layer.sustainSynth.releaseAll?.();
        layer.seq?.dispose?.();
      }
      started = false;
    },

    setProgress(x) { progress = Math.max(0, Math.min(1, x)); if (started) applyMix(false); },
    setThreat(x) { threat = Math.max(0, Math.min(1, x)); if (started) applyMix(false); },

    // playground-only
    setMuted(key, isMuted) { muted[key] = isMuted; if (started) applyMix(false); },
    isStarted() { return started; },

    // exposed for deferred SFX / vocal one-shots (constraint from the spec)
    getMasterInput() { return masterFilter; },
  };
}
```

- [ ] **Step 2: Lint (the @ts-nocheck file is skipped; ensure nothing else broke)**

Run: `make lint`
Expected: PASS (no new type errors; `engine.js` skipped via `@ts-nocheck`).

- [ ] **Step 3: Commit**

```bash
git add js/audio/engine.js
git commit -m 'Add Tone engine wrapper (engine.js)'
```

---

## Task 6: Event-bus subscriber (`audio-renderer.js`)

Browser-only. Lazily starts the engine on first user gesture, then maps `STATE_CHANGED` (+ run lifecycle) to the two axis scalars via `signals.js`.

**Files:**
- Create: `js/audio/audio-renderer.js`

- [ ] **Step 1: Implement `audio-renderer.js`**

Create `js/audio/audio-renderer.js`:

```js
// @ts-check
import { on, E } from "../core/events.js";
import { deriveProgress, deriveThreat } from "./signals.js";
import { computeFlavor } from "./scores/index.js";
import { createAudioEngine } from "./engine.js";

/**
 * Wire the audio engine to the event bus. Browser-only — do NOT import from
 * headless entry points (scripts/playtest.js, scripts/bot/cli.js).
 */
export function initAudioRenderer() {
  const engine = createAudioEngine();
  let armed = false;

  // AudioContext needs a user gesture. Arm on the first pointer/key event.
  function arm() {
    if (armed) return;
    armed = true;
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
    // engine.start() resolves the AudioContext; safe to call before a run exists.
    engine.setScore(computeFlavor("corporate"));
    engine.start();
  }
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);

  on(E.STATE_CHANGED, (state) => {
    if (!state) return;
    engine.setProgress(deriveProgress(state));
    engine.setThreat(deriveThreat(state));
  });

  on(E.RUN_STARTED, ({ state }) => {
    // (re)select the score for this run's biome; corporate is the only one today.
    const biome = state?.spec?.biome ?? state?.meta?.biome ?? "corporate";
    engine.setScore(computeFlavor(biome));
  });

  // expose for the playground / debugging
  return engine;
}
```

- [ ] **Step 2: Create the score selector `scores/index.js`**

Create `js/audio/scores/index.js`:

```js
// @ts-check
// Score registry + seeded flavor selection within a biome.
import { random, RNG } from "../../core/rng.js";
import { CORPORATE_SCORE } from "./corporate.js";

const SCORES = { corporate: CORPORATE_SCORE };

/**
 * Pick a score for a biome, choosing a flavor by seeded RNG (WORLD stream).
 * Falls back to corporate for unknown biomes.
 * @param {string} biome
 * @returns {object}
 */
export function computeFlavor(biome) {
  const score = SCORES[biome] ?? CORPORATE_SCORE;
  const flavors = score.flavors ?? [{ id: "default", processing: null }];
  const idx = Math.floor(random(RNG.WORLD) * flavors.length);
  return { ...score, activeFlavor: flavors[idx] ?? flavors[0] };
}
```

- [ ] **Step 3: Lint**

Run: `make lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add js/audio/audio-renderer.js js/audio/scores/index.js
git commit -m 'Add audio-renderer event subscriber + score selector'
```

---

## Task 7: Tuning harness (`preview/audio.html` + `playground.js`)

Standalone page that drives the engine directly: per-layer mutes + the two axis sliders. Leaves the root `preview.html` untouched.

**Files:**
- Create: `preview/audio.html`
- Create: `js/audio/playground.js`

- [ ] **Step 1: Implement `playground.js`**

Create `js/audio/playground.js`:

```js
// @ts-nocheck
import { createAudioEngine } from "./engine.js";
import { CORPORATE_SCORE, LAYER_KEYS } from "./scores/corporate.js";

const engine = createAudioEngine();
engine.setScore(CORPORATE_SCORE);

const status = document.getElementById("status");
document.getElementById("play").onclick = async () => {
  try { await engine.start(); status.textContent = "playing"; }
  catch (e) { status.textContent = "ERROR: " + e.message; console.error(e); }
};
document.getElementById("stop").onclick = () => { engine.stop(); status.textContent = "stopped"; };

const tracks = document.getElementById("tracks");
for (const key of LAYER_KEYS) {
  const el = document.createElement("span");
  el.className = "track on";
  el.innerHTML = `<span class="dot"></span>${key}`;
  el.onclick = () => { const on = el.classList.toggle("on"); engine.setMuted(key, !on); };
  tracks.appendChild(el);
}

const prog = document.getElementById("progress"), progVal = document.getElementById("progressVal");
prog.oninput = () => { const v = +prog.value / 100; progVal.textContent = v.toFixed(2); engine.setProgress(v); };
const threat = document.getElementById("threat"), threatVal = document.getElementById("threatVal");
threat.oninput = () => { const v = +threat.value / 100; threatVal.textContent = v.toFixed(2); engine.setThreat(v); };
```

- [ ] **Step 2: Implement `preview/audio.html`**

Create `preview/audio.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Starnet audio — tuning harness</title>
<style>
  :root { --bg:#0a0a0f; --cyan:#22d3ee; --green:#39ff88; --mag:#ff00aa; --dim:#1b2330; }
  body { background:var(--bg); color:var(--green); font-family:ui-monospace,monospace; margin:0; padding:2rem; }
  h1 { color:var(--cyan); font-size:1.1rem; text-shadow:0 0 8px rgba(34,211,238,.5); }
  .panel { border:1px solid var(--dim); border-radius:6px; padding:1.25rem; max-width:600px; }
  .row { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; margin:.6rem 0; }
  button { background:transparent; color:var(--cyan); border:1px solid var(--cyan); border-radius:4px; padding:.5rem 1rem; font:inherit; cursor:pointer; }
  button.stop { color:var(--mag); border-color:var(--mag); }
  .track { display:inline-flex; align-items:center; gap:.4rem; border:1px solid var(--dim); border-radius:4px; padding:.35rem .6rem; cursor:pointer; user-select:none; color:#8aa; font-size:.8rem; }
  .track.on { color:var(--green); border-color:var(--green); }
  .track .dot { width:8px; height:8px; border:1px solid currentColor; transform:rotate(45deg); }
  .track.on .dot { background:var(--green); }
  label.slider { display:flex; flex-direction:column; gap:.2rem; font-size:.75rem; color:#8aa; flex:1; min-width:200px; }
  input[type=range]{ width:100%; accent-color:var(--mag); }
  .val { color:#a78bfa; }
</style>
</head>
<body>
  <h1>STARNET // AUDIO TUNING HARNESS</h1>
  <div class="panel">
    <div class="row">
      <button id="play">▶ PLAY</button>
      <button id="stop" class="stop">■ STOP</button>
      <span id="status" style="color:#6b7a8d;font-size:.8rem">idle</span>
    </div>
    <div class="row" id="tracks"></div>
    <div class="row"><label class="slider">PROGRESS <span class="val" id="progressVal">0.00</span>
      <input type="range" id="progress" min="0" max="100" value="0" /></label></div>
    <div class="row"><label class="slider">THREAT <span class="val" id="threatVal">0.00</span>
      <input type="range" id="threat" min="0" max="100" value="0" /></label></div>
  </div>
  <script type="module" src="/js/audio/playground.js"></script>
</body>
</html>
```

- [ ] **Step 3: Build the bundle and smoke-test in a headless browser**

Run: `make bundle-vendor`
Then start a server and run a Playwright load check (confirms the bundle imports, the engine builds its graph, and no JS errors — cannot verify *sound*):

Create `/tmp/audio_pg_check.mjs`:

```js
import pkg from '/home/lmorchard/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pkg;
const b = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await b.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://localhost:3000/preview/audio.html');
await page.waitForLoadState('networkidle');
await page.click('#play');
await page.waitForTimeout(2500);
await page.$eval('#progress', el => { el.value = 70; el.dispatchEvent(new Event('input')); });
await page.$eval('#threat', el => { el.value = 80; el.dispatchEvent(new Event('input')); });
await page.click('text=lead');
await page.waitForTimeout(800);
console.log('status:', JSON.stringify(await page.textContent('#status')));
console.log('pageerrors:', errs.length ? errs : 'none');
await b.close();
```

Run (server already running via `make serve` in the worktree):
`node /tmp/audio_pg_check.mjs`
Expected: `status: "playing"`, `pageerrors: none`.

- [ ] **Step 4: Manual listen checkpoint (Les)**

Open `http://localhost:3000/preview/audio.html`, press PLAY, sweep PROGRESS (layers should *blossom* in) and THREAT (filter sweep + tension/arp should *alarm*). Mute/unmute layers. This is the real verification the headless test can't give.

- [ ] **Step 5: Commit**

```bash
git add preview/audio.html js/audio/playground.js
git commit -m 'Add audio tuning harness (preview/audio.html)'
```

---

## Task 8: Wire into the game + final checks

**Files:**
- Modify: `js/ui/main.js`

- [ ] **Step 1: Import and call the renderer in main.js**

In `js/ui/main.js`, add the import near the other renderer imports (after line 10, `import { initLogRenderer } from "./log-renderer.js";`):

```js
import { initAudioRenderer } from "../audio/audio-renderer.js";
```

Then in `init()`, add the call immediately after `initVisualRenderer();` (line 69):

```js
  initVisualRenderer();  // must subscribe before initGame fires STATE_CHANGED
  initAudioRenderer();   // browser-only audio; arms on first user gesture
```

- [ ] **Step 2: Confirm headless paths stay audio-free**

Run: `grep -rn "audio-renderer\|audio/engine\|/dist/tone" scripts/`
Expected: NO matches (audio must never load in playtest/bot/census).

- [ ] **Step 3: Full check**

Run: `make check`
Expected: lint PASS, all tests PASS (including the three new audio test files).

- [ ] **Step 4: In-game listen checkpoint (Les)**

Run `make serve`, open the game, start a run, click to arm audio. Confirm: music starts sparse; owning nodes layers it up; raising the alert / ICE detection brings urgency + filter sweep; calming eases it back.

- [ ] **Step 5: Update docs status**

In `docs/audio-direction.md`, change the status line to:
`> **Status: v1 shipped.** ...`
and note the playground at `preview/audio.html`.

- [ ] **Step 6: Commit**

```bash
git add js/ui/main.js docs/audio-direction.md
git commit -m 'Wire audio-renderer into the game (main.js)'
```

---

## Self-Review

- **Spec coverage:** engine + two axes (Tasks 2,3,5), Corporate score with all 8 layers (Task 4), `js/audio/` module layout incl. `audio-renderer.js` in `js/audio/` (Tasks 5,6), Tone vendored (Task 1), browser-only + gesture gating + headless-safety (Tasks 6,8), continuous-piece transitions + smooth ramps + asymmetric threat (Task 5), seeded flavor selection (Task 6), tuning harness at `preview/audio.html` (Task 7), master bus exposed for deferred SFX/vocal (`getMasterInput`, Task 5). Deferred items (SFX, vocal one-shots, aged-media, bar-quantize, other biomes, hybrid) are intentionally out of scope.
- **Type consistency:** layer keys are the same `LAYER_KEYS` list across `corporate.js`, `mixer.js` consumers, `engine.js`, and `playground.js`. `computeMix(score, progress, threat)` signature is identical in mixer tests, score test, and engine. `createAudioEngine()` API (`setScore/start/stop/setProgress/setThreat/setMuted/isStarted/getMasterInput`) is used consistently by `audio-renderer.js` and `playground.js`.
- **Placeholders:** none — all code is complete. The single-flavor `flavors` array is intentional for v1 (aged-media deferred).
