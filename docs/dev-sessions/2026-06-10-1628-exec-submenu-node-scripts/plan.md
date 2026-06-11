# EXEC Submenu / Verb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group all non-core node actions (set-piece scripts + security subversion) behind a single `EXEC` context-menu entry and `exec` console verb, separating them from the core deck command namespace and top-level tab-completion.

**Architecture:** Approach A — the action/dispatch layer is unchanged; scripts stay in `getAvailableActions()` and stay dispatchable by id. We add a pure partition predicate (`isScriptAction`), inject one synthetic `EXEC` follow-up action when a node has ≥1 script (reusing the existing exploit-card choice picker for the GUI), drop scripts from the dynamic console verb registry, and add a static `exec` command. We rename `eject` → `kick` to free the letter `e` for `exec`.

**Tech Stack:** Vanilla ES modules, JSDoc `@ts-check`, `node:test` + `node:assert/strict`. Run tests via `make test`; lint via `make lint`; both via `make check`.

**Spec:** `docs/dev-sessions/2026-06-10-1628-exec-submenu-node-scripts/spec.md` · **Issue:** #135

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `js/core/action-ids.js` | canonical action id constants | rename `EJECT`→`KICK`; add `EXEC` |
| `js/core/actions/scripts.js` | **new** — pure core/script partition | `CORE_NODE_VERBS`, `isScriptAction` |
| `js/core/actions/scripts.test.js` | **new** — predicate unit tests | — |
| `js/core/actions/node-actions.js` | merge global + graph actions | inject synthetic EXEC; export `getScriptActions` |
| `js/core/actions/action-context.js` | unified dispatcher | EXEC log-echo special-case |
| `js/core/node-graph/game-types.js` | node-type/action templates | `EJECT_ACTION`→`KICK_ACTION` |
| `js/core/node-graph/traits.js` | composable trait defs | `ACTION_TEMPLATES.EJECT`→`.KICK` |
| `js/core/node-graph/traits.test.js` | trait tests | `"eject"`→`"kick"` assertions |
| `js/core/console-commands/dynamic-actions.js` | per-selection dynamic verbs | skip scripts + synthetic EXEC |
| `js/core/console-commands/commands.js` | static console commands | add `exec`; regroup `actions`; help text; kick |
| `js/core/console-commands/commands.test.js` | console command tests | `exec` tests |
| `js/ui/visual-renderer.js` | graph context-menu sync | filter raw scripts from menu |
| `js/ui/log-renderer.js` | log text | "eject"→"kick" in ICE warning |
| `scripts/bot/execute.js`, `scripts/bot/heuristics/{puzzles,evasion}.js`, `scripts/playtest.js` | bot/harness | `A.EJECT`→`A.KICK`; help text |
| `MANUAL.md` | player-facing reference | EXEC section, kick rename, console list |

**Note on module boundaries (avoids a circular import):** `scripts.js` stays *pure* — it imports only `action-ids.js` and exports `CORE_NODE_VERBS` + `isScriptAction`. `getScriptActions` and `buildExecAction` live in `node-actions.js` (which already owns `getAvailableActions`). `buildExecAction` closes over the already-wrapped script ActionDefs, so `EXEC.execute` never needs to re-query `getAvailableActions` — no import cycle.

---

## Task 1: Rename `eject` → `kick`

Frees the first letter `e` for `exec`. Only the **player-facing** verb/label/id changes. The internal mechanism keeps its names: `ejectIce()` ctx method and `E.ICE_EJECTED` event are NOT renamed.

