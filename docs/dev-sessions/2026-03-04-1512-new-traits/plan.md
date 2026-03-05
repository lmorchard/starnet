# Session Plan: New Traits

## Overview

Runtime extensions first (foundation), then traits one at a time (simplest to most
complex). Each trait is tested immediately after implementation.

**Dependency chain:**
```
Phase 1: durationMultiplier + noiseInterval in timed-action operator
Phase 2: Per-node triggers (TraitDef + resolveTraits + runtime)
Phase 3: quality-from-attr condition type
Phase 4: Trait — hardened (uses durationMultiplier)
Phase 5: Trait — audited (uses noiseInterval)
Phase 6: Trait — trapped (uses per-node triggers)
Phase 7: Trait — encrypted (uses quality-from-attr condition)
Phase 8: Trait — volatile (uses per-node triggers + operator + ctx methods)
```

---

## Phase 1: durationMultiplier + noiseInterval in Timed-Action Operator

**Goal:** The timed-action operator respects two new node-level attributes for
duration scaling and noise emission.

### Step 1.1: durationMultiplier

In `operators.js`, find the timed-action operator's duration computation from
durationTable. After computing `gradeDuration`, apply:

```js
const multiplier = attrs.durationMultiplier ?? 1;
gradeDuration = Math.ceil(gradeDuration * multiplier);
```

### Step 1.2: noiseInterval

In the progress milestone check section of the timed-action operator, fall back
to node attributes when the operator config doesn't specify noise:

```js
const interval = config.onProgressInterval ?? attrs.noiseInterval ?? null;
const effects = config.onProgressEffects ?? attrs.noiseEffects ?? null;
```

If both `interval` and `effects` are non-null, check milestones and fire effects.
This means the exploit operator (which has `onProgressInterval` in config) keeps
its behavior, while other timed-action operators (probe, read, loot) pick up
noise from node attributes when `audited` trait is present.

Default noise effect (when `noiseEffects` attr is absent but `noiseInterval` is
present): emit `exploit-noise` message — same as exploit does. This keeps ICE
noise detection working uniformly.

### Step 1.3: Tests

In `timed-action.test.js`:
- Test: node with `durationMultiplier: 2` takes twice as many ticks to complete
- Test: node with `noiseInterval: 0.25` emits noise at 25% milestones for a probe action

**Checkpoint:** `make check` passes. Timed-action operator supports both attributes.

---

## Phase 2: Per-Node Triggers

**Goal:** Traits and NodeDefs can define triggers scoped to their owning node.

### Step 2.1: Update typedefs

In `types.js`: add `triggers?: TriggerDef[]` to `NodeDef`.
In `traits.js`: add `triggers?: TriggerDef[]` to `TraitDef`.

### Step 2.2: Merge triggers in resolveTraits

In `traits.js` `resolveTraits()`:
- Collect trait triggers (concatenate, same as operators)
- Append NodeDef-level triggers
- Return merged triggers in result

### Step 2.3: Register per-node triggers in runtime

In `runtime.js` constructor:
- After resolving traits for each node, extract `triggers` from the resolved NodeDef
- For each trigger, fill in `nodeId` in conditions where missing (the "self" node)
- Register all per-node triggers into the graph's TriggerStore alongside graph-level
  triggers

The simplest approach: just merge per-node triggers into the main trigger pool during
construction, with nodeId pre-filled. No separate TriggerStore needed.

**Pre-filling nodeId**: walk the trigger's `when` condition tree. For any `node-attr`
condition with no `nodeId`, set it to the owning node's ID. Recursive for `all-of`
and `any-of` compositions.

Also pre-fill `$nodeId` in effect args (same pattern as action effects).

### Step 2.4: Handle in snapshot/restore

Per-node triggers that were merged into the main pool will be part of the trigger
snapshot. No special handling needed — they're just triggers with explicit nodeIds.

### Step 2.5: Tests

In `traits.test.js`:
- Register a trait with a trigger. Resolve a NodeDef. Verify triggers appear with
  nodeId filled in.
- Create a NodeGraph with a per-node trigger. Set an attribute. Verify trigger fires.

**Checkpoint:** `make check` passes. Per-node triggers work.

---

## Phase 3: quality-from-attr Condition

**Goal:** New condition type that reads a quality name from a node attribute.

### Step 3.1: Add condition type

