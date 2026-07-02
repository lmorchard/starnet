# Spec — the cascade substrate (#286)

**Status:** design approved in brainstorm; awaiting spec review before planning.
**Tracking:** #286 (epic #279). **Evidence:** `research.md` + `prototype.mjs` (6 experiments, run against
the live runtime). **Approach:** prototype-first — every claim below is backed by a run, not a guess.

## Goal

Give the reactive node-graph a first-class capability it lacks today: **entity-injected,
time-resolving, propagating (spawning) behaviors** — cascades. One primitive serves the player
(SWEEP, later SNIFF/REPLAY), ICE, and the network itself (hostile re-grade/reboot pulses). This
retires the one-off `js/core/processes.js`, makes SWEEP the first citizen of the substrate rather than
a special case, and lays the foundation for the RAM loadout (runtime-equipped behaviors).

## Background (from the spike)

The prototype composed existing primitives into a pulse cascade and found the walls empirically. In
short (full detail + transcripts in `research.md`):

- **Already free:** cascade propagation (`sendMessage`+`relay`+`_deliver`), entity attribution (rides
  in payload), two-way gate control (`forwardingEnabled` — the `corrupt` mechanic, generalized).
- **Real gaps:** G1 timed-forward loses `message.path` (ping-pong non-termination); G2 no TTL-decrement /
  computed outgoing payload; G3 no payload→attr copy; G5 no cascade identity/abort; G6 no runtime-attach.
- **Small fix:** a ~20-line cascade operator (EXP 4) gives a depth-bounded, attributed, gate-gated
  cascade that terminates. EXP 5 proved the hostile version is the same primitive. EXP 6 proved
  runtime-attaching an operator-behavior is nearly free and already serializable.

## The model

A **cascade** is one entity-injected propagating behavior instance. Its stimulus is a message whose
payload carries a typed envelope:

```js
{ type: <kind>,                    // "probe-pulse", "downgrade", "reboot-pulse", …
  payload: {
    source:    "player" | "ice:<id>" | "<node-id>",   // entity attribution (G4 — a documented field)
    ttl:       <int>,              // depth budget; decremented each hop; forward only while ttl > 1
    cascadeId: <int>,              // identity for abort / completion / reporting (G5)
    ...data                        // kind-specific (none for SWEEP)
  } }
```

Propagation rules (all validated in the prototype):
- **Forward on the operator `outgoing` path**, never `emit-message`/`_emitFrom` — `outgoing` preserves
  `message.path`, so the cycle-guard terminates the cascade (G1).
- **Decrement `ttl` per hop**, stop at `ttl <= 1` (G2).
- **Respect `forwardingEnabled`** so every gate node (router/firewall/IDS/monitor) bounds the cascade —
  offense and defense on one topology (EXP 2, EXP 5).

## Decision: dissolve `processes.js`

`processes.js` exists to *drive* propagation (a per-tick `stepProcesses()` poll + hand-rolled frontier
recursion in `sweep.js`). The cascade operator makes the graph **self-propagate**, so that driver
becomes dead weight. Its remaining roles — identity, abort, busy — move into the graph:

| processes.js role | Replacement in the substrate |
|---|---|
| `state.processes[]` record | `cascadeId` in the stimulus payload, stamped as a node attr (`_cascade_id`). Serializes via the existing graph `snapshot()` (EXP 6). |
| `stepProcesses()` per-tick driver | Gone. `timed-action` completion emits the next hop; the graph's own `tick()` advances it. |
| `abortNodeProcesses(nodeId)` | `NodeGraph.abortCascade(cascadeId)` — scans nodes carrying `_cascade_id`, clears their active timed-action (the same node-scan the nav-cancel handler already performs). |
| `activeProcessOnNode()` busy check | `getActiveTimedAction(nodeId)` (already exists) + `_cascade_id`. |
| `PROCESS_ENDED`/`PROCESS_STEP` events | `CASCADE_ENDED` / `CASCADE_STEP` (renamed; log parity preserved). |

**Ragged vs synchronized waves.** The operator model propagates *raggedly* — each branch advances at
its own probe-speed rather than all frontier probes finishing before the next wave. SWEEP's current
tests assert only "multiple waves over time" + gate/depth/abort, not synchronization, and "parallel
probes propagating" reads as ragged anyway. **Risk:** if playtest shows synchronized waves feel
better, reintroduce a *minimal* cascade-scoped wave-coordinator in the graph (not the old game-layer
module). Flagged, not pre-built (YAGNI).

## Components

### 1. Cascade operator (G1–G3)
A registered operator (working name `cascade`) — the EXP 4 shape, generalized:
- On its stimulus kind: apply the node's side-effect (via attributes and/or a ctx-call), then if
  `ttl > 1` and `forwardingEnabled !== false`, emit the stimulus with `ttl-1` (and `source`/`cascadeId`
  carried through) on the `outgoing` path.
