# Plan: Node Type Registry & Behavior System

## Architectural Note: Avoiding Circular Dependencies

`node-types.js` must be **pure** — no imports from other game modules (`alert.js`,
`ice.js`, `loot.js`). This avoids circular dependencies since those modules will
import from `node-types.js`.

Behavior atom hooks receive a `ctx` object from their dispatcher containing the
functions they need (dependency injection):

```js
// node-types.js — atom is pure, receives what it needs
"iceResident": {
  onOwned: (node, state, ctx) => {
    if (state.ice?.active && state.ice.residentNodeId === node.id) {
      ctx.stopIce();
      ctx.disableIce();
    }
  },
}

// node-lifecycle.js — dispatcher assembles ctx
import { stopIce, disableIce } from "./ice.js";
on(E.NODE_ACCESSED, ({ nodeId, next }) => {
  if (next !== "owned") return;
  const ctx = { stopIce, disableIce, cancelTraceCountdown };
  for (const atom of getBehaviors(node)) atom.onOwned?.(node, s, ctx);
});
```

This pattern applies to all atom hooks: `onAlertRaised`, `onReconfigured`, `onInit`.

---

## Step 1 — JSDoc typedefs in `types.js`

**Builds on:** nothing — pure foundation.
**State after:** new types available for `@typedef` use; `make check` still passes.

Add the following typedefs to `js/types.js`:

- `BehaviorAtom` — `{ id: string, stateFields?: Object, onInit?: fn, onOwned?: fn, onAlertRaised?: fn, onReconfigured?: fn }`
  - All hook functions have signature `(node: NodeState, state: GameState, ctx: Object) => void`
- `ActionDef` — `{ id: string, label: string, available: (node, state) => boolean, desc: (node, state) => string }`
- `GradeOverride` — `{ behaviors?: string[], extraBehaviors?: string[], actions?: ActionDef[], extraActions?: ActionDef[], combatConfig?: CombatConfig, vulnConfig?: VulnConfig }`
- `NodeTypeDef` — `{ behaviors: string[], actions: ActionDef[], lootConfig?: {count: number[]}, combatConfig?: CombatConfig, vulnConfig?: VulnConfig, gradeOverrides?: Object }`
- `CombatConfig` — `{ gradeModifier?: Object, disclosureChance?: Object, patchLag?: Object }` (each a Grade → number map)
- `VulnConfig` — `{ count?: Object, rarities?: Object }` (each a Grade → value map)

Run `make check` to confirm clean.

---

## Step 2 — `js/node-types.js`: behavior atoms + registry + helpers

**Builds on:** Step 1 types.
**State after:** registry exists and is fully queryable; nothing wired to it yet.

Create `js/node-types.js`. **No imports from other game modules** (see architectural note).

### 2a — Behavior atom definitions

Define `BEHAVIORS` map (keyed by atom id). Each atom is a plain `BehaviorAtom` object.
Hook implementations in terms of `ctx`:

- `detection.onAlertRaised(node, state, ctx)` — calls `ctx.propagateAlertEvent(node.id)`
- `detection.onReconfigured(node, state, ctx)` — calls `ctx.recomputeGlobalAlert()`
- `detection.stateFields` — `{ eventForwardingDisabled: false }`
- `direct-trace.onAlertRaised(node, state, ctx)` — calls `ctx.startTraceCountdown()` (skips propagation)
- `monitor.onOwned(node, state, ctx)` — calls `ctx.cancelTraceCountdown()`
- `iceResident.onOwned(node, state, ctx)` — if `state.ice?.active && state.ice.residentNodeId === node.id`, calls `ctx.stopIce()` then `ctx.disableIce()`
- `lootable.onInit(node, state, ctx)` — reads `ctx.typeDef.lootConfig.count`, generates macguffins via `ctx.generateMacguffin()`, assigns to `node.macguffins`

### 2b — Node type registry

Define `NODE_TYPES` with all 8 types:

