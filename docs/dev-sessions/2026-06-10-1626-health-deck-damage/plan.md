# Health + Deck Loss Clocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-built `health` / `deckIntegrity` pools real in play — ICE
effects fire on detection, two damaging presets (Sentinel/Spike) can spawn, and the
pools are visible in HUD, `status`, and the log.

**Architecture:** Wire a bounded slice of the ICE-reinvention §8 dispatcher at the
*detection trigger*: `triggerDetection()` resolves the detecting instance's type and
applies its `effects[]` via atoms, with a ctx that routes `raise-alert` to the existing
alert path and `damage-*` to the `player-orchestration` wrappers (which already end the
run on depletion). Alert-raise is one orthogonal effect type among three (alert / health
/ deck); damaging presets carry no `raise-alert`, so they attack their own clock.

**Tech Stack:** Vanilla ES modules, `node:test`, JSDoc `@ts-check`, Lit components.
Run tests with `make test`; lint with `make lint`; both with `make check`.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `js/core/ice/index.js` | ICE module public surface | **Modify** — side-effect import of `effects.js` + `triggers.js` so atoms register in the live app |
| `js/core/ice/registry.js` | ICE type catalog | **Modify** — add `sentinel` + `spike` presets and a pure `pickIceTypeId(grade, roll)` |
| `js/core/ice/runtime.js` | per-tick movement + detection | **Modify** — dispatch effects in `triggerDetection`; new `applyIceEffects()` |
| `js/core/state/index.js` | initial state + ICE spawn | **Modify** — typed spawn via `pickIceTypeId` |
| `js/ui/components/starnet-hud.js` | header bar | **Modify** — health/deck meters |
| `js/ui/visual-renderer.js` | state→component bridge | **Modify** — push health/deck props to HUD |
| `js/ui/components/starnet-end-screen.js` | game-over overlay | **Modify** — `burned`/`bricked` outcomes |
| `js/core/console-commands/cmd-status.js` | `status` text | **Modify** — HEALTH/DECK lines |
| `css/style.css` | styles | **Modify** — meter styles |
| `scripts/playtest.js` | headless harness | **Modify** — log `ICE_EFFECT_APPLIED` |
| `MANUAL.md` | canonical behavior | **Modify** — document the new mechanic |
| `js/core/ice/registry.test.js` | (new) | **Create** — preset + picker tests |
| `js/core/ice/dispatch.test.js` | (new) | **Create** — detection→effect integration tests |

---

## Task 1: Register ICE atoms in the live path

The atom bodies live in `ice/effects.js` / `ice/triggers.js`, which are imported **only**
by `atoms.test.js`. In the running app `EFFECT_ATOMS` is empty, so dispatch would always
hit the fallback. Importing them from `ice/index.js` (the public surface) fixes this for
every live consumer.

**Files:**
- Modify: `js/core/ice/index.js`
- Test: `js/core/ice/index.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `js/core/ice/index.test.js`:

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Importing the public surface MUST register the atom bodies as a side effect.
import { getEffect, getTrigger, getType } from "./index.js";

describe("ice/index registers atoms + types on import", () => {
  it("damage-health / damage-deck / raise-alert atoms are live", () => {
    assert.ok(getEffect("damage-health"), "damage-health must be registered");
    assert.ok(getEffect("damage-deck"), "damage-deck must be registered");
    assert.ok(getEffect("raise-alert"), "raise-alert must be registered");
  });

  it("on-dwell-grade trigger is live", () => {
    assert.ok(getTrigger("on-dwell-grade"));
  });

  it("classic presets are registered", () => {
    assert.ok(getType("patrol-classic-B"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/core/ice/index.test.js`
Expected: FAIL — `getEffect("damage-health")` is `null` (atoms never imported).

- [ ] **Step 3: Add side-effect imports to `ice/index.js`**

At the top of `js/core/ice/index.js`, immediately under the header comment, add:

```js
// Register atom bodies + trigger bodies as a side effect of loading the ICE
// module. Without these imports EFFECT_ATOMS / TRIGGER_ATOMS are empty in the
// live app (only the test suite imported them before).
import "./effects.js";
import "./triggers.js";
```

