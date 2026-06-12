# Deep Audit — node-graph runtime + alert/ICE event flow

**Date:** 2026-06-11
**Method:** Two agents read the named subsystems **and their tests in full** (not excerpts),
traced complete signal paths (input → atoms/operators → edges → triggers → effects → ctx
calls → state mutations → emitted events), and ran isolated reproductions. **Every
high/medium finding below was then re-verified by hand against the code** before recording —
file/line, attribute names, and the dropped/branching paths were all confirmed. Full suite
is green (1026 tests); the bugs below are ones the green suite does **not** catch (that's
finding T, the test-honesty problem).

---

## The root theme: two regimes, and the legacy alert layer is vestigial in graph mode

Most of the alert findings share one cause. The game has an **older alert layer** in
`js/core/alert.js` (`propagateAlertEvent`, `recomputeGlobalAlert`, gated on node
`alertState` + `eventForwardingDisabled`) that predates the node-graph rewrite. Production
always builds a `nodeGraph`, and `alert.js`'s `NODE_ALERT_RAISED` handler branches on it:

```
on(NODE_ALERT_RAISED): if (s.nodeGraph) recomputeGlobalAlert();   // graph mode (production)
                       else { propagateAlertEvent(); recomputeGlobalAlert(); }  // legacy
```

In graph mode the real IDS→monitor chain is meant to run through graph operators/triggers
(`relay`/`flag` operators, `forwardingEnabled` attr, `alerted` boolean). But the two layers
drifted apart and use **different attributes for the same concepts**:

| Concept | Legacy layer (alert.js) | Graph layer (shipped) |
|---|---|---|
| IDS subverted | `eventForwardingDisabled` (true) | `forwardingEnabled` (false) |
| Detector tripped | `alertState` = red | `alerted` = true (boolean) |

Consequences (all verified):
- `recomputeGlobalAlert` counts red detectors/monitors by `alertState`, but **nothing in
  graph mode ever sets an IDS/monitor `alertState`** (verified: `setNodeAlertState` is only
  ever called on the *acted-on* node in combat/game-ctx, which is rarely a detector). So
  `recomputeGlobalAlert` always sees zero red detectors → returns green → **inert**.
- The CORRUPT action sets `forwardingEnabled:false` (honored by the `relay` operator), but
  `recomputeGlobalAlert` gates on `eventForwardingDisabled` (never set). So IDS subversion
  doesn't register with the legacy recompute — **latent**, harmless only because recompute
  is already inert.
- **The documented two-layer IDS→monitor→TRACE ladder does not function in graph mode.**
  Live global escalation actually comes from: the `security` trait's `alert-escalate`
  trigger (caps at *yellow*), set-piece `startTrace` triggers, and ICE detection
  (`recordIceDetection`). The IDS→monitor chain tops out at yellow; TRACE arrives only from
  ICE or set-piece alarms. This contradicts `MANUAL.md` "Detection" and CLAUDE.md's "Alert
  System (Two-Layer)" section.

**This is a decision, not just a bug:** either retire the legacy
`eventForwardingDisabled`/`recomputeGlobalAlert`/`alertState` path (and the tests that
exercise it), or finish wiring IDS `alertState` in graph mode and unify on one forwarding
attribute. Leaving the polarity mismatch latent is the worst option.

---

## Resolution status (added after the audit)

