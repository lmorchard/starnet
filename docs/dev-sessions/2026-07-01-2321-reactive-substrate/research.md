# Reactive substrate (#286) — prototype findings

**Method (approach locked with Les: prototype-first).** Rather than reason about the runtime, I
composed the *existing* node-graph primitives into a pulse cascade and ran into the walls. The probe
is `prototype.mjs` in this directory (`node docs/dev-sessions/2026-07-01-2321-reactive-substrate/prototype.mjs`),
run against the real `js/core/node-graph/runtime.js` + `operators.js` — no game, no mocks. Four
experiments, transcript reproduced inline below each.

Topology throughout (a line with one branch, so gate-blocking and depth-bounding are visible):

```
origin — a — b — c
              \
               d
```

---

## What already works today (no new code)

### 1. Entity-injected stimulus → cascade (EXP 1)
`sendMessage(nodeId, {type, payload})` injects a pulse; each node's `relay` operator forwards it to
neighbors; `_deliver` recurses. The pulse reached the **whole connected component in one synchronous
call** (`origin a b c d`, each delivered twice = init + pulse). The `message.path` cycle-guard stops
loops, so it terminates.

- **Entity attribution rides in `payload`** (`{source:"player"}`) and survives every hop because
  `relay` copies `message.payload` forward. It's a convention today, not a typed field — see gap G4.
- **But:** no timing (all hops in one call) and **no depth bound** — `ttl:2` in the payload was
  ignored; `c`/`d` at 3 hops still received it.

### 2. Two-way gate control (EXP 2)
Setting `forwardingEnabled:false` on `b` (the existing IDS-`corrupt` flag, read by `relay`) stopped
the pulse dead: `c`/`d` behind the gate got the init message only, never the pulse. **This is exactly
the two-way gate-control the issue asks for** — subvert/own a gate node and you block a hostile pulse
from reaching the subnet behind it — and it exists today for free. The offense/defense symmetry is a
property of generalizing *one* propagation path (relay + `forwardingEnabled`) to all stimulus.

**Implication:** "gate-bounded propagation" is not a gap. The substrate should route ALL cascade
stimulus through the relay/`forwardingEnabled` seam so every gate node (router/firewall/IDS/monitor)
gates it uniformly.

---

## What breaks — the real gaps (EXP 3)

EXP 3 tried to build **timed-then-forward** (react over real ticks, *then* spawn the next hop) by
composing `flag` (start a reaction on pulse) → `timed-action` (run it over N ticks) →
`onComplete:[emit-message]` (forward). A timed wave genuinely propagated (`origin→a→b→…` over ticks),
proving the shape is composable *in spirit*. Then it broke, three ways, all confirmed in the transcript
(nodes kept re-reacting: `origin` reacted again at t=5, t=7, t=10, t=12 — never terminating):

- **G1 — Timed-forward loses the propagation path → non-termination.** The only completion-time emit
  path is the `emit-message` effect → `_emitFrom`, and `_emitFrom` **resets `message.path` to
  `[self]`** (runtime.js ~L429). That's deliberate for one-shot action emits, but it defeats the
  cycle-guard for a cascade: the forwarded pulse flows *backward* (`a→origin→a…`) and ping-pongs
  forever. A timed cascade needs to emit while **carrying the accumulated path** (as the operator
  `outgoing` path does), or track visited nodes some other way.

- **G2 — No TTL decrement / no computed outgoing payload.** `onComplete.emit-message.message` is
  **static config**. Every node emits the same hardcoded `ttl`; there is no attr→payload arithmetic,
  so even with a correct path guard there is no depth bound. Cascades need a hop-decrementing payload.

- **G3 — No payload→attribute copy.** `flag` sets a *static* value; no operator/effect copies an
  arriving message's payload field (`ttl`, `source`) into a node attribute. So a node reacting over
  time can't remember "what ttl/source did I arrive with" in order to forward `ttl-1` on completion.
  (G2 and G3 are the same missing capability seen from the two ends: *read payload→attr* and
  *write attr→payload*.)

---

## The gap is small — one operator closes propagation (EXP 4)

