# Cascade Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the node-graph a first-class cascade capability — entity-injected, TTL-bounded, gate-gated propagating behaviors — add a runtime `attachBehavior` API, prove it with a hostile downgrade demo, and move SWEEP onto the substrate.

**Architecture:** A pure `cascade` operator adds hop-limited (TTL) propagation to the existing relay/message model (forwarding on the operator `outgoing` path so the cycle-guard terminates it). `attachBehavior` appends registered operator configs to a live node (participation + serialization fall out for free). SWEEP keeps its `processes.js` record for identity/abort/busy (coexist — the dissolve is deferred to #288), but its stimulus becomes a graph `sweep-pulse` message and its propagation moves onto per-node probe-completion forwarding; the wave-batching frontier recursion is deleted and `step()` slims to a liveness watcher.

**Tech Stack:** Vanilla JS ES modules, JSDoc `@ts-check` (no build step), `node --test` (see `tests/` and `js/core/**/*.test.js`), Makefile targets `make lint` / `make test` / `make check` / `make census`.

## Global Constraints

- **Coexist with `processes.js` — do NOT touch its record contract or any busy/abort surface** (`state.processes`, `activeProcessOnNode`, `abortNodeProcesses`, `PROCESS_*` events, `isNodeBusy`). #187 is building on it live. (spec §Decision)
- **Vanilla JS + JSDoc `@ts-check`.** No new npm deps. `make lint` (tsc, no emit) must pass.
- **Test honesty (CLAUDE.md):** assert observable consequences, not intermediate attributes; trace the full signal path; no manual state resets mid-scenario.
- **Always pass an explicit seed to `initGame()` in tests** (issue #109).
- **Three parallel entry points** (`js/main.js`, `scripts/playtest.js`, `scripts/bot/cli.js`) share timer/dispatch wiring — SWEEP must still run in the playtest harness and the bot after the cutover.
- **Ragged waves are acceptable** (each branch advances at its own probe-speed); synchronization is not required (spec §Ragged vs synchronized).
- **`make check` green** at the end of every task; commit per task.

---

### Task 1: The `cascade` operator (TTL-bounded propagation)

**Files:**
- Modify: `js/core/node-graph/operators.js` (register `cascade` near `relay`, ~line 122)
- Test: `tests/cascade.test.js` (create)

**Interfaces:**
- Produces: an operator registered as `"cascade"`. Config: `{ name: "cascade", kind?: string }` (`kind` defaults to `"pulse"` — the message type it propagates). Reads `message.payload.ttl` (integer) and `message.payload.source` (string). Forwards `{ type: kind, payload: { ...payload, ttl: ttl-1 } }` on the `outgoing` path while `ttl > 1` and `attrs.forwardingEnabled !== false`. Terminates at `ttl <= 1` or a shut gate.

- [ ] **Step 1: Write the failing test**

Create `tests/cascade.test.js`:

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "../js/core/node-graph/runtime.js";

// Topology: origin — a — b — c, with a branch b — d
const EDGES = [["origin", "a"], ["a", "b"], ["b", "c"], ["b", "d"]];
const mkNodes = (extra = () => ({})) =>
  ["origin", "a", "b", "c", "d"].map((id) => ({
    id, type: "host",
    attributes: { forwardingEnabled: true, ...extra(id) },
    operators: [{ name: "cascade", kind: "pulse" }],
  }));

/** Count non-tick deliveries per node via the onEvent hook. */
function tracker() {
  const hits = {};
  return {
    onEvent: (type, p) => {
      if (type === "message-delivered" && p.message?.type !== "tick")
        hits[p.nodeId] = (hits[p.nodeId] ?? 0) + 1;
    },
    hits,
  };
}

describe("cascade operator — TTL-bounded propagation", () => {
  it("propagates to depth = ttl-1 and stops", () => {
    const t = tracker();
    const g = new NodeGraph({ nodes: mkNodes(), edges: EDGES }, undefined, t.onEvent);
    g.init();
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    // ttl:3 → origin(entry) forwards ttl2 to a, a forwards ttl1 to b, b stops (ttl-1 <= 1).
    assert.ok(t.hits["a"] >= 1, "a reached");
    assert.ok(t.hits["b"] >= 1, "b reached");
    assert.equal(t.hits["c"] ?? 0, 0, "c beyond depth is NOT reached");
    assert.equal(t.hits["d"] ?? 0, 0, "d beyond depth is NOT reached");
  });

  it("a shut gate (forwardingEnabled:false) blocks propagation past it", () => {
    const t = tracker();
    const nodes = mkNodes((id) => (id === "b" ? { forwardingEnabled: false } : {}));
    const g = new NodeGraph({ nodes, edges: EDGES }, undefined, t.onEvent);
    g.init();
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 9, source: "player" } });
    assert.ok(t.hits["b"] >= 1, "b received the pulse");
    assert.equal(t.hits["c"] ?? 0, 0, "c behind the shut gate is untouched");
  });

  it("carries the source attribution forward", () => {
    let seenAtA = null;
    const g = new NodeGraph({ nodes: mkNodes(), edges: EDGES }, undefined, (type, p) => {
      if (type === "message-delivered" && p.nodeId === "a" && p.message?.type === "pulse")
        seenAtA = p.message.payload.source;
    });
    g.init();
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "ice:hunter-1" } });
    assert.equal(seenAtA, "ice:hunter-1", "source rides through the hop");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cascade.test.js`
Expected: FAIL with `Unknown operator: "cascade"`.

- [ ] **Step 3: Implement the operator**

In `js/core/node-graph/operators.js`, add after the `relay` operator (after line 122):

```js
/**
 * cascade — relay with a hop limit. Forwards its `kind` message to connected nodes with a
 * decremented TTL, carrying the payload (source, etc.) forward on the operator `outgoing` path
 * (which preserves message.path, so the cycle-guard terminates the cascade). Gated by
 * forwardingEnabled (a shut gate stops it); terminates when ttl reaches 1.
 * Config: { kind?: string }  — message type to propagate (default "pulse").
 */