- **B1, B2, B3 — FIXED in this PR (#163)**, each TDD with a failing test first. B2's fix
  also caught a third phantom-attr site the audit missed (the `encrypted` trait's custom
  DUMP action) via a grep sweep — now fixed too.
- **Root theme (legacy alert layer) — filed as #173 (P1)** for an immediate next session;
  it's a design decision (retire vs finish-wire), not a mechanical fix.
- **B4 — intentional**, left alone (ICE-reinvention rewrite in progress).
- **B5/B6/B7 — not yet addressed** (low severity / latent); fold in when those areas are touched.

## Confirmed bugs (verified against code)

### B1. `sendMessage` silently drops any message whose origin == target node — HIGH / HIGH
`runtime.js:101` → `_deliver` → `hasCycle(message, nodeId)` (`runtime.js:322`).
`createMessage({origin})` seeds `path:[origin]` (`message.js:11`); `hasCycle` returns
`path.includes(nodeId)`. So `sendMessage(nodeId, createMessage({origin: nodeId}))` is
dropped before the node's operators run.

`graph-bridge.js` does exactly this for two of three bridges:
- `:36` XPLOIT → `exploit` message at its own node → **dropped**
- `:46` NODE_ALERT_RAISED → `alert` message at its own node → **dropped**
- `:31` PROBE → `probe-noise` to *neighbors* (origin ≠ target) → delivered fine.

So graph-side circuits fed by the bridge's `exploit`/`alert` injection are dead: the
`relay filter:alert` → `flag on:alert` IDS chain (corporate-pieces idsRelayChain) never
fires via the bridge, and the honeypot `flag(on:"exploit")` never poisons via message
(masked because `resolveLoot`/`resolveMine` also set `poisoned` directly). The core global
alert still escalates only because of the separate legacy path. **Fix direction:** give
bridge-injected messages a sentinel origin (e.g. `"__external__"`), or have `sendMessage`
deliver to the named node without pre-seeding the path with it (cf. `_emitFrom`, which
deliberately seeds the path with the *source* and delivers to neighbors — `sendMessage`
looks like it was meant to deliver *to* the node).

### B2. DUMP/FETCH timed-action progress attr desync → stale progress on cancel-restart — HIGH / MEDIUM
Operator default progress attr is `_ta_${action}_progress` (`operators.js:358`). DUMP's
operator uses `action:"dump"` (`traits.js:213`) → `_ta_dump_progress`, but the DUMP action
effect resets `_ta_read_progress` (`game-types.js:115`). FETCH: operator `action:"fetch"`
(`traits.js:220`) → `_ta_fetch_progress`, but the effect resets `_ta_loot_progress`
(`game-types.js:135`). The verb/noun diverge for these two only (probe/xploit/mine match).

Completion still works (operator drives its own attr). The bug is the **navigation-cancel**
path (`game-ctx.js:389/394`) clears the *wrong* attrs, leaving real progress stale: DUMP to
4/10, navigate away, restart → resumes at 5 and finishes early (reproduced). The explicit
ABORT action is correct (it reads `active.progressAttr` from the operator). Same stringly-
typed coupling family as backlog item / issue #170.

### B3. `owned-cancel-trace` is a one-shot trigger on a repeating condition — HIGH / MEDIUM
`traits.js:286-292` (security trait) fires `cancelTrace` `when accessLevel === "owned"` with
no `repeating:true`, so it defaults one-shot (`triggers.js:51`). If the player owns the
security monitor *before* any trace (a sensible "disarm the kill switch early" play), the
trigger fires once into a no-op and is permanently `_fired`; a later trace then runs to
`caught` even though the player owns the monitor (reproduced). The manual frames owning the
monitor as the trace kill switch. The explicit `CANCEL_TRACE_ACTION` still works as a manual
recovery. **Fix:** `repeating: true` (cancelTrace is idempotent). Classic CLAUDE.md
"one-shot trigger on a repeating behavior" anti-pattern. Reproduce with a failing test first.

### B4. ICE movement-pattern layer (`js/core/ice/patterns/`) is dead code — HIGH / LOW
**Status: intentional / leave for now.** This is scaffolding for an in-progress ICE-system
rewrite (see the "ICE reinvention" GitHub issues). Not a defect to fix in isolation — it
will be resolved by that work. Recorded here for completeness only.

Zero production imports of `patterns/` (verified); `behaviorPattern` is stored
(`registry.js`, `state/index.js:233`) but never dispatched on. `moveInstance`
(`ice/runtime.js:158-216`) re-implements movement inline by grade and duplicates
`nextHopToward` verbatim in three files. Worse, the catalog *lies*: `registry.js` assigns
A/S the `player-hunter` pattern (pathfinds to `selectedNodeId`), but the runtime gives A/S
disturbance-tracking (pathfinds to `lastDisturbedNodeId`). The `patterns/*.test.js` files
give false coverage — they test code nothing calls. **Fix:** either dispatch `moveInstance`
through the registry (and resolve the A/S disagreement) or delete the unused modules + tests.

### B5 (lower). Order-dependent ICE trace gating — MEDIUM / LOW (acknowledged in comments)
`recordIceDetection` (`alert.js:200-231`) sums `detectionCount` across all ICE instances but
gates on `DETECTION_TRACE_THRESHOLD[grade]` of whichever instance detected last. Benign
while instances share the run grade (the code says so), but the multi-grade spawn path
(`sentinel`/`spike`) could expose it.

### B6 (latent). `endRun` leaves `traceTimerId`/`traceCountdown` dangling — LOW / LOW
`endRun` calls `clearAllTimers()` but not `setTraceTimerId(null)`/`setTraceCountdown(null)`,
so a serialized ended-run round-trips a stale timer id. Phase-gating protects re-fire today;
`cancelTraceCountdown` clears both cleanly, `endRun` doesn't. Cheap to make consistent.

### B7 (latent footgun). `tick(n>1)` evaluates triggers once — LOW / LOW
`runtime.js:110-118` delivers n tick messages then evaluates triggers once; a repeating
trigger that should pulse multiple times in the batch fires once. **Not hit in production**
(timers and bot both loop `tick(1)`), but worth a guard or comment.

---

## Test honesty (finding T) — the suite is green but partly hollow in these areas

These are why the bugs above survived a 1026-test suite. Verified by reading the tests:

- **`runtime.test.js` IDS-relay suite asserts nothing.** The "IDS relay chain" blocks use
  `assert.ok(true)` (`:70`) and `assert.doesNotThrow(...)` (`:134`) with comments admitting
  they can't observe the relay ("mon has no operator to set alerted… verify it doesn't
  throw"). These exercise the exact path B1 breaks and would never catch it. *(The
  underlying relay/flag operators ARE honestly tested in `operators.test.js`; it's the
  end-to-end runtime delivery that's untested.)*
- **`integration.test.js:317-338` injects dead state.** "ids alert escalates global alert"
  sets `s.nodes["ids-1"].alertState = "yellow"` directly (graph mode never sets it) and "does
  NOT escalate when forwarding disabled" sets `eventForwardingDisabled = true` directly (the
  CORRUPT action never sets it). Both pass while testing assignments the game never performs.
