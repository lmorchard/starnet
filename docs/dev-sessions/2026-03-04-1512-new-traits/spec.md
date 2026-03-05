# Session Spec: New Traits

## Goal

Build 5 new traits that stress-test the composable trait system's expressiveness.
Each trait should be expressible purely as data (attributes + operators + actions +
triggers) without new engine code — except for small, general-purpose runtime
extensions (per-node triggers, `durationMultiplier`, `on-attr` operator,
`quality-from-attr` condition).

## Runtime Extensions Needed

### Per-Node Triggers

Traits can define triggers scoped to their owning node. The `nodeId` in conditions
is implicit (always `self`). `resolveTraits` merges trait triggers onto the NodeDef.
The runtime registers them with the nodeId filled in during construction.

```js
// In a trait definition:
{
  triggers: [
    {
      id: "trap-on-probe",
      when: { type: "node-attr", attr: "probed", eq: true },
      then: [{ effect: "ctx-call", method: "startTrace", args: [] }],
    }
  ]
}
```

### `quality-from-attr` Condition

New condition type that reads a quality name from a node attribute at evaluation
time, then checks the quality value against a threshold.

```js
{ type: "quality-from-attr", attr: "encryptionKey", gte: 1 }
```

Evaluator reads `attrs[attr]` to get the quality name, then checks
`quality(name) >= gte`. Enables dynamic quality gating — the quality name
can be changed at runtime (e.g. swapping an encryption key via subversion).

### `durationMultiplier` Attribute

The timed-action operator checks for a node attribute `durationMultiplier`.
If present, the computed duration (from `durationTable[grade]`) is multiplied
by this value. Default: 1.0 (no change).

### `noiseInterval` Attribute

The timed-action operator checks for a node attribute `noiseInterval`. If present
and the operator config doesn't already have `onProgressInterval`, this attribute
is used instead. Enables audited trait to make ALL timed actions noisy without
duplicating operator configs.

Similarly `noiseEffects` attribute provides the effects to fire at each noise
interval (defaults to emit-message exploit-noise if not specified).

## New Traits

### `hardened`

**Fiction:** Military-grade node. All actions take longer.

**Implementation:**
- Attributes: `{ durationMultiplier: 2.0 }`
- Operators: none
- Actions: none
- Triggers: none

The timed-action operator reads `durationMultiplier` and applies it when computing
duration from the grade table. Simple attribute-based modifier.

### `audited`

**Fiction:** Corporate network — everything is logged. All timed actions emit noise,
not just exploit.

**Implementation:**
- Attributes: `{ noiseInterval: 0.1 }`
- Operators: none
- Actions: none
- Triggers: none

The timed-action operator reads `noiseInterval` and emits noise messages at that
interval for ALL timed actions (probe, read, loot, exploit). On an audited node,
probing generates noise that ICE can detect — the corporate security system logs
every access.

### `trapped`

**Fiction:** Probing this node triggers a security response — trace, ICE spawn,
or alert escalation. The player doesn't know it's trapped until they probe it.

**Implementation:**
- Attributes: `{ trapEffect: "startTrace" }` (configurable: "startTrace",
  "setGlobalAlert", or other ctx method)
- Operators: none
- Actions: none
- Triggers (per-node):
  ```js
  [{
    id: "trap-on-probe",
    when: { type: "node-attr", attr: "probed", eq: true },
    then: [{ effect: "ctx-call", method: "$trapEffect" }],
  }]
  ```

The trigger fires when `probed` transitions to true. The effect method is read
from the `trapEffect` attribute — this needs either a new `$attr` substitution
pattern in the effect system, or a fixed ctx method `fireTrap(nodeId)` that reads
the attribute and dispatches.

**Simpler alternative:** fixed effect `ctx.startTrace()` in the trigger, with
the `trapEffect` attribute being a future extensibility hook. Start simple,
generalize later.

### `encrypted`