- `ids` — behaviors: `["detection"]`; reconfigure action; gradeOverrides S+A add `direct-trace`
- `security-monitor` — behaviors: `["monitor", "iceResident"]`; cancel-trace action
- `fileserver` — behaviors: `["lootable"]`; lootConfig `{ count: [1, 2] }`
- `cryptovault` — behaviors: `["lootable"]`; lootConfig `{ count: [1, 3] }`; combatConfig overrides (harder gradeModifier + higher disclosureChance vs defaults)
- `workstation` — behaviors: `["lootable"]`; lootConfig `{ count: [0, 1] }`
- `gateway`, `router`, `firewall` — behaviors: `[]`; actions: `[]`

### 2c — Registry query helpers

```js
export function getNodeType(type)        // NODE_TYPES[type]; throws on unknown
export function resolveNode(node)        // merges gradeOverrides[node.grade] onto base
export function getBehaviors(node)       // resolves behavior IDs → BEHAVIORS objects
export function hasBehavior(node, id)    // true if resolved behaviors includes id
export function getStateFields(node)     // merges stateFields from all resolved behaviors
export function getActions(node, state)  // ActionDef[] where available(node, state) === true
```

`resolveNode` merge rules:
- `gradeOverride.behaviors` replaces base `behaviors` entirely
- `gradeOverride.extraBehaviors` appends to base `behaviors`
- Same logic for `actions` / `extraActions`
- `combatConfig` / `vulnConfig` shallow-merged (override wins per key)

---

## Step 3 — Unit tests

**Builds on:** Step 2 registry.
**State after:** `make test` passes; registry verified before any integration work.

Create `tests/node-types.test.js` using `node:test` and `node:assert`.

Tests:
- `getNodeType` throws on unknown type string
- `resolveNode` returns base def when no grade override exists
- `resolveNode` for Grade-S `ids` includes `direct-trace` in resolved behaviors
- `resolveNode` for Grade-C `ids` does NOT include `direct-trace`
- `hasBehavior` returns true for `detection` on `ids`, false on `gateway`
- `getStateFields` returns `{ eventForwardingDisabled: false }` for `ids`
- `getStateFields` returns `{}` (no extra fields) for `gateway`
- `getActions` returns `reconfigure` for `ids` node that is compromised + forwarding enabled
- `getActions` returns empty for `ids` node with `eventForwardingDisabled: true`
- `getActions` returns `cancel-trace` for owned `security-monitor` with active trace
- `getActions` returns empty for owned `security-monitor` with no active trace

Add to `Makefile`:
```makefile
test:
	node --test tests/*.test.js
```

---

## Step 4 — Node state initialization (`state.js`)

**Builds on:** Steps 2–3.
**State after:** `eventForwardingDisabled` only on detection nodes; macguffins via atom `onInit`.

Import `getStateFields`, `getBehaviors`, `resolveNode` from `node-types.js` into `state.js`.
Import `generateMacguffin` from `loot.js` (it's already used; confirm it's exported).

Changes to `initState`:

1. In the node initialization block, replace the hardcoded `eventForwardingDisabled: false`
   with a spread of `getStateFields`:
   ```js
   nodes[n.id] = {
     id: n.id,
     type: n.type,
     // ... other fields ...
     ...getStateFields(n),  // adds eventForwardingDisabled only for detection nodes
   };
   ```

2. Replace the `assignMacguffins(nodes)` call with a per-node `onInit` dispatch after all
   nodes are built:
   ```js
   const allNodes = Object.values(state.nodes);
   allNodes.forEach((node) => {
     const typeDef = resolveNode(node);
     const ctx = { typeDef, generateMacguffin };
     getBehaviors(node).forEach((atom) => atom.onInit?.(node, state, ctx));
   });
   // flagMissionMacguffin still runs once after all nodes are initialized
   const allMacguffins = allNodes.flatMap((n) => n.macguffins);
   // ... same mission flagging logic as before
   ```