- **Trigger/availability tests reach into private state** (`runtime.test.js:348/410`,
  `runtime-extensions.test.js:301`): `graph._nodes.get(id).attributes.x = true` then `tick(0)`,
  testing the condition read given a hand-set attr, not the circuit that sets it.
- **`gate: all-of` test** (`runtime.test.js:174-231`) asserts intermediate `_allof_state`
  scratch and watches an attr (`_allof_A_active`) no operator sets — the trigger can't fire;
  the test passes via the scratch map. Testing assignment, not the circuit.

Honest rewrites would drive the real signal path (exploit-fail → alert message → IDS relay →
monitor flag → trigger → global alert moves) and assert the observable consequence.

---

## What is genuinely solid (traced, not assumed)

- **node-graph pure core**: `conditions.js`/`fillConditionNodeId` (correct recursion, non-
  mutating), `qualities.js`, `effects.js` ($nodeId resolution consistent, throws on missing
  target), `traits.js` composition + per-node trigger id-namespacing, operator purity +
  progressive patch merge, `enabledAttr` gating (`=== false` only), snapshot/restore
  round-trip (attrs, qualities, fired-set, mid-clock state).
- **timed-action core lifecycle**: start/progress/complete, grade-table duration,
  `durationMultiplier`, milestone-interval math — all correct and covered. (Only the
  DUMP/FETCH attr *naming* is wrong, B2 — the state machine itself is right.)
- **Global alert never accidentally de-escalates**: `recomputeGlobalAlert`/`raiseGlobalAlert`/
  `recordIceDetection` all guard `next > current`; only deliberate `cancelTraceCountdown` and
  the cheat downgrade. Multi-event coalescing in one tick is idempotent. `STATE_CHANGED` is
  correctly gated to one emit per tick boundary.
- **Per-instance ICE dwell/detection isolation**: each instance owns its dwell timer; departure/
  detection cancel only that instance's timer; detection lock + `PLAYER_NAVIGATED` reset are
  correct and **honestly tested** (`ice-multi-detection.test.js`, `snapshot-ice-detection.test.js`
  assert observable consequences). Effect-atom dispatch (sentinel/spike → health/deck damage,
  classic → recordIceDetection) is genuinely wired and asserted on deltas.
- **Trace countdown** fires once and cleans up; `handleTraceTick` phase-guards post-end ticks.

The ICE *effect* and *detection-isolation* machinery is the strongest part. The weakness is
concentrated in the **alert-layer seam** and the **message-delivery / timed-action attribute
coupling** — exactly the stringly-typed, two-regime areas.

---

## Recommended sequencing (for discussion — several need a design call)

1. **B3** (`owned-cancel-trace` → `repeating:true`) — smallest, clearest player-facing fix.
   Failing test first.
2. **B1** (sendMessage origin) — real and currently masking dead set-piece circuits. Fix the
   delivery semantics; then the honeypot/IDS-relay circuits become live (re-check they behave).
3. **B2** (DUMP/FETCH attr unify) — fold into the timed-action registry work (issue #170).
4. **The legacy alert layer (root theme)** — Les's call: retire vs finish-wiring the two-layer
   ladder. This also dictates whether the manual's "Detection" section is a spec to implement
   or prose to correct. Pair with honest rewrites of the integration alert tests (finding T).
5. **B4** (ICE patterns dead code) — delete or dispatch-through-registry.
6. Housekeeping: B5/B6/B7 comments/guards as touched.

No code changed in this audit.
