# Timed-action / process runtime convergence (#288) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the clean core verbs (probe/dump/fetch/mine + encrypted's dump) onto the declarative `timed:` synthesis path and retire their hand-wired trait operators, then unify busy-detection and abort into one game-layer contract — a pure coherence refactor with byte-identical census output.

**Architecture:** One timed-execution engine (the node-graph `timed-action` operator) and one orchestration layer (`processes.js`) already coexist and compose. This plan (A) finishes moving core-verb *timing config* out of `traits.js` onto their ActionDefs so `synthesizeTimedActions` regenerates the operators, keeping the `TIMED_ACTIONS` registry as the source of truth for the irregular `activeAttr`; and (B) collapses the two hand-bridged seams — busy and abort — into single game-layer functions. It does **not** merge the two runtime levels or change any behavior.

**Tech Stack:** Vanilla ES modules, JSDoc `@ts-check` (no build step for `js/`), `node:test` unit/integration tests, esbuild for vendor only. Run via the Makefile.

## Global Constraints

- **No behavior change.** This is a refactor. `make census SEEDS=50` must be byte-identical to a same-seed `origin/main` run after Part A and again at the end. Any delta is a regression.
- **`make check`** (tsc + `node:test`) is the hard gate on every task — must pass before commit.
- **State stays fully serializable.** Any operator `onComplete` is pure data (`ctx-call` method + serializable args), never a closure.
- **Three entry points stay green:** `js/ui/main.js`, `scripts/playtest.js`, `scripts/bot/`. Do NOT change action ids, event names, or event payloads.
- **`TIMED_ACTIONS` registry remains the single source of truth** for each timed action's `activeAttr` + `abortable`. Only `durationTable`/`onComplete` move out of `traits.js`.
- **Worktree path gotcha:** this branch lives in `.claude/worktrees/timed-action-runtime-convergence/`. Read/Edit/Write need the full worktree path; Bash/grep use the worktree cwd.
- Commit messages: single-quoted `-m` strings; end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Do NOT run `make census` inside the sandbox without care — it's the comparison gate, run it deliberately and compare to a same-seed main run.

## File Map

- `js/core/node-graph/timed-synthesis.js` — **modify** (A0): resolve `activeAttr` from the registry when present.
- `js/core/node-graph/action-templates.js` — **modify** (A1): PROBE/DUMP/FETCH/MINE gain `timed:` + real-work effects; drop now-unused `getTimedActionAttrNames` import if orphaned.
- `js/core/node-graph/traits.js` — **modify** (A1): delete probe/mine operators from `hackable`, dump/fetch from `lootable`; give `encrypted`'s dump override a `timed:` block; add "stays bespoke" comment on `rebootable`'s reboot operator.
- `js/core/node-graph/timed-actions.test.js` — **modify** (A1): redirect the "backed by an operator" scan to synthesized operators.
- `tests/timed-synthesis.test.js` — **modify** (A0): add registry-activeAttr cases.
- `tests/timed-synthesis-parity.test.js` — **create** (A1): synthesized operator == the old hand-wired config.
- `js/core/actions/node-actions.js` — **modify** (B1, B2): route through unified `isNodeBusy` + `abortNode`.
- `js/core/actions/program-actions.js` — **modify** (B1): use unified `isNodeBusy`.
- `js/core/busy.js` — **create** (B1): the single `isNodeBusy(node, state)` helper.
- `js/core/node-graph/game-ctx.js` — **modify** (B2): extract `resetActiveAbortableTimedAction`, add exported `abortNode`, simplify nav-cancel; add `abortNode` to ctx.
- `js/core/processes.js`, `js/ui/feedback-profiles.js` — **modify** (B3): boundary-doc comments only.
- Memory `timed-actions-mechanism.md`, `docs/BACKLOG.md`/gotchas — **modify** (docs).

---

## Task A0: Synthesis honors the registry activeAttr

**Files:**
- Modify: `js/core/node-graph/timed-synthesis.js:88`
- Test: `tests/timed-synthesis.test.js`