In `conditions.js` `evaluateCondition()`, add a new case:

```js
case "quality-from-attr": {
  const qualityName = stateAccessors.getNodeAttr(nodeId, condition.attr);
  if (!qualityName) return false;
  const value = stateAccessors.getQuality(qualityName);
  if (condition.gte !== undefined) return value >= condition.gte;
  if (condition.eq !== undefined) return value === condition.eq;
  return false;
}
```

This reads the quality name from the node's attribute at evaluation time, then
checks the quality value against the threshold.

**Important**: need to ensure `nodeId` is available. For action `requires`, the
action system fills in nodeId. For trigger conditions, the pre-fill from Phase 2
handles it.

### Step 3.2: Update Condition typedef

In `types.js`, add `QualityFromAttrCondition` to the Condition union.

### Step 3.3: Tests

- Test: condition with `quality-from-attr` passes when quality meets threshold
- Test: condition fails when quality is below threshold
- Test: condition reads different quality names from different nodes

**Checkpoint:** `make check` passes. New condition type works.

---

## Phase 4: Trait — hardened

**Goal:** Register the `hardened` trait. Simplest trait — just sets an attribute.

### Step 4.1: Register trait

In `traits.js`:

```js
registerTrait("hardened", {
  attributes: { durationMultiplier: 2.0 },
  operators: [],
  actions: [],
  triggers: [],
});
```

### Step 4.2: Test in playground

Create `data/playground/test-hardened.json`:
```json
{
  "nodes": [
    { "id": "target", "type": "fileserver",
      "traits": ["graded", "hackable", "lootable", "rebootable", "hardened", "gate"],
      "attributes": { "grade": "D" } }
  ],
  "edges": [],
  "triggers": []
}
```

Load in playground, probe the target. Verify it takes twice as long (40 ticks
instead of 20 for grade D).

### Step 4.3: Unit test

Test that a node with `hardened` + `hackable` traits resolves to `durationMultiplier: 2.0`.

**Checkpoint:** `make check` passes. Hardened trait works.

---

## Phase 5: Trait — audited

**Goal:** Register the `audited` trait. All timed actions emit noise.

### Step 5.1: Register trait

```js
registerTrait("audited", {
  attributes: { noiseInterval: 0.1 },
  operators: [],
  actions: [],
  triggers: [],
});
```

### Step 5.2: Test

Create playground test JSON. Load, probe a node. Verify noise messages emitted
during probe (not just exploit). Check in message trace log.

### Step 5.3: Unit test

Create a node with `audited` + `hackable`, set probing=true, tick, verify
exploit-noise messages are emitted during probe progress.

**Checkpoint:** `make check` passes. Audited trait works.

---

## Phase 6: Trait — trapped

**Goal:** Probing this node fires a per-node trigger that starts trace.

### Step 6.1: Register trait

```js
registerTrait("trapped", {
  attributes: {},
  operators: [],
  actions: [],
  triggers: [{
    id: "trap-on-probe",
    when: { type: "node-attr", attr: "probed", eq: true },
    then: [{ effect: "ctx-call", method: "startTrace", args: [] }],
  }],
});
```

### Step 6.2: Test in playground

Create test JSON with a trapped node. Probe it. Verify trace starts.

### Step 6.3: Unit test

Create a graph with a trapped node. Set `probed: true`. Verify `ctx.startTrace`
was called.

**Checkpoint:** `make check` passes. Trapped trait works.

---

## Phase 7: Trait — encrypted

**Goal:** Read action requires a quality gate. Quality name comes from node attribute.

### Step 7.1: Register trait

```js
registerTrait("encrypted", {
  attributes: { encryptionKey: "default-key" },
  operators: [],
  actions: [{
    id: "read",
    label: "READ",
    desc: "Scan encrypted node contents (requires decryption key).",
    requires: [
      { type: "any-of", conditions: [
        { type: "node-attr", attr: "accessLevel", eq: "compromised" },
        { type: "node-attr", attr: "accessLevel", eq: "owned" },
      ]},
      { type: "node-attr", attr: "read", eq: false },
      { type: "node-attr", attr: "rebooting", eq: false },
      { type: "node-attr", attr: "reading", eq: false },
      { type: "quality-from-attr", attr: "encryptionKey", gte: 1 },
    ],
    effects: [
      { effect: "set-attr", attr: "reading", value: true },
      { effect: "set-attr", attr: "_ta_read_progress", value: 0 },
    ],
  }],
  triggers: [],
});
```

