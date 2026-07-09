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

> **Updated by #310 (combat cutover, landed on main during planning):** `xploit`
> is **no longer** a hand-wired `timed-action` operator — it is now a progressive
> **process** (`autoburn`, `js/core/autoburn.js`, launched by `startAutoBurn`),
> the second process client after SWEEP. Its busy-state already comes from
> `activeProcessOnNode`. This resolves one of the spec's original three "bespoke
> exceptions" in the process direction (aligned with Part B) and removes `xploit`
> from Part A's migration entirely. `exploiting`/`activeExploitId` remain as
> vestigial attributes read by the legacy card path (Phase 5 cleanup, out of scope
> here).

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

**Synthesis enabler (prerequisite, discovered in planning).** The migrated verbs
use *irregular* activeAttr names — `probing`, `reading`, `looting`, `mining` — that
are read widely across the codebase (DUMP/FETCH requires, `sweep.js reachableFrom`'s
`typeof node.probing === "boolean"`, `ABORTABLE_FLAGS`, rendering, bot). But
`synthesizeTimedActions` currently mints `timedActiveAttr(id)` = `_ta_active_<id>`
for the synthesized operator's `activeAttr`. A naive migration would rename
`probing`→`_ta_active_probe` and break all those readers. So synthesis must **honor
the registry's activeAttr when one exists**: resolve
`getTimedActionAttrNames(action.id).activeAttr ?? timedActiveAttr(action.id)`.
Actions absent from `TIMED_ACTIONS` (corrupt, kick, sniff, replay, set-piece
scripts) keep `_ta_active_<id>` unchanged — fully backward-compatible. The
`TIMED_ACTIONS` registry **stays the single source of truth** for activeAttr +
abortable; only `durationTable` + `onComplete` move out of `traits.js`.

Then migrate each verb to the synthesis model
(`js/core/node-graph/timed-synthesis.js`):

1. ActionDef gains `timed: { durationTable: {...} }` (the table currently in the
   trait operator).
2. ActionDef `effects` become the **real work** — the `ctx-call` currently sitting
   in the operator's `onComplete` (`resolveProbe` / `resolveRead` / `resolveLoot` /
   `resolveMine`). The old hand-written arm effects (`set active=true`,
   `set progress=0`) are deleted — synthesis regenerates them.
3. **Delete** the operator entry from the trait (`hackable`, `lootable`).
   `synthesizeTimedActions` regenerates both the operator (with `onComplete` = the
   action's effects, `activeAttr` = the registry's) and the arm boilerplate.
4. `encrypted`'s `dump` override moves in lockstep: same `timed: { durationTable }`
   (matching `lootable`'s dump table), keeping its extra `encryptionKey`
   requirement; its manual arm effects are deleted.

**Test impact.** `timed-actions.test.js`'s "every registry action is backed by a
defined operator" scans `traits.js` operators; after deletion, probe/dump/fetch/mine
operators come from synthesis, so this scan must be redirected to check the
*synthesized* operator on a constructed node (via a node factory) rather than the
raw trait. The new *synthesis-parity* test asserts the synthesized operator's
`activeAttr` (= registry) + `durationTable` (= ActionDef) equal the config the trait
used to hand-write.

**Net result:** the operator config and arm boilerplate for these verbs disappear
from `traits.js`. Authoring drops from three sites (registry + trait operator +
ActionDef arm) to two cohesive ones (registry metadata + ActionDef behavior),
matching how `corrupt`/`kick` already work. This is the concrete kill of the
"timed-action authoring is multi-site" gotcha for the verbs it can reach.

### Deliberate exceptions (documented in code, not migrated)

- **`reboot`** — its *arm* does irreducible non-generic work that computes duration:
  `startReboot` evicts ICE, deselects, and rolls an RNG duration (no `durationTable`).
  The `timed:` schema can't express arm-time work; forcing it in would add schema
  surface for one client that would still call a bespoke ctx method. Keeps its
  hand-wired operator with a `// stays bespoke because…` comment pointing at
  `startReboot`.
- **`volatile`** — self-arming, involuntary, has **no ActionDef** to hang `timed:`
  on. Stays hand-wired. (Not a player action → no multi-site authoring problem.)
- **`xploit`** — already migrated *away* from a timed operator by #310; it is now
  the `autoburn` process (see the Context note). Not touched here.

## Part B — one busy/abort contract (two levels, one seam)

The runtimes already compose; only busy-detection and abort are hand-bridged.

### B1 — unify busy detection

Today two disjoint checks that cannot see each other:
- `graph.isNodeBusy(nodeId)` (operator-only) drives the graph's `NOT_BUSY`
  condition. The graph has no game-state access, so it cannot see `state.processes`.
- `activeProcessOnNode(state, id)` is checked separately in `getAvailableActions`
  (`node-actions.js:37`) to override the menu with ABORT.

**Change (revised in planning — see note).** Introduce a single game-layer helper
`isNodeBusy(node, state)` = `!!state.nodeGraph?.isNodeBusy(node.id) ||
activeProcessOnNode(state, node.id)`. Route the game-layer consumers through it:
`node-actions.js` (the process early-return + the ABORT affordance) and
`program-actions.js:132` (which today calls the operator-only `graph.isNodeBusy`
directly). This is the one public "is this node busy" contract at the game layer.

> **Why not inject `processBusy` into the graph's `NOT_BUSY` (the originally
> approved mechanism)?** On close reading, `getAvailableActions` in
> `node-actions.js` already early-returns an `[ABORT]`-only menu whenever
> `activeProcessOnNode` is true — *before* the graph computes any node action. So
> the graph never evaluates a node's `NOT_BUSY` conditions while a process is
> active; injecting process-awareness into the graph would be dead weight and risk
> double-gating. The game-layer helper yields the same "one contract" outcome with
> a smaller, behavior-preserving change. (Flagged to Les at plan handoff.)

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

