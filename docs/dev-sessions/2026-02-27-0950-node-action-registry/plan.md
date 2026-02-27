# Plan: Node Action Registry

## Overview

Ten phases, each building cleanly on the last. Tests come *before* the risky migrations — the registry is verified against known expected behavior before any consumer is changed.

1. Extend `ActionDef` typedef + add `ActionContext` to `types.js`
2. Create `js/node-actions.js` with all core node-contextual actions
3. Create `js/global-actions.js` with jackout / select / deselect
4. Export unified `getAvailableActions(node, state)` from `node-actions.js`
5. **Tests: availability parity** — verify registry output matches current hard-coded behavior for all known game states
6. Migrate `visual-renderer.js` to use `getAvailableActions()`
7. Migrate `console.js` to use `getAvailableActions()`
8. **Tests: dispatch routing** — verify ActionContext methods are called correctly before touching main.js
9. Build `ActionContext` and simplify `main.js` dispatch loop
10. Final test pass

Each phase ends in a working, test-passing state. The test phases (5 and 8) act as safety nets that must be green before the riskiest changes proceed.

---

## Phase 1 — Extend types.js

**Context:** `ActionDef` already exists but lacks `execute`. `BehaviorAtom` already uses a `ctx: Object` injection pattern — model `ActionContext` the same way.

**Prompt:**

In `js/types.js`, make two changes:

1. Add an `execute` field to the `ActionDef` typedef:
```js
/**
 * @typedef {{
 *   id:        string,
 *   label:     string,
 *   available: (node: NodeState, state: GameState) => boolean,
 *   desc:      (node: NodeState, state: GameState) => string,
 *   execute:   (node: NodeState, state: GameState, ctx: ActionContext, payload?: Object) => void,
 * }} ActionDef
 */
```
The optional `payload` carries event-specific data (e.g. `exploitId` / `cardIndex` for the exploit action, `nodeId` for select).

2. Add the `ActionContext` typedef immediately after `ActionDef`:
```js
/**
 * Dependency-injection context passed to action execute() functions.
 * main.js constructs one instance at init, wiring each field to the
 * corresponding state mutator. Tests can pass mock contexts.
 * @typedef {{
 *   getState:      () => GameState,
 *   selectNode:    (nodeId: string) => void,
 *   deselectNode:  () => void,
 *   startProbe:    (nodeId: string) => void,
 *   cancelProbe:   () => void,
 *   startExploit:  (nodeId: string, exploitId: string) => void,
 *   cancelExploit: () => void,
 *   readNode:      (nodeId: string) => void,
 *   lootNode:      (nodeId: string) => void,
 *   ejectIce:      () => void,
 *   rebootNode:    (nodeId: string) => void,
 *   jackOut:       () => void,
 *   logCommand:    (cmd: string) => void,
 * }} ActionContext
 */
```

Note that `logCommand` is on the context — this lets actions (and tests) assert that the correct command string was echoed to the log without importing `log-renderer.js` directly.

Run `make lint` to confirm no type errors introduced.

---

## Phase 2 — Create js/node-actions.js

**Context:** `types.js` now has the full `ActionDef` shape. This phase creates the registry for node-contextual actions. No other files change yet — this is purely additive.

**Prompt:**

Create `js/node-actions.js`. It should:

- Import `ActionDef`, `NodeState`, `GameState`, `ActionContext` types from `./types.js`
- Define and export `NODE_ACTIONS` as a frozen array of `ActionDef` objects, one per action:
  - `probe` — available when `node.accessLevel === "locked"` and `!node.probed` and `!node.rebooting` and no active probe on this node
  - `cancel-probe` — available when `state.activeProbe?.nodeId === node.id`
  - `exploit` — available when `node.visibility === "accessible"` and `!node.rebooting` and `node.accessLevel !== "owned"` and no exploit currently executing on this node; execute calls `ctx.startExploit(node.id, payload.exploitId)`
  - `cancel-exploit` — available when `state.executingExploit?.nodeId === node.id`; desc includes the executing card name if available
  - `read` — available when `(node.accessLevel === "compromised" || node.accessLevel === "owned")` and `!node.read`
  - `loot` — available when `node.accessLevel === "owned"` and `node.read` and `node.macguffins.some(m => !m.collected)`
  - `eject` — available when `state.ice?.active && state.ice.attentionNodeId === node.id`
  - `reboot` — available when `node.accessLevel === "owned"` and `!node.rebooting`

