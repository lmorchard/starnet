# Timed-action / process runtime convergence (#288)

**Session:** 2026-07-08-1422-timed-action-runtime-convergence
**Branch:** `worktree-timed-action-runtime-convergence`
**Issue:** [#288](https://github.com/lmorchard/starnet/issues/288) — "Converge the two timed/process runtimes into one action-owns-its-process model"
**Predecessors:** #187 Phase 1 (PR #296), Phase 2 (PR #305). #302 (save/load feedback) already merged on main.

## Goal

Reduce the drift between the two ways an operation advances over time, and cut the
hand-wiring that #187 Phase 1 deliberately left in place for the core verbs. Ship as
one PR (A as the first commit/checkpoint, B on top).

This is a **coherence refactor, not a behavior change.** Success is byte-identical
census output against a same-seed `origin/main` run.

## Context — there is one engine, not two

The issue's "two runtimes" framing is slightly misleading. Reading the code:

- **One timed-execution engine:** the node-graph `timed-action` operator
  (`js/core/node-graph/operators.js`). Progress lives as node attrs; it emits
  `ACTION_FEEDBACK`, which drives overlays + Strudel drones.
- **One orchestration layer:** `js/core/processes.js` (#282) — a thin
  liveness-watcher + abort-registry + busy-gate for multi-node operations. It does
  **not** run timed work itself. SWEEP proves this: the actual timed work is still
  each node's `timed-action` probe operator; the process injects `sweep-pulse`
  messages, forwards the wave on `ACTION_RESOLVED`, and watches `_cascade_ttl` for
  completion.

So convergence is not a substrate rewrite. It is (A) finishing the core-verb
migration onto the declarative `timed:` block, and (B) collapsing the two
hand-bridged seams — busy detection and abort — into one contract, while keeping
the two levels distinct.

## Part A — migrate the clean core verbs onto `timed:`

**In scope:** `probe`, `dump`, `fetch`, `mine`, and `encrypted`'s `dump` override.

Each is currently authored in two places:
- a `timed-action` operator entry in `traits.js` (`hackable`/`lootable`), holding
  `durationTable` + `onComplete`;
- an ActionDef in `action-templates.js` whose `effects` are hand-written arm
  boilerplate (`set active=true`, `set progress=0`).

Migrate to the synthesis model (`js/core/node-graph/timed-synthesis.js`):

1. ActionDef gains `timed: { durationTable: {...} }`.
2. ActionDef `effects` become the **real work** — the `ctx-call` currently sitting
   in the operator's `onComplete` (`resolveProbe` / `resolveRead` / `resolveLoot` /
   `resolveMine`).
3. **Delete** the operator entry from the trait. `synthesizeTimedActions`
   regenerates both the operator (with `onComplete` = the action's effects) and the
   arm boilerplate.
4. `encrypted`'s `dump` override moves in lockstep: same `timed: { durationTable }`
   (matching `lootable`'s dump table), keeping its extra `encryptionKey`
   requirement; its manual arm effects are deleted.

**Net result:** the operator config and arm boilerplate for these verbs disappear.
One authoring site (the ActionDef). This is the concrete kill of the "timed-action
authoring is multi-site" gotcha for the verbs it can reach.

### Deliberate exceptions (documented in code, not migrated)

- **`xploit` / `reboot`** — their *arm* does irreducible non-generic work that
  computes duration: `startExploit` derives duration from the selected card's
  quality (and sets `activeExploitId`, emits start feedback); `startReboot` evicts
  ICE, deselects, and rolls an RNG duration. `xploit` also carries
  `onProgressEffects` (exploit-noise). The `timed:` schema can't express arm-time
  work; forcing it in would add schema surface for two clients that would still call
  a bespoke ctx method. Each keeps its hand-wired operator with a
  `// stays bespoke because…` comment pointing at `startExploit`/`startReboot`.
- **`volatile`** — self-arming, involuntary, has **no ActionDef** to hang `timed:`
  on. Stays hand-wired. (Not a player action → no multi-site authoring problem.)

## Part B — one busy/abort contract (two levels, one seam)

The runtimes already compose; only busy-detection and abort are hand-bridged.

### B1 — unify busy detection

Today two disjoint checks that cannot see each other:
- `graph.isNodeBusy(nodeId)` (operator-only) drives the graph's `NOT_BUSY`
  condition. The graph has no game-state access, so it cannot see `state.processes`.
- `activeProcessOnNode(state, id)` is checked separately in `getAvailableActions`
  (`node-actions.js:37`) to override the menu with ABORT.

**Change:** inject a `processBusy(nodeId)` predicate into the graph ctx (the
ctx-accessor seam already exists at `runtime.js:519`). `graph.isNodeBusy` becomes
`operatorBusy || processBusy(nodeId)`. Both the graph's `NOT_BUSY` condition and the
game-layer `getAvailableActions` then resolve the same truth. A single
`isNodeBusy(node, state)` helper is the one public contract; the ABORT affordance
keys off it.

### B2 — unify abort

Today two loops:
- ABORT action → `abortNodeProcesses` (when a process is active) *or*
  `abortTimedAction` (operator) — two variants.
- nav-cancel (`game-ctx.js:404`) runs the registry loop + the generalized
  structural loop + a separate `abortNodeProcesses` loop.

**Change:** one `abortNode(nodeId, reason)` = abort active timed-action operators
(the generalized structural sweep already in `abortTimedAction`) **+**
`abortNodeProcesses`. Both the ABORT action and nav-cancel call this single entry
point. Per-verb registry / `clearOnCancel` details stay the operator layer's
business; there is one door into them.

### B3 — one documented feedback boundary

Write down the contract that is already ~true: per-node timed feedback →
`ACTION_FEEDBACK`; multi-node orchestration lifecycle → `PROCESS_*`. The one code
change is routing `PROCESS_*` log/audio through the same action→feedback resolution
the operator uses (`js/ui/feedback-profiles.js`), so there is a single mapping. No
overlay-pipeline rewrite — SWEEP's per-node rings already flow through
`ACTION_FEEDBACK`.

## Non-goals

- No folding the operator into `processes.js` (rejected: "operator becomes a
  degenerate 1-node process" — high blast radius).
- No making processes emit synthetic `ACTION_FEEDBACK`.
- No migration of `xploit` / `reboot` / `volatile`.
- No player-facing behavior change. MANUAL.md should not need mechanic edits.

## Verification

- **`make check`** (tsc + tests) is the hard gate on every task.
- **`make census SEEDS=50`** after Part A and again at the end, compared against a
  **same-seed `origin/main`** run. Target: byte-identical. This is a pure refactor;
  any census delta is a regression to investigate, not a tuning result.
- **New tests:**
  - *Synthesis parity* — for each migrated verb, the operator config synthesis now
    produces equals the config the trait used to hand-write (name, `action`,
    `activeAttr`, `durationTable`, `onComplete`).
  - *Busy/abort unification* — a node with an active process and a node with an
    active timed-action both report busy through the one `isNodeBusy(node, state)`
    contract; `abortNode` clears both a timed-action operator and a process.
- **Three entry points stay green** — `js/ui/main.js`, `scripts/playtest.js`,
  `scripts/bot/`. The bot reads state directly and dispatches via events; this
  refactor must not change action ids, event names, or payloads.
- `make bundle-vendor` before any browser smoke test.

## Task breakdown (subagent-driven, review gate per task)

1. **A** — migrate `probe`/`dump`/`fetch`/`mine` + `encrypted` dump; delete trait
   operator entries; document `xploit`/`reboot`/`volatile` exceptions; synthesis
   parity test. Census check vs main.
2. **B1** — `processBusy` injection; single `isNodeBusy(node, state)`;
   `getAvailableActions` uses it; unit test.
3. **B2** — one `abortNode(nodeId, reason)`; ABORT action + nav-cancel call it;
   unit test.
4. **B3** — route `PROCESS_*` log/audio through `feedback-profiles.js`; document the
   feedback boundary in code.
5. **Docs** — update `timed-actions-mechanism` memory; retire/annotate the
   "timed-action authoring is multi-site" gotcha; MANUAL.md only if wording drifts.
   Final census check vs main.

Whole-branch opus review at the end. Les squash-merges and requests Copilot review
from the PR UI.

## Risks

- **Combat path churn.** `origin/main` just landed a combat cutover (#310, exploit
  hoard + coherence auto-burn). `xploit` stays hand-wired, but `resolveExploit` /
  `startExploit` may have shifted — Part A branches fresh from that tip; re-read
  `game-ctx.js` combat ctx-calls before editing.
- **Synthesis arm-vs-work inversion.** The migrated verbs currently put arm effects
  in the ActionDef and real work in the operator; synthesis expects the opposite.
  The parity test is the guard that the swap is exact.
- **`encrypted` + `lootable` composition.** Confirm whether an encrypted node also
  composes `lootable` (double dump operator) before deleting anything — the override
  exists for a reason.
