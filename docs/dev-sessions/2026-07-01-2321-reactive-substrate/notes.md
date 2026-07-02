# Reactive substrate — entity-injected propagating behaviors — session notes

**Status: PROTOTYPE DONE (2026-07-02). Findings in `research.md`, runnable probe in `prototype.mjs`.
Next: brainstorm → `spec.md` for G1–G5 (see research.md open questions).** Tracking issue: **#286**
(under epic #279). Branch `reactive-substrate` off `origin/main`@c48b3dc (includes #261
hub-reachability; #282 SWEEP is in branch history). Baseline green.

## Prototype results (2026-07-02) — see research.md for the full writeup
Composed existing primitives into a pulse cascade against the real runtime; found the walls empirically.
- **Works today, no new code:** cascade propagation (`relay`), entity attribution (rides in payload),
  **two-way gate control** (`forwardingEnabled` — the corrupt mechanic, generalized). Gate-bounding is
  NOT a gap.
- **Real gaps:** G1 timed-forward loses `message.path` (`_emitFrom` resets it) → ping-pong
  non-termination; G2 no TTL-decrement / computed outgoing payload; G3 no payload→attr copy; G5 no
  cascade identity/abort (this is what `processes.js` legitimately owns); G6 no runtime-attach of
  behaviors (deepest; the loadout's prerequisite).
- **Gap is small:** a ~20-line `pulse-cascade` operator (EXP 4) gives a depth-bounded, attributed,
  gate-gated cascade that terminates. Substrate = "compose + small gap-fill," not from-scratch.
- **Recommendation:** `processes.js` and the graph **coexist** — graph owns propagation/timing/gating,
  `processes.js` (or successor) owns cascade identity+abort. SWEEP reimplements as a cascade + record.
  **Spec G1–G5 now; defer G6** to a loadout-tied session (not on SWEEP's critical path).

## The idea (why)
SWEEP (#282) needed a progressive, propagating, abortable behavior the node-graph couldn't host, so
it got a standalone `js/core/processes.js`. That treats the symptom. The real move: build the missing
**infrastructural capability** — the reactive graph should host **entity-injected, time-resolving,
propagating (spawning) behaviors**. Entities: the **player** (SWEEP, SNIFF/REPLAY), **ICE**, and
**security nodes / the network** (e.g. a node that pulses reboots, access-level downgrades, or
"OS-upgrades" that re-grade nodes). Player programs + verb-variants + the RAM loadout + adversarial
network pulses all become **citizens of one substrate** instead of bespoke modules.

**Two-way gate control:** gate nodes (routers/firewalls/IDS/monitors) gate *all* propagation. A router
blocks the player's SWEEP; subvert/own it and you block a hostile pulse from reaching the subnet behind
it. Offense + defense on the same topology.

## Runtime research — most primitives ALREADY EXIST (so this is composition + gap-fill)
From `js/core/node-graph/runtime.js` + `operators.js`:
- `sendMessage(nodeId, msg)` — inject a message at a node → **entity-injected stimulus ✓**
- `_deliver(nodeId, msg)` runs the node's operators and recursively delivers `outgoing` messages to
  connected nodes → **cascades ✓**
- `relay` operator + a `forwardingEnabled` flag = **gated, subvertible propagation** (the IDS→monitor
  + `corrupt` mechanic) → generalize to all stimulus for the two-way gate-blocking idea
- operators available: relay, invert, any-of, all-of, latch, **clock**, **delay**, counter, report,
  flag, **watchdog**, tally, **timed-action**, **debounce** → building blocks for **timed-then-forward**

### Likely real gaps to prototype against
- **entity/source attribution** on messages (source = player | ice | node-id) — for detection/scoring/fiction
- a clean **timed-then-forward + TTL(depth)** cascade pattern (react over real time, then propagate a
  hop-decremented pulse; stop at gate-controllers / TTL 0)
- cascade **lifecycle**: abort/cancel in-flight, clean completion, serializable mid-flight
- **runtime-attached (entity-equipped) behaviors** — not baked into node defs (the loadout: player
  brings behaviors and injects them). This is the deepest gap.

## Approach (locked with Les): PROTOTYPE-FIRST
Build a minimal entity pulse-cascade by composing existing primitives, discover the real gaps
empirically, THEN write the capability spec from evidence.

### Concrete first prototype (proposed)
Reimplement **SWEEP as a probe-pulse cascade** on the graph (no `processes.js`):
1. A player-injected `sweep-pulse` message at the origin (via `sendMessage`), carrying `{source:"player", ttl:depth}`.
2. A node reacting to `sweep-pulse`: start a timed probe (timed-action); on completion, if TTL>0 and it's
   a probe-gate node, emit `sweep-pulse{ttl-1}` to neighbors (relay-style, gated by the node's forwarding).
3. Observe: does composing sendMessage + timed-action + relay + a TTL payload reproduce SWEEP's behavior
   (gate-bounded, timed waves, abortable)? What's missing (attribution, timed-then-forward glue,
   abort of in-flight cascade, attaching the reactive behavior to arbitrary nodes at runtime)?
4. Then prototype the **adversarial** counterpart (security-node downgrade/re-grade pulse) to prove
   entity-symmetry + two-way gate blocking (player subverts a gate to stop it).
Write findings → `research.md`; then brainstorm → `spec.md` for the real capability; decide whether it
**subsumes `processes.js`** and whether SWEEP moves onto it.

## Open state / loose ends
- **PR #282 (SWEEP) is OPEN, awaiting Les's merge decision** — behavior correct + green; its
  `processes.js` may be superseded by this substrate. Rebase onto main before merge (main moved).
- Ripple visual follow-up: **#280**. Console node-arg consistency: **#284**.
- Worktrees live: `verb-variants` (#282, unmerged), `reactive-substrate` (this).
