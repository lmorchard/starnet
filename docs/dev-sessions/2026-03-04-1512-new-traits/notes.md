# Session Notes: New Traits

## Session Retro

### Summary

Built 5 new traits (hardened, audited, trapped, encrypted, volatile) that stress-test
the composable trait system. Added 3 general-purpose runtime extensions (per-node
triggers, quality-from-attr condition, timed-action attribute knobs) that enabled the
traits as pure data definitions. Then used per-node triggers to simplify 4 existing
set-pieces by moving graph-level triggers into traits and node definitions.

**7 commits, 20 files changed, +1,307 / -89 lines.**

### Key Actions

**Planned phases (1-8) — all completed:**
1. durationMultiplier + noiseInterval + durationAttrSource in timed-action operator
2. Per-node triggers (TraitDef + resolveTraits + runtime constructor)
3. quality-from-attr condition type
4. Trait: hardened (durationMultiplier: 2.0)
5. Trait: audited (noiseInterval: 0.1)
6. Trait: trapped (per-node trigger → startTrace on probe)
7. Trait: encrypted (quality-from-attr gated read action)
8. Trait: volatile (per-node trigger + timed-action + ctx detonate)

**Beyond-plan work:**
- Set-piece refactor: moved graph-level triggers from idsRelayChain, nthAlarm,
  deadmanCircuit, and honeyPot into per-node triggers (in traits and node defs)
- Security trait now automatically provides alert escalation + cancel-trace on
  ownership — every security monitor gets this for free

### Divergences from Plan

1. **Phases 4-8 done in one batch.** The plan had each trait as a separate phase.
   In practice, all 5 traits were simple enough to register in one pass since the
   runtime extensions were already in place.

2. **Set-piece refactor was not planned.** Les asked "are there changes we can make
   to existing set-pieces?" after seeing per-node triggers work. This turned out to
   be the most architecturally satisfying part of the session — the trait system
   paying for itself by simplifying existing code.

3. **`durationAttrSource` added to the plan.** Not in the original spec — emerged
   during implementation when volatile trait needed a way to read countdown duration
   from a node attribute instead of a grade table.

### Insights & Lessons

- **All 5 traits composed cleanly as data.** No engine-specific code beyond the
  general-purpose runtime extensions. The trait system's expressiveness holds up.
  Les confirmed this met expectations.

- **Per-node triggers are the best addition.** They enabled trapped and volatile
  traits, AND simplified 4 existing set-pieces. The insight: behaviors that react
  to "this node's state changed" are extremely common and should be expressible
  without graph-level trigger wiring.

- **Attribute-level knobs (durationMultiplier, noiseInterval) are composable.**
  A node can have both hardened and audited traits simultaneously — actions take
  longer AND emit noise. The effects stack through independent attribute checks
  in the timed-action operator. No special composition logic needed.

- **quality-from-attr enables dynamic gameplay.** The encrypted trait's read gate
  checks a quality whose name comes from an attribute. This means the encryption
  key can be changed at runtime — a future subversion mechanic. The condition
  system is more expressive than it needs to be today, which is the right direction.