3. Remove the `assignMacguffins` import from `state.js`.

`loot.js` changes: remove `LOOT_CONFIG` and `assignMacguffins`; ensure `generateMacguffin`
is exported. `flagMissionMacguffin` stays and is called from `state.js` as before.

Run `make check`. Playtest `reset` + `status node fileserver` to confirm macguffins assigned.
Playtest `status node gateway` to confirm no `eventForwardingDisabled` field.

---

## Step 5 — Node lifecycle dispatcher (`js/node-lifecycle.js`)

**Builds on:** Steps 2–4.
**State after:** `onOwned` hooks fire via single dispatcher; `ice.js` listener removed.

Create `js/node-lifecycle.js`:

```js
import { on, E } from "./events.js";
import { getState } from "./state.js";
import { getBehaviors } from "./node-types.js";
import { stopIce, disableIce } from "./ice.js";
import { cancelTraceCountdown } from "./alert.js";

export function initNodeLifecycle() {
  on(E.NODE_ACCESSED, ({ nodeId, next }) => {
    if (next !== "owned") return;
    const s = getState();
    const node = s.nodes[nodeId];
    if (!node) return;
    const ctx = { stopIce, disableIce, cancelTraceCountdown };
    getBehaviors(node).forEach((atom) => atom.onOwned?.(node, s, ctx));
  });
}
```

In `main.js`: import `initNodeLifecycle` and call it inside `init()`.

In `ice.js`: remove the `NODE_ACCESSED` listener block (lines ~38–44) that called
`stopIce()` / `disableIce()` on resident node owned.

Run `make check`. Playtest with cheats: own security-monitor → verify ICE stops and
alert clears to green.

---

## Step 6 — Alert system migration (`alert.js`)

**Builds on:** Steps 2, 5.
**State after:** `DETECTION_TYPES` / `MONITOR_TYPES` gone; all type logic via registry.

Import `hasBehavior`, `getBehaviors` from `node-types.js` into `alert.js`.

Changes:

1. Delete `DETECTION_TYPES` and `MONITOR_TYPES` exports.

2. Replace `NODE_ALERT_RAISED` listener body:
   ```js
   on(E.NODE_ALERT_RAISED, ({ nodeId }) => {
     const s = getState();
     const node = s.nodes[nodeId];
     if (!node) return;
     const ctx = { propagateAlertEvent, startTraceCountdown, recomputeGlobalAlert };
     const handled = getBehaviors(node).some((atom) => {
       if (atom.onAlertRaised) { atom.onAlertRaised(node, s, ctx); return true; }
       return false;
     });
     if (!handled) recomputeGlobalAlert();
   });
   ```

3. Replace `NODE_RECONFIGURED` listener body:
   ```js
   on(E.NODE_RECONFIGURED, ({ nodeId }) => {
     const s = getState();
     const node = s.nodes[nodeId];
     if (!node) return;
     const ctx = { recomputeGlobalAlert };
     getBehaviors(node).forEach((atom) => atom.onReconfigured?.(node, s, ctx));
   });
   ```

4. In `recomputeGlobalAlert`, replace the `filter` calls:
   ```js
   const monitors  = Object.values(s.nodes).filter((n) => hasBehavior(n, "monitor"));
   const detectors = Object.values(s.nodes).filter(
     (n) => hasBehavior(n, "detection") || hasBehavior(n, "direct-trace")
   );
   ```

Run `make check`. Playtest full alert flow end-to-end: probe IDS → fail exploit → alert
propagates to security-monitor → global alert escalates → trace starts.

---

## Step 7 — Action system (`visual-renderer.js` + `console.js`)

**Builds on:** Steps 2, 6.
**State after:** single source of truth for action availability; no type checks in UI or console.

### 7a — `visual-renderer.js`

Import `getActions` from `node-types.js`.