This overrides the `lootable` trait's read action (last-wins by ID) with one that
has the additional quality gate.

### Step 7.2: Companion key-setter pattern

For testing, create a two-node test network where reading the key-holder node
sets the quality:
- key-holder: lootable node with a trigger `when: read === true, then: quality-set("vault-key", 1)`
- encrypted node: has `encryptionKey: "vault-key"`

This demonstrates the cross-node pattern that encrypted enables.

### Step 7.3: Test

In playground: load the two-node network. Try to read the encrypted node — should
fail (no key). Read the key-holder first. Then try the encrypted node — should work.

### Step 7.4: Unit test

Create graph with quality-from-attr condition. Verify action unavailable when quality
is 0, available when quality is >= 1.

**Checkpoint:** `make check` passes. Encrypted trait works.

---

## Phase 8: Trait — volatile

**Goal:** Node self-destructs N ticks after being owned.

### Step 8.1: Add volatile ctx methods to game-ctx.js

Add `volatileDetonate(nodeId)` to the ctx interface:
- Read `volatileEffect` attribute from node
- Dispatch based on value:
  - `"reset"`: set accessLevel="locked", probed=false, clear vulnerabilities
  - `"disable"`: set visibility="hidden"
  - `"corrupt"`: set macguffins to empty array
- Emit ACTION_RESOLVED with action="volatile-detonate"
- Log a message

Also add to nullCtx and mockCtx.

### Step 8.2: Register trait

```js
registerTrait("volatile", {
  attributes: {
    volatileDelay: 30,
    volatileEffect: "reset",
    _volatile_armed: false,
  },
  operators: [{
    name: "timed-action",
    action: "volatile",
    activeAttr: "_volatile_armed",
    durationAttr: "_ta_volatile_duration",
    progressAttr: "_ta_volatile_progress",
    // No durationTable — trigger sets duration from volatileDelay attribute
    onComplete: [{ effect: "ctx-call", method: "volatileDetonate", args: ["$nodeId"] }],
  }],
  actions: [],
  triggers: [{
    id: "volatile-arm",
    when: { type: "node-attr", attr: "accessLevel", eq: "owned" },
    then: [
      { effect: "set-attr", attr: "_volatile_armed", value: true },
      { effect: "set-attr", attr: "_ta_volatile_progress", value: 0 },
    ],
    repeating: false,
  }],
});
```

**Duration setting:** The trigger sets `_volatile_armed: true`. The timed-action
operator needs the duration set too. Options:
- Trigger also sets `_ta_volatile_duration` from `volatileDelay` attribute. But
  effects can't read other attributes to compute values.
- The timed-action operator detects `_volatile_armed: true` with `duration === 0`
  and reads `volatileDelay` as the duration (similar to how durationTable works but
  reading from a different attribute).

Simpler: extend the timed-action operator to support `durationAttrSource` — an
attribute name to read the duration from instead of a table. When present:
`duration = attrs[config.durationAttrSource] ?? 30`.

### Step 8.3: Test

In playground: load a volatile node (reset mode). Exploit it to owned. Wait 30
ticks. Verify it resets to locked.

Test all three modes: reset, disable, corrupt.

### Step 8.4: Unit test

Create graph with volatile node. Set accessLevel to owned. Tick past delay.
Verify ctx.volatileDetonate called.

**Checkpoint:** `make check` passes. Volatile trait works in all three modes.

---

## Risk Notes

- **Per-node trigger evaluation cost.** If every node has triggers, we're evaluating
  more conditions per tick. For small playground networks this is fine. For large
  networks, may need optimization later.

- **Trapped + exploiting interaction.** If a trapped node's probe trigger fires
  `startTrace`, the trace starts mid-probe. The player is already committed to the
  probe action. This is intentional — the trap punishes probing — but test that
  the trace countdown and probe timer don't interfere.

- **Volatile cleanup.** When volatile-reset fires, it sets accessLevel back to locked.
  Does the graph bridge / state sync handle this gracefully? Resetting a node mid-game
  is a novel state transition.

- **Encrypted read override.** The encrypted trait provides its own `read` action that
  overrides lootable's read. Trait ordering matters — encrypted must come AFTER lootable
  in the traits list. Document this.
