# Session Spec: Composable Traits & Core Mechanics Migration

## Goal

Replace the current factory-based node type system with a composable trait system
where node behavior is defined entirely by named traits in data. Simultaneously
migrate the core game mechanics (probe, exploit, read, loot) into the node-graph
runtime, deleting the standalone executor files. The end result: nodes are pure data
definitions with trait lists, the graph owns timed-action lifecycles, and resolution
logic lives in ctx callbacks.

## Design Principles

- **Behavior from data composition, not code.** (Caves of Qud inspiration.) Traits
  are named behaviors registered once in code, composed freely in data. Node
  definitions are pure data structures — eventually JSON-serializable.
- **The graph says what's happening; the renderer decides how it looks.** Action
  feedback is generic events with progress metrics. Visual mapping lives in the
  renderer, not the graph.
- **Operators stay reactive and clean.** Complex game logic (combat resolution, RNG,
  card state) stays in ctx callbacks. The graph orchestrates lifecycle; ctx resolves
  outcomes.
- **Shared attributes are implicit interfaces.** Multiple traits can provide and
  consume the same attributes. This creates emergent cross-trait interactions
  without explicit wiring — e.g. `hackable` raises `alertState`, `detectable`
  reads it and forwards alerts. The shared attribute *is* the coupling point.
  (Fallen London qualities pattern applied at the trait level.)
- **Keep it simple, last-wins, don't overthink it.** Trait composition uses simple
  merge rules. No error-on-conflict, no complex precedence. Explicit node attributes
  always override trait defaults.

## Trait System

### Trait Registry

A global registry maps trait names to trait definitions. Each trait definition
provides:

- **attributes** — default attribute key/value pairs
- **operators** — operator configs to attach to the node
- **actions** — ActionDef objects the node exposes

Traits are registered in code (JS functions in the registry), but composed by name
in data (trait names listed in NodeDef).

### Composition Rules

When multiple traits compose onto a node:

1. **Attributes**: traits provide defaults, merged left-to-right (last-listed wins
   on conflict). Explicit `attributes` in the NodeDef always override trait defaults.
2. **Operators**: concatenated in trait-list order.
3. **Actions**: merged by ID, later trait's version overrides earlier.

### NodeDef Format

```js
{
  id: "fs-1",
  type: "fileserver",       // human-readable shorthand, not behavioral
  traits: ["hackable", "lootable", "gate"],
  attributes: { grade: "C" },  // explicit overrides
  operators: [],               // additional operators beyond traits (optional)
  actions: [],                 // additional actions beyond traits (optional)
}
```

The `type` field becomes a label — it does not drive behavior. Behavior comes
entirely from `traits` + any explicit `operators`/`actions`.

### Base Node Attributes (Intrinsic)

Only three attributes are truly intrinsic to being a node:

- **id** — unique identity
- **label** — display name
- **visibility** — hidden | revealed | accessible (controls player interaction)

Everything else — grade, alertState, accessLevel, etc. — comes from traits.

### Initial Trait Vocabulary

| Trait | Attributes | Operators | Actions |
|-------|-----------|-----------|---------|
| **graded** | grade | — | — |
| **hackable** | accessLevel, probed, vulnerabilities, probing, exploiting, alertState | timed-action (probe), timed-action (exploit) | probe, cancel-probe, exploit, cancel-exploit |
| **lootable** | read, looted, macguffins, reading, looting | timed-action (read), timed-action (loot) | read, cancel-read, loot, cancel-loot |
| **rebootable** | rebooting | timed-action (reboot) | eject, reboot |
| **relay** | — | relay | — |
| **detectable** | forwardingEnabled, alerted, alertState | relay(filter:alert), flag(alert→alerted) | reconfigure |
| **security** | alerted, alertState | flag(alert→alerted) | cancel-trace |
| **gate** | gateAccess | — | — |

Notes:
- `graded` is a standalone trait providing per-node grade. Traits that use
  grade-keyed duration tables (`hackable`, `lootable`, `rebootable`) expect it
  to be present. This keeps the door open for a future redesign where grade is
  a LAN-wide property rather than per-node.
- `alertState` appears in multiple traits that interact with the alert system.
  Last-wins merge means the default is set once regardless of how many alert-
  aware traits are present.

### Factory Functions (Optional Sugar)

Convenience functions like `createFileserver(id, config)` remain as optional
shorthand that expands to a NodeDef with the right trait list. Network builders
can use them or write raw NodeDefs. The canonical authoring surface is the raw
NodeDef with traits.

## Generic Timed-Action Operator

A single `timed-action` operator handles the lifecycle for all timed actions
(probe, exploit, read, loot, reboot). Configured per-action in the trait
definition.

### Lifecycle

1. **Start**: action effect sets node attributes (e.g. `probing: true`,
   `actionDuration: N`). Duration comes from a grade-keyed table in the operator
   config, or is set by ctx at action start time (for exploit, where duration
   depends on card quality).
2. **Progress**: on each `tick` message, the operator increments progress and
   emits an `action-feedback` event with progress ratio.
3. **Complete**: when progress reaches duration, the operator fires completion
   effects (a `ctx-call` to the resolution method) and resets action state.
4. **Cancel**: a cancel action resets state and emits a cancelled feedback event.

### Configuration

```js
{
  name: "timed-action",
  action: "probe",                    // action name
  activeAttr: "probing",              // boolean attribute for "in progress"
  durationTable: { S: 50, A: 40, B: 30, C: 20, D: 20, F: 10 },  // grade → ticks
  onComplete: [                       // effects to run on completion
    { effect: "ctx-call", method: "resolveProbe", args: ["$nodeId"] }
  ]
}
```

