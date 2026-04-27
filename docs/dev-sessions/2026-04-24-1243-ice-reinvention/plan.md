# ICE Reinvention — Session 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild ICE as a data-driven, multi-instance system so future sessions can add variant ICE types as pure content changes. Existing gameplay must be unchanged — the bot census is the regression gate.

**Architecture:** Replace the `s.ice` singleton with `s.ice.instances` keyed by id. Split `js/core/ice.js` into a module directory (`js/core/ice/{registry,atoms,runtime,patterns/}`). Atoms are pure composable functions (triggers, behavior patterns, effects) assembled via a type catalog. Add two new integer loss-pools to `PlayerState` (health, deck integrity) with their own run outcomes.

**Tech Stack:** Vanilla ES modules, JSDoc `@ts-check`, `node:test`, `node:assert/strict`. No new dependencies.

**Spec:** [`docs/dev-sessions/2026-04-24-1243-ice-reinvention/spec.md`](./spec.md) — this plan implements session 1 from §10.

**Issue:** [#92](https://github.com/lmorchard/starnet/issues/92)

**Scope pragma:** Dormant atoms (those not wired into any catalog entry this session) ship with their `id` + `schema` registered, but their `apply()` body throws `"atom '<id>' not yet implemented — wired in session N"`. Each dormant atom has a minimal existence test that verifies id and schema. Home sessions replace the stub body and add behavior tests. This honors the spec commitment ("every atom exists as a named function with a unit test") without shipping partially-correct implementations.

---

## File Structure

### New files

```
js/core/ice/
  index.js              — re-export surface for callers outside the module
  registry.js           — catalog of ICE type presets
  atoms.js              — trigger + effect atom registries (the Map data structures)
  effects.js            — live + dormant effect atom definitions (registers on import)
  triggers.js           — live + dormant trigger atom definitions (registers on import)
  runtime.js            — per-tick dispatcher, detection logic
  patterns/
    trap.js             — stationary pattern (stub, session 2)
    patrol-random.js    — random walk (live; matches today's D/F behavior)
    disturbance-tracker.js — tracks lastDisturbedNodeId (live; matches today's C/B)
    player-hunter.js    — targets player selection (live; matches today's A/S)
    patrol-route.js     — stub, later session
    sentry-radius.js    — stub, later session
    relocate-on-activate.js — stub, later session
    player-avoid.js     — stub, later session
    freeze.js           — stub, later session

tests/
  ice-serialization.test.js — instance collection round-trip
```

### Modified files

- `js/core/types.js` — add `IceInstance` typedef, update `GameState.ice`, add `Health`/`DeckIntegrity` pools on `PlayerState`, add run outcomes
- `js/core/state/index.js` — `initGame` builds instance collection; `endRun` iterates instances; add `health`/`deckIntegrity` defaults; emit for new outcomes
- `js/core/state/ice.js` — setters accept `iceId` parameter; `getPrimaryIce()` helper
- `js/core/state/player.js` — add `damagePlayerHealth`, `damagePlayerDeck`, `setHealth`, `setDeckIntegrity`
- `js/core/events.js` — add new event constants; existing ICE events get `iceId` in their payloads
- `js/core/ice.js` — becomes a re-export shim that points at `js/core/ice/runtime.js`
- `js/core/alert.js` — `recordIceDetection` accepts `iceId`; reads instance instead of singleton
- `js/core/cheats.js` — status + teleport cheats use primary instance; `cheat ice-move` gains `--id` later
- `js/core/console-commands/cmd-status.js` — iterate instances
- `js/core/node-graph/game-ctx.js` — `residentNodeId`/`residentLabel` from primary instance
- `js/core/actions/node-actions.js` — `eject`/`reboot` actions iterate instances
- `js/ui/visual-renderer.js` — iterate instances when syncing graph
- `js/playground/main.js` — iterate instances for debug overlay
- `scripts/bot/perception.js`, `scripts/bot/execute.js`, `scripts/bot/loop.js`, `scripts/bot/stats.js` — iterate instances
- `scripts/playtest.js` — already goes through state module, but add ice-aware status subcommand
- `tests/integration.test.js`, `tests/init-game.test.js`, `tests/snapshot-ice-detection.test.js` — update assertions to reach through `getPrimaryIce()` or iterate
- `js/core/state/ice.test.js` — update to exercise `iceId`-parameterized setters

### Out of scope (explicitly deferred)

- Discovery, stash, host-badge graph marker, hack/reprogram verbs — sessions 2+
- Wiring any dormant atom into a catalog entry — home sessions
- `MANUAL.md` player-facing updates — none needed this session; no player-visible behavior change

---

## Phase 1 — Player resources (health + deck integrity)

Additive, isolated, low risk. Does not depend on any ICE changes.

### Task 1.1: Extend PlayerState typedef + run-outcome type

**Files:**
- Modify: `js/core/types.js`

- [ ] **Step 1: Write the failing test**

Add to `tests/init-game.test.js` (append to the existing describe block):
```js
it("player state includes health and deckIntegrity pools", () => {
  clearAll();
  initGame(() => buildCorporateExchange());
  const s = getState();
  assert.equal(s.player.health.current, 100);
  assert.equal(s.player.health.max, 100);
  assert.equal(s.player.deckIntegrity.current, 100);
  assert.equal(s.player.deckIntegrity.max, 100);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/init-game.test.js
```
Expected: FAIL — `s.player.health` is undefined.

- [ ] **Step 3: Update the typedef**

In `js/core/types.js`, modify the `PlayerState` typedef and `RunOutcome`:
```js
/** @typedef {"success"|"caught"|"burned"|"bricked"} RunOutcome */

/**
 * @typedef {{
 *   cash: number,
 *   hand: ExploitCard[],
 *   health: { current: number, max: number },
 *   deckIntegrity: { current: number, max: number },
 * }} PlayerState
 */
```

Test will still fail — only typedef changed, no runtime value.

- [ ] **Step 4: Seed pools in initGame**

In `js/core/state/index.js` `initGame`, change the `player` line:
```js
player: {
  cash: meta.startCash ?? 1000,
  hand: generateStartingHand(meta.startHand),
  health:        { current: meta.startHealth        ?? 100, max: meta.startHealth        ?? 100 },
  deckIntegrity: { current: meta.startDeckIntegrity ?? 100, max: meta.startDeckIntegrity ?? 100 },
},
```

- [ ] **Step 5: Verify test passes**

```bash
node --test tests/init-game.test.js
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/core/types.js js/core/state/index.js tests/init-game.test.js
git commit -m 'feat(player): add health + deck integrity pools to PlayerState

Additive state only; not yet damaged by any game mechanic.
Part of ICE reinvention session 1 (#92).'
```

### Task 1.2: Player damage mutators

**Files:**
- Modify: `js/core/state/player.js`
- Create test in: `js/core/state/player.test.js` (new file; follows pattern of `state/ice.test.js`)

- [ ] **Step 1: Write the failing test**

Create `js/core/state/player.test.js`:
```js
// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js";
import { initGame, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import { damagePlayerHealth, damagePlayerDeck, setPlayerHealth, setPlayerDeckIntegrity } from "./player.js";

describe("state/player — health + deck integrity", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateExchange());
  });

  it("damagePlayerHealth reduces current, clamps at 0", () => {
    damagePlayerHealth(30);
    assert.equal(getState().player.health.current, 70);
    damagePlayerHealth(999);
    assert.equal(getState().player.health.current, 0);
  });

  it("damagePlayerDeck reduces current, clamps at 0", () => {
    damagePlayerDeck(40);
    assert.equal(getState().player.deckIntegrity.current, 60);
    damagePlayerDeck(999);
    assert.equal(getState().player.deckIntegrity.current, 0);
  });

  it("setPlayerHealth sets absolute value, clamps at max", () => {
    setPlayerHealth(50);
    assert.equal(getState().player.health.current, 50);
    setPlayerHealth(999);
    assert.equal(getState().player.health.current, 100);
  });

  it("damage functions increment version counter", () => {
    const v = getVersion();
    damagePlayerHealth(1);
    assert.equal(getVersion(), v + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test js/core/state/player.test.js
```
Expected: FAIL — mutators do not exist.

- [ ] **Step 3: Add the mutators**

Append to `js/core/state/player.js`:
```js
/** Damages player health. Clamps at 0. */
export function damagePlayerHealth(amount) {
  mutate((s) => {
    s.player.health.current = Math.max(0, s.player.health.current - amount);
  });
}

/** Damages player deck integrity. Clamps at 0. */
export function damagePlayerDeck(amount) {
  mutate((s) => {
    s.player.deckIntegrity.current = Math.max(0, s.player.deckIntegrity.current - amount);
  });
}

/** Sets player health to an absolute value. Clamps at max. */
export function setPlayerHealth(value) {
  mutate((s) => {
    s.player.health.current = Math.min(s.player.health.max, Math.max(0, value));
  });
}

/** Sets player deck integrity to an absolute value. Clamps at max. */
export function setPlayerDeckIntegrity(value) {
  mutate((s) => {
    s.player.deckIntegrity.current = Math.min(s.player.deckIntegrity.max, Math.max(0, value));
  });
}
```

- [ ] **Step 4: Verify test passes**

```bash
node --test js/core/state/player.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/core/state/player.js js/core/state/player.test.js
git commit -m 'feat(player): health + deck integrity damage mutators

Part of ICE reinvention session 1 (#92).'
```

### Task 1.3: New run outcomes (`burned`, `bricked`) auto-end the run

**Files:**
- Modify: `js/core/state/player.js`
- Modify: `js/core/state/index.js`
- Modify: `js/core/state/player.test.js`

- [ ] **Step 1: Write the failing test**

Append to `js/core/state/player.test.js`:
```js
describe("state/player — resource depletion ends run", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateExchange());
  });

  it("draining health to 0 ends the run with outcome 'burned'", () => {
    damagePlayerHealth(999);
    assert.equal(getState().phase, "ended");
    assert.equal(getState().runOutcome, "burned");
  });

  it("draining deck integrity to 0 ends the run with outcome 'bricked'", () => {
    damagePlayerDeck(999);
    assert.equal(getState().phase, "ended");
    assert.equal(getState().runOutcome, "bricked");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test js/core/state/player.test.js
```
Expected: FAIL — phase still `playing` after damage.

- [ ] **Step 3: Wire damage → endRun in the mutators**

In `js/core/state/player.js`, add an import for `endRun` (lazy to avoid cycle):
```js
// Lazy import to break a cycle with state/index.js endRun → ice → events
async function endRunLazy(outcome) {
  const mod = await import("./index.js");
  mod.endRun(outcome);
}
```

Wait — a dynamic import returns a promise, which won't work synchronously in tests. Better approach: push the check into `endRun` callers, or colocate the check in `state/index.js`.

Actually, the cleanest fix is a direct import. `state/index.js` imports from `state/player.js` already; the reverse is allowed so long as we only import `endRun` lazily *at call time*. But we don't need lazy — `player.js` can import `endRun` eagerly because it's a top-level export of `./index.js` and Node ESM handles the cycle (the import binding resolves when called, not at module-load time, given `endRun` is declared with `export function`). Verify with a direct import:

Add at the top of `js/core/state/player.js`:
```js
import { endRun } from "./index.js";
```

Then update the mutators:
```js
export function damagePlayerHealth(amount) {
  mutate((s) => {
    s.player.health.current = Math.max(0, s.player.health.current - amount);
  });
  if (getHealthCurrent() === 0) endRun("burned");
}

export function damagePlayerDeck(amount) {
  mutate((s) => {
    s.player.deckIntegrity.current = Math.max(0, s.player.deckIntegrity.current - amount);
  });
  if (getDeckCurrent() === 0) endRun("bricked");
}

function getHealthCurrent() {
  // import getState lazily to avoid duplicating the binding
  // (alternatively, we can import getState at top).
}
```

Simpler: import `getState` from the same module:
```js
import { mutate, endRun, getState } from "./index.js";
```

Then:
```js
export function damagePlayerHealth(amount) {
  mutate((s) => {
    s.player.health.current = Math.max(0, s.player.health.current - amount);
  });
  if (getState().player.health.current === 0 && getState().phase === "playing") {
    endRun("burned");
  }
}

export function damagePlayerDeck(amount) {
  mutate((s) => {
    s.player.deckIntegrity.current = Math.max(0, s.player.deckIntegrity.current - amount);
  });
  if (getState().player.deckIntegrity.current === 0 && getState().phase === "playing") {
    endRun("bricked");
  }
}
```

The `phase === "playing"` guard prevents re-entering endRun if it was already called.

- [ ] **Step 4: Verify tests pass**

```bash
node --test js/core/state/player.test.js
```
Expected: PASS

- [ ] **Step 5: Run full lint + test**

```bash
make check
```
Expected: PASS. The typedef change in Task 1.1 may expose a pre-existing issue anywhere `s.player` is narrowly typed; address each if necessary by updating usage or casts.

- [ ] **Step 6: Commit**

```bash
git add js/core/state/player.js js/core/state/player.test.js
git commit -m 'feat(player): burned / bricked run outcomes from resource depletion

Draining health or deck integrity to zero ends the run with the
corresponding outcome. Part of ICE reinvention session 1 (#92).'
```

---

## Phase 2 — Event surface (additive)

Purely additive constants so later phases have event names available.

### Task 2.1: Add new ICE event constants

**Files:**
- Modify: `js/core/events.js`

- [ ] **Step 1: Write the failing test**

Create `js/core/events.test.js` (new file):
```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { E } from "./events.js";

describe("events — E catalog", () => {
  it("exposes new ICE reinvention event constants", () => {
    assert.equal(E.ICE_INSTALLED,        "ice:installed");
    assert.equal(E.ICE_REVEALED,         "ice:revealed");
    assert.equal(E.ICE_ACTIVATED,        "ice:activated");
    assert.equal(E.ICE_EFFECT_APPLIED,   "ice:effect-applied");
    assert.equal(E.ICE_HACKED,           "ice:hacked");
    assert.equal(E.ICE_STASH_DEPOSITED,  "ice:stash-deposited");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test js/core/events.test.js
```
Expected: FAIL — constants undefined.

- [ ] **Step 3: Add constants**

In `js/core/events.js`, extend the `E` object:
```js
  ICE_MOVED:            "ice:moved",
  ICE_DETECT_PENDING:   "ice:detect-pending",
  ICE_DETECTED:         "ice:detected",
  ICE_EJECTED:          "ice:ejected",
  ICE_REBOOTED:         "ice:rebooted",
  ICE_DISABLED:         "ice:disabled",
  ICE_INSTALLED:        "ice:installed",
  ICE_REVEALED:         "ice:revealed",
  ICE_ACTIVATED:        "ice:activated",
  ICE_EFFECT_APPLIED:   "ice:effect-applied",
  ICE_HACKED:           "ice:hacked",
  ICE_STASH_DEPOSITED:  "ice:stash-deposited",
```

- [ ] **Step 4: Verify test passes**

```bash
node --test js/core/events.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/core/events.js js/core/events.test.js
git commit -m 'feat(events): add ICE reinvention event constants

Additive only — no emitters or listeners yet.
Part of ICE reinvention session 1 (#92).'
```

---

## Phase 3 — IceInstance type and state shape migration

The heaviest phase. Moves `s.ice` from singleton to `s.ice.instances`. A
`getPrimaryIce()` shim keeps existing callers working while they're migrated
in Phase 4.

### Task 3.1: Add IceInstance typedef, update GameState.ice

**Files:**
- Modify: `js/core/types.js`

- [ ] **Step 1: Add the `IceInstance` typedef**

In `js/core/types.js`, add after the existing `IceState` typedef:
```js
/**
 * A single ICE entity in the reinvented multi-instance model. For session 1
 * the collection holds exactly one instance per network, ported from the
 * pre-reinvention singleton. Additional fields (triggers, effects, etc.)
 * are introduced in later sessions.
 *
 * @typedef {{
 *   id: string,
 *   typeId: string,
 *   hostNodeId: string,
 *   attentionNodeId: string,
 *   active: boolean,
 *   enabled: boolean,
 *   grade: Grade,
 *   focus: "stationary" | "roaming",
 *   behaviorPattern: string,
 *   dwellTimerId: number|null,
 *   detectedAtNode: string|null,
 *   detectionCount: number,
 * }} IceInstance
 */
```

Then replace the `ice` field in `GameState` (which currently isn't in `types.js` — it's implicit). Find the `IceState` typedef and deprecate it by changing the export comment to point at `IceInstance` for the new shape:
```js
/**
 * @deprecated Use IceInstance. Retained as a type alias for callers mid-migration.
 * @typedef {IceInstance} IceState
 */
```

- [ ] **Step 2: Update lint**

```bash
make lint
```
Expected: PASS (typedefs only).

- [ ] **Step 3: Commit**

```bash
git add js/core/types.js
git commit -m 'feat(types): add IceInstance typedef for multi-instance model

IceState kept as deprecated alias during migration.
Part of ICE reinvention session 1 (#92).'
```

### Task 3.2: `getPrimaryIce()` compat shim + state shape change

**Files:**
- Modify: `js/core/state/index.js`
- Modify: `js/core/state/ice.js`

This is a breaking change to the in-memory shape; Task 3.3 updates callers.

- [ ] **Step 1: Write the failing test**

Append to `js/core/state/ice.test.js`:
```js
describe("state/ice — multi-instance shape", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateExchange());
  });

  it("state.ice is a collection keyed by id", () => {
    const s = getState();
    assert.ok(s.ice);
    assert.ok(typeof s.ice.instances === "object");
    const ids = Object.keys(s.ice.instances);
    assert.equal(ids.length, 1);
  });

  it("getPrimaryIce() returns the first active instance", () => {
    const { getPrimaryIce } = require("./ice.js"); // dynamic — see note below
    const ice = getPrimaryIce();
    assert.ok(ice);
    assert.equal(ice.active, true);
  });
});
```

Actually the test file is ESM — no `require`. Rewrite the test using ESM imports at the top:

Add to the imports at the top of `js/core/state/ice.test.js`:
```js
import { getPrimaryIce } from "./ice.js";
```

And rewrite the second test:
```js
it("getPrimaryIce() returns the first active instance", () => {
  const ice = getPrimaryIce();
  assert.ok(ice);
  assert.equal(ice.active, true);
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
node --test js/core/state/ice.test.js
```
Expected: FAIL — `s.ice.instances` is undefined and `getPrimaryIce` isn't exported.

- [ ] **Step 3: Update `initGame` to build the instance collection**

In `js/core/state/index.js`, replace the ICE spawn block (`if (meta.ice)`):
```js
if (meta.ice) {
  const nodeIds = Object.keys(nodes);
  const hostNodeId = meta.ice.startNode ?? randomPick(RNG.WORLD, nodeIds);
  const id = "ice-1";
  /** @type {import('../types.js').IceInstance} */
  const primary = {
    id,
    typeId: gradeToTypeId(meta.ice.grade),
    hostNodeId,
    attentionNodeId: hostNodeId,
    active: true,
    enabled: true,
    grade: meta.ice.grade,
    focus: "roaming",
    behaviorPattern: gradeToPattern(meta.ice.grade),
    dwellTimerId: null,
    detectedAtNode: null,
    detectionCount: 0,
  };
  state.ice = { instances: { [id]: primary } };
} else {
  state.ice = { instances: {} };
}
```

Add helpers at the top of `state/index.js`:
```js
/** Map legacy grade to the session-1 catalog type id. */
function gradeToTypeId(grade) {
  return `patrol-classic-${grade}`;
}

/** Map legacy grade to the behavior pattern name used in session 1. */
function gradeToPattern(grade) {
  if (grade === "D" || grade === "F") return "patrol-random";
  if (grade === "A" || grade === "S") return "player-hunter";
  return "disturbance-tracker";
}
```

- [ ] **Step 4: Add `getPrimaryIce()` to `state/ice.js`**

Append to `js/core/state/ice.js`:
```js
import { getState } from "./index.js";

/**
 * Return the first active instance, or null if none.
 * Compatibility shim — callers are migrated to iterate `s.ice.instances`
 * in later sessions.
 *
 * @returns {import('../types.js').IceInstance|null}
 */
export function getPrimaryIce() {
  const inst = getState().ice?.instances ?? {};
  for (const id of Object.keys(inst)) {
    if (inst[id]?.active) return inst[id];
  }
  return null;
}
```

- [ ] **Step 5: Update existing setters to operate on the primary instance**

Rewrite `js/core/state/ice.js` setters to accept an optional `iceId` and default to primary:
```js
function resolveIce(s, iceId) {
  if (iceId) return s.ice?.instances?.[iceId];
  const inst = s.ice?.instances ?? {};
  for (const id of Object.keys(inst)) if (inst[id]?.active) return inst[id];
  return null;
}

export function setIceAttention(nodeId, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.attentionNodeId = nodeId;
  });
}

export function setIceDetectedAt(nodeId, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.detectedAtNode = nodeId;
  });
}

export function setIceDwellTimer(timerId, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.dwellTimerId = timerId;
  });
}

export function incrementIceDetectionCount(iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.detectionCount++;
  });
}

export function setIceActive(active, iceId) {
  mutate((s) => {
    const ice = resolveIce(s, iceId);
    if (ice) ice.active = active;
  });
}
```

`setLastDisturbedNode` stays unchanged (operates on root `s.lastDisturbedNodeId` — still global for session 1; becomes per-instance in session 7 / per-zone work).

- [ ] **Step 6: Update serialization to handle the new shape**

`serializeState` / `deserializeState` in `state/index.js` already pass through `state.ice` as a POJO, so no change is strictly required. But add a single assertion to confirm:

Append a test to `js/core/state/ice.test.js`:
```js
it("serialize → deserialize round-trips the ice collection", async () => {
  const { serializeState, deserializeState } = await import("./index.js");
  setIceAttention("gateway");
  const snap = JSON.parse(JSON.stringify(serializeState()));
  clearAll();
  initGame(() => buildCorporateExchange());
  deserializeState(snap);
  const ice = getPrimaryIce();
  assert.equal(ice.attentionNodeId, "gateway");
});
```

- [ ] **Step 7: Run state/ice tests**

```bash
node --test js/core/state/ice.test.js
```
Expected: PASS (new tests + existing `getState().ice.foo` tests fail because the shape changed — we'll update those in the next step).

Actually existing tests like `assert.equal(getState().ice.attentionNodeId, "gateway")` will now fail. Update them to use `getPrimaryIce()`:

```js
it("setIceAttention changes attentionNodeId", () => {
  const v = getVersion();
  setIceAttention("gateway");
  assert.equal(getPrimaryIce().attentionNodeId, "gateway");
  assert.equal(getVersion(), v + 1);
});
```

Repeat for every test in `ice.test.js`. After updating, re-run:
```bash
node --test js/core/state/ice.test.js
```
Expected: PASS

- [ ] **Step 8: Run the full test suite — most will fail at this point**

```bash
make test
```
Expected: many failures across `integration.test.js`, `init-game.test.js`, `snapshot-ice-detection.test.js`, and every file that reads `s.ice.X` directly. These are addressed in Phase 4.

- [ ] **Step 9: Commit the state shape change**

```bash
git add js/core/types.js js/core/state/index.js js/core/state/ice.js js/core/state/ice.test.js
git commit -m 'refactor(ice): migrate s.ice singleton to s.ice.instances collection

One instance per LAN for now (ported from the pre-reinvention singleton).
getPrimaryIce() compat shim introduced to smooth migration of callers.

Callers outside state/ are updated in a follow-up commit; tests at HEAD
are red across ice consumers. Part of session 1 (#92).'
```

---

## Phase 4 — Migrate callers to `getPrimaryIce()`

Mechanical migration of the 17 callers enumerated in File Structure. Each
file gets its own small commit so the diff is reviewable.

### Task 4.1 — core: `js/core/ice.js`

**Files:**
- Modify: `js/core/ice.js`

- [ ] **Step 1: Update all `s.ice?.X` / `s.ice.X` reads**

At the top of `ice.js`, add import:
```js
import { getPrimaryIce } from "./state/ice.js";
```

Replace every `s.ice` read with `getPrimaryIce()`, e.g.:

Before:
```js
export function startIce() {
  const s = getState();
  if (!s.ice || !s.ice.active) return;
  const interval = MOVE_INTERVALS[s.ice.grade] ?? 6000;
  scheduleRepeating(TIMER.ICE_MOVE, interval);
}
```

After:
```js
export function startIce() {
  const ice = getPrimaryIce();
  if (!ice) return;
  const interval = MOVE_INTERVALS[ice.grade] ?? 6000;
  scheduleRepeating(TIMER.ICE_MOVE, interval);
}
```

Apply the same substitution throughout `ice.js`:
- `s.ice?.active` → presence check via `getPrimaryIce()` truthy
- `s.ice.attentionNodeId` → `ice.attentionNodeId`
- `s.ice.grade` → `ice.grade`
- `s.ice.detectedAtNode` → `ice.detectedAtNode`
- `s.ice.residentNodeId` → `ice.hostNodeId` (renamed for the new model)

Add a deprecation guard at the top of `ice.js`:
```js
// Session 1 still addresses the primary instance throughout; the runtime
// rewrite in js/core/ice/runtime.js (Phase 6) iterates state.ice.instances.
```

- [ ] **Step 2: Run ice tests**

```bash
node --test tests/integration.test.js
```
Expected: many tests still fail — callers in `integration.test.js` itself use `getState().ice.X`. Task 4.2+ updates them.

- [ ] **Step 3: Commit**

```bash
git add js/core/ice.js
git commit -m 'refactor(ice): js/core/ice.js uses getPrimaryIce() shim

Part of session 1 (#92) caller migration.'
```

### Task 4.2 — core: `js/core/alert.js`

- [ ] **Step 1: Replace `s.ice?.active` checks**

```js
import { getPrimaryIce } from "./state/ice.js";

// inside the existing function:
// before:  if (!s.ice?.active) return;
// after:   if (!getPrimaryIce()) return;
```

- [ ] **Step 2: Run alert-related tests**

```bash
node --test tests/integration.test.js
```

- [ ] **Step 3: Commit**

```bash
git add js/core/alert.js
git commit -m 'refactor(alert): use getPrimaryIce() shim

Part of session 1 (#92) caller migration.'
```

### Task 4.3 — core: `js/core/cheats.js`

- [ ] **Step 1: Replace `s.ice` reads**

```js
import { getPrimaryIce } from "./state/ice.js";

// ice-status cheat: replace every s.ice.X with getPrimaryIce().X after null-check
// ice-move teleport: same pattern
```

Specifically at `js/core/cheats.js:201`, `:258`, `:262`, rewrite each block to guard via `getPrimaryIce()`.

- [ ] **Step 2: Commit**

```bash
git add js/core/cheats.js
git commit -m 'refactor(cheats): use getPrimaryIce() shim

Part of session 1 (#92) caller migration.'
```

### Task 4.4 — core: `js/core/console-commands/cmd-status.js`

- [ ] **Step 1: Iterate instances, show all**

Instead of the shim, this file is a good first candidate for the iterating pattern — status output should show all ICE instances. Replace the current singleton block:

```js
// before
if (s.ice) {
  iceStr = `ACTIVE @ ${s.nodes[s.ice.residentNodeId]?.label ?? s.ice.residentNodeId} → ${s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId}`;
}
```

```js
// after
const iceInstances = Object.values(s.ice?.instances ?? {});
if (iceInstances.length === 0) {
  iceStr = "none";
} else {
  iceStr = iceInstances.map(ice => {
    const host = s.nodes[ice.hostNodeId]?.label ?? ice.hostNodeId;
    const at   = s.nodes[ice.attentionNodeId]?.label ?? ice.attentionNodeId;
    const state = ice.active ? "ACTIVE" : "INACTIVE";
    return `${ice.id} [${ice.typeId}] ${state} @ ${host} → ${at}`;
  }).join(" | ");
}
```

Apply the same transformation for the other two occurrences in the file (status subcommands for `status ice` and `status full`).

- [ ] **Step 2: Verify via playtest harness**

```bash
node scripts/playtest.js reset
node scripts/playtest.js "status ice"
```
Expected: status output shows `ice-1 [patrol-classic-<grade>] ACTIVE @ ...`

- [ ] **Step 3: Commit**

```bash
git add js/core/console-commands/cmd-status.js
git commit -m 'refactor(status): iterate ice instances in cmd-status

Part of session 1 (#92) caller migration.'
```

### Task 4.5 — core: `js/core/node-graph/game-ctx.js`

- [ ] **Step 1: Update residentNodeId/residentLabel reads**

Look at `game-ctx.js:157-158`:
```js
// before
residentNodeId: s.ice.residentNodeId,
residentLabel: s.nodes[s.ice.residentNodeId]?.label ?? s.ice.residentNodeId,
```

These construct an ICE_REBOOTED payload. In the new model, use the primary instance's `hostNodeId`:
```js
// after
const ice = getPrimaryIce();
// then in the payload build:
residentNodeId: ice?.hostNodeId ?? null,
residentLabel: ice ? (s.nodes[ice.hostNodeId]?.label ?? ice.hostNodeId) : null,
```

Add the import at the top:
```js
import { getPrimaryIce } from "../state/ice.js";
```

- [ ] **Step 2: Commit**

```bash
git add js/core/node-graph/game-ctx.js
git commit -m 'refactor(node-graph): game-ctx reboot payload via getPrimaryIce()

Part of session 1 (#92) caller migration.'
```

### Task 4.6 — core: `js/core/actions/node-actions.js`

- [ ] **Step 1: Update any `s.ice` references**

Find the eject / reboot action availability predicates and update reads.

```bash
grep -n 's\.ice' js/core/actions/node-actions.js
```
For each hit, swap to `getPrimaryIce()`.

- [ ] **Step 2: Commit**

```bash
git add js/core/actions/node-actions.js
git commit -m 'refactor(actions): use getPrimaryIce() shim

Part of session 1 (#92) caller migration.'
```

### Task 4.7 — UI: `js/ui/visual-renderer.js`

- [ ] **Step 1: Replace lines 274–278**

Replace the singleton block with an iteration:
```js
// before
if (state.ice) {
  syncIceGraph(state.ice, state.nodes, state.selectedNodeId);
  // docked computation used state.ice.active and state.ice.attentionNodeId
  const docked = state.ice.active && state.ice.attentionNodeId === state.selectedNodeId;
  ...
}
```

```js
// after
const iceInstances = Object.values(state.ice?.instances ?? {});
for (const ice of iceInstances) {
  syncIceGraph(ice, state.nodes, state.selectedNodeId);
}
// docked = any active instance docked on the selected node
const docked = iceInstances.some(ice =>
  ice.active && ice.attentionNodeId === state.selectedNodeId
);
```

`syncIceGraph` signature stays the same; it just handles one ice at a time now. Inspect `syncIceGraph` (same file) and adapt if it reaches into `state.ice.X` internally — swap for the parameter.

- [ ] **Step 2: Visual sanity check**

```bash
make bundle-vendor
make serve &
open http://localhost:3000
```
Click around; verify ICE marker appears on a node and moves. Kill `serve`.

- [ ] **Step 3: Commit**

```bash
git add js/ui/visual-renderer.js
git commit -m 'refactor(visual): iterate ice instances in renderer

Part of session 1 (#92) caller migration.'
```

### Task 4.8 — playground: `js/playground/main.js`

- [ ] **Step 1: Swap to `getPrimaryIce()`** (playground is debug-only; single-instance view is fine)

- [ ] **Step 2: Commit**

```bash
git add js/playground/main.js
git commit -m 'refactor(playground): use getPrimaryIce() shim

Part of session 1 (#92) caller migration.'
```

### Task 4.9 — scripts/bot: perception, execute, loop, stats

**Files:**
- Modify: `scripts/bot/perception.js`, `scripts/bot/execute.js`, `scripts/bot/loop.js`, `scripts/bot/stats.js`

- [ ] **Step 1: Iterate instances where relevant**

For each file, find `s.ice.X` references. Most likely the bot reads `s.ice.attentionNodeId` to decide movement — for session 1, the bot can read the primary instance. Later sessions (when multiple ICE exist) will need bot strategy updates — file as a TODO note in the code if the change is non-trivial.

```bash
grep -n 's\.ice' scripts/bot/*.js
```
For each hit: `import { getPrimaryIce } from "../../js/core/state/ice.js"` and substitute.

- [ ] **Step 2: Smoke-test the bot**

```bash
node scripts/bot-census.js --time F --money F --seeds 5
```
Expected: bot completes 5 seeds without crashing. Near-100% success rate (F/F is the easiest grade).

- [ ] **Step 3: Commit**

```bash
git add scripts/bot/
git commit -m 'refactor(bot): use getPrimaryIce() shim across bot modules

Part of session 1 (#92) caller migration.'
```

### Task 4.10 — tests: update all `getState().ice.X` in test files

**Files:**
- Modify: `tests/integration.test.js`, `tests/init-game.test.js`, `tests/snapshot-ice-detection.test.js`

- [ ] **Step 1: Find and replace**

```bash
grep -n 'getState().ice\.' tests/
```

For each file, add `import { getPrimaryIce } from "../js/core/state/ice.js";` and substitute `getState().ice.X` → `getPrimaryIce().X`.

Also note any `getState().ice = ...` assignments in test setup — these are legitimate test-only shortcuts, but they need to write into `getState().ice.instances[id]` now. Rewrite each to mutate the primary instance:
```js
// before
getState().ice.active = false;
// after
getPrimaryIce().active = false;
```

(Direct mutation in tests is a pre-existing pattern — we're preserving it.)

- [ ] **Step 2: Run full test suite**

```bash
make check
```
Expected: all tests PASS. Any remaining failures indicate a missed callsite.

- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m 'test: update ice assertions for instance collection

Part of session 1 (#92) caller migration.'
```

### Task 4.11 — verify callsite migration complete

- [ ] **Step 1: Grep should show only intended remaining references**

```bash
grep -rn 's\.ice\.' js/ scripts/ tests/ | grep -v 'instances' | grep -v '\.test\.js.' | head -20
```

Expected: zero hits, or only `s.ice.instances` references. Any other hits indicate a missed migration. Fix each.

- [ ] **Step 2: Run full check**

```bash
make check
```
Expected: PASS

- [ ] **Step 3: Run bot census as a regression gate**

```bash
make census SEEDS=20
```
Compare success rates / cash scores to a pre-migration baseline (captured as a comparison artifact in a previous session, or run against `main` first). Near-zero deviation expected.

---

## Phase 5 — Module skeleton and atom registries

Create `js/core/ice/` alongside existing `js/core/ice.js`. `ice.js` becomes
a re-export shim in Phase 6.

### Task 5.1: Create module skeleton

**Files:**
- Create: `js/core/ice/index.js`
- Create: `js/core/ice/registry.js`
- Create: `js/core/ice/atoms.js`
- Create: `js/core/ice/patterns/` (9 files)

- [ ] **Step 1: Create `js/core/ice/atoms.js` with empty registries**

```js
// @ts-check
// Atom registries for the data-driven ICE model.
// Each registry maps atom id → { id, schema, apply(instance, state, ctx, params) }.
// Session 1 ships 3 fully-wired effect atoms (raise-alert, damage-health,
// damage-deck); remaining atoms are dormant — their apply() throws until
// wired by a later session.

/** @type {Object<string, any>} */
export const TRIGGER_ATOMS = {};
/** @type {Object<string, any>} */
export const EFFECT_ATOMS = {};

export function registerTrigger(atom) {
  TRIGGER_ATOMS[atom.id] = atom;
}
export function registerEffect(atom) {
  EFFECT_ATOMS[atom.id] = atom;
}

export function getTrigger(id) { return TRIGGER_ATOMS[id] ?? null; }
export function getEffect(id)  { return EFFECT_ATOMS[id]  ?? null; }
```

- [ ] **Step 2: Create pattern files as stubs**

Create `js/core/ice/patterns/patrol-random.js`:
```js
// @ts-check
// Random-walk pattern — chooses a neighbor at random each tick.
// Matches pre-reinvention grade-D/F behavior.

import { RNG, randomPick } from "../../rng.js";

export const patrolRandom = {
  id: "patrol-random",
  onTick(instance, state) {
    const neighbors = (state.adjacency[instance.attentionNodeId] || [])
      .filter((n) => state.nodes[n]?.type !== "wan");
    if (neighbors.length === 0) return { nextAttention: null };
    return { nextAttention: randomPick(RNG.ICE, neighbors) };
  },
};
```

Create `js/core/ice/patterns/disturbance-tracker.js`:
```js
// @ts-check
// Tracks state.lastDisturbedNodeId using BFS to the first hop.
// Matches pre-reinvention grade-C/B behavior.

import { RNG, randomPick } from "../../rng.js";

function nextHopToward(src, dst, adjacency) {
  if (src === dst) return null;
  const visited = new Set([src]);
  const queue = [[src, null]];
  while (queue.length) {
    const [node, firstHop] = queue.shift();
    for (const neighbor of (adjacency[node] || [])) {
      const hop = firstHop ?? neighbor;
      if (neighbor === dst) return hop;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, hop]);
      }
    }
  }
  return null;
}

export const disturbanceTracker = {
  id: "disturbance-tracker",
  onTick(instance, state) {
    const neighbors = (state.adjacency[instance.attentionNodeId] || [])
      .filter((n) => state.nodes[n]?.type !== "wan");
    if (neighbors.length === 0) return { nextAttention: null };
    const target = state.lastDisturbedNodeId;
    const alreadyDetectedTarget = instance.detectedAtNode === target;
    if (target && target !== instance.attentionNodeId && !alreadyDetectedTarget) {
      const hop = nextHopToward(instance.attentionNodeId, target, state.adjacency)
        ?? randomPick(RNG.ICE, neighbors);
      return { nextAttention: hop };
    }
    return {
      nextAttention: randomPick(RNG.ICE, neighbors),
      arrivedAtDisturbanceTarget: target === instance.attentionNodeId,
    };
  },
};
```

Create `js/core/ice/patterns/player-hunter.js`:
```js
// @ts-check
// Player-hunter — pathfinds directly toward selectedNodeId when set.
// Matches pre-reinvention grade-A/S behavior.

import { RNG, randomPick } from "../../rng.js";

function nextHopToward(src, dst, adjacency) {
  if (src === dst) return null;
  const visited = new Set([src]);
  const queue = [[src, null]];
  while (queue.length) {
    const [node, firstHop] = queue.shift();
    for (const neighbor of (adjacency[node] || [])) {
      const hop = firstHop ?? neighbor;
      if (neighbor === dst) return hop;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, hop]);
      }
    }
  }
  return null;
}