Each action's `execute` calls the appropriate `ctx` method. Actions that require a `nodeId` use `node.id` from the first argument — they do not read it from `payload`.

- Export `getNodeActions(node, state)` that returns `NODE_ACTIONS.filter(a => a.available(node, state))`.

Do not import from `state.js`, `events.js`, or any game-logic module. All mutations go through `ctx`.

Run `make lint`.

---

## Phase 3 — Create js/global-actions.js

**Context:** Node-contextual actions exist. This phase adds the global tier — actions that are available regardless of which node is selected (though they still flow through `available` predicates so future mechanics can gate them).

**Prompt:**

Create `js/global-actions.js`. It should:

- Import relevant types from `./types.js`
- Define and export `GLOBAL_ACTIONS` as a frozen array of `ActionDef` objects:
  - `jackout` — always available (`available: () => state.phase === "playing"`); execute calls `ctx.jackOut()`
  - `select` — available when there exists at least one accessible or revealed node other than the current selection; `payload.nodeId` is the target; execute calls `ctx.selectNode(payload.nodeId)`
  - `deselect` — available when `state.selectedNodeId !== null`; execute calls `ctx.deselectNode()`

- Export `getGlobalActions(node, state)` that returns `GLOBAL_ACTIONS.filter(a => a.available(node, state))`.

Note: `node` may be `null` for global actions (no node selected). The `available` and `execute` signatures accept `node: NodeState | null`.

Run `make lint`.

---

## Phase 4 — Add getAvailableActions() to node-actions.js

**Context:** Both registries exist. This phase adds the single unified query function that consumers will call. Still no existing files modified.

**Prompt:**

In `js/node-actions.js`, add:

```js
import { getGlobalActions } from "./global-actions.js";
import { getActions as getTypeActions } from "./node-types.js";

/**
 * Returns all available actions for the given node and game state,
 * merging global actions, node-contextual actions, and type-specific actions.
 * @param {NodeState | null} node
 * @param {GameState} state
 * @returns {ActionDef[]}
 */
export function getAvailableActions(node, state) {
  const global = getGlobalActions(node, state);
  if (!node) return global;
  return [
    ...global,
    ...getNodeActions(node, state),
    ...getTypeActions(node, state),
  ];
}
```

Write a quick smoke test: call `getAvailableActions(null, someMinimalState)` and assert `jackout` is present; call it with a locked unprobed node and assert `probe` is present.

Run `make lint` and `make test`.

---

## Phase 5 — Tests: availability parity

**Context:** The registry exists and is callable, but no consumers have been changed yet. This phase writes the full test suite *now*, before migration, to lock in the expected behavior. If a predicate is wrong, we catch it here — not after we've deleted the old code.

**Prompt:**

Create `tests/node-actions.test.js`. The goal is to verify that `getAvailableActions()` returns the same action IDs as the current hard-coded logic in `visual-renderer.js` and `console.js` for a representative set of game states.

For each action, test the `available` predicate with minimal state stubs (only populate fields the predicate actually reads):

```js
// Example stub shapes
const lockedNode    = { id: "t", accessLevel: "locked",      probed: false, rebooting: false, visibility: "accessible", macguffins: [], type: "workstation", grade: "D" };
const compromisedNode = { ...lockedNode, accessLevel: "compromised", probed: true };
const ownedNode     = { ...lockedNode, accessLevel: "owned",       probed: true, read: true, macguffins: [{ collected: false }] };
const baseState     = { activeProbe: null, executingExploit: null, ice: null, selectedNodeId: null, phase: "playing", traceSecondsRemaining: null, nodes: {}, player: { hand: [] } };
```

**Required parity tests** — each verifies the registry matches current behavior:

- `probe`: present for locked+unprobed, absent for locked+probed, absent for compromised
- `cancel-probe`: present when `state.activeProbe.nodeId === node.id`, absent otherwise
- `exploit`: present for locked accessible non-rebooting, absent for owned, absent when exploit already executing
- `cancel-exploit`: present when `state.executingExploit.nodeId === node.id`, absent otherwise
- `read`: present for compromised+unread, present for owned+unread, absent when already read
- `loot`: present for owned+read with uncollected macguffins, absent when all collected, absent when unread
- `eject`: present when ICE active at this node, absent when ICE not at this node
- `reboot`: present for owned+not-rebooting, absent when rebooting
- `jackout`: present when `phase === "playing"`, absent when `phase !== "playing"`
- `deselect`: present when `selectedNodeId` is set, absent when null