- **One-shot trigger timing matters.** The security trait's `owned-cancel-trace`
  trigger fires during `executeAction` evaluation (not during construction, since
  the constructor doesn't evaluate triggers). This caused a test to see 2 calls
  instead of 1 — the action effect calls cancelTrace AND the trigger fires it.
  Not a bug, just a consequence of the dual-path (action + trigger) design.

### Stats

- **Commits:** 7
- **Tests:** 523 passing (started at 505, +18 new tests)
- **Lines:** +1,307 / -89 net across 20 files
- **New traits:** 5 (hardened, audited, trapped, encrypted, volatile)
- **Runtime extensions:** 4 (per-node triggers, quality-from-attr, timed-action knobs, enabledAttr)
- **Set-pieces simplified:** 4 (idsRelayChain, nthAlarm, deadmanCircuit, honeyPot)
- **Set-pieces given disarm actions:** 4 (nthAlarm, tripwireGauntlet, probeBurstAlarm, noisySensor)
- **Conversation turns:** ~35 (across 2 conversations)

### Process Observations

- **Fastest session yet.** The trait system infrastructure was already solid from
  the composable-traits session. Adding new traits was mostly "register data,
  write test, verify." The runtime extensions were small, focused additions.

- **The set-piece refactor was the highlight.** It wasn't planned but it was the
  most valuable output — demonstrating that per-node triggers simplify existing
  code, not just enable new code. This is the sign of a good abstraction.

- **Playground would have been useful here.** We built the playground in the
  previous session but didn't use it to test the new traits interactively. The
  headless playtest had a dynamic-command-discovery issue that blocked end-to-end
  testing. The playground would have been the right tool for interactive validation.

---

## Continuation: enabledAttr + Disarm Actions

### Summary

Added `enabledAttr` — an optional field on OperatorConfig and TriggerDef that names
a node attribute controlling whether that operator/trigger is active. When the attribute
is `false`, the operator/trigger is skipped. Absent = always enabled. Then used this
to add player disarm actions to 4 defensive set-pieces that previously had no counterplay.

**1 commit, 7 files changed, +147 / -16 lines.**

### Key Actions

1. **Identified the gap.** Audited all 15 set-pieces for player counterplay once nodes
   are owned. Found 5 with no disarm path: nthAlarm, tripwireGauntlet, probeBurstAlarm,
   noisySensor, honeyPot.
2. **Designed `enabledAttr` mechanism.** One-line skip in `applyOperators`, two-line skip
   in `TriggerStore.evaluate()`. Per-operator independent control via different attribute
   names on the same node.
3. **Stored `_nodeId` on per-node triggers** so the trigger evaluator can look up the
   owning node's attributes for the enabledAttr check.
4. **Added disarm actions** to 4 set-pieces (honeyPot excluded — avoidance trap by design).
5. **Also added missing `accessLevel: "locked"`** to tripwireGauntlet sensor and alarm
   nodes, which were missing it.

### Divergences from Plan

This work wasn't in the original session plan at all — it emerged from reviewing
set-pieces after the traits work was complete. Les spotted that several traps had
no player agency once triggered, and proposed the `enabledAttr` mechanism with
per-operator granularity.

### Insights

- **The simplest engine extension unlocked the most gameplay.** One `continue` check
  in a loop gave every operator and trigger an independent disable switch. The content
  changes (adding actions to set-pieces) were straightforward once the mechanism existed.

- **Per-operator granularity was the right call.** A node-level "disabled" flag would
  have been coarser — you'd disable ALL operators at once. With `enabledAttr`, a node
  can have its counter disabled while its relay still works. This enables more nuanced
  player strategies.

- **Attribute-driven means reversible by default.** Since enable/disable is just a node
  attribute, any action, trigger, or effect can flip it back. A re-arming trigger or
  an ICE countermeasure could re-enable a disarmed trap. No special "undo" mechanism
  needed.

- **Content audit was valuable.** Walking through every set-piece with "can the player
  do anything about this?" surfaced not just missing actions but also missing
  `accessLevel` attributes on nodes that should be hackable.

### Stats

- **Commits:** 1 (total session: 7)
- **Tests:** 523 passing (+6 new)
- **Lines:** +147 / -16 across 7 files
- **Set-pieces updated:** 4 (nthAlarm, tripwireGauntlet, probeBurstAlarm, noisySensor)
- **Conversation turns:** ~10
- **PR:** https://github.com/lmorchard/starnet/pull/23

---

## Phase-by-Phase Notes

## Phase 1: durationMultiplier + noiseInterval ✓
- timed-action operator now checks durationMultiplier, noiseInterval, durationAttrSource
- 3 new tests, all 508 pass

## Phase 2: Per-node triggers ✓
- TraitDef and NodeDef now support triggers field
- resolveTraits merges trait triggers (concatenate)
- Runtime pre-fills nodeId in conditions and $nodeId in effects
- Per-node triggers merged into main trigger pool
- 2 new tests, all 510 pass

## Phase 3: quality-from-attr condition ✓
- New condition type reads quality name from node attribute
- Added to Condition union typedef
- All 510 tests pass

## Phases 4-8: 5 New Traits ✓
- hardened: durationMultiplier: 2.0
- audited: noiseInterval: 0.1
- trapped: per-node trigger fires startTrace on probe
- encrypted: read action gated by quality-from-attr condition
- volatile: per-node trigger arms timed-action countdown, volatileDetonate ctx method
  with reset/disable/corrupt modes
- 6 new trait tests, all 516 pass

## Set-Piece Refactor ✓
- Security trait now provides alert-escalate + owned-cancel-trace per-node triggers
- idsRelayChain: graph-level triggers removed (handled by security trait)
- honeyPot: trigger moved to per-node trigger on honey-pot node
- nthAlarm: trigger moved to per-node trigger on alarm-latch node
- deadmanCircuit: trigger moved to per-node trigger on alarm-latch node
- All 517 tests pass
