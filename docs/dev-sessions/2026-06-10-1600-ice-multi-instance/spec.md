# ICE Multi-Instance Runtime Migration Spec

**Goal:** Make multiple concurrent ICE instances function as fully independent roaming detectors — each with its own movement cadence, dwell, and detection — and spawn them in real generated networks (one per security-monitor, capped), retiring the `getPrimaryIce()` singleton shim.

**Source:** https://github.com/lmorchard/starnet/issues/36

## Current state

The state shape is already a collection (`state.ice.instances`) and movement already iterates it, but detection/dwell/timers/alert/bot are singleton-bound. See `research.md`. Load-bearing facts:

- The timer system is **per-id** (`timers.js:34-49`); `cancelEvent(id)` cancels one, `cancelAllByType(type)` cancels all (`timers.js:97-105`). `ice.dwellTimerId` is already a per-instance field.
- `startIce()` schedules **one** repeating `ICE_MOVE` at the primary's grade interval (`runtime.js:39-42`); `handleIceTick()` iterates all active instances and moves each (`runtime.js:118-126`).
- Detection is gated to the primary: `moveInstance()` only starts a dwell when the instance equals `getPrimaryIce()` (`runtime.js:184-190`). Dwell uses a single shared `ICE_DETECT` timer; `cancelIceDwell()` does `cancelAllByType(ICE_DETECT)` (`runtime.js:241-243`).
- `recordIceDetection()` reads grade + `detectionCount` from `getPrimaryIce()` and gates a **single** global trace clock (`alert.js:200-228`). Alert is global and escalation-only (`alert.js:85-111`).
- Production spawns exactly one ICE, at threat ≥ B, grade = run threat, at the first `security-monitor` node (`assemble.js:63-73`, `state/index.js:186-210`). Generated networks have **2–5 security-monitors** (occasionally 0, up to 6) — measured across threat×complexity×depth.
- Bot reads a single ICE via `getPrimaryIceFromState` into `WorldModel.ice` (`perception.js:115-121`); `execute.js` ejects-on-arrival / aborts-on-detection off that one ICE (`execute.js:121-133`).

## Desired end state

