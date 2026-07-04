# Spec — Timed actions Phase 2: reactive/program verbs + tuning (#187)

## Goal

Finish the timed-action breadth: convert the last still-instant gameplay verbs, and do a duration
feel-pass. Phase 1 (#296) shipped the mechanism + made every set-piece/script action timed-by-default;
this handles the stragglers the flip couldn't reach.

## Current state (origin/main @ 1a20f29)

- **Timed already:** core loop verbs (probe/xploit/dump/fetch/mine/reboot), `corrupt` (explicit
  `durationTable`), `scrub-logs` (non-core → timed by the Phase-1 flip), and every set-piece script
  action. Instant exceptions marked `instant: true`: `cancel-trace`, `access-darknet`, `disconnect`,
  and the `scan-*` status readouts.
- **Still instant — this spec's targets:**
  - **`kick`** (`KICK_ACTION`, action-templates.js) — a node-graph action, effect `ctx.ejectIce`. Core
    verb (excluded from the flip's auto-timing).
  - **`sniff` / `replay`** (`SNIFF_ACTION`/`REPLAY_ACTION`, program-actions.js) — *injected* program
    actions with `execute` callbacks (`sniffFlow`/`replayCredential`), NOT on the node-synthesis path.
- **Timing mechanism (Phase 1):** an `ActionDef.timed` block synthesizes a `timed-action` operator at
  node construction; it emits `ACTION_FEEDBACK` → generic overlay + drone; abortable via the unified
  `isNodeBusy` / `getActiveAbortableTimedAction`. `SWEEP` is the precedent for a timed *program* action,
  but it uses the process framework because it's genuinely multi-node.
- **#286 shipped `attachBehavior(nodeId, operatorConfig)` / `detachBehavior(nodeId, operatorName)`**
  (runtime.js) — dynamic per-node operator attachment.

## Design decision

`sniff`/`replay` are **single-node atomic timed actions** (like `corrupt`), so they belong on the
**operator path**, not the multi-node process framework — chosen for the cleaner long-term direction
(operator-centric convergence, #288): native `ACTION_FEEDBACK`/overlay, one feedback pipeline, no
process→overlay bridge. Cost: a small dispatch-layer bridge (below), accepted deliberately.

## Part 1 — `kick` (short-timed)

- Add `timed: { duration: 5 }` (feel-draft ~0.5s) to `KICK_ACTION`. It synthesizes exactly like
  `corrupt` — `effects` (`ejectIce`) move to the operator's `onComplete`; gets the generic overlay +
  drone + abort. Short so it barely dents the reactive/panic use the verb exists for.
- **Bot:** the bot reactively kicks ICE (`scripts/bot/execute.js`). Like `corrupt`, add `A.KICK` to the
  bot's `TIMED_ACTIONS` set so it waits for completion. Verify `ejectIce` emits an `ACTION_RESOLVED`
  the bot's `tickUntilResolved` can match; if it doesn't, wire the bot to wait on the activeAttr
  clearing instead. Census must show no regression.

## Part 2 — `sniff` / `replay` operator bridge

- `SNIFF_ACTION` / `REPLAY_ACTION` gain `timed: { duration }` (feel-draft).
- **Dispatch bridge** (`js/core/actions/action-context.js`, where `action.execute(node, state, ctx,
  payload)` runs): when the dispatched action carries `timed` AND is a program action (an `execute`
  callback, not graph `effects`), do NOT run `execute` immediately. Instead **arm a synthesized
  `timed-action` operator on the target node via `attachBehavior`**:
  - `activeAttr = timedActiveAttr(action.id)` (`_ta_active_sniff` / `_ta_active_replay`), duration from
    `action.timed`, and `onComplete = [{ effect: "ctx-call", method: "<resolver>", args: [...] }]`.
  - The resolver is a small ctx method — `resolveSniff(nodeId, flowId)` → `sniffFlow(state, nodeId,
    flowId)`, `resolveReplay(nodeId)` → `replayCredential(state, nodeId)`. The dispatch **payload**
    (`flowId` for sniff) is baked into the `onComplete` args as **serializable data** (never a closure),
    so the attached operator round-trips through save/load.
  - Set the arm attrs (activeAttr true, progress 0, duration) so the operator ticks; it emits
    `ACTION_FEEDBACK` → the generic overlay/drone, same as any timed action.
  - **Cleanup:** `detachBehavior(nodeId, "timed-action")` after `onComplete` runs (and on abort /
    nav-cancel / run-end) so attached operators don't accumulate. The unified abort path already resets
    the activeAttr; extend it (or the arm) so a cancelled program action detaches WITHOUT running the
    resolver (a cancelled sniff captures nothing, a cancelled replay grants no access).
- The followup flow-picker resolves `flowId` before dispatch, so it's known at attach time.
- **Availability while armed:** a node running a timed sniff/replay is busy (unified `isNodeBusy`), so
  ABORT shows and other actions are blocked — same as any timed action.

## Part 3 — duration tuning (feel-loop, with Les)

After Parts 1–2 land and are legible, a **live in-browser feel-pass** — NOT autonomous — to dial:
`kick` (short), `sniff`/`replay`, the flat `DEFAULT_SCRIPT_ACTION_DURATION = 20`, and `corrupt`'s
`durationTable`. Census can't judge these (bot doesn't feel-pace / doesn't use programs), so Les drives
the live controls; the harness is set up for him. This is a checkpoint, not a spec-and-autopilot task.

## Testing

- **kick:** dispatch → `ejectIce` does NOT fire immediately (armed only); tick to completion → ICE
  ejected + `ICE_EJECTED` fires once; ABORT mid-kick → no ejection; resolves to the generic overlay.
- **sniff/replay:** dispatch a `timed` program action → `sniffFlow`/`replayCredential` does NOT run at
  dispatch (operator armed via `attachBehavior`); tick to completion → resolver runs exactly once (flow
  captured / credential replayed) and the behavior detaches; ABORT / nav-away mid-action → detaches,
  resolver never runs (nothing captured); `ACTION_FEEDBACK` resolves the generic overlay; a save/load
  round-trip mid-action preserves the armed operator (serializable onComplete).
- **No-regression:** existing timed verbs + SWEEP + the process framework unchanged; `make check` green;
  `make census SEEDS=50` vs base — confirm `kick` timing (with the bot fix) doesn't regress the curve.

## Non-goals

- No change to `SWEEP`/the process framework, or to the already-timed verbs' behavior (only durations,
  in Part 3's feel-pass).
- Not the full operator↔process convergence (#288) — Part 2 is one aligned instance, not the merge.
- No new instant exceptions beyond those already marked.