export const playerHunter = {
  id: "player-hunter",
  onTick(instance, state) {
    const neighbors = (state.adjacency[instance.attentionNodeId] || [])
      .filter((n) => state.nodes[n]?.type !== "wan");
    if (neighbors.length === 0) return { nextAttention: null };
    const target = state.selectedNodeId;
    if (target && target !== instance.attentionNodeId) {
      const hop = nextHopToward(instance.attentionNodeId, target, state.adjacency)
        ?? randomPick(RNG.ICE, neighbors);
      return { nextAttention: hop };
    }
    return { nextAttention: randomPick(RNG.ICE, neighbors) };
  },
};
```

Create stub pattern files: `trap.js`, `patrol-route.js`, `sentry-radius.js`, `relocate-on-activate.js`, `player-avoid.js`, `freeze.js`. Each follows this template:
```js
// @ts-check
// <Pattern name> — <one-line description>. Stub for session 1; wired in session N.

export const <camelName> = {
  id: "<kebab-name>",
  onTick() {
    throw new Error("pattern '<kebab-name>' not yet implemented — wired in session <N>");
  },
};
```

Specifically:
- `trap.js` — session 2
- `patrol-route.js` — session 8
- `sentry-radius.js` — session 8
- `relocate-on-activate.js` — session 5
- `player-avoid.js` — session 5
- `freeze.js` — session 5

- [ ] **Step 3: Create `js/core/ice/registry.js`**

```js
// @ts-check
// Catalog of ICE type presets. Each entry combines a focus, a behavior
// pattern, a trigger list, and an effect list into a named type that
// procgen and network meta can reference.

