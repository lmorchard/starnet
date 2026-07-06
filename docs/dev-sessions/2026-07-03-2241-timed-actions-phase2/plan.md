# Timed Actions Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the last still-instant gameplay verbs (`kick`, `sniff`, `replay`) to timed actions, reusing the Phase-1 mechanism, then hand off to a live feel-tuning pass.

**Architecture:** `kick` is already a node-graph action, so it becomes timed the same way `corrupt` did — a declarative `timed:` block that `synthesizeTimedActions()` rewrites into a `timed-action` operator at node construction. `sniff`/`replay` are *injected program actions* (they carry `execute` callbacks, not graph `effects`, and never pass through node synthesis), so they get a thin **operator bridge**: their `execute` callbacks stop resolving immediately and instead arm a `timed-action` operator on the target node via `attachBehavior`, whose `onComplete` ctx-call runs the original resolver (`sniffFlow`/`replayCredential`) when the timer completes. The attached operator is plain serializable data, so it round-trips through save/load; abort and nav-cancel are inherited for free from the existing generic handlers that already act on *any* structurally-active `timed-action` operator.

**Tech Stack:** Vanilla ES modules, JSDoc `@ts-check`, `node:test` unit/integration tests. No build step for `js/`.

## Global Constraints

- **State fully serializable.** Any attached operator's `onComplete` must be **pure data** (a `ctx-call` method name + serializable args), never a closure. Per-play parameters (the sniff `flowId`) live as a **node attribute**, not baked into a changing operator config — mirroring how `startExploit` stashes `activeExploitId` and `resolveExploit` reads it back.
- **All state mutation goes through the graph/state setters** — attach/arm via `state.nodeGraph.attachBehavior` / `state.nodeGraph.setNodeAttr`; never write `node.operators` or attrs directly outside `js/core/`.
- **Three parallel entry points** (`js/ui/main.js`, `scripts/playtest.js`, `scripts/bot/`) share the dispatcher — changes flow through `getAvailableActions().find().execute()` and need no per-entry-point edits, but the **bot must not regress** (`make census`).
- **Feel-draft durations only.** Every duration number in this plan is a placeholder to be dialed in Part 3 (the live feel-loop with Les). Mark each with a `feel-draft` comment. Do **not** tune them in these tasks.
- **Commit messages:** single-quoted `-m` strings (no `$()` heredocs), ending with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Baseline:** `make check` is currently green (1441 tests as of Phase 1). Keep it green; never weaken an assertion to pass.

---

## File Structure

- `js/core/node-graph/action-templates.js` — **modify** `KICK_ACTION` (add `timed` + `...NOT_BUSY`). (Task 1)
- `js/core/node-graph/runtime.js` — **add** public `hasBehavior(nodeId, operatorName, actionId?)` predicate next to `attachBehavior`/`detachBehavior`. (Task 2)
- `js/core/actions/program-actions.js` — **add** `armTimedProgram(...)` helper; **modify** `SNIFF_ACTION.execute` / `REPLAY_ACTION.execute` to arm instead of resolve; **modify** `getProgramActions` to gate SNIFF/REPLAY on "not busy". (Task 3)
- `js/core/node-graph/game-ctx.js` — **add** `resolveSniff(nodeId)` / `resolveReplay(nodeId)` ctx methods (the `onComplete` targets). (Task 3)
- `js/core/balance.js` — **add** `SNIFF_DURATION` / `REPLAY_DURATION` feel-draft constants. (Task 3)
- `js/core/node-graph/timed-synthesis.test.js` — **extend**: KICK synthesizes a timed-action operator. (Task 1)
- `js/core/node-graph/runtime.test.js` (or the nearest existing NodeGraph unit suite) — **extend**: `hasBehavior`. (Task 2)
- `tests/integration.test.js` — **add** a `sniff/replay timed` suite; **add**/adjust a `kick timed` case. (Tasks 1, 3)

---

## Task 1: `kick` becomes a short timed action

**Files:**
- Modify: `js/core/node-graph/action-templates.js:190-200` (`KICK_ACTION`)
- Test: `js/core/node-graph/timed-synthesis.test.js`
- Test: `tests/integration.test.js`