(Leave the existing `export { ... } from "./atoms.js"` / `"./registry.js"` re-exports as-is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/core/ice/index.test.js`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add js/core/ice/index.js js/core/ice/index.test.js
git commit -m 'feat(ice): register effect/trigger atoms in the live ICE module'
```

---

## Task 2: Sentinel + Spike presets and a type picker

**Files:**
- Modify: `js/core/ice/registry.js`
- Test: `js/core/ice/registry.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `js/core/ice/registry.test.js`:

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getType, pickIceTypeId } from "./registry.js";

describe("damaging presets", () => {
  it("sentinel carries a damage-health effect and no raise-alert", () => {
    const t = getType("sentinel");
    assert.ok(t);
    const atoms = t.effects.map((e) => e.atom);
    assert.ok(atoms.includes("damage-health"));
    assert.ok(!atoms.includes("raise-alert"));
    const dmg = t.effects.find((e) => e.atom === "damage-health");
    assert.equal(dmg.params.amount, 20);
  });

  it("spike carries a damage-deck effect and no raise-alert", () => {
    const t = getType("spike");
    assert.ok(t);
    const atoms = t.effects.map((e) => e.atom);
    assert.ok(atoms.includes("damage-deck"));
    assert.ok(!atoms.includes("raise-alert"));
    assert.equal(t.effects.find((e) => e.atom === "damage-deck").params.amount, 20);
  });
});

describe("pickIceTypeId", () => {
  it("below B: always classic, regardless of roll", () => {
    assert.equal(pickIceTypeId("C", 0.0), "patrol-classic-C");
    assert.equal(pickIceTypeId("D", 0.99), "patrol-classic-D");
    assert.equal(pickIceTypeId("F", 0.6), "patrol-classic-F");
  });

  it("B+: roll partitions classic / sentinel / spike", () => {
    assert.equal(pickIceTypeId("B", 0.10), "patrol-classic-B"); // < 0.5 → classic
    assert.equal(pickIceTypeId("A", 0.60), "sentinel");          // [0.5, 0.75) → sentinel
    assert.equal(pickIceTypeId("S", 0.90), "spike");             // >= 0.75 → spike
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/core/ice/registry.test.js`
Expected: FAIL — `getType("sentinel")` is `null`, `pickIceTypeId` is not exported.

- [ ] **Step 3: Add presets + picker to `registry.js`**

Append to `js/core/ice/registry.js` (after the `for (const grade ...)` classic loop):

```js
// Session: health-deck-damage. Damaging presets — grade-agnostic (instance
// grade is set at spawn). Alert-raise is intentionally NOT bundled: these ICE
// attack the health / deck clocks, not the trace clock.
registerType({
  typeId: "sentinel",
  focus: "roaming",
  behaviorPattern: "disturbance-tracker",
  triggers: ["on-dwell-grade"],
  effects: [{ atom: "damage-health", params: { amount: 20 } }],
});

registerType({
  typeId: "spike",
  focus: "roaming",
  behaviorPattern: "disturbance-tracker",
  triggers: ["on-dwell-grade"],
  effects: [{ atom: "damage-deck", params: { amount: 20 } }],
});

const GRADE_NUM = { F: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };

/**
 * Pick the ICE type id for a spawned instance. Damaging presets only appear at
 * threat B+; below that the network's single ICE stays classic (alert-only).
 * Pure: `roll` is a float in [0, 1) supplied by the caller's seeded stream.
 * (Biome-biasing is a deferred tuning seam — grade gating only for the MVP.)
 * @param {string} grade
 * @param {number} roll
 * @returns {string}
 */
export function pickIceTypeId(grade, roll) {
  if ((GRADE_NUM[grade] ?? 1) < 4) return `patrol-classic-${grade}`;
  if (roll < 0.5) return `patrol-classic-${grade}`;
  if (roll < 0.75) return "sentinel";
  return "spike";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/core/ice/registry.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/ice/registry.js js/core/ice/registry.test.js
git commit -m 'feat(ice): sentinel + spike damaging presets and pickIceTypeId'
```

---

## Task 3: Wire effect dispatch at the detection trigger

`triggerDetection()` currently calls `recordIceDetection()` directly. Replace that with:
always set the detection lock, then apply the instance type's `effects[]`. `raise-alert`
routes back to `recordIceDetection` (so classic ICE step alert / start trace exactly as
today); `damage-*` route to the orchestration wrappers; each damage application logs and
emits `ICE_EFFECT_APPLIED`.

**Files:**
- Modify: `js/core/ice/runtime.js`
- Test: `js/core/ice/dispatch.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `js/core/ice/dispatch.test.js`:

```js
// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// corporate-exchange spawns an ICE instance (meta.ice grade "B").
import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js";
import { initGame, getState } from "../state.js";
import { setSelectedNode } from "../state/game.js";
import { clearAll } from "../timers.js";
import { on, off, E } from "../events.js";
import { handleIceDetect } from "./runtime.js";

function withEvents(type, fn) {
  const captured = [];
  const h = (p) => captured.push(p);
  on(type, h);
  fn();
  off(type, h);
  return captured;
}

beforeEach(() => {
  clearAll();
  // initGame(buildNetworkFn, seedString, opts). meta.ice comes from the builder.
  initGame(() => buildCorporateExchange(), "dispatch-test");
});

// Helper: force the single spawned ICE instance to a given type, co-located with
// the player. (Overriding typeId directly bypasses the spawn roll — this test is
// about dispatch, independent of Task 4. State mutation here is test setup only.)
function placeIce(typeId) {
  const s = getState();
  const ice = Object.values(s.ice.instances)[0];
  ice.typeId = typeId;
  const node = ice.attentionNodeId;
  setSelectedNode(node);
  return { ice, node };
}

describe("detection effect dispatch", () => {
  it("sentinel detection reduces health and emits ICE_EFFECT_APPLIED", () => {
    const { node } = placeIce("sentinel");
    const before = getState().player.health.current;
    const applied = withEvents(E.ICE_EFFECT_APPLIED, () => handleIceDetect({ nodeId: node }));
    assert.equal(getState().player.health.current, before - 20);
    assert.ok(applied.some((p) => p.effect === "damage-health"));
  });

  it("spike detection reduces deck integrity", () => {
    const { node } = placeIce("spike");
    const before = getState().player.deckIntegrity.current;
    handleIceDetect({ nodeId: node });
    assert.equal(getState().player.deckIntegrity.current, before - 20);
  });

  it("sentinel detection does NOT step the global alert (no raise-alert)", () => {
    const { node } = placeIce("sentinel");
    const alertBefore = getState().globalAlert;
    handleIceDetect({ nodeId: node });
    assert.equal(getState().globalAlert, alertBefore);
  });

  it("classic detection still raises the global alert (regression)", () => {
    const { node } = placeIce("patrol-classic-B");
    const raised = withEvents(E.ALERT_GLOBAL_RAISED, () => handleIceDetect({ nodeId: node }));
    assert.ok(raised.length >= 1, "classic ICE must still step alert");
    assert.equal(getState().player.health.current, 100, "classic ICE deals no damage");
  });

  it("damage emits a LOG_ENTRY readout", () => {
    const { node } = placeIce("sentinel");
    const logged = withEvents(E.LOG_ENTRY, () => handleIceDetect({ nodeId: node }));
    assert.ok(logged.some((p) => /HEALTH/.test(p.text)));
  });
});
```

> Verified: `setSelectedNode` is exported from `js/core/state/game.js`; `initGame` is
> `(buildNetworkFn, seedString, opts)`; `corporate-exchange` yields `meta.ice` at grade B.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/core/ice/dispatch.test.js`
Expected: FAIL — sentinel currently steps alert and deals no damage (dispatch not wired).

- [ ] **Step 3: Implement dispatch in `runtime.js`**

Add imports near the top of `js/core/ice/runtime.js` (with the existing imports):

```js
import { getType, getEffect } from "./index.js";
import { damagePlayerHealth, damagePlayerDeck } from "../player-orchestration.js";
```

Replace the existing `triggerDetection` function (lines ~233-241) with:

```js
function triggerDetection(nodeId) {
  const s = getState();
  const ice = getPrimaryIce();
  emitEvent(E.ICE_DETECTED, { iceId: ice?.id ?? null, nodeId, label: s.nodes[nodeId]?.label ?? nodeId });
  if (!ice) return;
  // Detection lock — applies to ALL ICE regardless of effects, so the same node
  // doesn't re-detect until the player moves. (recordIceDetection also sets this
  // for classic ICE; idempotent.)
  setIceDetectedAt(nodeId);
  applyIceEffects(ice, s, nodeId);
}

/**
 * Apply the detecting instance type's effect atoms. raise-alert routes through
 * the existing alert/trace path (recordIceDetection); damage atoms route through
 * the player-orchestration wrappers (which end the run on depletion) and log a
 * readout. Untyped/legacy instances fall back to raise-alert — preserving
 * pre-dispatch behavior for fixtures like 'standard-ice'.
 */
function applyIceEffects(ice, state, nodeId) {
  const type = getType(ice.typeId);
  const effects = type?.effects ?? [{ atom: "raise-alert", params: {} }];
  const ctx = {
    propagateAlertEvent: (nid) => recordIceDetection(nid),
    damagePlayerHealth,
    damagePlayerDeck,
  };
  emitEvent(E.ICE_ACTIVATED, { iceId: ice.id, trigger: "on-dwell-grade", hostNodeId: ice.attentionNodeId });
  for (const eff of effects) {
    const atom = getEffect(eff.atom);
    if (!atom) continue;
    atom.apply(ice, state, ctx, eff.params ?? {});
    logIceEffect(ice, eff, nodeId);
    emitEvent(E.ICE_EFFECT_APPLIED, { iceId: ice.id, effect: eff.atom, result: { ...(eff.params ?? {}) } });
    // Stop if a depletion ended the run mid-list (single-effect presets won't hit this).
    if (getState().phase !== "playing") break;
  }
}

/** Emit a log readout for damage effects (raise-alert is logged by the alert layer). */
function logIceEffect(ice, eff, nodeId) {
  const s = getState();
  const label = (s.nodes[nodeId]?.label ?? nodeId);
  if (eff.atom === "damage-health") {
    const h = s.player.health;
    const dead = h.current === 0;
    emitEvent(E.LOG_ENTRY, {
      text: `${dead ? "!! " : ""}[ICE] ${label} neural feedback: −${eff.params.amount} HEALTH (${h.current} left)`,
      type: dead ? "error" : "warning",
    });
  } else if (eff.atom === "damage-deck") {
    const d = s.player.deckIntegrity;
    const dead = d.current === 0;
    emitEvent(E.LOG_ENTRY, {
      text: `${dead ? "!! " : ""}[ICE] ${label} deck corruption: −${eff.params.amount} DECK (${d.current} left)`,
      type: dead ? "error" : "warning",
    });
  }
}
```

(Leave `recordIceDetection` in `alert.js` unchanged — `raise-alert` calls it via the ctx.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/core/ice/dispatch.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite to catch regressions**

Run: `make test`
Expected: all pass, including the existing `Snapshot: ICE detection at player node`
(the `standard-ice` fixture exercises the raise-alert fallback).

- [ ] **Step 6: Commit**

```bash
git add js/core/ice/runtime.js js/core/ice/dispatch.test.js
git commit -m 'feat(ice): apply effect atoms on detection — health/deck damage live'
```

---

## Task 4: Typed ICE spawn

Replace the hardcoded `typeId: 'standard-ice'` with a registry pick so damaging presets
can spawn. The weighted roll uses the seeded WORLD stream; an explicit `meta.ice.typeId`
(tests / cheats) overrides it.

**Files:**
- Modify: `js/core/state/index.js`
- Test: `js/core/state/index.test.js` (add a case if the file exists; otherwise create)

- [ ] **Step 1: Write the failing test**

Create `js/core/state/spawn.test.js`:

```js
// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js"; // meta.ice grade B
import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js"; // meta.ice grade C
import { initGame, getState } from "../state.js";
import { getType } from "../ice/index.js";
import { clearAll } from "../timers.js";

beforeEach(() => clearAll());

describe("typed ICE spawn", () => {
  it("spawned ICE has a registry-resolvable typeId (not legacy 'standard-ice')", () => {
    initGame(() => buildCorporateExchange(), "spawn-1");
    const ice = Object.values(getState().ice.instances)[0];
    assert.notEqual(ice.typeId, "standard-ice");
    assert.ok(getType(ice.typeId), `typeId ${ice.typeId} must resolve in the registry`);
    assert.match(ice.typeId, /^(patrol-classic-B|sentinel|spike)$/);
  });

  it("below B, the spawn stays classic", () => {
    initGame(() => buildCorporateFoothold(), "spawn-2"); // grade C
    const ice = Object.values(getState().ice.instances)[0];
    assert.equal(ice.typeId, "patrol-classic-C");
  });
});
```

> The explicit-override branch (`meta.ice.typeId ?? pickIceTypeId(...)`) is covered by
> reading + Task 2's picker unit tests; no network builder sets `meta.ice.typeId`, and
> `initGame` doesn't accept it (it comes from the builder), so there's no integration
> path to assert it without a bespoke fixture — not worth one for a trivial `??`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/core/state/spawn.test.js`
Expected: FAIL — `ice.typeId === "standard-ice"`.

- [ ] **Step 3: Implement typed spawn**

In `js/core/state/index.js`, add the import (with the other imports at the top):

```js
import { pickIceTypeId } from "../ice/registry.js";
import { random } from "../rng.js";
```

Replace the ICE spawn block (lines ~187-210). Change the `typeId` and `behaviorPattern`
lines so:

```js
  // Spawn ICE if defined in meta
  if (meta.ice) {
    const nodeIds = Object.keys(nodes);
    const hostNodeId = meta.ice.startNode ?? randomPick(RNG.WORLD, nodeIds);
    const id = 'ice-1';
    const grade = meta.ice.grade;
    // Registry-driven type: damaging presets (sentinel/spike) appear at B+.
    // An explicit meta.ice.typeId (cheats/tests) overrides the seeded roll.
    const typeId = meta.ice.typeId ?? pickIceTypeId(grade, random(RNG.WORLD));
    /** @type {import('../types.js').IceInstance} */
    const primary = {
      id,
      typeId,
      hostNodeId,
      residentNodeId: hostNodeId, // deprecated, kept for migration; remove when callers stop reading it
      attentionNodeId: hostNodeId,
      active: true,
      enabled: true,
      grade,
      focus: 'roaming',
      behaviorPattern: 'standard',
      dwellTimerId: null,
      detectedAtNode: null,
      detectionCount: 0,
    };
    state.ice = { instances: { [id]: primary } };
  } else {
    state.ice = { instances: {} };
  }
```

(`behaviorPattern: 'standard'` is retained — movement keys off `grade`, not the pattern,
so it's cosmetic this session. Movement-by-pattern is a later reinvention task.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/core/state/spawn.test.js`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `make test`
Expected: all pass. (The `standard-ice` fixture is a saved snapshot, not a fresh spawn,
so it is unaffected.)

- [ ] **Step 6: Commit**

```bash
git add js/core/state/index.js js/core/state/spawn.test.js
git commit -m 'feat(ice): registry-driven typed ICE spawn (sentinel/spike at B+)'
```

---

## Task 5: HUD health + deck meters

No Lit component unit-test harness exists, so this task is **verified in the browser**.

**Files:**
- Modify: `js/ui/components/starnet-hud.js`
- Modify: `js/ui/visual-renderer.js`
- Modify: `css/style.css`

- [ ] **Step 1: Add properties + defaults to `starnet-hud.js`**

In `static properties`, after `paused`:

```js
    health: { type: Number },
    healthMax: { type: Number },
    deck: { type: Number },
    deckMax: { type: Number },
```

In the constructor, after `this.paused = false;`:

```js
    this.health = 100;
    this.healthMax = 100;
    this.deck = 100;
    this.deckMax = 100;
```

- [ ] **Step 2: Render the meters**

In `render()`, immediately after the WALLET `<span>` block (after line ~69) and before
the trace block, insert:

```js
      ${this._meter("HEALTH", this.health, this.healthMax)}
      ${this._meter("DECK", this.deck, this.deckMax)}
```

Add this method to the class (above `render()`):

```js
  _meter(label, current, max) {
    const frac = max > 0 ? current / max : 0;
    const color = frac > 0.6 ? "var(--green)" : frac > 0.3 ? "var(--yellow)" : "var(--red)";
    return html`
      <span class="hud-label">${label}:</span>
      <span class="hud-meter" title="${current}/${max}">
        <span class="hud-meter-fill" style="width:${Math.round(frac * 100)}%;background:${color}"></span>
        <span class="hud-meter-text" style="color:${color}">${current}</span>
      </span>
    `;
  }
```

- [ ] **Step 3: Push props from `visual-renderer.js`**

In `syncHud(state)` (after `hudEl.phase = state.phase;`, ~line 350):

```js
    hudEl.health = state.player.health.current;
    hudEl.healthMax = state.player.health.max;
    hudEl.deck = state.player.deckIntegrity.current;
    hudEl.deckMax = state.player.deckIntegrity.max;
```

- [ ] **Step 4: Add meter styles to `css/style.css`**

Append:

```css
/* HUD resource meters (health / deck integrity) */
.hud-meter {
  position: relative;
  display: inline-block;
  width: 64px;
  height: 12px;
  border: 1px solid var(--cyan);
  vertical-align: middle;
  overflow: hidden;
}
.hud-meter-fill {
  position: absolute;
  inset: 0 auto 0 0;
  opacity: 0.35;
  transition: width 0.3s ease;
}
.hud-meter-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7em;
}
```

- [ ] **Step 5: Verify in the browser**

Run: `make bundle-vendor` (if `dist/` is stale), then `make serve`.
Open `http://localhost:3000`, start a run, and confirm HEALTH/DECK meters render in the
header at 100. Then (fastest path) drive damage from the harness or a cheat and reload to
confirm the meter shrinks and recolors. Screenshot for the notes.

- [ ] **Step 6: Commit**

```bash
git add js/ui/components/starnet-hud.js js/ui/visual-renderer.js css/style.css
git commit -m 'feat(ui): HUD health + deck meters'
```

---

## Task 6: `status` health/deck lines (HUD-parity for the console)

**Files:**
- Modify: `js/core/console-commands/cmd-status.js`
- Test: `js/core/console-commands/cmd-status.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `js/core/console-commands/cmd-status.test.js`:

```js
// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame } from "../state.js";
import { clearAll } from "../timers.js";
import { on, off, E } from "../events.js";
import { cmdStatusSummary, cmdStatusFull } from "./cmd-status.js";

function logs(fn) {
  const captured = [];
  const h = (p) => captured.push(p);
  on(E.LOG_ENTRY, h);
  fn();
  off(E.LOG_ENTRY, h);
  return captured;
}

beforeEach(() => {
  clearAll();
  initGame(() => buildCorporateFoothold(), "status-test");
});

describe("status shows resource pools", () => {
  it("summary includes HEALTH and DECK", () => {
    const out = logs(() => cmdStatusSummary()).map((p) => p.text).join("\n");
    assert.match(out, /HEALTH/);
    assert.match(out, /DECK/);
    assert.match(out, /100/);
  });

  it("full includes health and deck", () => {
    const out = logs(() => cmdStatusFull()).map((p) => p.text).join("\n");
    assert.match(out, /health/i);
    assert.match(out, /deck/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/core/console-commands/cmd-status.test.js`
Expected: FAIL — no HEALTH/DECK in output.

- [ ] **Step 3: Add the summary line**

In `cmd-status.js` `cmdStatusSummary()`, after the Seed/Alert/Cash/Trace push (line ~19):

```js
  const h = s.player.health, d = s.player.deckIntegrity;
  lines.push(`  HEALTH: ${h.current}/${h.max}  |  DECK: ${d.current}/${d.max}`);
```

- [ ] **Step 4: Add the full-status lines**

In `cmdStatusFull()`, under `### PLAYER`, after the `- cash:` push (line ~94):

```js
  lines.push(`- health: ${s.player.health.current}/${s.player.health.max}`);
  lines.push(`- deck integrity: ${s.player.deckIntegrity.current}/${s.player.deckIntegrity.max}`);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test js/core/console-commands/cmd-status.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/core/console-commands/cmd-status.js js/core/console-commands/cmd-status.test.js
git commit -m 'feat(console): show health + deck integrity in status'
```

---

## Task 7: End-screen `burned` / `bricked` outcomes

`burned`/`bricked` currently fall through to the "RUN COMPLETE" branch. Treat them as
failures (distinct title, zeroed-style cash) alongside `caught`.

**Files:**
- Modify: `js/ui/components/starnet-end-screen.js`

- [ ] **Step 1: Replace the outcome-derived constants in `render()`**

Replace `const caught = this.outcome === "caught";` (line ~52) with:

```js
    const failed = this.outcome === "caught"
      || this.outcome === "burned"
      || this.outcome === "bricked";
    const title =
      this.outcome === "caught"  ? "▶ TRACED ◀" :
      this.outcome === "burned"  ? "▶ FLATLINED ◀" :
      this.outcome === "bricked" ? "▶ DECK FRIED ◀" :
                                   "▶ RUN COMPLETE ◀";
```

- [ ] **Step 2: Use `title` / `failed` in the template**

Change the title line:

```js
        <div class="end-title">${title}</div>
```

Change the cash row's class binding from `${caught ? "end-zero" : ""}` to:

```js
          <span class="end-val ${failed ? "end-zero" : ""}">¥${this.cash.toLocaleString()}</span>
```

- [ ] **Step 3: Verify in the browser**

Run a run to depletion (cheat or harness drives health/deck to 0), confirm the overlay
shows FLATLINED / DECK FRIED with the cash styled as zero. (No unit-test harness for Lit
components — verify visually; screenshot for notes.)

- [ ] **Step 4: Commit**

```bash
git add js/ui/components/starnet-end-screen.js
git commit -m 'feat(ui): end-screen copy for burned / bricked outcomes'
```

---

## Task 8: Headless-harness legibility for `ICE_EFFECT_APPLIED`

The damage `LOG_ENTRY` already shows in the harness (it captures all log entries). Add the
semantic `ICE_EFFECT_APPLIED` to the harness's printed event stream for completeness.

**Files:**
- Modify: `scripts/playtest.js`

- [ ] **Step 1: Subscribe + format**

In the event-subscription block of `scripts/playtest.js` (near the other `on(E.*)`
handlers, ~line 214), add:

```js
  on(E.ICE_EFFECT_APPLIED, ({ iceId, effect, result }) =>
    out(`[ICE] ${iceId} effect: ${effect}${result?.amount != null ? ` (${result.amount})` : ""}`));
```

If `E.ICE_EFFECT_APPLIED` is not already in the events-of-interest array (~lines 165-170),
add it there too so JSON mode captures it.

- [ ] **Step 2: Verify manually**

```bash
node scripts/playtest.js --seed dispatch-test reset
node scripts/playtest.js "status"   # confirm HEALTH/DECK line prints
```

Expected: `status` prints a `HEALTH: 100/100 | DECK: 100/100` line.

- [ ] **Step 3: Commit**

```bash
git add scripts/playtest.js
git commit -m 'chore(playtest): surface ICE_EFFECT_APPLIED in the harness'
```

---

## Task 9: Update MANUAL.md

**Files:**
- Modify: `MANUAL.md`

- [ ] **Step 1: Document the mechanic**

Add/extend the relevant sections:
- **ICE types**: add **Sentinel** (burns HEALTH on detection, raises no alert) and
  **Spike** (corrupts DECK integrity, raises no alert). Note they appear at threat B+.
- **Loss clocks**: alongside the trace, the player now has **HEALTH** and **DECK
  INTEGRITY** pools (start 100). Depleting HEALTH ends the run *flatlined* (`burned`);
  depleting DECK ends it *bricked*. Note the orthogonality: classic ICE pursue the trace;
  Sentinel/Spike pursue the health/deck clocks.
- **Console**: `status` / `status full` now report HEALTH and DECK.

- [ ] **Step 2: Commit**

```bash
git add MANUAL.md
git commit -m 'docs(manual): health/deck loss clocks + Sentinel/Spike ICE'
```

---

## Task 10: Full verification + balance check + notes

- [ ] **Step 1: `make check` (lint + full test suite)**

Run: `make check`
Expected: 0 lint errors; all tests pass (baseline was 775 + new tests).

- [ ] **Step 2: Bot census — confirm no difficulty regression**

Run: `node scripts/bot-census.js --time F --money F --seeds 10`
Expected: ~80% success (the smoke-test target from CLAUDE.md). Investigate if damaging
ICE on B+ networks tanks the rate unexpectedly; record the numbers in notes. The bot does
not track health/deck, so a modest dip on B+ runs is expected and acceptable — note it
rather than papering over it.

- [ ] **Step 3: End-to-end browser smoke**

`make serve` → start a B+ run, get detected by a Sentinel/Spike (or drive damage), confirm:
HUD meter drops + recolors, a log line appears, and depletion shows the right end screen.

- [ ] **Step 4: Write the session summary in `notes.md`**

Capture: what shipped, the alert-orthogonality decision, tuning values as shipped, census
numbers, and any follow-ups (e.g., biome-biasing the type roll; bloom-driven-by-deck in
#134).

- [ ] **Step 5: Final commit (notes)**

```bash
git add docs/dev-sessions/2026-06-10-1626-health-deck-damage/notes.md
git commit -m 'docs: session notes — health/deck loss clocks'
```

---

## Self-Review

**Spec coverage:**
- §1 dispatch at detection → Task 3 ✓
- §2 Sentinel/Spike presets + typed spawn → Tasks 2, 4 ✓
- §2 alert as orthogonal effect (no bundling) → Task 2 presets (no raise-alert) + Task 3
  dispatch (raise-alert only via classic) ✓; regression asserted in Task 3
- §3 HUD / status / log visibility → Tasks 5, 6, 3 (log) ✓
- §4 run-end copy (burned/bricked) → Task 7 ✓
- atom-registration gap (live import) → Task 1 ✓ (prerequisite discovered during planning)
- verification (make check, census, MANUAL) → Tasks 9, 10 ✓

**Placeholder scan:** none — every code step shows the code. The signatures the test
snippets depend on (`initGame(buildNetworkFn, seedString, opts)`, `meta.ice` from the
builder, `setSelectedNode` in `state/game.js`, `corporate-exchange` = grade B,
`corporate-foothold` = grade C) were verified against the repo during planning.

**Type consistency:** `pickIceTypeId(grade, roll)` defined in Task 2, called in Task 4 with
`random(RNG.WORLD)`. ctx methods `propagateAlertEvent` / `damagePlayerHealth` /
`damagePlayerDeck` (Task 3) match the atom bodies in `ice/effects.js`. HUD props
`health/healthMax/deck/deckMax` defined in Task 5 and pushed in the same task. Events
`ICE_ACTIVATED` / `ICE_EFFECT_APPLIED` already exist in `js/core/events.js`.

**Known soft spots (call out, don't hide):**
- Tasks 5/7 (HUD meters, end-screen) have no unit tests — there is no Lit component test
  harness in the repo. They are verified in-browser with screenshots saved to notes.
- Task 4's spawn roll consumes one `RNG.WORLD` draw; its *position* in the WORLD stream
  relative to other consumers isn't asserted (the test checks resolvability + the grade
  gate, not an exact rolled type), so it won't go flaky if unrelated WORLD draws shift.