**Interfaces:**
- Consumes: `getTimedActionAttrNames(actionId).activeAttr` (returns the registry's irregular activeAttr, or `undefined`), `timedActiveAttr(actionId)` → `_ta_active_<id>`. Both already imported at `timed-synthesis.js:52`.
- Produces: `synthesizeTimedActions(node)` now stamps a synthesized operator's `activeAttr` as `getTimedActionAttrNames(action.id).activeAttr ?? timedActiveAttr(action.id)`. Behavior-neutral until a registry action declares `timed:` (Task A1).

- [ ] **Step 1: Write the failing test**

Add to `tests/timed-synthesis.test.js` (bare-NodeGraph + `mockCtx` pattern already in that file):

```js
import { NodeGraph } from "../js/core/node-graph/runtime.js";
import { mockCtx } from "../js/core/node-graph/ctx.js";

describe("synthesis activeAttr resolution (#288 A0)", () => {
  it("uses the registry activeAttr for a registered action id", () => {
    const node = {
      id: "n1", type: "test", attributes: {},
      operators: [],
      actions: [{
        id: "probe",                    // in TIMED_ACTIONS → activeAttr "probing"
        label: "PROBE",
        requires: [],
        timed: { durationTable: { S: 50, A: 40, B: 30, C: 20, D: 20, F: 10 } },
        effects: [{ effect: "set-attr", attr: "done", value: true }],
      }],
    };
    const g = new NodeGraph({ nodes: [node], edges: [] }, mockCtx());
    const op = g.getNode("n1"); // sanity that node built
    const built = g._nodes.get("n1");
    const timedOp = built.operators.find((o) => o.name === "timed-action" && o.action === "probe");
    assert.equal(timedOp.activeAttr, "probing", "registry activeAttr wins for probe");
  });

  it("falls back to _ta_active_<id> for an unregistered action id", () => {
    const node = {
      id: "n2", type: "test", attributes: {},
      operators: [],
      actions: [{
        id: "my-script-thing",          // NOT in TIMED_ACTIONS
        label: "X",
        requires: [],
        timed: { duration: 5 },
        effects: [{ effect: "set-attr", attr: "done", value: true }],
      }],
    };
    const g = new NodeGraph({ nodes: [node], edges: [] }, mockCtx());
    const built = g._nodes.get("n2");
    const timedOp = built.operators.find((o) => o.name === "timed-action" && o.action === "my-script-thing");
    assert.equal(timedOp.activeAttr, timedActiveAttr("my-script-thing"));
    assert.equal(timedOp.activeAttr, "_ta_active_my-script-thing");
  });
});
```

> If `g._nodes` internal access is discouraged in that file, use whatever accessor the sibling tests use to read a constructed node's operators (check `timed-synthesis.test.js` / `runtime.js` for a public `getNode`/operator accessor and mirror it).

- [ ] **Step 2: Run the test — verify it fails**

Run: `node --test tests/timed-synthesis.test.js`
Expected: the "registry activeAttr" case FAILS (`activeAttr` is `_ta_active_probe`, not `probing`).

- [ ] **Step 3: Make the change**

In `js/core/node-graph/timed-synthesis.js`, replace line 88:

```js
    const activeAttr = timedActiveAttr(action.id);
```

with:

```js
    // Registry-listed actions (probe/dump/fetch/mine/lie-low/reboot) carry an
    // irregular activeAttr (`probing`, `reading`, …) that is read widely across the
    // codebase; honor it so a migrated core verb keeps its load-bearing flag name.
    // Everything else (corrupt/kick/sniff/replay/set-piece scripts) mints
    // `_ta_active_<id>` as before — fully backward-compatible (#288 A0).
    const activeAttr = getTimedActionAttrNames(action.id).activeAttr ?? timedActiveAttr(action.id);
```

(`getTimedActionAttrNames` is already imported at line 52.)

- [ ] **Step 4: Run the test — verify it passes**

Run: `node --test tests/timed-synthesis.test.js`
Expected: PASS.

- [ ] **Step 5: Full gate**

Run: `make check`
Expected: PASS (behavior-neutral — no registry action declares `timed:` yet).

- [ ] **Step 6: Commit**

```bash
git add js/core/node-graph/timed-synthesis.js tests/timed-synthesis.test.js
git commit -m 'A0: synthesis honors registry activeAttr for core verbs (#288)' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task A1: Migrate probe/dump/fetch/mine + encrypted dump onto `timed:`

**Files:**
- Modify: `js/core/node-graph/action-templates.js` (PROBE 55-68, DUMP 128-149, FETCH 150-169, MINE 170-187)
- Modify: `js/core/node-graph/traits.js` (`hackable` operators, `lootable` operators, `encrypted` dump override, `rebootable` comment)
- Modify: `js/core/node-graph/timed-actions.test.js` (operator-backing scan)
- Test: `tests/timed-synthesis-parity.test.js` (create)

**Interfaces:**
- Consumes: Task A0's registry-activeAttr synthesis.
- Produces: probe/dump/fetch/mine (and encrypted's dump) are timed-by-declaration; `hackable.operators` = `[{ name: "sweep-cascade" }]`, `lootable.operators` = `[]`. Their operators are now synthesized with the same `activeAttr`/`durationTable`/`onComplete` the traits used to hand-write.

- [ ] **Step 1: Verify the encrypted composition assumption**

Run: `grep -rn "encrypted" js/core/network/ data/ js/core/node-graph/puzzles.js 2>/dev/null`
Confirm whether any live node applies the `encrypted` trait alongside `lootable`. Record the finding in `notes.md`. Either way, the `encrypted` dump override still needs a `timed:` block (it relies on `lootable`'s dump operator, which this task deletes) — this step is to know whether a live test can exercise it or it's latent set-piece code.

- [ ] **Step 2: Write the failing parity test**

Create `tests/timed-synthesis-parity.test.js`:

```js
// @ts-check
// #288 A1: after migrating the clean core verbs onto declarative `timed:` blocks,
// the synthesized timed-action operator must be byte-equivalent to the config the
// traits used to hand-write — same action, activeAttr (from the registry), and
// durationTable. Guards the arm-vs-work inversion and the activeAttr resolution.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createFileserver, createCryptovault } from "../js/core/node-graph/node-factories.js";
import { NodeGraph } from "../js/core/node-graph/runtime.js";
import { mockCtx } from "../js/core/node-graph/ctx.js";

/** Expected (action → { activeAttr, durationTable }) the hand-wired operators used. */
const EXPECTED = {
  probe: { activeAttr: "probing", durationTable: { S: 50, A: 40, B: 30, C: 20, D: 20, F: 10 } },
  mine:  { activeAttr: "mining",  durationTable: { S: 70, A: 60, B: 50, C: 40, D: 35, F: 30 } },
  dump:  { activeAttr: "reading", durationTable: { S: 40, A: 35, B: 25, C: 15, D: 15, F: 8 } },
  fetch: { activeAttr: "looting", durationTable: { S: 30, A: 25, B: 20, C: 12, D: 10, F: 6 } },
};

function opFor(nodeDef, action) {
  const g = new NodeGraph({ nodes: [nodeDef], edges: [] }, mockCtx());
  const built = g.getNodeState(nodeDef.id); // use whatever the codebase exposes; see runtime.js
  // Prefer a public operator accessor if one exists; otherwise read the constructed node.
  const node = g._nodes.get(nodeDef.id);
  return node.operators.find((o) => o.name === "timed-action" && o.action === action);
}

describe("core-verb synthesis parity (#288 A1)", () => {
  it("fileserver synthesizes probe/dump/fetch/mine with the registry activeAttr + trait durationTable", () => {
    const nodeDef = createFileserver("fs1", { grade: "B" });
    for (const action of ["probe", "dump", "fetch", "mine"]) {
      const op = opFor(nodeDef, action);
      assert.ok(op, `synthesized timed-action operator for ${action} exists`);
      assert.equal(op.activeAttr, EXPECTED[action].activeAttr, `${action} activeAttr`);
      assert.deepEqual(op.durationTable, EXPECTED[action].durationTable, `${action} durationTable`);
      assert.deepEqual(op.onComplete?.[0]?.effect, "ctx-call", `${action} onComplete is a ctx-call`);
    }
  });
});
```

> Adjust `createFileserver`'s traits if it doesn't compose all four verbs — pick a factory that composes `hackable` + `lootable` (cryptovault composes both). Use the codebase's real operator accessor if `_nodes` is private.

- [ ] **Step 3: Run the test — verify it fails**

Run: `node --test tests/timed-synthesis-parity.test.js`
Expected: FAIL — before migration, the synthesized operators don't exist (the hand-wired ones do, but they aren't produced by synthesis from a `timed:` block; the test reads synthesized operators specifically). It will fail to find the synthesized op or find the wrong shape.

- [ ] **Step 4: Add `timed:` blocks to the four ActionDefs**

In `js/core/node-graph/action-templates.js`:

PROBE_ACTION — replace its `effects` block:
```js
  timed: { durationTable: { S: 50, A: 40, B: 30, C: 20, D: 20, F: 10 } },
  effects: [{ effect: "ctx-call", method: "resolveProbe", args: ["$nodeId"] }],
```
DUMP_ACTION:
```js
  timed: { durationTable: { S: 40, A: 35, B: 25, C: 15, D: 15, F: 8 } },
  effects: [{ effect: "ctx-call", method: "resolveRead", args: ["$nodeId"] }],
```
FETCH_ACTION:
```js
  timed: { durationTable: { S: 30, A: 25, B: 20, C: 12, D: 10, F: 6 } },
  effects: [{ effect: "ctx-call", method: "resolveLoot", args: ["$nodeId"] }],
```
MINE_ACTION:
```js
  timed: { durationTable: { S: 70, A: 60, B: 50, C: 40, D: 35, F: 30 } },
  effects: [{ effect: "ctx-call", method: "resolveMine", args: ["$nodeId"] }],
```

If `getTimedActionAttrNames` is now unused in this file, remove its import (tsc/lint will flag).

- [ ] **Step 5: Delete the hand-wired operators from traits**

In `js/core/node-graph/traits.js`:

`hackable.operators` → keep only sweep-cascade, add a note:
```js
  operators: [
    { name: "sweep-cascade" },
    // probe & mine timed-action operators removed (#288 A1): probe/mine are now
    // synthesized from their ActionDef `timed:` blocks (action-templates.js). The
    // TIMED_ACTIONS registry still owns their activeAttr (`probing`/`mining`).
  ],
```
`lootable.operators` → empty, with a note:
```js
  operators: [
    // dump & fetch timed-action operators removed (#288 A1): synthesized from
    // ACTION_TEMPLATES.DUMP/FETCH `timed:` blocks. Registry owns reading/looting.
  ],
```
`rebootable` — add above the reboot operator:
```js
    // reboot STAYS hand-wired (#288): its arm does irreducible non-generic work —
    // startReboot evicts ICE, deselects, and rolls an RNG duration (no durationTable).
    // The declarative `timed:` schema can't express arm-time computation. See game-ctx.startReboot.
```
`encrypted`'s dump action override — replace its manual arm effects with a `timed:` block matching lootable's dump table (it composes on top of lootable, whose operator this task deletes, so it must now synthesize its own):
```js
    timed: { durationTable: { S: 40, A: 35, B: 25, C: 15, D: 15, F: 8 } },
    effects: [{ effect: "ctx-call", method: "resolveRead", args: ["$nodeId"] }],
```
(Remove the `getTimedActionAttrNames("dump").progressAttr` set-attr and the manual `reading` set — synthesis regenerates the arm.)

- [ ] **Step 6: Fix `timed-actions.test.js`'s operator-backing scan**

In `js/core/node-graph/timed-actions.test.js`, the `definedTimedActions()` scan of raw trait operators will no longer find probe/dump/fetch/mine. Redirect it to read *synthesized* operators from a constructed node. Replace the `TRAITS_WITH_TIMED_ACTIONS` trait-scan with a node-construction scan:

```js
import { createCryptovault } from "./node-factories.js";
import { NodeGraph } from "./runtime.js";
import { mockCtx } from "./ctx.js";

// Cryptovault composes hackable + lootable + rebootable → probe/dump/fetch/mine/reboot.
function definedTimedActions() {
  const def = createCryptovault("cv", { grade: "B" });
  const g = new NodeGraph({ nodes: [def], edges: [] }, mockCtx());
  const node = g._nodes.get("cv");
  const found = node.operators
    .filter((o) => o.name === "timed-action")
    .map((o) => ({ action: o.action, activeAttr: o.activeAttr }));
  if (LIE_LOW_OPERATOR?.name === "timed-action") {
    found.push({ action: LIE_LOW_OPERATOR.action, activeAttr: LIE_LOW_OPERATOR.activeAttr });
  }
  return found;
}
```

Keep the two assertions (every defined op matches a registry entry; every abortable registry action is backed by a defined op — reboot is non-abortable but still synthesized/hand-wired, so it appears). Update the header comment to say the scan now reads synthesized operators.

- [ ] **Step 7: Run tests — verify they pass**

Run: `node --test tests/timed-synthesis-parity.test.js js/core/node-graph/timed-actions.test.js`
Expected: PASS.

- [ ] **Step 8: Full gate**

Run: `make check`
Expected: PASS. Investigate any failure in DUMP/FETCH gating, sweep, or serialization tests — those read `probing`/`reading`/`looting`/`mining` and are the canary for an activeAttr regression.

- [ ] **Step 9: Census regression check**

In a separate checkout on `origin/main`, run `make census SEEDS=50 > /tmp/census-main.txt` with a fixed seed set. In this worktree run `make census SEEDS=50 > /tmp/census-branch.txt`. Diff them.
Run: `diff /tmp/census-main.txt /tmp/census-branch.txt`
Expected: empty diff (byte-identical). Any delta is a regression — stop and investigate.

- [ ] **Step 10: Commit**

```bash
git add js/core/node-graph/action-templates.js js/core/node-graph/traits.js js/core/node-graph/timed-actions.test.js tests/timed-synthesis-parity.test.js
git commit -m 'A1: migrate probe/dump/fetch/mine + encrypted dump onto timed: (#288)' -m 'Retire the hand-wired trait operators; TIMED_ACTIONS registry keeps activeAttr. reboot/volatile stay bespoke by design.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task B1: One game-layer `isNodeBusy(node, state)`

**Files:**
- Create: `js/core/busy.js`
- Modify: `js/core/actions/node-actions.js` (import + the process early-return check)
- Modify: `js/core/actions/program-actions.js:132`
- Test: `tests/busy-contract.test.js` (create)

**Interfaces:**
- Consumes: `state.nodeGraph.isNodeBusy(nodeId)` (operator busy), `activeProcessOnNode(state, nodeId)` (from `js/core/processes.js`).
- Produces: `export function isNodeBusy(node, state): boolean` — the single game-layer "is this node busy" contract. `true` iff an operator timed-action OR a process is active on the node.

- [ ] **Step 1: Write the failing test**

Create `tests/busy-contract.test.js`:

```js
// @ts-check
// #288 B1: one game-layer isNodeBusy(node, state) that ORs the operator-level
// (graph.isNodeBusy) and process-level (activeProcessOnNode) busy sources.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isNodeBusy } from "../js/core/busy.js";

describe("isNodeBusy game-layer contract (#288 B1)", () => {
  it("true when the graph reports an active timed-action operator", () => {
    const state = { nodeGraph: { isNodeBusy: (id) => id === "n1" }, processes: [] };
    assert.equal(isNodeBusy({ id: "n1" }, state), true);
    assert.equal(isNodeBusy({ id: "n2" }, state), false);
  });
  it("true when a process is active on the node", () => {
    const state = { nodeGraph: { isNodeBusy: () => false }, processes: [{ nodeId: "n1" }] };
    assert.equal(isNodeBusy({ id: "n1" }, state), true);
    assert.equal(isNodeBusy({ id: "n2" }, state), false);
  });
  it("false with no graph and no processes", () => {
    assert.equal(isNodeBusy({ id: "n1" }, { processes: [] }), false);
  });
});
```

- [ ] **Step 2: Run — verify it fails**

Run: `node --test tests/busy-contract.test.js`
Expected: FAIL (`../js/core/busy.js` does not exist).

- [ ] **Step 3: Create the helper**

Create `js/core/busy.js`:

```js
// @ts-check
/**
 * The single game-layer "is this node busy?" contract (#288 B1). ORs the two busy
 * sources that previously lived in separate layers: the node-graph operator busy
 * (graph.isNodeBusy — an active timed-action operator) and the process-framework
 * busy (activeProcessOnNode — SWEEP, autoburn, …). The graph can't see
 * state.processes, so this OR happens here, at the layer that has both.
 *
 * Note on scope: the graph's own NOT_BUSY condition stays operator-only on purpose —
 * getAvailableActions (node-actions.js) early-returns an [ABORT]-only menu whenever a
 * process is active, before the graph ever evaluates a node's action conditions, so
 * the graph never needs process-awareness. This helper is the contract for
 * game-layer consumers.
 */

/** @typedef {import('./types.js').GameState} GameState */

import { activeProcessOnNode } from "./processes.js";

/**
 * @param {{ id: string } | null} node
 * @param {GameState} state
 * @returns {boolean}
 */
export function isNodeBusy(node, state) {
  if (!node) return false;
  const operatorBusy = !!state.nodeGraph?.isNodeBusy(node.id);
  return operatorBusy || activeProcessOnNode(state, node.id);
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `node --test tests/busy-contract.test.js`
Expected: PASS.

- [ ] **Step 5: Route consumers through the helper**

In `js/core/actions/program-actions.js`, replace line ~132:
```js
  const busy = state.nodeGraph?.isNodeBusy(node.id);
```
with:
```js
  const busy = isNodeBusy(node, state);
```
and add `import { isNodeBusy } from "../busy.js";` at the top.

In `js/core/actions/node-actions.js`, the process early-return at line 37 (`if (activeProcessOnNode(state, node.id))`) is correct as-is for the ABORT swap, but add the import and leave a comment that `isNodeBusy` is the canonical game-layer check (the early-return is the process-specific *affordance*, which Task B2 unifies). Do NOT change behavior here — this step is only the `program-actions.js` reroute plus the import for B2's use.

- [ ] **Step 6: Full gate**

Run: `make check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/core/busy.js js/core/actions/program-actions.js js/core/actions/node-actions.js tests/busy-contract.test.js
git commit -m 'B1: single game-layer isNodeBusy(node, state) contract (#288)' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task B2: One `abortNode(nodeId, reason)`

**Files:**
- Modify: `js/core/node-graph/game-ctx.js` (extract `resetActiveAbortableTimedAction`, add exported `abortNode`, add ctx `abortNode`, simplify `initNavigationCancelHandler`)
- Modify: `js/core/node-graph/action-templates.js` (`ABORT_ACTION.effects` → `abortNode`)
- Modify: `js/core/actions/node-actions.js` (process-ABORT `execute` → `abortNode`)
- Test: `tests/abort-node.test.js` (create)

**Interfaces:**
- Consumes: `NodeGraph#getActiveAbortableTimedAction`, `abortNodeProcesses` (from `processes.js`), `getState()`.
- Produces: `export function abortNode(nodeId, reason = "aborted"): void` in `game-ctx.js` — resets any active *abortable* timed-action operator on the node (emitting the `cancel` ACTION_FEEDBACK) AND aborts any process on the node. `ctx.abortNode(nodeId)` exposes it for `ctx-call`. Non-abortable timed actions (reboot, volatile) are untouched.

- [ ] **Step 1: Write the failing test**

Create `tests/abort-node.test.js` — a game-state integration test (use `initGame` with an explicit seed, per the testing rules). Set up a node mid-probe (an abortable timed action) and assert `abortNode` clears it and emits a `cancel` feedback; set up a node with an active process and assert `abortNode` removes it. Sketch:

```js
// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState } from "../js/core/state.js";
import { abortNode } from "../js/core/node-graph/game-ctx.js";
import { addProcess, nextProcessId } from "../js/core/state/process.js";
import { on, off, E } from "../js/core/events.js";
// (import the harness init helpers the other integration tests use)

describe("abortNode unifies timed-action + process cancel (#288 B2)", () => {
  it("clears an active abortable timed action and emits cancel feedback", () => {
    initGame({ seed: "abort-test" /* + the network/harness setup other tests use */ });
    const s = getState();
    const nodeId = /* pick a hackable node id from s.nodes */;
    s.nodeGraph.setNodeAttr(nodeId, "probing", true);
    s.nodeGraph.setNodeAttr(nodeId, "_ta_probe_progress", 3);
    const cues = [];
    const h = (p) => cues.push(p);
    on(E.ACTION_FEEDBACK, h);
    abortNode(nodeId);
    off(E.ACTION_FEEDBACK, h);
    assert.equal(s.nodes[nodeId].probing, false);
    assert.ok(cues.some((c) => c.phase === "cancel" && c.action === "probe"));
  });

  it("aborts an active process on the node", () => {
    initGame({ seed: "abort-test-2" /* … */ });
    const s = getState();
    const nodeId = /* pick a node id */;
    addProcess({ id: nextProcessId(), type: "sweep", nodeId, source: "player", depthCap: 2 });
    abortNode(nodeId);
    assert.equal(s.processes.some((p) => p.nodeId === nodeId), false);
  });
});
```

> Mirror the setup helpers in `tests/integration.test.js` / the existing timed-action integration tests for `initGame` wiring (network, `initNavigationCancelHandler`, process registration). Pick concrete node ids from the seeded network.

- [ ] **Step 2: Run — verify it fails**

Run: `node --test tests/abort-node.test.js`
Expected: FAIL (`abortNode` is not exported).

- [ ] **Step 3: Extract the reset + add `abortNode`**

In `js/core/node-graph/game-ctx.js`, factor the body of the existing `abortTimedAction` ctx method (lines ~130-155) into a module-scope function, then define `abortNode`:

```js
/**
 * Reset any active ABORTABLE timed-action operator on a node — the generic sweep the
 * ABORT action and nav-cancel share. Non-abortable actions (reboot, volatile) are
 * left running by design. Emits the `cancel` ACTION_FEEDBACK so overlays tear down.
 * @param {string} nodeId
 */
export function resetActiveAbortableTimedAction(nodeId) {
  const graph = getState().nodeGraph;
  if (!graph) return;
  const active = graph.getActiveAbortableTimedAction(nodeId);
  if (!active) return;
  // xploit special-case removed (#310 made it a process); no clearOnCancel entries remain.
  graph.setNodeAttr(nodeId, active.activeAttr, false);
  graph.setNodeAttr(nodeId, active.progressAttr, 0);
  graph.setNodeAttr(nodeId, active.durationAttr, 0);
  emitEvent(E.ACTION_FEEDBACK, { nodeId, action: active.action, phase: "cancel", progress: 0 });
}

/**
 * The one abort entry point (#288 B2): cancel whatever kind of operation is running
 * on a node — an abortable timed-action operator and/or a process. Called by the
 * ABORT action, the process-ABORT affordance, and nav-cancel.
 * @param {string} nodeId @param {string} [reason]
 */
export function abortNode(nodeId, reason = "aborted") {
  resetActiveAbortableTimedAction(nodeId);
  abortNodeProcesses(nodeId, reason);
}
```

Rewrite the `abortTimedAction` ctx method to delegate: `abortTimedAction: (nodeId) => resetActiveAbortableTimedAction(nodeId),` and add `abortNode: (nodeId) => abortNode(nodeId),` to the ctx object. (`abortNodeProcesses` is already imported at line 37; `emitEvent`/`E`/`getState` are in scope.)

> If `cancelExploit` (the vestigial xploit path) is still referenced by the legacy card path, leave it — it's out of scope. `resetActiveAbortableTimedAction` no longer special-cases xploit because xploit is a process now.

- [ ] **Step 4: Simplify nav-cancel**

In `initNavigationCancelHandler` (`game-ctx.js:404`), replace the registry loop + generalized structural loop + separate process loop with a single pass:

```js
  for (const nodeId of graph.getNodeIds()) {
    resetActiveAbortableTimedAction(nodeId);   // structural: covers core verbs + synthesized alike
  }
  for (const proc of [...getState().processes]) abortNodeProcesses(proc.nodeId);
```

(The structural `getActiveAbortableTimedAction` already spans registry verbs and synthesized actions — see the #187 Phase 2 comment — so the enumerated registry loop is redundant.)

- [ ] **Step 5: Point both ABORT affordances at `abortNode`**

`ABORT_ACTION.effects` in `action-templates.js`:
```js
  effects: [{ effect: "ctx-call", method: "abortNode", args: ["$nodeId"] }],
```
`node-actions.js` process early-return `execute`:
```js
      execute: (n) => abortNode(n.id),
```
Add `import { abortNode } from "../node-graph/game-ctx.js";` to `node-actions.js`.

- [ ] **Step 6: Run tests — verify they pass**

Run: `node --test tests/abort-node.test.js`
Expected: PASS.

- [ ] **Step 7: Full gate + evasion-path sanity**

Run: `make check`
Expected: PASS. Pay attention to any nav-cancel / jack-out / ABORT integration tests — this touches the evasion-critical path. Also smoke via the harness:
```bash
node scripts/playtest.js reset
node scripts/playtest.js "target gateway"
node scripts/playtest.js "probe"
node scripts/playtest.js "target gateway"   # nav away mid-probe — probe should cancel
node scripts/playtest.js "status node gateway"   # probing:false
```

- [ ] **Step 8: Commit**

```bash
git add js/core/node-graph/game-ctx.js js/core/node-graph/action-templates.js js/core/actions/node-actions.js tests/abort-node.test.js
git commit -m 'B2: unify timed-action + process cancel into abortNode (#288)' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task B3 + Docs: Document the feedback boundary and update memory

**Files:**
- Modify: `js/core/processes.js` (header comment)
- Modify: `js/ui/feedback-profiles.js` (header comment)
- Modify: memory `timed-actions-mechanism.md` + `MEMORY.md` pointer
- Modify: MANUAL.md (only if any player-facing wording drifted — expected none)
- Modify: the "timed-action authoring is multi-site" gotcha memory (annotate as reduced)

**Interfaces:** none (documentation only).

- [ ] **Step 1: Document the feedback boundary in code**

Add to `js/core/processes.js`'s header comment:
```
// Feedback boundary (#288 B3): a PROCESS is orchestration — its lifecycle is
// reported via PROCESS_STARTED/STEP/ENDED (log lines + node flashes). Per-node
// timed WORK reports separately via ACTION_FEEDBACK (overlays/drones/cues resolved
// through js/ui/feedback-profiles.js). These are two intentionally-separate channels
// answering different questions ("is a multi-node op in flight" vs "how far along is
// this node's action"); they are not routed through one another. A process that also
// runs per-node timed work (SWEEP) gets per-node rings via the operator's
// ACTION_FEEDBACK, not via PROCESS_* — that's why there's no PROCESS_*→feedback bridge.
```
Add a one-line cross-reference to the same boundary in `js/ui/feedback-profiles.js`'s header.

- [ ] **Step 2: Update the mechanism memory**

Update the `timed-actions-mechanism` memory file: note that core verbs probe/dump/fetch/mine are now synthesized from `timed:` (operators retired from traits.js), the registry still owns activeAttr, xploit is now a process (autoburn, #310), reboot/volatile remain bespoke, and busy/abort are unified via `isNodeBusy(node,state)` / `abortNode(nodeId)`. Keep it one file, update the MEMORY.md pointer line if the hook changed.

- [ ] **Step 3: Annotate the multi-site gotcha as reduced**

In the `timed-action-authoring-multisite` memory, add that #288 retired the trait-operator authoring site for the clean core verbs; remaining bespoke: reboot (arm-time work) + volatile (no ActionDef). The gotcha is reduced, not fully dead.

- [ ] **Step 4: MANUAL.md check**

Run: `grep -in "timed\|probe\|dump\|fetch\|mine\|abort\|sweep" MANUAL.md | head`
Confirm no player-facing description contradicts current behavior. Expected: no change needed (internal refactor). If a wording drift is found, fix it.

- [ ] **Step 5: Final census regression check**

Repeat Task A1 Step 9's diff against a same-seed `origin/main` census.
Expected: byte-identical.

- [ ] **Step 6: Full gate + commit**

Run: `make check`
```bash
git add -A
git commit -m 'B3 + docs: document feedback boundary; update timed-action memory (#288)' -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Final: whole-branch review + PR

- [ ] Whole-branch opus review (requesting-code-review skill).
- [ ] `make bundle-vendor` + browser smoke test of probe/dump/fetch/mine + abort + sweep if any UI doubt remains.
- [ ] Open ONE PR (A commits first, then B) referencing #288. Les squash-merges and requests Copilot review from the PR UI.

## Self-Review notes

- **Spec coverage:** A0+A1 cover Part A (migration + enabler + exceptions); B1 covers busy; B2 covers abort; B3+Docs cover the feedback boundary + docs. All spec sections mapped.
- **Type consistency:** `isNodeBusy(node, state)` (B1) and `abortNode(nodeId, reason)` / `resetActiveAbortableTimedAction(nodeId)` (B2) names are used consistently across tasks and consumers.
- **Open detail for the implementer:** the exact public accessor for a constructed node's operators (tests use `g._nodes.get(id)` as a fallback — replace with the codebase's real accessor if one exists). Flagged in the test steps.