**Interfaces:**
- Consumes: the existing `synthesizeTimedActions()` path (an explicit `action.timed` block is honored for *any* action id, including core verbs — synthesis checks `action.timed` before the `isScriptAction` default branch), and the shared `NOT_BUSY` template already defined in `action-templates.js`.
- Produces: after this task, dispatching `kick` on an owned node **arms** a 5-tick timer; `ejectIce` (the original effect, now `onComplete`) fires only on completion. No new exported symbols.

**Background the implementer needs:**
- `KICK_ACTION` today is instant with `effects: [{ effect: "ctx-call", method: "ejectIce", args: ["$nodeId"] }]`. `$nodeId` in an `onComplete` ctx-call resolves to the operator's own node (`applyEffect` maps `"$nodeId"` → `targetNodeId`), so the effect works unchanged as `onComplete`.
- `corrupt` (`RECONFIGURE_ACTION`, same file) is the exact precedent: it has `...NOT_BUSY` in `requires` and a `timed:` block; synthesis moves its `effects` to the operator's `onComplete`. Mirror it.
- `ejectIce` (`js/core/ice/runtime.js`) emits `E.ICE_EJECTED` (not `ACTION_RESOLVED`). It is a no-op if there is no ICE on the node.

- [ ] **Step 1: Write the failing synthesis test**

In `js/core/node-graph/timed-synthesis.test.js`, add:

```js
it("synthesizes a timed-action operator for KICK (core verb with explicit timed block)", () => {
  const node = {
    id: "srv",
    actions: [{
      id: "kick",
      effects: [{ effect: "ctx-call", method: "ejectIce", args: ["$nodeId"] }],
      timed: { duration: 5 },
    }],
    operators: [],
    attributes: {},
  };
  synthesizeTimedActions(node);

  const op = node.operators.find((o) => o.name === "timed-action" && o.action === "kick");
  assert.ok(op, "kick gets a timed-action operator");
  assert.equal(op.emitStartOnArm, true, "flat duration → emitStartOnArm");
  assert.deepEqual(op.onComplete, [{ effect: "ctx-call", method: "ejectIce", args: ["$nodeId"] }]);

  const kick = node.actions.find((a) => a.id === "kick");
  // effects rewritten to the arm pattern (set active flag + zero progress + seed duration)
  assert.ok(kick.effects.some((e) => e.effect === "set-attr" && e.attr === "_ta_active_kick" && e.value === true));
  assert.ok(kick.effects.some((e) => e.effect === "set-attr" && e.attr === "_ta_kick_duration" && e.value === 5));
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test js/core/node-graph/timed-synthesis.test.js`
Expected: FAIL — `kick gets a timed-action operator` (no `timed` block yet, and `kick` is a core verb so the default branch skips it).

- [ ] **Step 3: Add the `timed` block + `NOT_BUSY` to `KICK_ACTION`**

In `js/core/node-graph/action-templates.js`, change `KICK_ACTION` to:

```js
/** @type {ActionDef} */
const KICK_ACTION = {
  id: A.KICK,
  label: "KICK",
  desc: "Boot ICE attention to a random adjacent node.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
    ...NOT_BUSY,
  ],
  // Timed (#187 Phase 2): a short beat so a reactive/panic kick still feels immediate but
  // reads as an action, not a free instant. duration is a feel-draft (~0.5s) — tuned in Part 3.
  timed: { duration: 5 },
  effects: [
    { effect: "ctx-call", method: "ejectIce", args: ["$nodeId"] },
  ],
};
```

- [ ] **Step 4: Run the synthesis test, verify it passes**