A single ~20-line experimental `pulse-cascade` operator — read `ttl`+`source` from the pulse, forward
`ttl-1` via operator `outgoing` (which keeps the runtime path, so it terminates), stop at `ttl<=0`,
respect `forwardingEnabled` — produced a **depth-bounded, entity-attributed, gate-gated** cascade:
`ttl:3` from origin reached `a` (ttl2) and `b` (ttl1) and **stopped**; `c`/`d` beyond the bound and the
back-path were untouched; it terminated cleanly.

This is the headline: **the substrate is "compose existing primitives + a small gap-fill," not a
from-scratch subsystem.** `relay`, `forwardingEnabled`, `timed-action`, `delay`, and per-node triggers
already carry most of the weight.

EXP 4 isolated the *propagation* fix (instant). The **timed** version = the same hop-emit deferred to
`timed-action` completion, using the operator-`outgoing` path (not `emit-message`/`_emitFrom`). Two
deeper gaps remain that EXP 4 does not touch:

- **G5 — Cascade identity / lifecycle.** A cascade-in-flight is smeared across many nodes' attrs +
  delay queues. There's no handle to **abort the whole cascade**, report "cascade N completed," or
  reason about "who started this." This is precisely why `processes.js` exists: it gives the cascade a
  single serializable record (`state.processes[]`) with a uniform abort (`abortNodeProcesses`) and
  a "node is busy if it has an active process" rule. The graph has no equivalent. **A substrate needs
  a first-class cascade/process record** — likely *keeping* `processes.js`'s record-and-abort role but
  driving the per-hop propagation through the graph instead of hand-rolled frontier arrays.