For exploit: `durationTable` is omitted; ctx sets `actionDuration` directly when
the action starts (computed from card quality).

## Core Mechanics Migration

### What Moves Into the Graph

The timed-action lifecycle currently managed by executor files:
- Timer scheduling and progress tracking
- Start/progress/cancel/complete state management
- Action-feedback event emission

### What Stays in Ctx

Resolution logic that needs game state beyond the node:
- **resolveProbe(nodeId)** — generate vulnerabilities based on grade, set probed=true,
  raise local alert, reveal neighbors if gate conditions met
- **resolveExploit(nodeId, exploitId)** — combat resolution (probability tables, grade
  modifiers, match bonus), access level promotion, card decay, disclosure checks
- **resolveRead(nodeId)** — mark read, reveal macguffin inventory
- **resolveLoot(nodeId)** — collect macguffins, add cash, check mission completion
- **resolveReboot(nodeId)** — take node offline, send ICE home

### Files Deleted

- `js/core/probe-exec.js` — lifecycle → timed-action operator, resolution → ctx
- `js/core/exploit-exec.js` — lifecycle → timed-action operator, resolution → ctx
- `js/core/read-exec.js` — lifecycle → timed-action operator, resolution → ctx
- `js/core/loot-exec.js` — lifecycle → timed-action operator, resolution → ctx

Resolution logic from these files migrates to ctx methods (in `game-ctx.js` or
small utility functions called by ctx).

## ACTION_FEEDBACK Event

Replace the per-action event zoo with a single unified event.

### Old (deleted)

```
E.PROBE_STARTED, E.PROBE_PROGRESS, E.PROBE_COMPLETE
E.EXPLOIT_STARTED, E.EXPLOIT_PROGRESS, E.EXPLOIT_SUCCESS, E.EXPLOIT_FAILURE
E.READ_STARTED, E.READ_PROGRESS, E.READ_COMPLETE
E.LOOT_STARTED, E.LOOT_PROGRESS, E.LOOT_COMPLETE
```

### New

```
E.ACTION_FEEDBACK — { nodeId, action, phase, progress, result? }
```

- `phase`: `"start"` | `"progress"` | `"complete"` | `"cancel"`
- `progress`: 0.0–1.0 ratio
- `result`: optional payload on complete (e.g. `{ success: true }` for exploit)
- `action`: `"probe"` | `"exploit"` | `"read"` | `"loot"` | `"reboot"`

### Visual Renderer

The renderer subscribes to `E.ACTION_FEEDBACK` and dispatches to animation
functions by action name. Existing animation code (sweep arc, brackets + zap,
sector scan, extraction) is preserved but triggered by the new event. Unknown
action names get a default animation (e.g. generic progress ring).

## Network Definitions & Set-Pieces

Existing network definitions and set-pieces updated to use trait-based NodeDefs.
The `createGameNode()` composition function is replaced by trait resolution at
graph init time.

## Scope

### In Scope

1. Trait registry and composition system
2. Rewrite game-types.js — factory functions become optional sugar over traits
3. Generic timed-action operator
4. Delete executor files, migrate resolution to ctx methods
5. ACTION_FEEDBACK event, rewire visual-renderer
6. Update network definitions and set-pieces to use traits
7. Update tests

### Out of Scope

- New traits beyond what current node types need (may add late if session allows)
- New set-pieces (may add late if session allows)
- Bot player rebuild
- MANUAL.md update

## Future Considerations: Expressiveness & Limitations

### Known Limitations of This Design

- **Traits don't parameterize.** `gate` defaults to `gateAccess: "probed"` — you
  override via attributes, not via `gate("owned")`. Readable but not self-documenting.
  Consider parameterized traits (trait functions returning defs) if authoring friction
  becomes a problem.
- **Traits are static.** A node can't *become* lootable mid-run based on a quality
  threshold. Triggers can enable/disable individual actions, but the trait itself is
  always-on. If "conditional trait activation" is needed, it would be a new primitive.
- **No trait variants or inheritance.** Can't express "armored-hackable is hackable
  but with 2x durations" without a separate trait definition. Attribute overrides
  work but don't scale well if variants multiply.
- **Intra-node only.** Traits compose behavior on a single node. Cross-node patterns
  (this node's state affects that node) still need explicit message wiring via
  operators and set-pieces. Traits don't help with inter-node relationships.

### Stress-Test Traits for Expressiveness

The initial trait vocabulary maps nearly 1:1 to old factory categories. The real test
is building things that *don't* map to existing node types. Candidate traits that
would validate the system composes at a finer grain:

- **`trapped`** — triggers a circuit on probe (not just alert raise, a custom effect
  like starting trace or spawning ICE)
- **`encrypted`** — read action reveals a password/key quality instead of macguffins;
  locked behind a quality gate from another node
- **`volatile`** — self-destructs N ticks after being owned (timer-based, uses the
  timed-action operator or a clock operator)
- **`mirrored`** — duplicates incoming messages to a hidden node (honeypot variant —
  security team sees everything you do)
- **`hardened`** — multiplies timed-action durations (military biome flavor)
- **`audited`** — generates extra noise on every action (corporate biome — everything
  is logged)

If these can be expressed as trait definitions (attributes + operators + actions)
without new engine code, the system is working. If they require operator extensions
or new effect types, that's the signal for a second iteration.