Run: `node --test js/core/node-graph/timed-synthesis.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing integration test**

In `tests/integration.test.js`, add a focused case (place it near existing ICE/kick coverage; set up state directly and pass an explicit seed):

```js
describe("kick is timed (#187 Phase 2)", () => {
  it("arms on dispatch, ejects ICE only on completion", () => {
    const { state } = initGame({ seed: "kick-timed", network: /* a net with an owned node + ICE on it */ });
    // ... target/own a node `srv` and place ICE on it (mirror the existing kick test's setup) ...

    let ejected = 0;
    on(E.ICE_EJECTED, () => { ejected++; });

    emitEvent("starnet:action", { actionId: "kick", nodeId: "srv" });
    assert.equal(ejected, 0, "kick does NOT eject at dispatch — only arms");
    assert.equal(state.nodeGraph.getNodeState("srv")._ta_active_kick, true);

    graph.tick(5); // duration
    assert.equal(ejected, 1, "ICE ejected exactly once on completion");
    assert.equal(state.nodeGraph.getNodeState("srv")._ta_active_kick, false);
  });
});
```

> **Note for the implementer:** reuse the existing kick integration test's exact setup for owning a node and placing ICE (search `tests/integration.test.js` for `kick` / `ICE_EJECTED`). Follow the seed rule in CLAUDE.md. `graph`/`tick` access must match how the surrounding suite drives ticks.

- [ ] **Step 6: Run it, verify it passes**

Run: `node --test tests/integration.test.js`
Expected: PASS. If a pre-existing kick test asserted immediate ejection, add a `graph.tick(5)` between dispatch and the assertion (legitimate behavior change — do **not** delete the assertion).

- [ ] **Step 7: Bot — confirm no wiring change is needed (do NOT add A.KICK to TIMED_ACTIONS)**

Read `scripts/bot/execute.js`. Confirm: `A.KICK` is dispatched **only reactively** (fire-and-forget in the `onIceMoved` handler inside `tickUntilResolved`), is **never** a scored primary `choice`, and lives in `INSTANT_ACTIONS`. Because the main loop always advances ≥1 tick/cycle, an armed reactive kick completes in the background over following cycles — exactly like the puzzle actions already documented in that file's `INSTANT_ACTIONS` comment. With `...NOT_BUSY` now on `KICK_ACTION`, a repeat reactive dispatch while a kick is already in flight simply isn't offered (the node is busy), so the dispatch no-ops. **Leave `A.KICK` in `INSTANT_ACTIONS`.** Add a one-line comment there noting kick is timed as of Phase 2 but stays instant-from-the-bot's-view (reactive fire-and-forget; `ejectIce` emits `ICE_EJECTED`, not `ACTION_RESOLVED`, so `tickUntilResolved` could never match it anyway).

- [ ] **Step 8: Run the full check + a census smoke**

Run: `make check`
Expected: green.
Run: `make census SEEDS=50`
Expected: `successRate` / `traceFiredRate` / `avgNodesOwned` within noise of a same-seed `origin/main` run. Record the numbers in `notes.md`. If materially regressed, stop and report (do not retune here).

- [ ] **Step 9: Commit**

```bash
git add js/core/node-graph/action-templates.js js/core/node-graph/timed-synthesis.test.js tests/integration.test.js scripts/bot/execute.js
git commit -m 'kick is a short timed action (#187 Phase 2)' -m 'Add timed:{duration:5} + NOT_BUSY to KICK_ACTION; ejectIce moves to the

synthesized operator onComplete. Bot keeps kick in INSTANT_ACTIONS (reactive
fire-and-forget; completes in the background). Feel-draft duration.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task 2: `hasBehavior` predicate on the graph runtime

**Files:**
- Modify: `js/core/node-graph/runtime.js` (add method next to `attachBehavior`/`detachBehavior`, ~line 246)
- Test: `js/core/node-graph/runtime.test.js` (or the nearest existing NodeGraph unit suite — find the one that constructs a `NodeGraph` and calls `attachBehavior`)

**Interfaces:**
- Produces: `NodeGraph.prototype.hasBehavior(nodeId: string, operatorName: string, actionId?: string): boolean` — true iff the node carries at least one operator with that `name` (and, if `actionId` is given, that `action`). Task 3's `armTimedProgram` consumes it to decide attach-vs-reuse.

**Why this exists:** `attachBehavior`'s contract forbids double-attach (a duplicate operator double-propagates). `armTimedProgram` must attach the sniff/replay operator once and thereafter **reuse** it. `detachBehavior(nodeId, "timed-action")` is too coarse — it would also remove a set-piece node's *synthesized* script-action operators. So we need to check for a specific `(name, action)` operator before attaching.

