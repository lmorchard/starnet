# Spec — the cascade substrate (#286)

**Status:** design approved in brainstorm; awaiting spec review before planning.
**Tracking:** #286 (epic #279). **Evidence:** `research.md` + `prototype.mjs` (6 experiments, run against
the live runtime). **Approach:** prototype-first — every claim below is backed by a run, not a guess.

## Goal

Give the reactive node-graph a first-class capability it lacks today: **entity-injected,
time-resolving, propagating (spawning) behaviors** — cascades. One primitive serves the player
(SWEEP, later SNIFF/REPLAY), ICE, and the network itself (hostile re-grade/reboot pulses). This makes
SWEEP the first citizen of the substrate rather than a special case (its bespoke frontier recursion
moves onto the graph), and lays the foundation for the RAM loadout (runtime-equipped behaviors).

**Coordination note (important).** An agent is actively working **#187** (make most actions timed;
unify busy/abort into `isNodeBusy(node) = active timed operator OR active process`), and **#288** (just
filed) is the north-star to *converge the two timed/process runtimes* into an "action-owns-its-process"
model. The spike found that the cascade operator makes `processes.js`'s per-tick driver obsolete — an
operator-centric convergence — but **that dissolve is #288's call, not this session's.** #286 therefore
**coexists with `processes.js`** (see Decision below) and feeds its findings into #288, to avoid a
head-on collision with the in-flight #187 work on the shared busy/abort surface.

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

## Decision: coexist with `processes.js` (defer the dissolve to #288)

The spike found that the cascade operator makes `processes.js`'s per-tick *driver* obsolete — the graph
can self-propagate. That points at an operator-centric convergence. **But the convergence is #288's
job**, an agent is actively building #187 on top of the current `processes.js`, and dissolving it here
would collide head-on with the shared busy/abort surface. So #286 **keeps `processes.js` intact** and
changes only *how a process propagates internally*:

| Concern | This session (#286) | Left to #288 |
|---|---|---|
| `state.processes[]` record | **Kept** — remains the cascade's identity/abort handle. | Whether it dissolves into the graph. |
| `activeProcessOnNode()` / busy | **Untouched** — so #187's `isNodeBusy(…OR active process)` keeps working. | Unifying the busy check. |
| `abortNodeProcesses` | **Reused as-is** for cascade abort. | Whether abort moves into the graph. |
| `stepProcesses()` step handler | SWEEP's handler **slims to a completion watcher** ("any node still reacting for this cascade?"); the `reachableFrom` frontier recursion is **deleted** (the graph now propagates). | Whether the step-loop is retired entirely. |
| `PROCESS_*` events | **Kept** (log/overlay parity). | Renaming/merging with `ACTION_FEEDBACK`. |

Net: #286 adds the *propagation* primitive to the graph and moves SWEEP's frontier logic onto it, while
the process *record* stays as the identity layer. The contract other code depends on (`state.processes`,
`activeProcessOnNode`, `abortNodeProcesses`, `PROCESS_*`) is unchanged — no collision with #187. The
spike's operator-centric evidence is filed to #288 as input for the eventual convergence.

**Ragged vs synchronized waves.** The graph-propagated model advances *raggedly* — each branch at its
own probe-speed rather than all frontier probes finishing before the next wave. SWEEP's current tests
assert only "multiple waves over time" + gate/depth/abort, not synchronization, and "parallel probes
propagating" reads as ragged anyway. **Risk:** if playtest shows synchronized waves feel better, the
slimmed step-watcher can gate wave advance (a minimal coordinator) — the process record is still there
to host it. Flagged, not pre-built (YAGNI).

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

### 3. Cascade identity via the existing process record (G5 — coexist)
- The cascade's identity **is a `processes.js` record** (`addProcess({id, type, nodeId, source, …})`).
  Abort reuses `abortNodeProcesses`; busy reuses `activeProcessOnNode` (so #187's `isNodeBusy` is
  unaffected). Add `source` to the record for entity attribution; the per-hop `ttl` rides in the
  stimulus payload, not the record.
- The record's `step()` handler slims to a **completion watcher** — return `true` (ended) when no node
  is still reacting for this cascade. It no longer drives propagation (the graph does).
- No new graph-level identity API and no `abortCascade` this session — that graph-native move is #288's.

### 4. `attachBehavior` / `detachBehavior` (G6 — operator half)
- `NodeGraph.attachBehavior(nodeId, operatorConfig)` appends a registered operator config to a live
  node; `detachBehavior` removes it. Participation and snapshot/restore fall out for free (EXP 6).
- Seed any private attrs the behavior needs (`_ta_*`, `_clock_ticks`) on attach.
- **Deferred:** runtime-attached *triggers* (resolved into `TriggerStore` at construction) — the harder
  case, not needed for SWEEP/SNIFF/REPLAY. Documented as out of scope.
- This is the loadout's mechanism; wiring an actual player loadout UI is out of scope (foundation only).

### 5. SWEEP reimplemented on the substrate
`startSweep` **keeps** its `processes.js` record (identity/abort), but its propagation moves onto the
graph: inject `probe-pulse{source:"player", ttl:depth}` at the origin; the cascade operator drives the
timed probes and forwards the wave. The `reachableFrom` frontier recursion is **deleted**; the record's
`step()` slims to the completion watcher (§3). Behavior guarded by SWEEP's tests — those that assert
observable consequences (nodes probed within depth, stops at a gate, ABORT ends it and keeps `probed`)
stay; those coupled to `PROCESS_STEP`/`depthCap` internals are re-pointed at the new propagation but
keep the same record surface. Per-node sweep heat (`HEAT_COST.sweep`) preserved via a ctx-call on
reaction.

### 6. Hostile downgrade cascade (entity-symmetry lock)
Ship the EXP 5 `downgrade`/re-grade cascade as a **test/demo only** — same operator, `source:"<node-id>"`,
walled off by a player-subverted gate. Proves offense/defense symmetry in CI. Actual adversarial
*content* (a security node that periodically fires these in real runs) is out of scope for this session.

## Serialization

Already covered: the cascade's per-hop state (`_cascade_ttl` etc.) rides as node attributes in the
graph `snapshot()`; its identity is the existing `state.processes` record (already serialized);
runtime-attached operators live in `node.operators`, also snapshotted (EXP 6). No new serialization
surface. The state rule (serialize→deserialize reproduces the game) is preserved; add a mid-cascade
round-trip test.

## Testing

- **Honesty (per CLAUDE.md set-piece rules):** assert observable consequences (a node ends up `probed`;
  a node behind a shut gate stays untouched; grade drops by one step), not intermediate attributes.
  Trace the full signal path.
- Rewrite `tests/sweep.test.js` off `state.processes` internals onto observable SWEEP behavior.
- New `tests/cascade.test.js`: propagation + ttl bound + gate block + abort mid-flight + snapshot
  round-trip mid-cascade + `attachBehavior` participation & persistence + the hostile downgrade demo.
- `make check` green; `make census SEEDS=10` no-regression vs a same-seed `main` run (SWEEP feel).

## Parallel entry points (CLAUDE.md contract)

`js/main.js`, `scripts/playtest.js`, and `scripts/bot/cli.js` share timer/dispatch wiring. Because
`processes.js` (its tick hook, `PROCESS_*` events, record contract) is **kept**, the surface these three
share is unchanged — the risk here is much smaller than the dissolve path. Checklist item in the plan:
verify SWEEP still runs in the playtest harness and the bot after propagation moves onto the graph.

## Out of scope

- Runtime-attached **triggers** (only operators this session).
- Adversarial **content** (hostile cascades in live runs) — demo/test only.
- Player loadout **UI** — the `attachBehavior` foundation only.
- New **heat/detection** wiring beyond carrying `source` and preserving SWEEP's per-node heat.
- SNIFF/REPLAY behaviors (future citizens; the substrate is built to host them).
- **Dissolving `processes.js` / the timed-action↔process convergence** — that's #288's deliberate swing,
  informed by this spike. #286 coexists.

## Risks

1. **Ragged vs synchronized waves** (above) — mitigated by playtest + a fallback (the slimmed
   step-watcher can gate wave advance if needed).
2. **Overlap with #187/#288** — mitigated by the coexist decision: #286 leaves the `processes.js`
   record/busy/abort contract untouched, so it doesn't fight #187's `isNodeBusy` work. The dissolve is
   explicitly deferred to #288, with the spike's evidence handed over as input.
3. **Mid-cascade reveal timing** — a node forwards to neighbors revealed by its own probe completion;
   the plan must order reveal-then-forward so the pulse reaches newly-online nodes.