/** @type {Object<string, any>} */
export const ICE_TYPES = {};

export function registerType(type) {
  ICE_TYPES[type.typeId] = type;
}

export function getType(typeId) {
  return ICE_TYPES[typeId] ?? null;
}

// Session-1 catalog: one preset per pre-reinvention grade, preserving the
// grade-based behavior of the old singleton so existing networks play
// identically after migration.

function classicFor(grade) {
  const pattern =
    grade === "D" || grade === "F" ? "patrol-random" :
    grade === "A" || grade === "S" ? "player-hunter" :
    "disturbance-tracker";
  return {
    typeId: `patrol-classic-${grade}`,
    focus: "roaming",
    behaviorPattern: pattern,
    grade,
    triggers: ["on-dwell-grade"],
    effects: [{ atom: "raise-alert", params: {} }],
  };
}

for (const grade of ["S", "A", "B", "C", "D", "F"]) {
  registerType(classicFor(grade));
}
```

- [ ] **Step 4: Create `js/core/ice/index.js`** (entry point; used by later phases)

```js
// @ts-check
export { EFFECT_ATOMS, TRIGGER_ATOMS, registerEffect, registerTrigger, getEffect, getTrigger } from "./atoms.js";
export { ICE_TYPES, registerType, getType } from "./registry.js";
```

- [ ] **Step 5: Lint**

```bash
make lint
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/core/ice/
git commit -m 'feat(ice): add js/core/ice/ module skeleton