- [ ] **Step 1: Write the failing test**

In the runtime unit suite, add:

```js
it("hasBehavior reports operators by name and optional action id", () => {
  const g = /* construct a minimal NodeGraph with one node "n" and no operators */;
  assert.equal(g.hasBehavior("n", "timed-action"), false);
  g.attachBehavior("n", { name: "timed-action", action: "sniff", activeAttr: "_ta_active_sniff" });
  assert.equal(g.hasBehavior("n", "timed-action"), true);
  assert.equal(g.hasBehavior("n", "timed-action", "sniff"), true);
  assert.equal(g.hasBehavior("n", "timed-action", "replay"), false);
});
```

> **Implementer:** mirror the construction used by the existing `attachBehavior`/`detachBehavior` test(s) in the same file.

- [ ] **Step 2: Run it, verify it fails**

Run: `node --test js/core/node-graph/runtime.test.js`
Expected: FAIL — `g.hasBehavior is not a function`.

- [ ] **Step 3: Implement `hasBehavior`**

In `js/core/node-graph/runtime.js`, immediately after `detachBehavior` (~line 246):

```js
  /**
   * Whether a node carries an operator with the given name (and optionally a
   * specific `action` id). Used to decide attach-vs-reuse for dynamically
   * attached behaviors (e.g. the sniff/replay timed-action bridge) without the
   * coarse detach-all-by-name that would sweep away synthesized operators.
   * @param {string} nodeId
   * @param {string} operatorName
   * @param {string} [actionId]
   * @returns {boolean}
   */
  hasBehavior(nodeId, operatorName, actionId = undefined) {
    const node = this._requireNode(nodeId);
    return node.operators.some(
      (op) => op.name === operatorName && (actionId === undefined || op.action === actionId)
    );
  }
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `node --test js/core/node-graph/runtime.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/node-graph/runtime.js js/core/node-graph/runtime.test.js
git commit -m 'Add NodeGraph.hasBehavior predicate (#187 Phase 2)' -m 'Lets the sniff/replay bridge attach a timed-action operator once and reuse it,

instead of a coarse detach-all-by-name that would sweep synthesized operators.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task 3: `sniff` / `replay` operator bridge

**Files:**
- Modify: `js/core/balance.js` (add `SNIFF_DURATION`, `REPLAY_DURATION`)
- Modify: `js/core/node-graph/game-ctx.js` (add `resolveSniff`, `resolveReplay`)
- Modify: `js/core/actions/program-actions.js` (add `armTimedProgram`; rewire `SNIFF_ACTION.execute` / `REPLAY_ACTION.execute`; gate `getProgramActions`)
- Test: `tests/integration.test.js` (new `sniff/replay timed` suite)

**Interfaces:**
- Consumes: `NodeGraph.hasBehavior` (Task 2); `attachBehavior` / `setNodeAttr` / `getNodeState` / `isNodeBusy` (existing); `timedActiveAttr` + `getTimedActionAttrNames` (`js/core/node-graph/timed-actions.js`); `sniffFlow` / `replayCredential` (`js/core/programs.js`).
- Produces:
  - `armTimedProgram(state, nodeId, actionId, duration, resolverMethod, extraAttrs = {})` in `program-actions.js` — attaches (once) and arms a `timed-action` operator whose `onComplete` calls `ctx.<resolverMethod>("$nodeId")`.
  - ctx methods `resolveSniff(nodeId)` / `resolveReplay(nodeId)` on the game ctx.