**Fiction:** This node's data is encrypted. Reading it requires a decryption key
(a quality) obtained from another node. The read action is gated by a quality
condition that reads the key name from the node's attributes.

**Implementation:**
- Attributes: `{ encryptionKey: "vault-key" }` (quality name required to read)
- Operators: none
- Actions: modified read action with additional require:
  ```js
  { type: "quality-from-attr", attr: "encryptionKey", gte: 1 }
  ```
- Triggers: none

The read action's `requires` array includes the `quality-from-attr` condition.
At evaluation time, the condition reads `attrs.encryptionKey` (e.g. `"vault-key"`),
then checks `quality("vault-key") >= 1`. If the quality isn't met, read is
unavailable.

**Companion pattern:** A key-holder node somewhere in the network has a trigger
or action that sets the quality when read/owned. This is wired at the set-piece
level, not in the trait. The `encrypted` trait just gates on the quality — it
doesn't know where the key comes from.

### `volatile`

**Fiction:** This node self-destructs after being owned. A countdown starts when
the player takes ownership, and when it expires the node is affected according
to the configured mode.

**Implementation:**
- Attributes:
  - `volatileDelay: 30` (ticks until self-destruct, default ~3 seconds)
  - `volatileEffect: "reset"` (one of: "reset", "disable", "corrupt")
  - `_volatile_countdown: 0` (internal counter)
- Operators:
  - clock-like operator that ticks when `accessLevel === "owned"`, incrementing
    `_volatile_countdown`. When countdown reaches `volatileDelay`, fires the
    configured effect.
  - OR: use the timed-action operator pattern with a custom activeAttr
- Actions: none
- Triggers (per-node):
  ```js
  [{
    id: "volatile-arm",
    when: { type: "node-attr", attr: "accessLevel", eq: "owned" },
    then: [{ effect: "set-attr", attr: "_volatile_armed", value: true }],
    repeating: false,
  }]
  ```

**Self-destruct effects:**
- `"reset"` — set accessLevel to locked, probed to false, clear vulns. Node can
  be re-probed and re-exploited. Player lost their work.
- `"disable"` — set visibility to hidden. Node goes dark permanently. Any relay
  through this node is severed.
- `"corrupt"` — destroy macguffins (set all to collected: true with cashValue: 0,
  or clear the array). Node stays owned but loot is gone.

Each effect is a ctx method: `ctx.volatileReset(nodeId)`, `ctx.volatileDisable(nodeId)`,
`ctx.volatileCorrupt(nodeId)`. Or a single `ctx.volatileDetonate(nodeId)` that reads
the `volatileEffect` attribute and dispatches.

## Deferred

### `mirrored`

Deferred — relational trait (mirrors to another node) doesn't fit the single-node
trait model. Better expressed as a set-piece pattern with relay + destinations.

### `tripwire`

Future trait — fires when a *neighboring* node is probed (reacts to probe-noise
messages). Distinct from `trapped` which fires on self-probe.

## Testing Strategy

Each trait should be testable in the playground:
1. Create a JSON file with a mini-network containing the trait
2. Load in playground (`?file=...`) or playtest.js (`--graph ...`)
3. Probe/exploit/read the node, verify the trait behavior
4. Unit tests for runtime extensions (per-node triggers, quality-from-attr condition,
   durationMultiplier, noiseInterval)

## Scope

### In Scope
1. Per-node triggers (runtime extension)
2. `quality-from-attr` condition (runtime extension)
3. `durationMultiplier` support in timed-action operator
4. `noiseInterval` support in timed-action operator
5. Five traits: hardened, audited, trapped, encrypted, volatile
6. ctx methods for volatile effects
7. Playground test files for each trait
8. Unit tests for runtime extensions

### Out of Scope
- mirrored trait (deferred — set-piece pattern)
- tripwire trait (future)
- New set-pieces using these traits
- Integrating traits into existing networks
- Bot player updates