### B3 — document the feedback boundary (no new plumbing)

**Revised in planning:** there is nothing to collapse. Processes emit **no audio**
today (nothing in `cues.js`/`drones.js`), and their log lines
(`log-renderer.js:169-186`) are keyed by process *type* producing text — not by
action id resolving to overlay/drone names the way `feedback-profiles.js` works. The
two families are already cleanly separated: per-node timed feedback →
`ACTION_FEEDBACK` (overlays/drones/cues via `feedback-profiles.js`); multi-node
orchestration lifecycle → `PROCESS_*` (log lines + node flashes). A
`PROCESS_*→feedback-profiles` bridge would be a mechanism with no client (YAGNI).

**Deliverable:** write the boundary down where the code lives — header comments in
`processes.js` and `feedback-profiles.js`, and the `timed-actions-mechanism` memory —
so the separation is intentional and documented, not accidental. Folded into the
docs task; no separate code task.

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

1. **A0 — synthesis enabler.** `synthesizeTimedActions` honors the registry
   activeAttr (`getTimedActionAttrNames(id).activeAttr ?? timedActiveAttr(id)`).
   Unit test: a synthesized `timed:` action whose id is in `TIMED_ACTIONS` gets the
   registry activeAttr; one that isn't keeps `_ta_active_<id>`. No verb migrated yet
   → `make check` green, census untouched.
2. **A1 — migrate the four verbs + encrypted.** Move `durationTable`/`onComplete`
   onto `timed:` blocks (probe/dump/fetch/mine in `action-templates.js` + encrypted's
   dump); delete the trait operator entries; document the `reboot`/`volatile`
   exceptions in code. Redirect `timed-actions.test.js`'s operator-backing scan to
   synthesized operators; add the synthesis-parity test. Census check vs main.
3. **B1** — single game-layer `isNodeBusy(node, state)`; route `node-actions.js` +
   `program-actions.js` through it; unit test.
4. **B2** — one `abortNode(nodeId, reason)`; the two ABORT ActionDefs collapse to
   one; nav-cancel's triple-loop calls it; unit test.
5. **B3 + Docs** — document the feedback boundary (comments in `processes.js` /
   `feedback-profiles.js`); update the `timed-actions-mechanism` memory; retire/
   annotate the "timed-action authoring is multi-site" gotcha; MANUAL.md only if
   wording drifts. Final census check vs main.

Whole-branch opus review at the end. Les squash-merges and requests Copilot review
from the PR UI.

## Risks

- **Irregular activeAttr breakage (primary).** `probing`/`reading`/`looting`/
  `mining` are load-bearing names. If the A0 synthesis enabler is wrong, migrated
  verbs silently get `_ta_active_<id>` and every reader (DUMP/FETCH gating, sweep,
  bot, rendering) breaks. A0 ships and is tested *before* any verb migrates, and the
  parity test pins the activeAttr.
- **Synthesis arm-vs-work inversion.** The migrated verbs currently put arm effects
  in the ActionDef and real work in the operator's `onComplete`; synthesis expects
  the opposite (effects = work). The parity test is the guard that the swap is exact.
- **`encrypted` + `lootable` composition.** Confirm whether an encrypted node also
  composes `lootable` (which would give it two dump operators) before deleting
  anything — the override exists for a reason. Verify in A1 before editing.
- **Combat path churn (mostly retired by #310).** The combat cutover already moved
  `xploit` to `autoburn`; `resolveExploit`/`startExploit` are legacy-card-path only.
  Part A doesn't touch them, but re-read `autoburn.js` + `node-actions.js`'s XPLOIT
  special-case before Part B abort work, since autoburn is now an abort target.