- **Each active instance detects independently.** Two instances on the player's node produce two detections; each runs its own dwell on its own per-id `ICE_DETECT` timer, cancelled individually.
- **Each instance moves on its own per-id `ICE_MOVE` timer** at its own grade cadence. (Production instances share grade = threat, so equal cadence; the per-instance machinery is what enables differing grades and independent dwells.)
- **Production spawns one roaming ICE per security-monitor node**, at threat ≥ B, each grade = run threat, each starting on its monitor node, **capped at 3 as a temporary swarm-guard** (not the balance solution — see #136). Networks with 0 monitors get 0 ICE (unchanged). Networks with exactly 1 monitor behave **identically to today** (single-instance parity).
- **Alert/trace stays a single global ladder.** Any instance's detection steps the global alert and counts toward one global trace threshold (keyed to run threat grade). Per-zone alert remains deferred to #98.
- **Bot perceives all active instances** and evades when any is on its selected node / threatens its current action — enough to keep the bot functional and the census meaningful.
- **`status` and the graph enumerate every active instance.**
- **`getPrimaryIce()` / `getPrimaryIceFromState()` removed** from runtime/alert/bot/status paths; exists-checks become "is any instance active?" helpers.
- **Census re-baselined** with the new spawn rule; the cap (and threat gate) tuned to keep success rate in a sane band. Deep rebalancing is out of scope (see below).

## Design decisions

- **Spawn rule: one ICE per security-monitor, gated at threat ≥ B, grade = run threat, capped at 3 as a temporary swarm-guard.**
  - **Why:** diegetically grounded (each security domain runs its own ICE), feeds future per-zone alert (#98), and fires often given measured monitor counts (2–5 per network).
  - **The cap is a temporary guard, NOT the balance lever.** Monitor count is emergent from slot-filler piece selection (`slot-filler.js`, scaled by `budget.js:183` wing count), not a dial. Tuning it cleanly is network-gen + IDS-puzzle work that overlaps #98/#106, so it's split out to **#136**. Until #136 lands, the cap prevents 5–6-ICE swarms; it knowingly leaves "orphan" monitors (no ICE) on dense networks — accepted as cosmetic and temporary, and is the motivation for #136.
  - **Rejected:** scale-with-threat (less grounded); scale-with-size (density unrelated to security); uncapped per-monitor *this session* (6-ICE swarms before #136 tames monitor count).
- **Per-instance timers via per-id scheduling.** Replace the single repeating `ICE_MOVE` with one repeating `ICE_MOVE` per instance, payload carrying `iceId`; `handleIceTick({iceId})` moves just that instance. `ICE_DETECT` payload carries `iceId`; dwell cancelled via `cancelEvent(ice.dwellTimerId)`, not `cancelAllByType`. Add a `moveTimerId` field alongside `dwellTimerId`.
  - **Why:** the timer system is already per-id and `dwellTimerId` already exists — this is the intended seam, not new infrastructure.
  - **Rejected:** keeping one shared `ICE_MOVE` tick that moves all instances (works only while all share a grade; blocks independent cadence and is a non-obvious coupling).
- **Detection de-gated from primary.** Remove the `getPrimaryIce()` check at `runtime.js:184-190`; every active instance evaluates dwell/detection on the player's node independently, keyed by its own `iceId`.
  - **Why:** this gate *is* the singleton seam for detection.
- **Single global alert/trace, sourced from any instance.** `recordIceDetection(nodeId, iceId)` increments the detecting instance's count and steps the same global ladder; the trace clock starts on total detection count ≥ threshold(run grade).
  - **Why:** smallest change preserving the model's shape; per-zone is a separate, larger effort (#98/#106).
  - **Rejected:** per-zone alert now (pulls #98/#106 scope forward, touches the whole alert subsystem).
- **Bot: perceive all, evade any.** `WorldModel` exposes all active instances; existing evade/eject/abort heuristics trigger when *any* instance is on the selected node / threatens the action.
  - **Why:** keep the bot functional and the census honest (CLAUDE.md). Smarter multi-threat back-off is #129, explicitly not this session.
- **Verification = correctness fixtures + single-ICE parity + re-baselined census.**
  - **Why:** single-monitor networks must stay byte-identical (regression guard); multi-monitor networks legitimately change (that's the feature); fixtures prove independent detect/dwell/move.

## Patterns to follow

- Per-id timer scheduling + `cancelEvent`: `timers.js:36-51`, `:97-99`. Mirror how `dwellTimerId` is stored (`runtime.js:218`) for the new `moveTimerId`.
- Instance iteration: `handleIceTick` (`runtime.js:118-126`) is the model for "do X for each active instance."
- `iceId`-in-payload events already exist (PR #108): `ICE_MOVED`/`ICE_DETECTED` carry `iceId` (`runtime.js`), tested in `tests/integration.test.js` "ice events: iceId in payload" — extend the same convention to timer payloads.
- Setters already accept optional `iceId` (`state/ice.js`) — pass it explicitly everywhere instead of defaulting to primary.
- Spawn placement mirrors current ICE block (`assemble.js:63-73`) — iterate monitor nodes instead of `find` first; `initGame` builds the instance collection from a list instead of one config (`state/index.js:186-210`).
- Multi-instance test setup already demonstrated: `tests/integration.test.js` "two active instances both move on a tick" — extend for detection/dwell.

## What we're NOT doing

- **Tuning network monitor density / IDS-sensor consolidation** — split out to #136. This session keeps the temporary ICE cap (3) and does NOT touch network generation or the IDS-puzzle piece composition.
- **Per-zone / per-domain alert** — stays global; that's #98 (and #106 alert rethink).
- **Smart multi-threat bot back-off / patience heuristic** — #129. Bot gets minimal "evade any" only.
- **Variant ICE types / trap / thief / defender** — sessions 2–5 (#93–#96). This is roaming patrol ICE only.
- **Deep rebalancing.** We re-baseline census and do *light* tuning (the cap, threat gate) to keep success rate sane; a full difficulty-curve pass is a follow-up if needed.
- **New ICE behaviors or detection mechanics** — same dwell-then-detect model, just per-instance.
- **Changing the IDS→monitor exploit-failure puzzle layer** — untouched.

## Open questions

- **Trace threshold grade when instances differ in grade.** Production instances all share grade = run threat, so the threshold is unambiguous there. *Default:* key the global trace threshold on the run's threat grade (not any single instance). Revisit only if a future session spawns mixed-grade roaming ICE.
- **Light-tuning target band.** *Default:* aim to keep default-grade census success rate within roughly ±0.10 of today's 0.28 after the cap; if the cap-at-3 overshoots, lower the cap or the threat gate rather than reworking detection. Not a blocker for planning.