Atom registries, pattern files (3 live, 6 stubs), type catalog with
session-1 classic presets. Not yet wired — runtime still uses js/core/ice.js.

Part of session 1 (#92).'
```

### Task 5.2: Pattern unit tests

**Files:**
- Create: `js/core/ice/patterns/patrol-random.test.js`
- Create: `js/core/ice/patterns/disturbance-tracker.test.js`
- Create: `js/core/ice/patterns/player-hunter.test.js`

- [ ] **Step 1: Write `patrol-random.test.js`**

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { patrolRandom } from "./patrol-random.js";
import { initRng } from "../../rng.js";

describe("pattern: patrol-random", () => {
  it("picks a WAN-excluded neighbor", () => {
    initRng("test-seed");
    const state = {
      adjacency: { a: ["b", "wan-1"] },
      nodes: { a: { type: "router" }, b: { type: "router" }, "wan-1": { type: "wan" } },
    };
    const result = patrolRandom.onTick({ attentionNodeId: "a" }, state);
    assert.equal(result.nextAttention, "b");
  });

  it("returns null nextAttention when no eligible neighbors", () => {
    const state = { adjacency: { a: ["wan-1"] }, nodes: { a: {}, "wan-1": { type: "wan" } } };
    const result = patrolRandom.onTick({ attentionNodeId: "a" }, state);
    assert.equal(result.nextAttention, null);
  });
});
```

- [ ] **Step 2: Write `disturbance-tracker.test.js`**

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { disturbanceTracker } from "./disturbance-tracker.js";
import { initRng } from "../../rng.js";

describe("pattern: disturbance-tracker", () => {
  it("pathfinds toward lastDisturbedNodeId", () => {
    initRng("test-seed");
    const state = {
      adjacency: { a: ["b"], b: ["a", "c"], c: ["b"] },
      nodes: { a: {}, b: {}, c: {} },
      lastDisturbedNodeId: "c",
    };
    const result = disturbanceTracker.onTick(
      { attentionNodeId: "a", detectedAtNode: null },
      state
    );
    assert.equal(result.nextAttention, "b");
  });

  it("signals arrival at disturbance target", () => {
    initRng("test-seed");
    const state = {
      adjacency: { c: ["b"] },
      nodes: { c: {}, b: {} },
      lastDisturbedNodeId: "c",
    };
    const result = disturbanceTracker.onTick(
      { attentionNodeId: "c", detectedAtNode: null },
      state
    );
    assert.ok(result.arrivedAtDisturbanceTarget);
  });
});
```

- [ ] **Step 3: Write `player-hunter.test.js`**

Same structural pattern — verify `selectedNodeId` is pursued via next-hop.

- [ ] **Step 4: Run tests**

```bash
node --test js/core/ice/patterns/
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/core/ice/patterns/
git commit -m 'test(ice): unit tests for live pattern atoms

Part of session 1 (#92).'
```

### Task 5.3: Stub pattern tests

**Files:**
- Create: `js/core/ice/patterns/stubs.test.js`

- [ ] **Step 1: Existence + throw test for each stub pattern**

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { trap } from "./trap.js";
import { patrolRoute } from "./patrol-route.js";
import { sentryRadius } from "./sentry-radius.js";
import { relocateOnActivate } from "./relocate-on-activate.js";
import { playerAvoid } from "./player-avoid.js";
import { freeze } from "./freeze.js";

const stubs = [trap, patrolRoute, sentryRadius, relocateOnActivate, playerAvoid, freeze];

describe("pattern: stubs (not-yet-implemented)", () => {
  for (const p of stubs) {
    it(`${p.id}: has stable id and throws on onTick()`, () => {
      assert.ok(p.id);
      assert.throws(() => p.onTick({}, {}), /not yet implemented/);
    });
  }
});
```

- [ ] **Step 2: Run tests**

```bash
node --test js/core/ice/patterns/stubs.test.js
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add js/core/ice/patterns/stubs.test.js
git commit -m 'test(ice): existence tests for stub pattern atoms

Part of session 1 (#92).'
```

---

## Phase 6 — Effect atoms (live and dormant)

### Task 6.1: `raise-alert` effect atom

**Files:**
- Modify: `js/core/ice/atoms.js`
- Create: `js/core/ice/atoms.test.js`

- [ ] **Step 1: Write failing test**

In `js/core/ice/atoms.test.js`:
```js
// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getEffect, EFFECT_ATOMS } from "./atoms.js";
import "./effects.js"; // registers side-effectfully

describe("atom: raise-alert", () => {
  beforeEach(() => {
    // effects.js registration is idempotent
  });

  it("is registered with id 'raise-alert'", () => {
    const atom = getEffect("raise-alert");
    assert.ok(atom);
    assert.equal(atom.id, "raise-alert");
  });

  it("apply() invokes propagateAlertEvent when given a host node", () => {
    const atom = getEffect("raise-alert");
    const calls = [];
    const ctx = { propagateAlertEvent: (nodeId) => calls.push(nodeId) };
    const instance = { id: "ice-1", hostNodeId: "host-1", attentionNodeId: "host-1" };
    atom.apply(instance, {}, ctx);
    assert.deepEqual(calls, ["host-1"]);
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

```bash
node --test js/core/ice/atoms.test.js
```
Expected: FAIL — `effects.js` doesn't exist yet.

- [ ] **Step 3: Create `js/core/ice/effects.js`** (effect atom definitions, registered at import time)

```js
// @ts-check
// Effect atom definitions. Imported for side-effect registration.

import { registerEffect } from "./atoms.js";

registerEffect({
  id: "raise-alert",
  schema: { amount: "number" },
  /**
   * @param {import('../types.js').IceInstance} instance
   * @param {import('../types.js').GameState} state
   * @param {{ propagateAlertEvent: (nodeId: string) => void }} ctx
   */
  apply(instance, state, ctx) {
    // Preserves pre-reinvention behavior: alert propagates from the ICE's
    // current attention node (where it would have detected the player).
    ctx.propagateAlertEvent(instance.attentionNodeId);
  },
});
```

- [ ] **Step 4: Verify test passes**

```bash
node --test js/core/ice/atoms.test.js
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/core/ice/effects.js js/core/ice/atoms.test.js
git commit -m 'feat(ice): raise-alert effect atom

First fully-wired effect, preserves pre-reinvention alert propagation.
Part of session 1 (#92).'
```

### Task 6.2: `damage-health` effect atom

**Files:**
- Modify: `js/core/ice/effects.js`
- Modify: `js/core/ice/atoms.test.js`

- [ ] **Step 1: Write failing test**

Append to `atoms.test.js`:
```js
describe("atom: damage-health", () => {
  it("is registered with id 'damage-health'", () => {
    const atom = getEffect("damage-health");
    assert.ok(atom);
  });

  it("apply() calls ctx.damagePlayerHealth with params.amount", () => {
    const atom = getEffect("damage-health");
    const calls = [];
    const ctx = { damagePlayerHealth: (n) => calls.push(n) };
    atom.apply({}, {}, ctx, { amount: 15 });
    assert.deepEqual(calls, [15]);
  });
});
```

- [ ] **Step 2: Add the atom**

Append to `js/core/ice/effects.js`:
```js
registerEffect({
  id: "damage-health",
  schema: { amount: "number" },
  /**
   * @param {import('../types.js').IceInstance} instance
   * @param {import('../types.js').GameState} state
   * @param {{ damagePlayerHealth: (n: number) => void }} ctx
   * @param {{ amount: number }} params
   */
  apply(instance, state, ctx, params) {
    ctx.damagePlayerHealth(params.amount);
  },
});
```

- [ ] **Step 3: Verify test passes**

```bash
node --test js/core/ice/atoms.test.js
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/core/ice/effects.js js/core/ice/atoms.test.js
git commit -m 'feat(ice): damage-health effect atom

Part of session 1 (#92).'
```

### Task 6.3: `damage-deck` effect atom

**Files:**
- Modify: `js/core/ice/effects.js`
- Modify: `js/core/ice/atoms.test.js`

- [ ] **Step 1: Write failing test**

Append to `atoms.test.js`:
```js
describe("atom: damage-deck", () => {
  it("is registered with id 'damage-deck'", () => {
    const atom = getEffect("damage-deck");
    assert.ok(atom);
  });

  it("apply() calls ctx.damagePlayerDeck with params.amount", () => {
    const atom = getEffect("damage-deck");
    const calls = [];
    const ctx = { damagePlayerDeck: (n) => calls.push(n) };
    atom.apply({}, {}, ctx, { amount: 8 });
    assert.deepEqual(calls, [8]);
  });
});
```

- [ ] **Step 2: Add the atom**

Append to `js/core/ice/effects.js`:
```js
registerEffect({
  id: "damage-deck",
  schema: { amount: "number" },
  /**
   * @param {import('../types.js').IceInstance} instance
   * @param {import('../types.js').GameState} state
   * @param {{ damagePlayerDeck: (n: number) => void }} ctx
   * @param {{ amount: number }} params
   */
  apply(instance, state, ctx, params) {
    ctx.damagePlayerDeck(params.amount);
  },
});
```

- [ ] **Step 3: Verify test passes**

```bash
node --test js/core/ice/atoms.test.js
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/core/ice/effects.js js/core/ice/atoms.test.js
git commit -m 'feat(ice): damage-deck effect atom

Part of session 1 (#92).'
```

### Task 6.4: Dormant effect atom stubs

**Files:**
- Modify: `js/core/ice/effects.js`
- Modify: `js/core/ice/atoms.test.js`

Session 1 registers remaining effect atom ids with schemas. Each `apply()`
throws with a clear message naming the home session.

- [ ] **Step 1: Add stub registrations**

At the bottom of `js/core/ice/effects.js`, add:
```js
// Dormant atoms — registered for discoverability; apply() throws.
// Each is wired by its home session (see docs/dev-sessions/2026-04-24-1243-ice-reinvention/spec.md §10).

const DORMANT = [
  { id: "start-trace",                 session: 4, schema: {} },
  { id: "steal-cash",                  session: 3, schema: { amount: "number", stashSelector: "string" } },
  { id: "destroy-macguffin",           session: 4, schema: { selector: "string" } },
  { id: "relocate-macguffin",          session: 4, schema: { selector: "string", toSelector: "string" } },
  { id: "shred-card",                  session: 3, schema: { selector: "string" } },
  { id: "degrade-card",                session: 3, schema: { selector: "string", steps: "number" } },
  { id: "steal-card",                  session: 3, schema: { selector: "string", stashSelector: "string" } },
  { id: "lock-node",                   session: 4, schema: { target: "string" } },
  { id: "patch-vulns",                 session: 4, schema: { target: "string" } },
  { id: "force-reboot",                session: 4, schema: { target: "string" } },
  { id: "deselect-player",             session: 4, schema: {} },
  { id: "cancel-action",               session: 4, schema: { kind: "string?" } },
  { id: "accelerate",                  session: 5, schema: { factor: "number", duration: "number" } },
  { id: "broadcast-alert-adjacent",    session: 5, schema: { amount: "number" } },
];

for (const d of DORMANT) {
  registerEffect({
    id: d.id,
    schema: d.schema,
    apply() {
      throw new Error(`effect atom '${d.id}' not yet implemented — wired in session ${d.session}`);
    },
  });
}
```

- [ ] **Step 2: Existence tests for all dormant atoms**

Append to `atoms.test.js`:
```js
describe("dormant effect atoms: registered with id + schema, apply() throws", () => {
  const dormantIds = [
    "start-trace", "steal-cash", "destroy-macguffin", "relocate-macguffin",
    "shred-card", "degrade-card", "steal-card", "lock-node", "patch-vulns",
    "force-reboot", "deselect-player", "cancel-action", "accelerate",
    "broadcast-alert-adjacent",
  ];
  for (const id of dormantIds) {
    it(`${id}: registered with id + schema, apply throws`, () => {
      const atom = getEffect(id);
      assert.ok(atom, `${id} must be registered`);
      assert.equal(atom.id, id);
      assert.ok(atom.schema, `${id} must have a schema`);
      assert.throws(() => atom.apply({}, {}, {}, {}), /not yet implemented/);
    });
  }
});
```

- [ ] **Step 3: Run tests**

```bash
node --test js/core/ice/atoms.test.js
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/core/ice/effects.js js/core/ice/atoms.test.js
git commit -m 'feat(ice): register dormant effect atoms with throwing apply()

Each atom has a schema and a documented home session for when its body
lands. Part of session 1 (#92).'
```

### Task 6.5: Trigger atoms (one live, rest dormant)

**Files:**
- Create: `js/core/ice/triggers.js`
- Modify: `js/core/ice/atoms.test.js`

Session 1 ships one live trigger: `on-dwell-grade` (reproduces pre-reinvention dwell behavior). Others are dormant stubs.

- [ ] **Step 1: Create `js/core/ice/triggers.js`**

```js
// @ts-check
import { registerTrigger } from "./atoms.js";

// Live trigger: on-dwell-grade
// Fires when an ICE has dwelled on its attention node long enough; the
// dwell-time constant is grade-keyed (preserves pre-reinvention tuning).

registerTrigger({
  id: "on-dwell-grade",
  schema: {},
  /**
   * @param {import('../types.js').IceInstance} instance
   * @param {import('../types.js').GameState} state
   */
  test(instance, state, ctx) {
    return ctx.hasDwellExpired(instance);
  },
});

const DORMANT_TRIGGERS = [
  { id: "on-select",                session: 2, schema: {} },
  { id: "on-probe",                 session: 2, schema: {} },
  { id: "on-exploit",               session: 2, schema: {} },
  { id: "on-exploit-fail",          session: 2, schema: {} },
  { id: "on-dump",                  session: 2, schema: {} },
  { id: "on-fetch",                 session: 2, schema: {} },
  { id: "on-dwell-N-ticks",         session: 2, schema: { ticks: "number" } },
  { id: "on-detect-presence",       session: 2, schema: {} },
];

for (const d of DORMANT_TRIGGERS) {
  registerTrigger({
    id: d.id,
    schema: d.schema,
    test() {
      throw new Error(`trigger atom '${d.id}' not yet implemented — wired in session ${d.session}`);
    },
  });
}
```

- [ ] **Step 2: Existence tests**

Append to `atoms.test.js`:
```js
import { getTrigger } from "./atoms.js";
import "./triggers.js"; // registers side-effectfully

describe("trigger atoms", () => {
  it("on-dwell-grade is live and calls ctx.hasDwellExpired", () => {
    const t = getTrigger("on-dwell-grade");
    let seen;
    const ctx = { hasDwellExpired: (i) => { seen = i; return true; } };
    assert.equal(t.test({ id: "x" }, {}, ctx), true);
    assert.deepEqual(seen, { id: "x" });
  });

  const dormantIds = [
    "on-select", "on-probe", "on-exploit", "on-exploit-fail",
    "on-dump", "on-fetch", "on-dwell-N-ticks", "on-detect-presence",
  ];
  for (const id of dormantIds) {
    it(`${id}: registered with id + schema, test() throws`, () => {
      const t = getTrigger(id);
      assert.ok(t);
      assert.ok(t.schema);
      assert.throws(() => t.test({}, {}, {}), /not yet implemented/);
    });
  }
});
```

- [ ] **Step 3: Run tests**

```bash
node --test js/core/ice/atoms.test.js
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/core/ice/triggers.js js/core/ice/atoms.test.js
git commit -m 'feat(ice): trigger atom registry (one live, rest dormant)

Part of session 1 (#92).'
```

---

## Phase 7 — Runtime split

Move the per-tick dispatch logic from `js/core/ice.js` into `js/core/ice/runtime.js`.
`ice.js` becomes a re-export shim so existing imports continue to work.

### Task 7.1: Create `js/core/ice/runtime.js` with dispatch

**Files:**
- Create: `js/core/ice/runtime.js`
- Modify: `js/core/ice.js` (shrink to re-exports)

- [ ] **Step 1: Copy current `js/core/ice.js` contents into `js/core/ice/runtime.js`**

Keep all current behavior. Imports from `../state/ice.js` stay one level up; fix paths:
```js
import { getState } from "../state.js";
import { setIceAttention, setIceDetectedAt, ... } from "../state/ice.js";
```

Do **not** yet change the dispatcher to iterate instances — that's Task 7.2.
Just relocate.

- [ ] **Step 2: Rewrite `js/core/ice.js` as a re-export shim**

```js
// @ts-check
// Re-export surface for backward compatibility during the ICE reinvention
// migration. All runtime logic lives in js/core/ice/runtime.js.

export {
  startIce, stopIce, initIceHandlers,
  handleIceTick, handleIceDetect, cancelIceDwell,
  teleportIce, ejectIce, disableIce, rebootIce,
} from "./ice/runtime.js";
```

- [ ] **Step 3: Run full check**

```bash
make check
```
Expected: PASS — nothing functional changed, just relocation.

- [ ] **Step 4: Commit**

```bash
git add js/core/ice.js js/core/ice/runtime.js
git commit -m 'refactor(ice): relocate runtime logic to js/core/ice/runtime.js

ice.js becomes a re-export shim. Behavior unchanged. Part of session 1 (#92).'
```

### Task 7.2: Iterate `state.ice.instances` in the dispatcher

**Files:**
- Modify: `js/core/ice/runtime.js`

- [ ] **Step 1: Write a failing test**

Append to `tests/integration.test.js` a new describe block for multi-instance:
```js
describe("ice runtime: iterates all active instances", () => {
  beforeEach(() => { clearHandlers(); clearAll(); });

  it("two instances both move on a tick", () => {
    // Build a LAN with manually-added second instance
    initGame(() => buildBasicLAN({ ice: { grade: "D", startNode: "router-a" } }));
    const s = getState();
    // Inject a second instance directly into the collection
    s.ice.instances["ice-2"] = {
      id: "ice-2",
      typeId: "patrol-classic-D",
      hostNodeId: "gateway",
      attentionNodeId: "gateway",
      active: true, enabled: true,
      grade: "D",
      focus: "roaming",
      behaviorPattern: "patrol-random",
      dwellTimerId: null, detectedAtNode: null, detectionCount: 0,
    };
    startIce();
    // Advance one ice-move tick
    tick(MOVE_INTERVALS_D_MS);
    // Both instances should have moved (or at least been visited by the dispatcher)
    const inst1 = s.ice.instances["ice-1"];
    const inst2 = s.ice.instances["ice-2"];
    // In a simple 2-node LAN, attention must flip for each
    assert.notEqual(inst1.attentionNodeId, "router-a"); // moved from origin
    assert.notEqual(inst2.attentionNodeId, "gateway");
  });
});
```

(Where `MOVE_INTERVALS_D_MS = 12000` matches the D-grade interval.)

- [ ] **Step 2: Run test, expect failure**

```bash
node --test tests/integration.test.js
```
Expected: FAIL — dispatcher only moves the primary instance.

- [ ] **Step 3: Update `handleIceTick` in runtime.js to iterate instances**

```js
export function handleIceTick() {
  const s = getState();
  if (s.phase !== "playing") return;
  const instances = Object.values(s.ice?.instances ?? {});
  for (const instance of instances) {
    if (!instance.active) continue;
    moveInstance(instance);
  }
}

function moveInstance(instance) {
  // Body of the former handleIceTick goes here, parameterized by `instance`.
  // Replaces the singleton's grade/attentionNodeId fields with instance.X.
}
```

Also update `checkIceDetection`, `triggerDetection`, `cancelIceDwell`, `teleportIce`, `ejectIce`, `rebootIce`, `disableIce`, and `startIce` to iterate instances where plural semantics apply (e.g. `startIce` schedules one `ICE_MOVE` timer tick — still fine — but the tick now moves every instance; `ejectIce` currently receives no args and ejects the primary instance — keep that behavior but document that later sessions parameterize by `iceId`).

- [ ] **Step 4: Run tests**

```bash
make check
```
Expected: PASS including the new multi-instance test.

- [ ] **Step 5: Commit**

```bash
git add js/core/ice/runtime.js tests/integration.test.js
git commit -m 'refactor(ice): runtime dispatcher iterates state.ice.instances

Single-instance behavior preserved for the 1-instance-per-LAN case;
multi-instance networks are now supported by the runtime.
Part of session 1 (#92).'
```

---

## Phase 8 — `iceId` threading on events

Existing ICE events (`ICE_MOVED`, `ICE_EJECTED`, `ICE_REBOOTED`,
`ICE_DETECTED`, `ICE_DETECT_PENDING`, `ICE_DISABLED`) gain an `iceId` field
so listeners can disambiguate when multiple instances exist.

### Task 8.1: Add `iceId` to every ICE event emission

**Files:**
- Modify: `js/core/ice/runtime.js`
- Modify: `js/core/alert.js` (emits `ICE_DETECTED` indirectly via `propagateAlertEvent`)

- [ ] **Step 1: Write a failing test**

Append to `tests/integration.test.js`:
```js
describe("ice events: iceId in payload", () => {
  beforeEach(() => { clearHandlers(); clearAll(); });

  it("ICE_MOVED payload carries iceId", () => {
    initGame(() => buildIceLAN({ grade: "D" }));
    startIce();
    const payloads = withEvents(E.ICE_MOVED, () => {
      tick(12000);
    });
    assert.ok(payloads.length > 0);
    assert.ok(payloads[0].iceId);
  });

  it("ICE_DETECTED payload carries iceId", () => {
    initGame(() => buildIceLAN({ grade: "S" })); // S grade → short dwell, quick detection
    navigateTo("router-a");
    teleportIce("router-a");
    const payloads = withEvents(E.ICE_DETECTED, () => tick(2000));
    assert.ok(payloads[0]?.iceId);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
node --test tests/integration.test.js
```
Expected: FAIL — `iceId` is not yet in the payload.

- [ ] **Step 3: Add `iceId` to every emission site in runtime.js**

Search for `emitEvent(E.ICE_` in `js/core/ice/runtime.js`:
```bash
grep -n 'emitEvent(E\.ICE_' js/core/ice/runtime.js
```

For each, add `iceId: instance.id` to the payload object.

Example:
```js
// before
emitEvent(E.ICE_MOVED, { fromId, toId: nextNode, fromLabel, toLabel, fromVisible, toVisible });
// after
emitEvent(E.ICE_MOVED, { iceId: instance.id, fromId, toId: nextNode, fromLabel, toLabel, fromVisible, toVisible });
```

Apply to `ICE_EJECTED`, `ICE_REBOOTED`, `ICE_DETECTED`, `ICE_DETECT_PENDING`, `ICE_DISABLED`.

Also check `js/core/alert.js` for any ICE-detection emits — add `iceId` where relevant (the detection record).

- [ ] **Step 4: Update downstream listeners that rely on event payloads**

Grep for `E.ICE_` listeners:
```bash
grep -rn 'on(E\.ICE_' js/
```

Visual and log renderers are the main consumers. Update any destructuring to include `iceId` if they need it now (most don't; passive compatibility is fine — extra fields are ignored by destructuring patterns without that field).

- [ ] **Step 5: Run tests**

```bash
make check
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/core/ice/runtime.js js/core/alert.js tests/integration.test.js
git commit -m 'feat(events): thread iceId through all ICE event payloads

Enables listeners to disambiguate when multiple instances exist.
Part of session 1 (#92).'
```

---

## Phase 9 — Serialization round-trip test

### Task 9.1: Multi-instance serialization integration test

**Files:**
- Create: `tests/ice-serialization.test.js`

- [ ] **Step 1: Write the test**

```js
// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";
import { clearAll } from "../js/core/timers.js";
import { getPrimaryIce } from "../js/core/state/ice.js";

describe("ice: multi-instance serialization round-trip", () => {
  beforeEach(() => { clearAll(); });

  it("round-trips a collection with multiple instances", () => {
    initGame(() => buildCorporateExchange());
    const s = getState();
    // Inject second and third instances directly
    s.ice.instances["ice-2"] = {
      id: "ice-2", typeId: "patrol-classic-D", hostNodeId: "gateway",
      attentionNodeId: "gateway", active: true, enabled: true,
      grade: "D", focus: "roaming", behaviorPattern: "patrol-random",
      dwellTimerId: null, detectedAtNode: null, detectionCount: 0,
    };
    s.ice.instances["ice-3"] = {
      ...s.ice.instances["ice-2"], id: "ice-3", active: false, enabled: false,
    };
    const snap = JSON.parse(JSON.stringify(serializeState()));
    // Reset and reinit to prove the reload builds the same state
    clearAll();
    initGame(() => buildCorporateExchange());
    deserializeState(snap);
    const rehydrated = getState();
    assert.equal(Object.keys(rehydrated.ice.instances).length, 3);
    assert.equal(rehydrated.ice.instances["ice-2"].hostNodeId, "gateway");
    assert.equal(rehydrated.ice.instances["ice-3"].active, false);
    assert.ok(getPrimaryIce()?.active);
  });
});
```

- [ ] **Step 2: Run test**

```bash
node --test tests/ice-serialization.test.js
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/ice-serialization.test.js
git commit -m 'test: multi-instance ice serialization round-trip

Verifies state.ice.instances round-trips through save/load with
mixed active/inactive entries. Part of session 1 (#92).'
```

---

## Phase 10 — Bot census regression gate + wrap-up

### Task 10.1: Baseline bot census on main, then ours

**Files:** no code changes — this is a regression assertion.

- [ ] **Step 1: Run the census on the session branch**

```bash
make census SEEDS=50
```

Capture the output (success rate, average cash, median ticks) and paste into session `notes.md`.

- [ ] **Step 2: Compare against main**

Quick comparison:
```bash
git stash
git checkout main
make census SEEDS=50
# paste output
git checkout ice-reinvention-session-1
git stash pop
```

- [ ] **Step 3: Record the diff in `docs/dev-sessions/2026-04-24-1243-ice-reinvention/notes.md`**

Expected: success rate within ±2%, median ticks within ±5%. Anything larger indicates an accidental behavior regression; investigate before merging.

- [ ] **Step 4: Commit notes**

```bash
git add docs/dev-sessions/2026-04-24-1243-ice-reinvention/notes.md
git commit -m 'docs(session-1): bot census regression comparison notes

Part of session 1 (#92).'
```

### Task 10.2: Docs touch-up

**Files:**
- Modify: `docs/ICE.md` — note session 1 is in flight, architecture landed
- Modify: `docs/dev-sessions/2026-04-24-1243-ice-reinvention/notes.md`

- [ ] **Step 1: Add a "Session 1 landed" stub line** at the top of `docs/ICE.md` if appropriate, or leave as-is (the paradigm doc describes the target state, which is unchanged regardless of whether session 1 has merged).

Decision: **leave `docs/ICE.md` untouched** — it describes the full paradigm which is the north star; session 1 doesn't change the documented interface.

- [ ] **Step 2: Finalize session notes**

Append final summary to `notes.md`:
```md
## Session 1 summary

**Outcome:** ICE architecture rebuild landed. State shape migrated to
`s.ice.instances`; module split at `js/core/ice/` in place; atom registries
seeded (3 live effects, 1 live trigger; dormant atoms stubbed with clear
home-session attribution); player HP + deck integrity pools added with
`burned`/`bricked` outcomes. Bot census near-zero deviation from main.

**Follow-ups opened or confirmed:**
- Sessions 2–8 and backlog issues #100–#106 already filed.
- No unanticipated follow-ups from this session.
```

- [ ] **Step 3: Commit + push**

```bash
git add docs/dev-sessions/2026-04-24-1243-ice-reinvention/notes.md
git commit -m 'docs(session-1): finalize session notes

Part of session 1 (#92).'
git push -u origin ice-reinvention-session-1
```

### Task 10.3: Open PR for #92

- [ ] **Step 1: Create PR with test plan**

```bash
gh pr create --repo lmorchard/starnet \
  --base main --head ice-reinvention-session-1 \
  --title "ICE reinvention session 1: architecture rebuild" \
  --body "$(cat <<'EOF'
## Summary

- `s.ice` singleton migrated to `s.ice.instances` keyed by id
- `js/core/ice/` module split (registry, atoms, runtime, patterns/)
- 3 live effect atoms (raise-alert, damage-health, damage-deck), 1 live trigger (on-dwell-grade); remaining atoms stubbed with throwing `apply()` and a named home session
- `PlayerState` gains `health` + `deckIntegrity` pools; new run outcomes `burned`/`bricked` end the run on 0
- Every ICE event payload carries `iceId`
- Serialization round-trips the collection
- Bot census within 2% of main (see notes.md)

Closes #92. Foundation for sessions 2–8 (#93–#99).

## Test plan
- [ ] `make check` passes
- [ ] `make census SEEDS=50` within 2% of baseline
- [ ] Manually smoke-test in browser: load a network, play through one run
- [ ] Verify `node scripts/playtest.js reset` + `status ice` show `ice-1 [patrol-classic-<grade>]` line

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist (run after the plan is fully executed)

Run each item before requesting PR review:

- [ ] `grep -rn 's\.ice\.' js/ scripts/ tests/ | grep -v instances | grep -v '\.test\.js'` returns zero lines
- [ ] `make check` green
- [ ] `make census SEEDS=50` within 2% of main baseline
- [ ] `tests/ice-serialization.test.js` and `js/core/ice/atoms.test.js` present and passing
- [ ] `js/core/ice/patterns/` has 9 pattern files (3 live, 6 stub)
- [ ] `js/core/ice.js` is ≤ 20 lines (pure re-export)
- [ ] `PlayerState.health` and `PlayerState.deckIntegrity` present in types.js
- [ ] `E.ICE_INSTALLED`, `E.ICE_REVEALED`, `E.ICE_ACTIVATED`, `E.ICE_EFFECT_APPLIED`, `E.ICE_HACKED`, `E.ICE_STASH_DEPOSITED` present in events.js
- [ ] `RunOutcome` typedef includes `burned` and `bricked`
- [ ] Session notes saved to `docs/dev-sessions/2026-04-24-1243-ice-reinvention/notes.md`
- [ ] PR opened and references #92

---

## Risks and mitigations

- **Hidden callsites.** `grep` may miss a callsite in dynamic code (e.g. cheat command handlers). Mitigation: bot census as regression gate + manual browser smoke test. Both catch behavior regressions even when grep misses a reference.
- **Pattern file explosion.** 9 files for patterns when only 3 are live may feel like over-engineering. Mitigation: the stubs are 5 lines each and serve as a self-documenting map of what's coming. Deleting and re-adding them in each home session would be churn.
- **Bot census deviation > 2%.** Most likely cause: an accidental difference in pattern selection (grade → pattern map). Mitigation: diff the grade-to-pattern logic between `js/core/ice/registry.js#classicFor` and the old `js/core/ice.js` tick logic; they should produce identical movement for identical seeds.
- **TDD test cycle on state/index.js ↔ state/player.js imports.** The `endRun` import cycle should work because of ESM late-binding of function exports, but if a test file imports both and observes an undefined binding, resolve by hoisting the check into a wrapper function called *inside* the mutator rather than at module-top-level.