- **G6 — Runtime-attached behaviors (deepest, the loadout's foundation).** Every operator/trigger is
  baked into the NodeDef at **construction** (`resolveTraits` in the constructor). There is no API to
  attach a behavior to a live node (`setNodeAttr` exists; `addOperator`/`attachBehavior` does not).
  SWEEP/SNIFF/REPLAY and the RAM loadout are *player-equipped* behaviors injected at runtime — they
  cannot be expressed as static node defs. This is the one gap that is genuinely new infrastructure,
  not gap-fill.

---

## Adversarial parity + runtime-attach (EXP 5, EXP 6)

Two follow-on experiments, added when scope widened to include G6.

### EXP 5 — the hostile cascade is the same primitive
A security/malware node injects a `downgrade` pulse attributed to itself (`source:"malware:origin"`);
a `downgrade-cascade` operator (identical shape to `pulse-cascade`, plus a re-grade side-effect on the
node it hits) propagates it. Results:

```
gate OPEN  → origin:B  a:B  b:B  c:B  d:B      (attack marches the whole reachable depth, A→B)
gate SHUT  → origin:B  a:B  b:A  c:A  d:A      (player subverted b → c/d behind it stay grade A)
```

**Entity-symmetry holds.** Offense and defense share one propagation path: a hostile pulse with a
node-id source, walled off by the same `forwardingEnabled` gate the player controls. This is the
issue's core payoff ("the network pushes back on the same substrate") demonstrated, not asserted.

### EXP 6 — runtime-attach is nearly free (this reframes G6)
Starting from plain nodes with no cascade behavior, a pulse did nothing. After appending a
`pulse-cascade` operator config to a live node's operator list (the entire "attach" mechanism), the
pulse propagated (`origin→a→b`, ttl-bounded) — **and it survived a real `snapshot()` →
`JSON` round-trip → `fromSnapshot()`**, still propagating after reload.

- Operators are already **data** (`{name,...config}`) resolved against a name→fn registry, and
  `snapshot()` already serializes `node.operators`. So runtime-attaching an operator-behavior needs
  **only a thin public API** (`attachBehavior`/`detachBehavior`) — the participation and serialization
  fall out for free.
- **Caveats:** (1) per-node **triggers** are resolved into the `TriggerStore` at construction —
  runtime-attaching a *trigger* (not just an operator) is the harder, still-unsolved case; (2)
  behaviors with private state (`_ta_*`, `_clock_ticks`) need those attrs seeded on attach.
- **Reframe:** G6-for-operators is cheap and safe to include now; G6-for-triggers can wait. SWEEP/
  SNIFF/REPLAY are operator-behaviors, so the loadout's first cut is unblocked by the cheap half.

## Gap scorecard (vs. the issue's "likely gaps")

| Issue's predicted gap | Verdict | Evidence |
|---|---|---|
| Entity/source attribution (G4) | **Partly there** — rides in payload, survives hops; wants a typed field | EXP 1 |
| Timed-then-forward + TTL(depth) | **Real, but small** — path-loss (G1) + no computed payload (G2/G3); closes in ~20 lines | EXP 3, EXP 4 |
| Gate-bounded propagation | **NOT a gap** — `relay`+`forwardingEnabled` already does it, both ways | EXP 2 |
| Cascade lifecycle / abort / serializable (G5) | **Real** — graph has no cascade identity; `processes.js` supplies it | EXP 3 non-termination; code read |
| Adversarial parity (offense/defense symmetry) | **Confirmed free** — same primitive, node-id source, same gate | EXP 5 |
| Runtime-attached behaviors (G6) | **Operators: nearly free** (thin API, already serializable). **Triggers: still hard.** | EXP 6 |

---

## Recommendation: does the substrate subsume `processes.js`?

**Coexist, don't delete — refactor the seam.** `processes.js` is only 59 lines and it owns the two
things the graph genuinely lacks: **cascade identity** (a serializable record) and **uniform abort/busy**
(G5). The graph owns what `processes.js` fakes with `s.nodes[id].probing` polling: **propagation,
timing, and gating**. The clean split the evidence points to:

- **Graph substrate provides:** the cascade *mechanics* — a `pulse-cascade`/timed-forward primitive
  (G1+G2+G3 fixed: emit via operator-`outgoing` with a decrementing, payload-carried TTL and source),
  routed through `relay`/`forwardingEnabled` for gating.
- **`processes.js` (or its successor) provides:** the cascade *identity* — one record per in-flight
  cascade for abort, completion reporting, entity attribution, and serialization (G5).
- SWEEP then becomes: "inject a `probe-pulse{source:player, ttl:depth}` and register a cascade record,"
  replacing the hand-rolled frontier/`reachableFrom` recursion in `sweep.js`. This is the "SWEEP becomes
  the first citizen" the issue wants — **without** throwing away the part of `processes.js` that earns
  its keep.
- **G6 (runtime-attach)** is orthogonal and larger; it's the loadout's prerequisite and deserves its
  own design pass. It is NOT needed to reimplement SWEEP (SWEEP's behavior can be a registered operator
  + a cascade record). Recommend: **spec G1–G5 now** (small, evidence-backed, unblocks SWEEP-on-substrate
  and adversarial pulses); **treat G6 as a follow-on** design session tied to the RAM loadout (Session 3).

---

## Open questions for the brainstorm (→ spec.md)

1. **Cascade record shape.** Extend `Process` (add `source`, `ttl`, `kind`) vs. a new `Cascade` type?
   The record must be serializable mid-flight (state rule) and support abort + completion events.
2. **Timed-forward primitive.** A dedicated `pulse-cascade`/`timed-forward` operator, or a documented
   composition of `timed-action` + a new "forward with decremented payload on complete" effect? EXP 4
   argues one small operator is cleaner than effect-plumbing.
3. **Emit-with-path.** Fix `emit-message`/`_emitFrom` to optionally carry the incoming path, or keep
   cascades on the operator-`outgoing` path exclusively (never `_emitFrom`)? (Leaning: cascades use
   `outgoing`; leave `_emitFrom` alone for one-shot action emits.)
4. **Payload↔attr plumbing (G2/G3).** Generalize (a `copy-from-payload` op + computed-emit) or keep it
   inside the one cascade operator? Generalizing helps future behaviors; scoping is faster.
5. **Adversarial parity.** A security-node **downgrade/re-grade pulse** as the first *hostile* cascade —
   same primitive, `source:"<node-id>"`, gated by the same relay/forwarding. Prototype next to prove
   entity-symmetry, or spec directly now that EXP 4 shows the shape?
6. **Heat/detection integration.** Entity attribution → "who's noticed." Do adversarial pulses generate
   their own alert signals as they propagate? (SWEEP already charges `HEAT_COST.sweep` per node.)
7. **G6 runtime-attach** — defer to a loadout-tied session, or scope a minimal `attachBehavior(nodeId,
   operatorConfig)` now? (Leaning: defer; it's not on SWEEP's critical path.)