- Payload→attr plumbing (G2/G3) stays **inside this operator** — it reads `ttl`/`source`/`cascadeId`
  from the message and writes the decremented payload directly. No generalized `copy-from-payload`
  effect until a second behavior needs one (YAGNI).

### 2. Timed-then-forward
The wave = the cascade forward deferred to `timed-action` completion. On stimulus arrival the operator
stamps `_cascade_id`/`_cascade_ttl` and starts the node's timed reaction (e.g. `probing = true`); on
completion the existing `onComplete` ctx-call does the game effect (e.g. `resolveProbe` → reveal
neighbors), and the forward emits `ttl-1` to the now-revealed neighbors. Exact operator boundary
(one combined operator vs. a small `cascade-forward` watcher beside `timed-action`) is a **plan-level**
decision; both are expressible today.

### 3. Cascade identity in the graph (G5)
- `cascadeId` minted at cascade start from a serializable, seeded counter (graph- or state-level).
- `NodeGraph.abortCascade(cascadeId)`; a lightweight read-only "any node still reacting for this
  cascade?" completion check emits `CASCADE_ENDED`. This is a *read*, not a propagation driver.

### 4. `attachBehavior` / `detachBehavior` (G6 — operator half)
- `NodeGraph.attachBehavior(nodeId, operatorConfig)` appends a registered operator config to a live
  node; `detachBehavior` removes it. Participation and snapshot/restore fall out for free (EXP 6).
- Seed any private attrs the behavior needs (`_ta_*`, `_clock_ticks`) on attach.
- **Deferred:** runtime-attached *triggers* (resolved into `TriggerStore` at construction) — the harder
  case, not needed for SWEEP/SNIFF/REPLAY. Documented as out of scope.
- This is the loadout's mechanism; wiring an actual player loadout UI is out of scope (foundation only).

### 5. SWEEP reimplemented on the substrate
`startSweep` becomes: mint a `cascadeId`, inject `probe-pulse{source:"player", ttl:depth, cascadeId}` at
the origin, done. The `reachableFrom` frontier recursion in `sweep.js` and the `processes.js`
registration are deleted. Behavior guarded by SWEEP's tests, rewritten to assert **observable
consequences** (nodes probed within depth, stops at a gate, ABORT ends it and keeps `probed`) rather
than `state.processes` internals. Per-node sweep heat (`HEAT_COST.sweep`) preserved via a ctx-call on
reaction.

### 6. Hostile downgrade cascade (entity-symmetry lock)
Ship the EXP 5 `downgrade`/re-grade cascade as a **test/demo only** — same operator, `source:"<node-id>"`,
walled off by a player-subverted gate. Proves offense/defense symmetry in CI. Actual adversarial
*content* (a security node that periodically fires these in real runs) is out of scope for this session.

## Serialization

Everything is already covered: `cascadeId`/`_cascade_id`/`_cascade_ttl` are node attributes in the
graph `snapshot()`; runtime-attached operators are in `node.operators`, also snapshotted (EXP 6). No new
serialization surface. The state rule (serialize→deserialize reproduces the game) is preserved; add a
mid-cascade round-trip test.

## Testing

- **Honesty (per CLAUDE.md set-piece rules):** assert observable consequences (a node ends up `probed`;
  a node behind a shut gate stays untouched; grade drops by one step), not intermediate attributes.
  Trace the full signal path.
- Rewrite `tests/sweep.test.js` off `state.processes` internals onto observable SWEEP behavior.
- New `tests/cascade.test.js`: propagation + ttl bound + gate block + abort mid-flight + snapshot
  round-trip mid-cascade + `attachBehavior` participation & persistence + the hostile downgrade demo.
- `make check` green; `make census SEEDS=10` no-regression vs a same-seed `main` run (SWEEP feel).

## Parallel entry points (CLAUDE.md contract)

`js/main.js`, `scripts/playtest.js`, and `scripts/bot/cli.js` share timer/dispatch wiring. Removing the
`processes.js` tick hook and renaming its events touches all three + `game-ctx.js`'s nav-cancel handler.
Checklist item in the plan: verify SWEEP still runs in the playtest harness and the bot, and that the
`CASCADE_*` events are handled wherever `PROCESS_*` were.

## Out of scope

- Runtime-attached **triggers** (only operators this session).
- Adversarial **content** (hostile cascades in live runs) — demo/test only.
- Player loadout **UI** — the `attachBehavior` foundation only.
- New **heat/detection** wiring beyond carrying `source` and preserving SWEEP's per-node heat.
- SNIFF/REPLAY behaviors (future citizens; the substrate is built to host them).

## Risks

1. **Ragged vs synchronized waves** (above) — mitigated by playtest + a fallback minimal coordinator.
2. **Churn across the `processes.js` consumers** (~9 files) — bounded, all touched for SWEEP anyway;
   the parallel-entry-point checklist guards regressions the tests might miss.
3. **Mid-cascade reveal timing** — a node forwards to neighbors revealed by its own probe completion;
   the plan must order reveal-then-forward so the pulse reaches newly-online nodes.