**Files:**
- Modify: `js/core/action-ids.js:24`
- Modify: `js/core/node-graph/game-types.js:156-166, 409`
- Modify: `js/core/node-graph/traits.js:244`
- Modify: `js/core/actions/node-actions.js:5, 36`
- Modify: `js/core/console-commands/commands.js:52, 85, 156, 162, 284`
- Modify: `js/ui/log-renderer.js:159`
- Modify: `scripts/bot/execute.js:18, 117, 127`
- Modify: `scripts/bot/heuristics/puzzles.js:19`
- Modify: `scripts/bot/heuristics/evasion.js:24, 31, 34` (rename the verb usages; the internal const `ICE_ON_NODE_EJECT` may stay — it's not player-facing)
- Modify: `scripts/playtest.js:123`
- Test: `js/core/node-graph/traits.test.js:229, 305` (existing assertions flip eject→kick — they go red on rename, green after)
- Test: `tests/integration.test.js` (new behavior test)

- [ ] **Step 1: Flip the existing trait test assertions (red first)**

In `js/core/node-graph/traits.test.js`, change both occurrences:

```js
assert.ok(actionIds.includes("eject"));
```
to
```js
assert.ok(actionIds.includes("kick"));
```

- [ ] **Step 2: Run them — verify they fail**

Run: `node --test js/core/node-graph/traits.test.js`
Expected: FAIL — the action id is still `"eject"`.

- [ ] **Step 3: Rename the constant**

`js/core/action-ids.js:24` — replace:
```js
  EJECT: "eject",
```
with:
```js
  KICK: "kick",
```

- [ ] **Step 4: Rename the action template**

`js/core/node-graph/game-types.js` lines 155-166 — replace the `EJECT_ACTION` block:
```js
/** @type {ActionDef} */
const KICK_ACTION = {
  id: A.KICK,
  label: "KICK",
  desc: "Boot ICE attention to a random adjacent node.",
  requires: [
    { type: "node-attr", attr: "accessLevel", eq: "owned" },
  ],
  effects: [
    { effect: "ctx-call", method: "ejectIce", args: [] },
  ],
};
```
And line 409 — replace `EJECT: EJECT_ACTION,` in the `ACTION_TEMPLATES` map with:
```js
  KICK: KICK_ACTION,
```

- [ ] **Step 5: Update the trait reference and the ICE filter**

`js/core/node-graph/traits.js:244` — replace `ACTION_TEMPLATES.EJECT,` with `ACTION_TEMPLATES.KICK,`.

`js/core/actions/node-actions.js:36` — replace `if (action.id === A.EJECT) {` with `if (action.id === A.KICK) {`. Also update the doc comment at line 5 (`...cancel-*, eject,` → `...cancel-*, kick,`).

- [ ] **Step 6: Update console command text + ids**

`js/core/console-commands/commands.js`:
- Line 156: `if (has.has(A.EJECT))  lines.push(\`  eject ...\`)` → `if (has.has(A.KICK))   lines.push(\`  kick                     — push ICE to adjacent node\`)`
- Line 162: in the `standardIds` array, replace `A.EJECT` with `A.KICK`.
- Line 284 (help): `"  eject                     Push ICE attention to adjacent node.",` → `"  kick                      Push ICE attention to adjacent node.",`
- Lines 52, 85 comments: `eject` → `kick`.

- [ ] **Step 7: Update player-facing log text**

`js/ui/log-renderer.js:159` — change `disengage or eject` to `disengage or kick`.

- [ ] **Step 8: Update bot + harness references**

- `scripts/bot/execute.js:18` and `scripts/bot/heuristics/puzzles.js:19`: in the KNOWN-actions set, `A.EJECT` → `A.KICK`.
- `scripts/bot/execute.js:127`: `actionId: A.EJECT` → `actionId: A.KICK` (comment at 117 optional).
- `scripts/bot/heuristics/evasion.js:31`: `action: A.EJECT,` → `action: A.KICK,` (reason string + const name may stay).
- `scripts/playtest.js:123`: help string `eject` → `kick`.

- [ ] **Step 9: Add a behavior test (kick == former eject)**

In `tests/integration.test.js`, add to the ICE area (reuse `buildAlertLAN`, `startIce`, `getAvailableActions`, `A`, `withEvents`-style capture):

```js
describe("kick action (renamed from eject)", () => {
  it("kick is the verb on an owned node with ICE present, and ejects ICE", () => {
    clearAll();
    initGame(() => buildAlertLAN({ ice: { grade: "C" } }), "itest-kick");
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    startIce();
    // Force ICE attention to ids-1 so the kick availability filter passes.
    const ice = Object.values(s.ice.instances).find((i) => i?.active);
    ice.attentionNodeId = "ids-1";
    const ids = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(ids.includes("kick"), "kick should be available");
    assert.ok(!ids.includes("eject"), "eject must be gone");

    let ejected = false;
    const h = () => { ejected = true; };
    on(E.ICE_EJECTED, h);
    s.nodeGraph.executeAction("ids-1", "kick");
    off(E.ICE_EJECTED, h);
    assert.ok(ejected, "kick must fire ICE_EJECTED (internal mechanism unchanged)");
  });
});
```

> If `buildAlertLAN`'s ICE option shape differs, mirror an existing ICE test in the file for the exact `startIce`/instance setup. The key assertions are: `kick` present, `eject` absent, `ICE_EJECTED` fires.

- [ ] **Step 10: Run the full suite**

Run: `make test`
Expected: PASS (traits tests now green; new kick test green; no `eject` references remain except `ejectIce`/`ICE_EJECTED`).

- [ ] **Step 11: Lint**

Run: `make lint`
Expected: no type errors.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m 'refactor: rename player verb eject -> kick (frees e for exec) (#135)'
```

---

## Task 2: Partition module (`scripts.js`) + `EXEC` id

**Files:**
- Modify: `js/core/action-ids.js`
- Create: `js/core/actions/scripts.js`
- Test: `js/core/actions/scripts.test.js`

- [ ] **Step 1: Write the failing predicate test**

Create `js/core/actions/scripts.test.js`:

```js
// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CORE_NODE_VERBS, isScriptAction } from "./scripts.js";
import { A } from "../action-ids.js";

describe("isScriptAction — core/script partition", () => {
  test("core node verbs are NOT scripts", () => {
    for (const id of [A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.MINE, A.KICK,
                       A.REBOOT, A.ABORT, A.TARGET, A.UNTARGET, A.JACKOUT, A.EXEC]) {
      assert.equal(isScriptAction(id), false, `${id} should be core`);
    }
  });

  test("set-piece + subversion actions ARE scripts", () => {
    for (const id of ["corrupt", "spoof", "disarm", "unlock-vault",
                      "extract-token", "extract-key", "decrypt-loot",
                      "scan-vault", "cancel-trace", "access-darknet"]) {
      assert.equal(isScriptAction(id), true, `${id} should be a script`);
    }
  });

  test("EXEC is in the core set so it is never treated as a script", () => {
    assert.ok(CORE_NODE_VERBS.has(A.EXEC));
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `node --test js/core/actions/scripts.test.js`
Expected: FAIL — `scripts.js` and `A.EXEC` don't exist.

- [ ] **Step 3: Add the `EXEC` id**

In `js/core/action-ids.js`, in the `// Node-specific actions` group, add:
```js
  EXEC: "exec",
```

- [ ] **Step 4: Create the partition module**

Create `js/core/actions/scripts.js`:
```js
// @ts-check
/**
 * Core/script partition. A node-contextual action is a "script" (grouped under
 * the EXEC submenu/verb) iff its id is NOT in the core deck-verb allowlist.
 * New set-piece-authored node actions become scripts automatically.
 */
import { A } from "../action-ids.js";

/** Core node verbs that stay top-level (never grouped under EXEC). */
export const CORE_NODE_VERBS = new Set([
  A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.MINE, A.KICK,
  A.REBOOT, A.ABORT, A.TARGET, A.UNTARGET, A.JACKOUT,
  A.EXEC, // synthetic submenu action — not itself a script
]);

/** @param {string} id @returns {boolean} */
export function isScriptAction(id) {
  return !CORE_NODE_VERBS.has(id);
}
```

- [ ] **Step 5: Run it — verify it passes**

Run: `node --test js/core/actions/scripts.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/core/action-ids.js js/core/actions/scripts.js js/core/actions/scripts.test.js
git commit -m 'feat: add core/script partition predicate + EXEC action id (#135)'
```

---

## Task 3: Inject the synthetic `EXEC` action

**Files:**
- Modify: `js/core/actions/node-actions.js`
- Test: `tests/integration.test.js`

- [ ] **Step 1: Write the failing integration test**

In `tests/integration.test.js`, add (reusing `buildAlertLAN`, `getAvailableActions`, `A`):

```js
describe("EXEC synthetic action injection", () => {
  beforeEach(() => { clearAll(); initGame(() => buildAlertLAN(), "itest-exec"); });

  it("a node with a script (owned IDS → corrupt) gains an EXEC action whose followup lists the script", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actions = getAvailableActions(s.nodes["ids-1"], s);
    const exec = actions.find((a) => a.id === A.EXEC);
    assert.ok(exec, "EXEC should be present");
    assert.ok(exec.followup, "EXEC should carry a followup");
    const choiceIds = exec.followup.choices(s.nodes["ids-1"], s).map((c) => c.id);
    assert.ok(choiceIds.includes("corrupt"), "corrupt should be an EXEC choice");
  });

  it("a node with no scripts gets no EXEC action", () => {
    const s = getState();
    // gateway has only core verbs (probe/xploit), no scripts
    const actions = getAvailableActions(s.nodes["gateway"], s);
    assert.ok(!actions.some((a) => a.id === A.EXEC), "no EXEC when no scripts");
  });

  it("EXEC.execute runs the chosen script (forwarding disabled), same as dispatching it directly", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const exec = getAvailableActions(s.nodes["ids-1"], s).find((a) => a.id === A.EXEC);
    exec.execute(s.nodes["ids-1"], s, {}, { scriptId: "corrupt", nodeId: "ids-1" });
    assert.equal(s.nodes["ids-1"].forwardingEnabled, false);
  });
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `node --test tests/integration.test.js`
Expected: FAIL — no `EXEC` action exists.

- [ ] **Step 3: Inject EXEC in `getAvailableActions` + export `getScriptActions`**

In `js/core/actions/node-actions.js`:

Add import at top:
```js
import { isScriptAction } from "./scripts.js";
```

Replace the end of `getAvailableActions` (current lines 43-46) so it appends EXEC:
```js
  // Wrap each graph ActionDef into a game-compatible ActionDef
  const wrapped = filtered.map(ga => wrapGraphAction(ga));

  // Group non-core node actions (scripts) under a synthetic EXEC follow-up action.
  const scripts = wrapped.filter(a => isScriptAction(a.id));
  const result = [...global, ...wrapped];
  if (scripts.length > 0) result.push(buildExecAction(scripts));
  return result;
}

/**
 * Node-contextual scripts available on this node (non-core actions only),
 * without the synthetic EXEC wrapper. Used by the console (`exec`, `actions`).
 * @param {NodeState | null} node @param {GameState} state @returns {ActionDef[]}
 */
export function getScriptActions(node, state) {
  return getAvailableActions(node, state).filter(a => isScriptAction(a.id));
}

/**
 * Build the synthetic EXEC action from already-wrapped script ActionDefs.
 * Closes over `scripts` so execute() needs no re-query (avoids an import cycle).
 * @param {ActionDef[]} scripts @returns {ActionDef}
 */
function buildExecAction(scripts) {
  const byId = new Map(scripts.map(s => [s.id, s]));
  return {
    id: A.EXEC,
    label: "EXEC",
    available: () => true,
    desc: () => "run a script on this node",
    followup: {
      title: () => "EXEC",
      choices: () => scripts.map(s => ({
        id: s.id, payloadKey: "scriptId", render: s.label, data: {},
      })),
      empty: () => "no scripts available",
    },
    execute: (node, state, ctx, payload) => {
      const script = byId.get(payload?.scriptId);
      script?.execute?.(node, state, ctx, { nodeId: node.id });
    },
  };
}
```

> `A` is already imported in `node-actions.js`. `isScriptAction(A.EXEC)` is `false`, so `getScriptActions` excludes the synthetic action and only returns real scripts.

- [ ] **Step 4: Run it — verify it passes**

Run: `node --test tests/integration.test.js`
Expected: PASS.

- [ ] **Step 5: Lint**

Run: `make lint`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add js/core/actions/node-actions.js tests/integration.test.js
git commit -m 'feat: inject synthetic EXEC follow-up action for node scripts (#135)'
```

---

## Task 4: Dispatcher log-echo special-case

So the GUI EXEC pick echoes `exec corrupt`, not `exec`, with exactly one echo — mirroring how `xploit <card>` already reads.

**Files:**
- Modify: `js/core/actions/action-context.js:74-78`
- Test: `tests/integration.test.js`

- [ ] **Step 1: Write the failing dispatcher test**

In `tests/integration.test.js`, add (uses `initActionDispatcher`, `buildActionContext` — import them at the top of the file from `../js/core/actions/action-context.js`):

```js
describe("EXEC dispatch echo", () => {
  let dispatcherReady = false;
  before(() => {
    initActionDispatcher(buildActionContext());
    dispatcherReady = true;
  });

  it("dispatching exec with a scriptId echoes 'exec <script>' once and runs the script", () => {
    clearAll();
    initGame(() => buildAlertLAN(), "itest-exec-echo");
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);

    const echoes = [];
    const h = ({ cmd }) => echoes.push(cmd);
    on(E.COMMAND_ISSUED, h);
    emitEvent("starnet:action", { actionId: "exec", nodeId: "ids-1", scriptId: "corrupt" });
    off(E.COMMAND_ISSUED, h);

    assert.deepEqual(echoes, ["exec corrupt"], "exactly one echo reading 'exec corrupt'");
    assert.equal(getState().nodes["ids-1"].forwardingEnabled, false, "script ran");
  });
});
```

> `initActionDispatcher` registers a persistent `starnet:action` listener — register it once in `before()` for this describe only. If another describe in the file later relies on no dispatcher being present, keep this block last, or guard with the `dispatcherReady` flag pattern shown.

- [ ] **Step 2: Run it — verify it fails**

Run: `node --test tests/integration.test.js`
Expected: FAIL — echo reads `exec`, not `exec corrupt`.

- [ ] **Step 3: Add the echo special-case**

In `js/core/actions/action-context.js`, replace the `logStr` block (lines 74-78):
```js
    if (!fromConsole) {
      // For exploit, log the card reference; for exec, log the chosen script —
      // both match the console output rather than the raw actionId.
      const logStr =
        (actionId === A.XPLOIT && (payload.cardIndex ?? payload.exploitId))
          ? `xploit ${payload.cardIndex ?? payload.exploitId}`
          : (actionId === A.EXEC && payload.scriptId)
            ? `exec ${payload.scriptId}`
            : actionId + (nodeId ? ` ${nodeId}` : "");
      emitEvent(E.COMMAND_ISSUED, { cmd: logStr });
    }
```

> `A` is already imported in `action-context.js`.

- [ ] **Step 4: Run it — verify it passes**

Run: `node --test tests/integration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/actions/action-context.js tests/integration.test.js
git commit -m 'feat: dispatcher echoes "exec <script>" for the EXEC menu pick (#135)'
```

---

## Task 5: Console — drop scripts from verb namespace, add `exec`

**Files:**
- Modify: `js/core/console-commands/dynamic-actions.js`
- Modify: `js/core/console-commands/commands.js`
- Test: `js/core/console-commands/commands.test.js`

- [ ] **Step 1: Write failing `exec` command tests**

In `js/core/console-commands/commands.test.js`, add a describe block. Owning the IDS for these tests uses the same `setNodeAccessLevel` import already present, plus a `forwardingEnabled` graph attr:

```js
describe("exec", () => {
  /** Own ids-1, enable forwarding, select it — so `corrupt` is an available script. */
  function selectOwnedIds() {
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);
    navigateTo("ids-1");
  }

  it("`exec` with no arg lists the node's scripts", () => {
    selectOwnedIds();
    const ls = logs(() => getCommand("exec").execute([]));
    const text = ls.map((l) => l.text).join("\n");
    assert.ok(text.includes("corrupt"), "should list corrupt");
  });

  it("`exec corrupt` dispatches the corrupt action on the selected node", () => {
    selectOwnedIds();
    const evts = actions(() => getCommand("exec").execute(["corrupt"]));
    assert.equal(evts.length, 1);
    assert.equal(evts[0].actionId, "corrupt");
    assert.equal(evts[0].nodeId, "ids-1");
    assert.equal(evts[0].fromConsole, true);
  });

  it("`exec bogus` logs an error and dispatches nothing", () => {
    selectOwnedIds();
    let evts;
    const ls = logs(() => { evts = actions(() => getCommand("exec").execute(["bogus"])); });
    assert.ok(ls.some((l) => l.type === "error"));
    assert.equal(evts.length, 0);
  });

  it("tab-completion returns script ids", () => {
    selectOwnedIds();
    const res = getCommand("exec").complete([], "", getState());
    assert.ok(res.insertTexts.includes("corrupt"));
  });

  it("`exec` with no node selected logs an error", () => {
    const ls = logs(() => getCommand("exec").execute([]));
    assert.ok(ls.some((l) => l.type === "error"));
  });
});
```

> If `ids-1` is `hidden`/`obscured` after init so `navigateTo` won't select it, set `s.nodes["ids-1"].visibility = "accessible"` before `navigateTo`, mirroring how other tests in this file prepare a node. The assertions that matter are the dispatch payload and the listing.

- [ ] **Step 2: Run them — verify they fail**

Run: `node --test js/core/console-commands/commands.test.js`
Expected: FAIL — there is no `exec` command.

- [ ] **Step 3: Add the `exec` command**

In `js/core/console-commands/commands.js`:

Extend the import from `node-actions.js` (line 7):
```js
import { getAvailableActions, getScriptActions } from "../actions/node-actions.js";
```

Add this CommandDef to the `COMMANDS` array (place it after the `xploit` block, near the other node-arg commands):
```js
  // ── exec — run a node script (grouped non-core node actions) ─────────────────
  { verb: "exec",
    complete(args, partial, state) {
      if (args.length > 0) return null;
      const sel = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
      if (!sel) return null;
      return fromList(getScriptActions(sel, state).map((a) => a.id), partial);
    },
    execute(args) {
      const s = getState();
      const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
      if (!sel) { addLogEntry("exec: no node selected.", "error"); return; }
      const scripts = getScriptActions(sel, s);
      if (args.length === 0) {
        if (scripts.length === 0) { addLogEntry(`no scripts on ${sel.id}.`, "meta"); return; }
        addLogEntry(`scripts on ${sel.id}: ${scripts.map((a) => a.id).join("  ")}`, "meta");
        return;
      }
      const id = args[0].toLowerCase();
      if (!scripts.some((a) => a.id === id)) {
        addLogEntry(`exec: no script "${id}" on ${sel.id}.`, "error");
        return;
      }
      dispatch(id, { nodeId: sel.id });
    },
  },
```

> `fromList`, `dispatch`, `addLogEntry`, `getState` are all already imported in this file.

- [ ] **Step 4: Drop scripts (and synthetic EXEC) from the dynamic verb registry**

In `js/core/console-commands/dynamic-actions.js`:

Add import:
```js
import { isScriptAction } from "../actions/scripts.js";
```

Add `A.EXEC` to the `STATIC_ACTION_IDS` set (so the synthetic EXEC is never registered as a dynamic verb):
```js
const STATIC_ACTION_IDS = new Set([
  A.XPLOIT,
  A.TARGET, A.UNTARGET, A.JACKOUT,
  A.EXEC, // synthetic submenu action — `exec` is a static command
]);
```

In `syncDynamicActions`, inside the `for (const action of graphActions)` loop, after the `STATIC_ACTION_IDS` skip, add:
```js
    if (isScriptAction(action.id)) continue; // scripts live under `exec`
```

- [ ] **Step 5: Run the command tests — verify they pass**

Run: `node --test js/core/console-commands/commands.test.js`
Expected: PASS.

- [ ] **Step 6: Add a namespace-separation test**

Create `js/core/console-commands/dynamic-actions.test.js`:
```js
// @ts-check
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame, getState } from "../state.js";
import { navigateTo } from "../navigation.js";
import { clearAll } from "../timers.js";
import { emitEvent, E } from "../events.js";
import { registry } from "./registry.js";
import { initDynamicActions } from "./dynamic-actions.js";

describe("dynamic-actions namespace separation", () => {
  beforeEach(() => { clearAll(); initGame(() => buildCorporateFoothold()); });

  test("a node with scripts registers no script verbs (only core verbs + static exec)", () => {
    initDynamicActions();
    const s = getState();
    const ids = Object.values(s.nodes).find((n) => n.type === "ids");
    assert.ok(ids, "expected an IDS node");
    s.nodeGraph.setNodeAttr(ids.id, "accessLevel", "owned");
    s.nodeGraph.setNodeAttr(ids.id, "forwardingEnabled", true);
    s.nodes[ids.id].visibility = "accessible";
    navigateTo(ids.id);
    emitEvent(E.STATE_CHANGED, s); // trigger syncDynamicActions

    assert.equal(registry.has("corrupt"), false, "script verb must not be top-level");
    assert.equal(registry.has("exec"), true, "static exec command stays");
  });
});
```

> `initDynamicActions` adds persistent listeners; this test file runs in its own process so stacking is not a concern. If `registry`/`initDynamicActions` exports differ, check `dynamic-actions.js` and `registry.js` for the exact names (they are `registry` and `initDynamicActions`). `exec` is registered when `COMMANDS` is loaded via `index.js`; if this test imports neither, register it explicitly or import `./index.js` for its side effects.

- [ ] **Step 7: Run it — confirm pass (after registering `exec`)**

Run: `node --test js/core/console-commands/dynamic-actions.test.js`
Expected: PASS. If `registry.has("exec")` is false, add `import "./index.js";` at the top of the test to load the static command set.

- [ ] **Step 8: Lint + commit**

```bash
make lint
git add js/core/console-commands/
git commit -m 'feat: exec console verb + drop node scripts from top-level namespace (#135)'
```

---

## Task 6: `actions` listing grouping + `help` text

Show scripts grouped under `exec` in `actions` (so players discover them without extra commands), and update `help`.

**Files:**
- Modify: `js/core/console-commands/commands.js` (`actions` block ~159-169, `help` ~277-286)
- Test: `js/core/console-commands/commands.test.js`

- [ ] **Step 1: Write failing tests**

Add to `commands.test.js`:
```js
describe("actions listing groups scripts under exec", () => {
  it("lists `exec` and an indented `corrupt` for an owned IDS", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);
    s.nodes["ids-1"].visibility = "accessible";
    navigateTo("ids-1");
    const text = logs(() => getCommand("actions").execute([])).map((l) => l.text).join("\n");
    assert.ok(/exec <script>/.test(text), "should advertise exec");
    assert.ok(/^\s+corrupt/m.test(text), "corrupt should be indented under exec");
  });
});

// extend the existing help test's verb list:
//   for (const verb of ["target", "probe", "xploit", "jackout", "status", "cheat", "exec"]) {
```

- [ ] **Step 2: Run — verify fail**

Run: `node --test js/core/console-commands/commands.test.js`
Expected: FAIL — no `exec <script>` grouping; help lacks `exec`.

- [ ] **Step 3: Regroup the `actions` block**

In `js/core/console-commands/commands.js`, replace the type-specific block (current lines 159-169, the `standardIds`/`typeSpecific` computation and its `forEach`) with:
```js
        // Non-core node actions are grouped under `exec` (see scripts.js).
        const scripts = getScriptActions(sel, s);
        if (scripts.length > 0) {
          lines.push(`  exec <script>            — run a script on ${sel.id}:`);
          scripts.forEach((a) => {
            const desc = typeof a.desc === "function" ? a.desc(sel, s) : (a.desc || a.label);
            lines.push(`    ${a.id.padEnd(22)} — ${desc}`);
          });
        }
```

> This removes the `standardIds` array and the bare type-specific listing entirely. The core verbs (probe/xploit/dump/fetch/kick/reboot) keep their existing explicit `lines.push` entries above this block.

- [ ] **Step 4: Update `help`**

In the `help` command's `lines` array: remove the standalone `corrupt [node]` entry (line ~281) and add an `exec` entry near the node verbs:
```js
        "  exec [<script>]           Run a node script (corrupt, unlock-vault, …). No arg lists scripts.",
```
(The `eject`→`kick` help line was already changed in Task 1.)

- [ ] **Step 5: Run — verify pass**

Run: `node --test js/core/console-commands/commands.test.js`
Expected: PASS.

- [ ] **Step 6: Lint + commit**

```bash
make lint
git add js/core/console-commands/commands.js js/core/console-commands/commands.test.js
git commit -m 'feat: actions listing + help group node scripts under exec (#135)'
```

---

## Task 7: Context menu — hide raw scripts behind EXEC

The synthetic EXEC already arrives via `getAvailableActions`; we just stop rendering the raw script buttons so only `EXEC ▸` shows.

**Files:**
- Modify: `js/ui/visual-renderer.js:223-224` (`syncContextMenu`)

> `js/ui/components/starnet-node-panel.js` was audited — it does not render the action list (only vulns/macguffins/ice-timers + an untarget button), so no change is needed there. The graph context menu is the only button surface.

- [ ] **Step 1: Filter raw scripts from the menu**

In `js/ui/visual-renderer.js`, add the import (top of file, with the other action imports):
```js
import { isScriptAction } from "../core/actions/scripts.js";
```

In `syncContextMenu`, extend the filter (line ~224):
```js
  const actions = getAvailableActions(node, state)
    .filter((a) => !a.noSidebar && a.id !== A.TARGET && a.id !== A.JACKOUT
      && a.id !== A.UNTARGET && a.id !== A.ABORT
      && !isScriptAction(a.id)); // scripts are reached via the EXEC ▸ entry
```

> `isScriptAction(A.EXEC)` is `false`, so the synthetic `EXEC` entry (which has a `followup`) survives the filter and renders with the `▸` indicator via the existing `hasFollowup` path. No component change needed — clicking it opens the existing `starnet:open-choices` picker.

- [ ] **Step 2: Lint**

Run: `make lint`
Expected: no type errors. (This is DOM/`@ts-nocheck`-adjacent UI code; verify it loads.)

- [ ] **Step 3: Manual smoke in the browser**

Run: `make bundle-vendor` (if not already built), then `make serve`. Open the game, navigate to and own an IDS node. Confirm:
- The context menu shows core verbs + `EXEC ▸` (no bare `CORRUPT` button).
- Clicking `EXEC ▸` opens the picker listing `corrupt`.
- Picking `corrupt` runs it; the log shows `> exec corrupt` followed by the corrupt effect line.

- [ ] **Step 4: Commit**

```bash
git add js/ui/visual-renderer.js
git commit -m 'feat: hide raw node scripts behind the EXEC submenu in the context menu (#135)'
```

---

## Task 8: MANUAL.md

**Files:**
- Modify: `MANUAL.md`

- [ ] **Step 1: Node Actions Reference table (line ~504)**

Add an `exec` row and fold the scripts under it. Concretely: keep core rows; change the `corrupt`/`spoof`/`cancel-trace`/`access-darknet` rows to note they're run via `exec`, and add a heading row. Replace the `eject` row with `kick`. Minimal edit:

- Add above the script rows:
  `| \`exec <script>\` | A compromised/owned node has node scripts | Lists/runs the node's scripts (corrupt, spoof, unlock-vault, cancel-trace, access-darknet, …) |`
- Change `| \`eject\`        | Owned node + ICE is present here               | Boots ICE to adjacent node |` to `| \`kick\`         | Owned node + ICE is present here               | Boots ICE to adjacent node |`
- Append " (run via `exec`)" to the Effect cell of `corrupt`, `spoof`, `cancel-trace`, and the `access-darknet` row.

- [ ] **Step 2: ICE section (line ~480)**

Change `**Eject** (owned nodes) — boots ICE to a random adjacent node: \`> eject\`` to `**Kick** (owned nodes) — boots ICE to a random adjacent node: \`> kick\``. Update the TIPS reference (line ~578, "have an eject") to "have a kick".

- [ ] **Step 3: Access Levels (line ~119)**

`...reboot the node, or eject ICE.` → `...reboot the node, or kick ICE.`

- [ ] **Step 4: Console Commands block (lines ~537-541)**

Replace:
```
corrupt [node]         Disable IDS event forwarding.
spoof [node]           Recalibrate security monitor.
eject                  Push ICE off current node to adjacent node.
```
with:
```
exec [<script>]        Run a node script (corrupt, spoof, unlock-vault, …). No arg lists scripts.
kick                   Push ICE off current node to adjacent node.
```
(Leave `reboot`, `cancel-trace`, `jackout` lines; `cancel-trace` and `access-darknet` are now reached via `exec` — note that inline if desired.)

- [ ] **Step 5: Subverting the IDS (line ~405-408)**

The example shows `> corrupt`. Update to `> exec corrupt` to match the new console flow.

- [ ] **Step 6: Commit**

```bash
git add MANUAL.md
git commit -m 'docs: MANUAL — EXEC submenu, exec verb, eject→kick rename (#135)'
```

---

## Task 9: Full verification

- [ ] **Step 1: Lint + test**

Run: `make check`
Expected: lint clean, all tests PASS.

- [ ] **Step 2: Playtest harness smoke (parallel entry point)**

```bash
node scripts/playtest.js reset
node scripts/playtest.js "target ids-1"   # or any node id from status
node scripts/playtest.js "status full"
```
Expected: no crash; `kick`/`exec` referenced correctly in help/actions output. (Cheat-own a node if needed to surface a script, then confirm `exec` lists it — note: cheat commands aren't supported in the harness, so verify via the browser smoke in Task 7 instead if needed.)

- [ ] **Step 3: Bot census smoke (verify difficulty curve didn't regress)**

Run: `node scripts/bot-census.js --time F --money F --seeds 10`
Expected: ~80% success. The bot uses `A.KICK` after the rename; confirm no errors about unknown actions.

- [ ] **Step 4: Open PR**

```bash
git push -u origin exec-submenu-node-scripts
gh pr create --title "EXEC submenu/verb for non-core node actions" \
  --body "Closes #135. Groups set-piece + subversion node actions under a single EXEC menu entry and \`exec\` console verb; renames eject→kick to free \`e\`. See docs/dev-sessions/2026-06-10-1628-exec-submenu-node-scripts/." \
  --base main
```

---

## Self-Review notes

- **Spec coverage:** partition (Task 2), EXEC injection (Task 3), dispatcher symmetry/echo (Task 4), console namespace + `exec` (Task 5), `actions`/`help` grouping (Task 6), context menu (Task 7), `eject`→`kick` (Task 1), MANUAL (Task 8), bot/harness parity + verification (Tasks 1, 9). All spec sections map to a task.
- **Module-boundary correction vs spec:** spec placed `getScriptActions`/`buildExecAction` in `scripts.js`; the plan keeps `scripts.js` pure and puts those two in `node-actions.js` to avoid a `node-actions ↔ scripts` import cycle. Net behavior identical.
- **Type/name consistency:** `A.KICK` (value `"kick"`), `A.EXEC` (value `"exec"`), `isScriptAction`, `getScriptActions`, `buildExecAction`, payloadKey `"scriptId"` — used identically across all tasks.
- **cancel-trace** intentionally lands under EXEC (spec non-goal: UX-friction mitigation deferred).