**Design (read before coding):**
- **Why the bridge lives in the program `execute` callbacks, not the generic dispatcher:** only `sniff`/`replay` need it. `SWEEP` is also a program action but stays a *process* (multi-node) — untouched. Editing the two specific `execute` callbacks avoids adding program-vs-graph detection to `initActionDispatcher`. (This is a deliberate simplification of the spec's "generic dispatch bridge" phrasing.)
- **Per-play parameter (sniff `flowId`) as a node attribute, not in `onComplete`:** the followup picker resolves `flowId` before dispatch. `armTimedProgram` stashes it as `_sniff_flow_id`; the *static* `onComplete` is `[{ ctx-call resolveSniff, args:["$nodeId"] }]`; `resolveSniff` reads `_sniff_flow_id` back. This keeps the operator config identical across plays (so reuse is safe) and fully serializable — exactly the `startExploit`/`activeExploitId`/`resolveExploit` pattern.
- **Reuse, don't detach:** `armTimedProgram` attaches only if `!hasBehavior(nodeId, "timed-action", actionId)`; otherwise it just re-arms the attrs. The operator persists inert (`activeAttr` false) between plays — harmless, serializable, and `isNodeBusy` keys off the active flag, not the operator's presence.
- **Abort / nav-cancel / save-load come for free:** the operator's `name` is `"timed-action"`, so `game-ctx.js`'s `abortTimedAction` and the `initNavigationCancelHandler` generic fallback (which already cancels *any* structurally-active `timed-action` via `getActiveTimedAction`) reset it and emit a `cancel` ACTION_FEEDBACK. `onComplete` fires **only** on completion, so a cancelled sniff reveals nothing / a cancelled replay grants no access. The stashed `_sniff_flow_id` is only read on completion and overwritten on the next arm, so a leftover after cancel is inert.
- **Feedback:** `emitStartOnArm: true` on the attached operator makes it emit the `start` ACTION_FEEDBACK on the first counting tick → the generic-process overlay + drone mount, same as any flat-duration timed action.
- **Availability while busy:** `getProgramActions` must not offer SNIFF/REPLAY when the node is already running a timed action — add `!state.nodeGraph.isNodeBusy(node.id)` to their guards (SWEEP keeps its existing `!activeProcessOnNode` guard).

- [ ] **Step 1: Add feel-draft duration constants**

In `js/core/balance.js`, near `HEAT_COST`:

```js
// Feel-draft timed-action durations for the flow programs (#187 Phase 2). Ticks (100ms each).
// SNIFF is a quick read; REPLAY is a heavier credential injection. Tuned in Part 3.
export const SNIFF_DURATION = 12;
export const REPLAY_DURATION = 20;
```

- [ ] **Step 2: Add `resolveSniff` / `resolveReplay` to the game ctx**

In `js/core/node-graph/game-ctx.js`, import the resolvers at the top:

```js
import { sniffFlow, replayCredential } from "../programs.js";
```

Add to the ctx object, in the "Resolve methods" block (after `resolveMine`):

```js
    // ── Flow-program resolvers (called by the sniff/replay timed-action operator on completion) ──
    // The per-play flowId is stashed on the node as `_sniff_flow_id` at arm time (armTimedProgram)
    // so the operator's onComplete stays static + serializable. Reads it back, then clears it.
    resolveSniff: (nodeId) => {
      const s = getState();
      const flowId = /** @type {any} */ (s.nodes[nodeId])?._sniff_flow_id;
      if (flowId == null) return;
      sniffFlow(s, nodeId, flowId);
      if (ctx._graph) ctx._graph.setNodeAttr(nodeId, "_sniff_flow_id", null);
    },
    resolveReplay: (nodeId) => {
      replayCredential(getState(), nodeId);
    },
```

- [ ] **Step 3: Add `armTimedProgram` + rewire the program `execute` callbacks**

In `js/core/actions/program-actions.js`, add imports:

```js
import { timedActiveAttr, getTimedActionAttrNames } from "../node-graph/timed-actions.js";
import { SNIFF_DURATION, REPLAY_DURATION } from "../balance.js";
```

Add the helper:

```js
/**
 * Arm a program action as a timed action by attaching (once) and arming a
 * `timed-action` operator on the target node. The operator's onComplete calls
 * `ctx.<resolverMethod>("$nodeId")` when the timer completes — see game-ctx.js.
 * Per-play parameters go in `extraAttrs` as serializable node attributes, NOT in
 * onComplete (which must stay static so the operator can be reused across plays).
 * @param {GameState} state @param {string} nodeId @param {string} actionId
 * @param {number} duration ticks @param {string} resolverMethod ctx method name
 * @param {Record<string, any>} [extraAttrs]
 */
export function armTimedProgram(state, nodeId, actionId, duration, resolverMethod, extraAttrs = {}) {
  const graph = state.nodeGraph;
  if (!graph) return;
  const activeAttr = timedActiveAttr(actionId);
  const { progressAttr, durationAttr } = getTimedActionAttrNames(actionId);

  if (!graph.hasBehavior(nodeId, "timed-action", actionId)) {
    graph.attachBehavior(nodeId, {
      name: "timed-action",
      action: actionId,
      activeAttr,
      emitStartOnArm: true, // flat duration → operator emits "start" on first tick (overlay mount)
      onComplete: [{ effect: "ctx-call", method: resolverMethod, args: ["$nodeId"] }],
      _abortable: true,
    });
  }

  for (const [k, v] of Object.entries(extraAttrs)) graph.setNodeAttr(nodeId, k, v);
  graph.setNodeAttr(nodeId, progressAttr, 0);
  graph.setNodeAttr(nodeId, durationAttr, duration);
  graph.setNodeAttr(nodeId, activeAttr, true); // set active LAST — operator sees progress/duration already seeded
}
```

Rewire the two `execute` callbacks (leave `SWEEP_ACTION` untouched):

```js
// SNIFF_ACTION:
  execute: (node, state, _ctx, payload) =>
    armTimedProgram(state, node.id, A.SNIFF, SNIFF_DURATION, "resolveSniff", { _sniff_flow_id: payload?.flowId }),

// REPLAY_ACTION:
  execute: (node, state, _ctx) =>
    armTimedProgram(state, node.id, A.REPLAY, REPLAY_DURATION, "resolveReplay"),
```

- [ ] **Step 4: Gate SNIFF/REPLAY offering on "not busy"**

In `getProgramActions` (`program-actions.js`), compute a `busy` flag and add it to the SNIFF and REPLAY guards so neither is offered while a timed action (including an in-flight sniff/replay) runs on the node:

```js
  const busy = state.nodeGraph?.isNodeBusy(node.id);

  if (node.probed && !busy && visibleIncidentFlows(state, node.id).length > 0) out.push(SNIFF_ACTION);

  const key = node.trustsCredential;
  if (node.finesseLocked && !busy && key && node.accessLevel !== "owned"
      && state.player.capturedCredentials.includes(key)) {
    out.push(REPLAY_ACTION);
  }
```

- [ ] **Step 5: Write the failing integration suite**

In `tests/integration.test.js`, add (set state up directly; explicit seed):

```js
describe("sniff/replay are timed (#187 Phase 2)", () => {
  it("sniff arms on dispatch and reveals the flow only on completion", () => {
    // Build a net with a probed, accessible node `edge` carrying a visible credential flow (id `fid`).
    const { state } = initGame({ seed: "sniff-timed", network: /* ... */ });
    // ... make `edge` accessible + probed, add a credential flow incident to it ...

    let sniffed = 0;
    on(E.FLOW_SNIFFED, () => { sniffed++; });

    emitEvent("starnet:action", { actionId: "sniff", nodeId: "edge", flowId: "fid" });
    assert.equal(sniffed, 0, "sniff does NOT resolve at dispatch — only arms");
    assert.equal(state.nodeGraph.getNodeState("edge")._ta_active_sniff, true);
    assert.equal(state.nodeGraph.getNodeState("edge")._sniff_flow_id, "fid");

    graph.tick(SNIFF_DURATION);
    assert.equal(sniffed, 1, "flow sniffed exactly once on completion");
    assert.equal(state.nodeGraph.getNodeState("edge")._ta_active_sniff, false);
  });

  it("abort mid-sniff reveals nothing", () => {
    // ... arm a sniff as above ...
    let sniffed = 0; on(E.FLOW_SNIFFED, () => { sniffed++; });
    emitEvent("starnet:action", { actionId: "sniff", nodeId: "edge", flowId: "fid" });
    graph.tick(3); // partway
    emitEvent("starnet:action", { actionId: "abort", nodeId: "edge" });
    graph.tick(SNIFF_DURATION);
    assert.equal(sniffed, 0, "cancelled sniff never resolves");
  });

  it("replay arms and grants owned access only on completion", () => {
    // Build a finesse-locked node `vault` trusting a credential the player holds.
    const { state } = initGame({ seed: "replay-timed", network: /* ... */ });
    // ... set node.finesseLocked, node.trustsCredential = "k", player.capturedCredentials = ["k"] ...
    emitEvent("starnet:action", { actionId: "replay", nodeId: "vault" });
    assert.notEqual(state.nodes["vault"].accessLevel, "owned", "replay does not resolve at dispatch");
    graph.tick(REPLAY_DURATION);
    assert.equal(state.nodes["vault"].accessLevel, "owned");
  });

  it("re-arming sniff reuses the operator (no accumulation)", () => {
    // ... arm + complete one sniff on `edge`, then arm a second ...
    emitEvent("starnet:action", { actionId: "sniff", nodeId: "edge", flowId: "fid" });
    graph.tick(SNIFF_DURATION);
    emitEvent("starnet:action", { actionId: "sniff", nodeId: "edge", flowId: "fid2" });
    // Read the node's operators the way the surrounding save/load or snapshot tests do.
    const ops = /* state.nodeGraph snapshot operators for "edge" */;
    const count = ops.filter((o) => o.name === "timed-action" && o.action === "sniff").length;
    assert.equal(count, 1, "operator attached once, reused thereafter");
  });

  it("a save/load round-trip mid-sniff preserves the armed operator", () => {
    // ... arm a sniff, tick partway ...
    emitEvent("starnet:action", { actionId: "sniff", nodeId: "edge", flowId: "fid" });
    graph.tick(3);
    const snap = /* serialize state (JSON round-trip) the way the save/load tests do */;
    const restored = /* deserialize + rebuild NodeGraph */;
    let sniffed = 0; on(E.FLOW_SNIFFED, () => { sniffed++; });
    /* restored graph */.tick(SNIFF_DURATION); // finish the remaining ticks
    assert.equal(sniffed, 1, "restored sniff completes and resolves once");
  });
});
```

> **Implementer:** wire the `network` fixtures and the `graph`/`tick` + save/load helpers to match the existing suites in `tests/integration.test.js` (search for `getNodeState`, flow setup, the save/load round-trip helper, and how operators are read from a snapshot). Assert **observable consequences** (`FLOW_SNIFFED`, `accessLevel === "owned"`), not intermediate attributes, per the test-honesty rules in CLAUDE.md. Trace the full path: dispatch → `execute` arms operator → tick → operator `onComplete` → `resolveSniff` → `sniffFlow` → `FLOW_SNIFFED`.

- [ ] **Step 6: Run the suite, verify it passes**

Run: `node --test tests/integration.test.js`
Expected: FAIL first (before Steps 2–4 are complete), then PASS once the bridge is wired. Iterate until green.

- [ ] **Step 7: Run type check + full test suite**

Run: `make check`
Expected: green. Fix any `@ts-check` complaints on the new code (e.g. the `_sniff_flow_id` read cast) rather than suppressing them.

- [ ] **Step 8: Manual harness sanity (playtest)**

Run:
```bash
node scripts/playtest.js --seed sniff reset
# navigate/own to a probed node with a flow, then:
node scripts/playtest.js "target <node>"
node scripts/playtest.js "sniff <flowId>"      # should report armed, not resolved
node scripts/playtest.js "status node <node>"  # _ta_active_sniff true
node scripts/playtest.js "tick 12"             # FLOW_SNIFFED in the event stream
```
Expected: sniff/replay arm, then resolve after ticking. Confirm the log shows a start + completion (every visual event needs a log entry). Record any surprises in `notes.md`.

- [ ] **Step 9: Census smoke (no-regression only)**

Run: `make census SEEDS=50`
Expected: within noise of base — the bot uses neither sniff nor replay, so this only confirms nothing else broke. Note numbers in `notes.md`.

- [ ] **Step 10: Commit**

```bash
git add js/core/balance.js js/core/node-graph/game-ctx.js js/core/actions/program-actions.js tests/integration.test.js
git commit -m 'sniff/replay are timed via an operator bridge (#187 Phase 2)' -m 'Program actions arm a reused timed-action operator via attachBehavior; the

per-play flowId is stashed as a node attr so onComplete stays static and
serializable. Abort/nav-cancel/save-load inherited from the existing generic
timed-action handlers. Feel-draft durations.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Part 3 (NOT a code task): live duration feel-loop with Les

**This is a checkpoint, not an autonomous task.** After Tasks 1–3 land green and are legible in the browser, **pause and hand off to Les** for a live in-browser feel-pass to dial:

- `kick` (`timed.duration`, currently 5)
- `SNIFF_DURATION` / `REPLAY_DURATION` (12 / 20)
- the flat `DEFAULT_SCRIPT_ACTION_DURATION` (20) and `corrupt`'s `durationTable`

Census can't judge these (the bot doesn't feel-pace and doesn't use programs). Set up the harness/browser so Les drives the live controls; change one value at a time. Do **not** tune these numbers autonomously.

---

## Docs & retro (fold into the final PR, before merge)

- [ ] **Update `MANUAL.md`:** note that `kick`, `sniff`, `replay` are now timed actions (they arm, tick, and can be aborted like probe/xploit). Update the node-actions reference / console-commands sections accordingly.
- [ ] **Update the timed-actions memory** (`timed-actions-mechanism.md`) if the two-runtime story changed — Phase 2 adds a *dynamically attached* timed-action operator (the program bridge) as a new instance of the operator path, still under the #288 convergence umbrella.
- [ ] **Session `notes.md`:** final summary (what shipped, the spec deviations — kick stays in bot INSTANT_ACTIONS; bridge in `execute` not the dispatcher; reuse-not-detach — census numbers, and the Part-3 handoff state).

---

## Self-Review (completed against the spec)

**Spec coverage:**
- Part 1 (`kick` short-timed) → Task 1. ✓ Bot handling reconciled: spec said "add to TIMED_ACTIONS"; correct behavior is "leave in INSTANT_ACTIONS" because kick is reactive-only and `ejectIce` emits `ICE_EJECTED` not `ACTION_RESOLVED` (documented as a deliberate deviation in Task 1 Step 7).
- Part 2 (`sniff`/`replay` operator bridge, `attachBehavior`, serializable `onComplete`, abort/nav-cancel/save-load, availability gating) → Tasks 2 + 3. ✓ Bridge placed in the program `execute` callbacks rather than the generic dispatcher (deliberate simplification, documented). Detach replaced by reuse-via-`hasBehavior` (avoids sweeping synthesized operators — a correctness fix over the spec's "detach by name").
- Part 3 (tuning feel-loop) → explicit non-code checkpoint. ✓
- Testing (kick arm/complete; sniff/replay arm/complete/abort/save-load/no-accumulate; no-regression `make check` + census) → Task 1 Steps 5–8, Task 3 Steps 5–9. ✓
- Non-goals (SWEEP/process framework untouched; no new instant exceptions; not the full #288 merge) → SWEEP explicitly left alone; no `instant:` changes. ✓

**Placeholder scan:** Test bodies contain `/* ... */` **only** for fixture/setup wiring that must match existing suites (network construction, save/load helper, snapshot operator read) — flagged with an implementer note pointing at the concrete patterns to copy, not left as vague "add setup." All production code is complete and literal.

**Type consistency:** `armTimedProgram(state, nodeId, actionId, duration, resolverMethod, extraAttrs)` is defined once and called with matching arity in both `execute` rewrites. `hasBehavior(nodeId, operatorName, actionId?)` signature matches its call in `armTimedProgram`. Attr names (`_ta_active_<id>`, `_ta_<id>_progress`, `_ta_<id>_duration`) come from `timedActiveAttr` / `getTimedActionAttrNames` — not hand-spelled in production code. `resolveSniff`/`resolveReplay` names match the `onComplete` method strings passed by the `execute` callbacks.