registerOperator("cascade", (config, attrs, message, _ctx) => {
  const kind = config.kind ?? "pulse";
  if (!message || message.type !== kind) return {};
  if (attrs.forwardingEnabled === false) return {};
  const ttl = (message.payload?.ttl ?? 0) - 1;
  if (ttl <= 0) return {};
  return { outgoing: [{ type: kind, payload: { ...message.payload, ttl } }] };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cascade.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/core/node-graph/operators.js tests/cascade.test.js
git commit -m 'Cascade substrate: TTL-bounded cascade operator (#286)'
```

---

### Task 2: `attachBehavior` / `detachBehavior` runtime API (G6)

**Files:**
- Modify: `js/core/node-graph/runtime.js` (add methods in the Public API section, after `setNodeAttr`, ~line 199)
- Test: `tests/cascade.test.js` (append a describe block)

**Interfaces:**
- Consumes: the `cascade` operator from Task 1.
- Produces: `NodeGraph.attachBehavior(nodeId, operatorConfig)` — appends a registered operator config to a live node; participates immediately. `NodeGraph.detachBehavior(nodeId, operatorName)` — removes all operators whose `name === operatorName`. Both survive `snapshot()`/`fromSnapshot()` because `node.operators` is already serialized.

- [ ] **Step 1: Write the failing test**

Append to `tests/cascade.test.js`:

```js
describe("attachBehavior — runtime-equipped behaviors", () => {
  const EDGES2 = [["origin", "a"], ["a", "b"], ["b", "c"], ["b", "d"]];
  const plainNodes = () =>
    ["origin", "a", "b", "c", "d"].map((id) => ({
      id, type: "host", attributes: { forwardingEnabled: true }, operators: [],
    }));

  it("a behavior attached at runtime participates immediately", () => {
    const t = tracker();
    const g = new NodeGraph({ nodes: plainNodes(), edges: EDGES2 }, undefined, t.onEvent);
    g.init();
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    assert.equal(t.hits["a"] ?? 0, 0, "no behavior yet → nothing propagates");
    for (const id of g.getNodeIds()) g.attachBehavior(id, { name: "cascade", kind: "pulse" });
    const t2 = tracker();
    g._onEvent = t2.onEvent; // re-point instrumentation
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    assert.ok(t2.hits["a"] >= 1, "attached cascade now propagates");
  });

  it("an attached behavior survives snapshot → fromSnapshot", () => {
    const g = new NodeGraph({ nodes: plainNodes(), edges: EDGES2 }, undefined, () => {});
    g.init();
    for (const id of g.getNodeIds()) g.attachBehavior(id, { name: "cascade", kind: "pulse" });
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    const t = tracker();
    const g2 = NodeGraph.fromSnapshot(snap, undefined, t.onEvent);
    g2.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    assert.ok(t.hits["a"] >= 1, "behavior persisted across reload");
  });

  it("detachBehavior stops participation", () => {
    const t = tracker();
    const g = new NodeGraph({ nodes: plainNodes(), edges: EDGES2 }, undefined, t.onEvent);
    g.init();
    for (const id of g.getNodeIds()) g.attachBehavior(id, { name: "cascade", kind: "pulse" });
    for (const id of g.getNodeIds()) g.detachBehavior(id, "cascade");
    const t2 = tracker();
    g._onEvent = t2.onEvent;
    g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
    assert.equal(t2.hits["a"] ?? 0, 0, "detached → no propagation");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cascade.test.js`
Expected: FAIL with `g.attachBehavior is not a function`.

- [ ] **Step 3: Implement the methods**

In `js/core/node-graph/runtime.js`, after `setNodeAttr` (line 199), add:

```js
  /**
   * Attach a behavior (a registered operator config) to a live node at runtime.
   * The operator participates in subsequent deliveries and is serialized by snapshot().
   * Foundation for the RAM loadout (player-equipped behaviors).
   * @param {string} nodeId
   * @param {import('./types.js').OperatorConfig} operatorConfig
   */
  attachBehavior(nodeId, operatorConfig) {
    const node = this._requireNode(nodeId);
    node.operators = [...node.operators, operatorConfig];
  }

  /**
   * Remove every operator with the given name from a live node.
   * @param {string} nodeId
   * @param {string} operatorName
   */
  detachBehavior(nodeId, operatorName) {
    const node = this._requireNode(nodeId);
    node.operators = node.operators.filter((op) => op.name !== operatorName);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cascade.test.js`
Expected: PASS (all tests, both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add js/core/node-graph/runtime.js tests/cascade.test.js
git commit -m 'Cascade substrate: attachBehavior/detachBehavior runtime API (#286)'
```

---

### Task 3: Adversarial downgrade demo (entity-symmetry lock)

**Files:**
- Modify: `js/core/node-graph/operators.js` (register a small `regrade` operator)
- Test: `tests/cascade.test.js` (append a describe block)

**Interfaces:**
- Consumes: the `cascade` operator (Task 1).
- Produces: an operator registered as `"regrade"`. Config `{ on?: string }` (message type, default `"downgrade"`). On a matching message it lowers the node's `grade` one step along `["S","A","B","C","D","F"]`. Composed with `cascade{kind:"downgrade"}` this is a hostile propagating behavior — the same substrate as the player's pulse, differing only by `source` and side-effect.

- [ ] **Step 1: Write the failing test**

Append to `tests/cascade.test.js`:

```js
describe("adversarial parity — hostile downgrade cascade", () => {
  const EDGES3 = [["origin", "a"], ["a", "b"], ["b", "c"], ["b", "d"]];
  const build = (gateOpen) => {
    const nodes = ["origin", "a", "b", "c", "d"].map((id) => ({
      id, type: id === "origin" ? "malware" : "host",
      attributes: { grade: "A", forwardingEnabled: id === "b" ? gateOpen : true },
      operators: [{ name: "regrade", on: "downgrade" }, { name: "cascade", kind: "downgrade" }],
    }));
    const g = new NodeGraph({ nodes, edges: EDGES3 }, undefined, () => {});
    g.init();
    return g;
  };
  const grade = (g, id) => g.getNodeState(id).grade;

  it("the hostile pulse re-grades along its path (same primitive, node-id source)", () => {
    const g = build(true);
    g.sendMessage("origin", { type: "downgrade", payload: { ttl: 4, source: "malware:origin" } });
    assert.equal(grade(g, "a"), "B", "a downgraded A→B");
    assert.equal(grade(g, "b"), "B", "b downgraded A→B");
  });

  it("a player-subverted gate walls off the subnet behind it", () => {
    const g = build(false); // b's forwarding shut by the player
    g.sendMessage("origin", { type: "downgrade", payload: { ttl: 4, source: "malware:origin" } });
    assert.equal(grade(g, "c"), "A", "c behind the shut gate stays grade A");
    assert.equal(grade(g, "d"), "A", "d behind the shut gate stays grade A");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cascade.test.js`
Expected: FAIL with `Unknown operator: "regrade"`.

- [ ] **Step 3: Implement the operator**

In `js/core/node-graph/operators.js`, add after the `cascade` operator:

```js
/**
 * regrade — lower the node's grade one step (worse) on a matching message. A side-effect operator;
 * compose with `cascade` to make a hostile propagating re-grade pulse.
 * Config: { on?: string } — message type to react to (default "downgrade").
 */
const _GRADE_LADDER = ["S", "A", "B", "C", "D", "F"];
registerOperator("regrade", (config, attrs, message, _ctx) => {
  if (!message || message.type !== (config.on ?? "downgrade")) return {};
  const i = _GRADE_LADDER.indexOf(attrs.grade ?? "D");
  return { attributes: { grade: _GRADE_LADDER[Math.min(i + 1, _GRADE_LADDER.length - 1)] } };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cascade.test.js`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add js/core/node-graph/operators.js tests/cascade.test.js
git commit -m 'Cascade substrate: regrade operator + adversarial downgrade demo (#286)'
```

---

### Task 4: SWEEP cutover — graph `sweep-pulse` stimulus starts the probe

**Files:**
- Modify: `js/core/sweep.js` (register a `sweep-cascade` operator; rework `startSweep` to inject a graph message)
- Modify: `js/core/node-graph/traits.js` (add the `sweep-cascade` operator to the `hackable` trait, ~line 154)
- Test: `tests/sweep.test.js` (the existing behavioral tests are the guard; add one for the new stimulus)

**Interfaces:**
- Consumes: `registerOperator` (operators.js), the `PROBE_PROGRESS` const already defined in sweep.js, `HEAT_COST`/`SWEEP_MAX_DEPTH` (balance.js), the existing `processes.js` record helpers.
- Produces: an operator `"sweep-cascade"` that, on a `sweep-pulse` message, brings an unprobed probeable node online and starts its probe, stamping `_cascade_ttl` from the payload. `startSweep(originId, depthCap)` (signature unchanged) now mints the process record with `source: "player"` and injects `sweep-pulse` via `graph.sendMessage` instead of hand-walking a frontier.

- [ ] **Step 1: Write the failing test**

First read the top of `tests/sweep.test.js` and reuse its existing imports (`initGame`, `getState`, `startSweep`, `buildCorporateExchange`, `tick`). Append inside the existing top-level describe:

```js
it("a sweep-pulse starts the origin probe and stamps the cascade ttl", () => {
  initGame(() => buildCorporateExchange(), "sweep-pulse-start");
  startSweep("gateway", 2);
  assert.equal(getState().nodes["gateway"].probing, true, "origin probe started via sweep-pulse");
  assert.equal(getState().nodes["gateway"]._cascade_ttl, 2, "origin stamped with the cascade ttl");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sweep.test.js`
Expected: FAIL — `_cascade_ttl` is `undefined` (old `startSweep` sets `probing` directly, never stamps `_cascade_ttl`).

- [ ] **Step 3: Register the `sweep-cascade` operator in `sweep.js`**

At the top of `js/core/sweep.js`, add to the imports:

```js
import { registerOperator } from "./node-graph/operators.js";
```

Then register the operator at module scope (after the existing `PROBE_PROGRESS` const):

```js
/**
 * sweep-cascade — on a `sweep-pulse`, bring an unprobed probeable node online and start its probe,
 * stamping the remaining depth as `_cascade_ttl` so the completion forwarder (Task 5) can propagate
 * ttl-1. No-op on already-probed / probing / non-probeable nodes and on ttl < 1.
 */
registerOperator("sweep-cascade", (_config, attrs, message, _ctx) => {
  if (!message || message.type !== "sweep-pulse") return {};
  if (typeof attrs.probing !== "boolean" || attrs.probed || attrs.probing) return {};
  const ttl = message.payload?.ttl ?? 0;
  if (ttl < 1) return {};
  return {
    attributes: { visibility: "accessible", probing: true, [PROBE_PROGRESS]: 0, _cascade_ttl: ttl },
    events: [{ type: "operator-effect", payload: { effect: "ctx-call", method: "recordHeat", args: [HEAT_COST.sweep] } }],
  };
});
```

- [ ] **Step 4: Rework `startSweep` to inject the graph stimulus**

Replace the body of `startSweep` in `js/core/sweep.js` with (record kept for identity/abort; propagation now via the graph):

```js
export function startSweep(originId, depthCap) {
  const s = getState();
  const graph = s.nodeGraph;
  if (!graph || activeProcessOnNode(s, originId)) return;
  const cap = Number.isFinite(depthCap) ? Math.min(Math.max(1, depthCap), SWEEP_MAX_DEPTH) : SWEEP_MAX_DEPTH;
  const origin = s.nodes[originId];
  const probeOrigin = typeof origin?.probing === "boolean" && !origin.probed;
  // Wave-0 targets: the origin itself if it's still probeable, else its already-revealed children.
  const targets = probeOrigin ? [originId] : reachableFrom(s, originId);
  if (targets.length === 0) return;
  addProcess({ id: nextProcessId(), type: "sweep", nodeId: originId, source: "player", depthCap: cap });
  emitEvent(E.PROCESS_STARTED, { type: "sweep", nodeId: originId, depthCap: cap });
  for (const id of targets) graph.sendMessage(id, { type: "sweep-pulse", payload: { ttl: cap, source: "player" } });
}
```

- [ ] **Step 5: Add `sweep-cascade` to the `hackable` trait**

In `js/core/node-graph/traits.js`, inside the `hackable` trait's `operators` array (starts ~line 170 with the probe `timed-action`), add as the FIRST operator in that array:

```js
      { name: "sweep-cascade" },
```

- [ ] **Step 6: Run the new test to verify it passes**

Run: `node --test tests/sweep.test.js`
Expected: the new "sweep-pulse starts the origin probe" test PASSES. Some multi-wave / depth tests may still FAIL (forwarding lands in Task 5) — expected; note which fail.

- [ ] **Step 7: Commit**

```bash
git add js/core/sweep.js js/core/node-graph/traits.js tests/sweep.test.js
git commit -m 'Cascade substrate: SWEEP stimulus becomes a graph sweep-pulse (#286)'
```

---

### Task 5: SWEEP cutover — completion-driven forwarding + slimmed step()

**Files:**
- Modify: `js/core/sweep.js` (forward on probe completion; replace the process `step()`/`onAbort`; delete `startWave`)
- Modify: harness/bot init call sites (Step 4)
- Test: `tests/sweep.test.js` (the existing multi-wave / depth / gate / abort tests are the guard)

**Interfaces:**
- Consumes: the `sweep-cascade` operator + `startSweep` (Task 4); `on`/`E` (events), `A` (action-ids); the existing `reachableFrom` helper.
- Produces: SWEEP propagation entirely via per-node probe completion. When a sweep node's probe resolves (`ACTION_RESOLVED` / `A.PROBE`), it forwards `sweep-pulse{ttl-1}` to its now-revealed reachable neighbors and clears its own `_cascade_ttl`. The `sweep` process `step()` returns `true` (ended) when no node carries `_cascade_ttl`; `onAbort` clears every node's in-flight sweep probe. `initSweepForwarding()` exported for harness re-registration.

- [ ] **Step 1: Confirm the guard tests currently fail**

Run: `node --test tests/sweep.test.js`
Expected: the multi-wave test ("probes outward ... then stops at a router") and the depth-ceiling test FAIL — after Task 4 the wave never advances past wave 0 (no forwarding yet).

- [ ] **Step 2: Add the completion-driven forwarder**

In `js/core/sweep.js`, add imports if missing:

```js
import { on, E } from "./events.js";
import { A } from "./action-ids.js";
```

Register a once-guarded listener (module scope). Mirror the `initNavigationCancelHandler` pattern in `game-ctx.js` (an exported init fn, called once at module load):

```js
/** Forward the sweep wave one hop when a sweep-probe completes. Registered once at startup. */
export function initSweepForwarding() {
  on(E.ACTION_RESOLVED, ({ action, nodeId }) => {
    if (action !== A.PROBE) return;
    const s = getState();
    const graph = s.nodeGraph;
    const node = s.nodes[nodeId];
    if (!graph || !node) return;
    const ttl = node._cascade_ttl;
    if (ttl == null) return;                          // not part of a sweep cascade
    graph.setNodeAttr(nodeId, "_cascade_ttl", null);  // this node's hop is done
    if (ttl > 1) {
      for (const nId of reachableFrom(s, nodeId)) {
        graph.sendMessage(nId, { type: "sweep-pulse", payload: { ttl: ttl - 1, source: "player" } });
      }
    }
  });
}
initSweepForwarding();
```

- [ ] **Step 3: Replace the `sweep` process `step()`/`onAbort` and delete `startWave`**

In `js/core/sweep.js`, replace the whole `registerProcess("sweep", { ... })` block with a liveness watcher + generic abort:

```js
registerProcess("sweep", {
  step(_proc, s) {
    // The cascade is live while any node still carries a stamped hop. Ragged: each branch
    // advances on its own probe completion (see initSweepForwarding). Done when none remain.
    return !Object.values(s.nodes).some((n) => n._cascade_ttl != null);
  },
  onAbort(_proc, s) {
    // Cancel every in-flight sweep probe so none resolve after the sweep is aborted.
    const graph = s.nodeGraph;
    for (const n of Object.values(s.nodes)) {
      if (n._cascade_ttl == null) continue;
      graph.setNodeAttr(n.id, "_cascade_ttl", null);
      if (n.probing) { graph.setNodeAttr(n.id, "probing", false); graph.setNodeAttr(n.id, PROBE_PROGRESS, 0); }
    }
  },
});
```

Delete the now-unused `startWave` function (its role — start probes on a frontier — is now the `sweep-cascade` operator's job). Keep `reachableFrom` (the forwarder uses it).

- [ ] **Step 4: Re-register `initSweepForwarding` in the harness/bot**

The browser gets it at module import. The playtest harness and bot call `clearHandlers()` between runs, so the listener must be re-registered wherever `initNavigationCancelHandler` is re-registered.

Run: `grep -rn "initNavigationCancelHandler" js/ scripts/`
For each **non-module-load** call site (harness/bot re-init blocks), add a matching `initSweepForwarding()` call (import it from `../js/core/sweep.js` / relative path as used there).

- [ ] **Step 5: Run the SWEEP guard tests**

Run: `node --test tests/sweep.test.js`
Expected: the multi-wave, depth-ceiling, and abort tests PASS. Tests asserting `PROCESS_STEP` `count`/`depth` internals or `proc.frontier` will still fail — repointed in Task 6.

- [ ] **Step 6: Commit**

```bash
git add js/core/sweep.js scripts/
git commit -m 'Cascade substrate: SWEEP propagates via probe-completion forwarding (#286)'
```

---

### Task 6: Repoint SWEEP tests to observable behavior; full verification

**Files:**
- Modify: `tests/sweep.test.js` (repoint internals-coupled assertions)
- Modify: `MANUAL.md` (only if SWEEP's described behavior changed)
- Test: whole suite + census smoke + harness smoke

**Interfaces:**
- Consumes: everything above.
- Produces: a green suite that asserts SWEEP's observable behavior (nodes probed within depth, stops at a gate, ABORT ends it keeping `probed`) rather than `PROCESS_STEP.count`/`proc.frontier` internals.

- [ ] **Step 1: Repoint internals-coupled assertions**

For each remaining assertion in `tests/sweep.test.js` that reads `state.processes[0].depth`, `.frontier`, or counts `PROCESS_STEP.count`, replace with an observable-consequence assertion:

- "advanced in multiple waves" → after `tick(400)`, assert the set of `probed` nodes equals the expected gate-bounded reachable set, and that a node behind a router is NOT probed.
- "depth ceiling bounds travel" → assert nodes at depth ≤ cap are `probed` and nodes at depth cap+1 are not.
- "clamps depth 0→1 / over-large→ceiling" → these read `depthCap` on the record, still set by `startSweep`; keep as-is.

Keep every test that already asserts observable state (probed/visibility/ABORT affordance) unchanged.

- [ ] **Step 2: Run the SWEEP suite**

Run: `node --test tests/sweep.test.js`
Expected: PASS (all).

- [ ] **Step 3: Run lint + full test suite**

Run: `make check`
Expected: `tsc` clean; all tests pass (pre-existing count + new `cascade.test.js` + `sweep.test.js` additions).

- [ ] **Step 4: Smoke-test the playtest harness**

Run:
```bash
node scripts/playtest.js reset
node scripts/playtest.js "target gateway"
node scripts/playtest.js "actions"
```
Confirm SWEEP is offered; then dispatch a sweep (per the harness's depth-arg syntax) and `tick` forward, confirming nodes reveal over time. Expected: SWEEP runs, nodes probe outward, no crash.

- [ ] **Step 5: Census no-regression**

Run: `make census SEEDS=10`
Compare `successRate` / `traceFiredRate` against a same-seed run on `main`. Expected: within noise (SWEEP feel unchanged; the bot doesn't drive SWEEP heavily — this mainly confirms no crash/regression).

- [ ] **Step 6: Update MANUAL.md if needed**

SWEEP's player-facing behavior is unchanged (gate-bounded, depth-capped, abortable). Confirm `MANUAL.md`'s SWEEP description still matches; edit only if wording implies synchronized waves.

- [ ] **Step 7: Commit**

```bash
git add tests/sweep.test.js MANUAL.md
git commit -m 'Cascade substrate: repoint SWEEP tests to observable behavior; verify (#286)'
```

---

## Self-review notes

- **Spec coverage:** cascade operator (§Components 1–2) → Task 1; `attachBehavior` (§4) → Task 2; adversarial demo (§6) → Task 3; SWEEP cutover (§5) → Tasks 4–6; coexist decision (§Decision) honored (record/busy/abort untouched; only `step()`/`startSweep`/`onAbort` internals change); serialization (§) → Task 2 snapshot test + `_cascade_ttl` is a node attr; parallel entry points (§) → Task 5 Step 4 + Task 6 Step 4. Runtime-attached *triggers*, adversarial *content*, loadout UI, and the `processes.js` dissolve are all explicitly out of scope (spec §Out of scope) — no tasks, correctly.
- **Type consistency:** `_cascade_ttl` (nullable int), `sweep-pulse` message type, `source` string, `cascade`/`regrade`/`sweep-cascade` operator names used identically across tasks. `startSweep(originId, depthCap)` signature unchanged.
- **Risk (spec §Risks):** ragged waves — Task 6 Step 1 asserts the reachable *set*, not wave ordering, so ragged propagation passes; if playtest (Task 6 Step 4) shows it feels wrong, the `step()` watcher is where a minimal wave-gate would go.
