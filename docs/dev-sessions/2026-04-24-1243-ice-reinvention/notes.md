# Session 1 Notes — ICE architecture rebuild

**Branch:** `ice-reinvention-session-1`
**Issue:** [#92](https://github.com/lmorchard/starnet/issues/92)
**Date:** 2026-04-24

## Outcome

ICE singleton (`s.ice = { ... }`) migrated to a multi-instance collection (`s.ice.instances = { [id]: IceInstance }`) with a data-driven atom architecture in place. Existing gameplay is preserved byte-for-byte under bot census; foundation is ready for sessions 2–8 to add variant ICE types, effects, and hack/reprogram verbs.

## Bot census regression check

Run on both branches at 50 seeds, default difficulty:

| Metric             | main (baseline) | ice-reinvention-session-1 | Delta |
|--------------------|-----------------|---------------------------|-------|
| `successRate`      | 0.28            | 0.28                      | 0     |
| `avgTicksElapsed`  | 499.8           | 499.8                     | 0     |
| `avgCash`          | 6738            | 6738                      | 0     |
| `avgCashSpent`     | 121             | 121                       | 0     |

**Zero deviation.** The architecture rebuild preserved gameplay deterministically. The seeded RNG (`RNG.ICE` for movement, `RNG.WORLD` for ICE host placement, etc.) was preserved across the singleton → collection migration. Bot decisions, ICE moves, exploit rolls, and end conditions all reproduce exactly.

## What landed

- `state.ice` is now `{ instances: { [id]: IceInstance } }`. `getPrimaryIce()` shim returns the first active instance; setters in `state/ice.js` accept an optional `iceId`.
- `js/core/ice/` module skeleton with `index.js`, `registry.js`, `atoms.js`, `effects.js`, `triggers.js`, `runtime.js`, plus 9 pattern files (3 live, 6 stub).
- 3 fully wired effect atoms (`raise-alert`, `damage-health`, `damage-deck`); 14 dormant effect stubs registered with id + schema and a throwing `apply()`. 1 live trigger (`on-dwell-grade`); 8 dormant trigger stubs.
- Player resources `health` and `deckIntegrity` integer pools added to `PlayerState`. New run outcomes `burned` / `bricked` end the run on resource depletion (orchestration in `js/core/player-orchestration.js` to keep state submodules pure).
- All six existing ICE event payloads carry `iceId` (`ICE_MOVED`, `ICE_DETECT_PENDING`, `ICE_DETECTED`, `ICE_EJECTED`, `ICE_REBOOTED`, `ICE_DISABLED`). Six new event constants (`ICE_INSTALLED`, `ICE_REVEALED`, `ICE_ACTIVATED`, `ICE_EFFECT_APPLIED`, `ICE_HACKED`, `ICE_STASH_DEPOSITED`) defined for future sessions.
- `js/core/ice.js` is now a 9-line re-export shim.
- `handleIceTick` iterates `state.ice.instances`; multi-instance LANs are runtime-supported. Internal helpers (detection, dwell timers) remain singleton-bound for session 1; multi-instance detection is a later concern.
- All consumer files migrated: bot scripts (`scripts/bot/*.js`), playtest (via state module), visual renderer, console-status command, cheats, alert subsystem, action-context, game-ctx, integration tests.
- Multi-instance serialization round-trip tested.
- Test count: 487 (pre-session) → 679 (post-session). Lint clean throughout.

## Architectural correction during execution

**Task 1.3 plan defect.** The original plan put the `endRun("burned")` / `endRun("bricked")` orchestration calls inline in `state/player.js`'s damage mutators. Code review caught that this violates the project convention ("State submodules are pure data — they don't emit game events or contain orchestration logic"). Plan was reworked: `js/core/player-orchestration.js` was created as a parallel to `alert.js` / `combat.js` / `loot.js`, and the run-end check moved there. This also broke the would-be ESM import cycle.

The pattern for future sessions: when an ICE effect atom needs to call `damagePlayerHealth` etc., import from `player-orchestration.js`, not from `state/player.js`.

## Caught during execution

A few things to flag for future sessions / future plan reviewers:

1. **Code reviewer found a structurally weak re-entry test.** Original test asserted `runOutcome` unchanged after a second damage call — but `endRun` would set the same value either way, so the test would pass even with the guard removed. Replaced with an event-spy test that counts `RUN_ENDED` emissions; verified by temporarily removing the guard (test fails) and restoring it.

2. **Subagent reported "all pre-existing failures" for 3 caught regressions.** Three `getState().ice.active` reads in the iceResident lifecycle suite were missed in the test-file migration. Caught by diffing test failures against `main` (main had 0, branch had 3 = 3 regressions, not "pre-existing"). Fixed and committed separately.

3. **Plan's "Create" instruction was wrong** for `state/player.test.js` — the file already existed. Implementer pragmatically appended; behaviorally correct, plan label was stale.

4. **Task 3.1 implementer expanded scope** by populating new IceInstance fields in `initGame` to keep lint passing. Plan had treated typedef change as lint-clean but the renamed fields were referenced by callers. Pragmatic save; Task 3.2's prompt was adjusted to reflect the new starting point.

These are reasons the per-task spec + code review pattern earned its keep — three of the four would have shipped silently otherwise.

## Out of scope, explicitly deferred

These are picked up by their session issues:
- Discovery (probe-reveal of installed ICE) — session 2 (#93)
- Stationary trap ICE + trigger system — session 2 (#93)
- Thief / cryptowallet / stash effects — session 3 (#94)
- Defender ICE + sabotage atoms — session 4 (#95)
- Hack / reprogram verbs — session 5 (#96)
- Counter-play scan refinement — session 6 (#97)
- Per-zone alert system — session 7 (#98)
- Procgen catalog population — session 8 (#99)

## Follow-ups identified mid-session

- **`RNG.ICE_EFFECT` named stream** (spec §8) wasn't added — none of session 1's wired atoms need randomness, so adding the stream now would be premature. Add when first random-using atom is wired (sessions 3–5).
- **`endRun` double-resolution in state/index.js.** When `endRun` runs and the path is "primary instance is active → setIceActive(false)", `state/index.js` first iterates instances to find the active primary, then calls `setIceActive(false)` which itself iterates again. Cosmetic redundancy; pass an explicit `iceId` to short-circuit. Cleanup candidate for a later session.
- **`residentNodeId` deprecated alias** still present on `IceInstance` typedef and in initGame — kept as a soft compat. Remove when no callers in this repo or its forks reference the old name. Quick grep before removal: `grep -rn 'residentNodeId' js/ scripts/ tests/ data/`.