**Integration parity tests** — verify exact action sets for composite states:

- Locked unprobed node: actions should be `["jackout", "deselect", "probe"]` (no others)
- Owned read node with loot: actions should include `jackout`, `deselect`, `reboot`, `loot` but not `probe` or `read`
- Node with active exploit running: actions should be `["jackout", "deselect", "cancel-exploit"]` only

Run `make test`. All tests must pass before proceeding to Phase 6.

---

## Phase 6 — Migrate visual-renderer.js

**Context:** `getAvailableActions()` is ready and parity-tested. This phase replaces `renderActions()` in `visual-renderer.js`. The parity tests from Phase 5 are the regression net — run them after the change to confirm nothing broke.

**Prompt:**

In `js/visual-renderer.js`:

1. Add import: `import { getAvailableActions } from "./node-actions.js";`
2. Remove the import of `getActions` from `./node-types.js` (it's now subsumed by `getAvailableActions`)
3. Replace the entire body of `renderActions(node, state)` with:

```js
function renderActions(node, state) {
  const actions = getAvailableActions(node, state);
  if (actions.length === 0) return `<span class="nd-dim">No actions available.</span>`;
  return actions.map(a => actionBtn(a.id, a.label, a.desc(node, state))).join("");
}
```

The `actionBtn` and `wireActionButtons` helpers are unchanged.

Note: the current `renderActions` has special early-return logic when an exploit is executing (only shows cancel-exploit). This is now handled by the `available` predicates: when `cancel-exploit` is available (exploit executing on this node), `exploit` is not (its predicate excludes nodes with an active exploit). Verify this is correct before removing the early return.

Run `make lint` and `make test`. Then do a manual browser pass: select a node, verify probe/exploit/read/loot/eject/reboot/cancel-* all appear and disappear correctly as game state changes.

---

## Phase 7 — Migrate console.js

**Context:** Visual rendering is migrated and verified. Console is next — it has the same duplication but with richer exploit card listing. That listing stays as a supplement on top of the registry output.

**Prompt:**

In `js/console.js`:

1. Add import: `import { getAvailableActions } from "./node-actions.js";`
2. Remove the import of `getActions` from `./node-types.js`
3. In `cmdActions()`, replace all the hard-coded per-action `if` chains for probe / cancel-probe / exploit / cancel-exploit / read / loot / eject / reboot / reconfigure / cancel-trace with a loop over `getAvailableActions(sel, s)`:

```js
getAvailableActions(sel, s).forEach(a => {
  lines.push(`  ${a.id.padEnd(24)} — ${a.desc(sel, s)}`);
});
```

4. The rich exploit card listing (sorted cards, match indicators, worn/disclosed status) is **not** part of the action registry — it is supplementary detail shown only in the console. Keep it as a separate block immediately after the `exploit` action appears in the output. You can detect that exploit is available by checking `getAvailableActions(sel, s).some(a => a.id === "exploit")`.

5. `jackout`, `select`, and `deselect` will now appear via `getAvailableActions` — remove their hard-coded equivalents from the top of the function.

The cheat command lines at the bottom of `cmdActions()` are out of scope — leave them as-is.

Run `make lint` and `make test`. Verify `actions` command output in browser or playtest harness.

---

## Phase 8 — Tests: dispatch routing

**Context:** Both rendering consumers are migrated. Before touching `main.js` dispatch, write tests that verify `execute()` on each action calls the right `ActionContext` method with the right arguments. These tests use a mock context — no game state initialization required.

**Prompt:**

In `tests/node-actions.test.js`, add a second describe block: `"action execute() routing"`.

For each action, construct a mock `ActionContext` where all methods are no-op stubs (e.g. using simple functions that record calls), then call `action.execute(node, state, ctx, payload)` and assert the correct method was called with the correct arguments:

```js
function mockCtx(overrides = {}) {
  return {
    getState:      () => baseState,
    selectNode:    () => {},
    deselectNode:  () => {},
    startProbe:    () => {},
    cancelProbe:   () => {},
    startExploit:  () => {},
    cancelExploit: () => {},
    readNode:      () => {},
    lootNode:      () => {},
    ejectIce:      () => {},
    rebootNode:    () => {},
    jackOut:       () => {},
    logCommand:    () => {},
    ...overrides,
  };
}
```

Required routing assertions:
- `probe`: calls `ctx.startProbe(node.id)`
- `cancel-probe`: calls `ctx.cancelProbe()`
- `exploit`: calls `ctx.startExploit(node.id, payload.exploitId)`
- `cancel-exploit`: calls `ctx.cancelExploit()`
- `read`: calls `ctx.readNode(node.id)`
- `loot`: calls `ctx.lootNode(node.id)`
- `eject`: calls `ctx.ejectIce()`
- `reboot`: calls `ctx.rebootNode(node.id)`
- `jackout`: calls `ctx.jackOut()`
- `select`: calls `ctx.selectNode(payload.nodeId)`
- `deselect`: calls `ctx.deselectNode()`

Run `make test`. All tests must pass before proceeding to Phase 9.

---

## Phase 9 — Build ActionContext and simplify main.js

**Context:** Both consumers use the registry. Execute routing is verified by tests. This phase wires `execute()` by building `ActionContext` in `main.js` and replacing individual `on("starnet:action:*")` handlers with a unified dispatch loop.

**Prompt:**

In `js/main.js`:

1. Add import: `import { getAvailableActions } from "./node-actions.js";`

2. In the init function, construct an `ActionContext` object:
```js
/** @type {import('./types.js').ActionContext} */
const ctx = {
  getState,
  selectNode:    (nodeId) => navigateTo(nodeId),
  deselectNode:  ()       => navigateAway(),
  startProbe:    (nodeId) => startProbe(nodeId),
  cancelProbe:   ()       => cancelProbe(),
  startExploit:  (nodeId, exploitId) => startExploit(nodeId, exploitId),
  cancelExploit: ()       => cancelExploit(),
  readNode:      (nodeId) => readNode(nodeId),
  lootNode:      (nodeId) => lootNode(nodeId),
  ejectIce:      ()       => ejectIce(),
  rebootNode:    (nodeId) => rebootNode(nodeId),
  jackOut:       ()       => endRun("success"),
  logCommand:    (cmd)    => logCommand(cmd),
};
```

3. Replace all individual `on("starnet:action:*")` handlers with a single unified dispatcher:
```js
on("starnet:action", ({ actionId, nodeId, fromConsole, ...payload }) => {
  const state = getState();
  const node = nodeId ? state.nodes[nodeId] : (state.selectedNodeId ? state.nodes[state.selectedNodeId] : null);
  const actions = getAvailableActions(node, state);
  const action = actions.find(a => a.id === actionId);
  if (!action) return;
  if (!fromConsole) ctx.logCommand(actionId + (nodeId ? ` ${nodeId}` : ""));
  action.execute(node, state, ctx, { nodeId, ...payload });
});
```

4. Update `wireActionButtons` in `visual-renderer.js` to emit `starnet:action` with `{ actionId, nodeId }` instead of `starnet:action:${action}`.

5. Update all `emitEvent("starnet:action:*")` calls in `console.js` to use the new unified event shape.

Keep the timer event handlers (`TIMER.ICE_MOVE`, etc.) and `starnet:action:run-again` — those are not part of the action registry.

Run `make lint` and `make test`. Do a full browser playthrough.

---

## Phase 10 — Final test pass

**Context:** Everything is wired. Run the full suite and do a final integration check.

**Prompt:**

Run `make check` (lint + all tests). All must pass.

Then do a full browser playthrough covering:
- Probe a node → probe button disappears, cancel-probe appears during scan
- Exploit a node → exploit options appear pre-probe, only matching cards highlighted post-probe
- Cancel an exploit mid-execution → cancel-exploit disappears, exploit reappears
- Read, loot, eject, reboot each appear and disappear at the right access levels
- Type an `actions` command in console → output matches sidebar buttons exactly
- ICE detection → eject appears; eject → eject disappears
- Jack out → run ends cleanly

Fix any discrepancies found. The test suite is the source of truth for availability; the browser pass is the source of truth for visual correctness.