In `renderActions(node, state)`, replace the per-type if-chains for type-specific actions
(reconfigure, cancel-trace) with calls to `getActions(node, state)`:
```js
const typeActions = getActions(node, state);
typeActions.forEach((a) => btns.push(actionBtn(a.id, a.label, a.desc(node, state))));
```

Keep the universal access-level-gated actions (PROBE, EXPLOIT/ESCALATE, READ, LOOT,
REBOOT, EJECT) in place — they are not type-specific.

### 7b — `console.js`

Import `getActions` from `node-types.js`.

In `cmdActions`, replace the type-check blocks that list reconfigure/cancel-trace with
`getActions(sel, s).forEach(a => lines.push(...))`.

In `cmdCancelTrace` and `cmdReconfigure`, replace the `sel.type !== "..."` guards:
```js
const available = getActions(sel, s).find((a) => a.id === "cancel-trace");
if (!available) { addLogEntry("Action not available on this node.", "error"); return; }
```

Run `make check`. Verify sidebar and console show identical available actions in playtest.

---

## Step 8 — Combat & vuln config (`combat.js` + `exploits.js`)

**Builds on:** Step 2 registry (cryptovault combatConfig defined there).
**State after:** per-type combat/vuln overrides active; registry is single source of truth.

### 8a — `combat.js`

Import `resolveNode` from `node-types.js`.

In `resolveExploit(exploit, node)`, replace direct grade table lookups:
```js
const resolved = resolveNode(node);
const modTable  = resolved.combatConfig?.gradeModifier    ?? GRADE_MODIFIER;
const discTable = resolved.combatConfig?.disclosureChance ?? DISCLOSURE_CHANCE;
const gradeModifier    = modTable[node.grade]  ?? 0.3;
const disclosureChance = discTable[node.grade] ?? 0.3;
```

Same pattern for `PATCH_LAG` in the patching logic.

Keep `GRADE_MODIFIER`, `DISCLOSURE_CHANCE`, `PATCH_LAG` as module-level constants —
they remain the fallback defaults.

### 8b — `exploits.js`

Change `generateVulnerabilities(grade)` to `generateVulnerabilities(grade, nodeType)`.
When `nodeType` is provided, query the registry for `vulnConfig` overrides:
```js
const resolved = nodeType ? resolveNode({ type: nodeType, grade }) : null;
const config = (resolved?.vulnConfig ?? VULN_CONFIG)[grade] ?? VULN_CONFIG["C"];
```

Update callers in `state.js` (`initState`) to pass `n.type`.

Run `make check`. Playtest cryptovault vs workstation at same grade to observe difficulty
difference.

---

## Step 9 — Playtest script `actions` command

**Builds on:** Step 7 (`getActions` wired and verified).
**State after:** no third copy of action gates; harness uses registry.

In `scripts/playtest.js`, find the `actions` / `cmdActions` handler. Replace inline
per-type checks with `getActions(sel, state)` imported from `../js/node-types.js`.

Confirm the ES module import path works from the `scripts/` directory.

Run end-to-end playtest:
```bash
node scripts/playtest.js reset
node scripts/playtest.js "select security-monitor"
node scripts/playtest.js "cheat own security-monitor"
node scripts/playtest.js "cheat trace start"
node scripts/playtest.js "select security-monitor"
node scripts/playtest.js "actions"   # should list cancel-trace
```

---

## Step 10 — Final validation & commit

**Builds on:** all prior steps.
**State after:** all acceptance criteria met; branch ready for review.

1. `make check` — must be clean
2. `make test` — all unit tests pass
3. Grep confirms `DETECTION_TYPES` and `MONITOR_TYPES` no longer exported from `alert.js`
4. Playtest `status node gateway` confirms no `eventForwardingDisabled` in output
5. Browser smoke test (Playwright):
   - Fresh game: probe → exploit failure → IDS alert → propagates to security-monitor →
     global alert escalates
   - Own security-monitor: ICE stops, alert resets to green
   - cancel-trace appears in sidebar when owned + trace active; clicking cancels correctly
6. Commit all changes with summary message
