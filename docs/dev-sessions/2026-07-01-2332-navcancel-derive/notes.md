# Notes — Nav-cancel handler derives from TIMED_ACTIONS (#225)

## What

The navigation-cancel handler (`initNavigationCancelHandler` in `js/core/node-graph/game-ctx.js`)
hand-enumerated all six abortable timed actions in a six-branch `if (attrs.probing) … if
(attrs.exploiting) …` block. That was the last hand-enumeration site after #170 centralized the
`_ta_` attribute names — a multi-site authoring trap: add a seventh abortable action and jack-out /
navigation would silently leave its timer running. Replaced it with a loop over the registry.

## Change

- `js/core/node-graph/timed-actions.js`: added `ABORTABLE_TIMED_ACTIONS` (the `abortable` subset)
  and an optional `clearOnCancel: string[]` field on `TimedActionDef` — set to `["activeExploitId"]`
  on the `xploit` entry (the one action with extra cancel cleanup). `ABORTABLE_FLAGS` now derives
  from `ABORTABLE_TIMED_ACTIONS` (unchanged value).
- `js/core/node-graph/game-ctx.js`: the handler now loops `ABORTABLE_TIMED_ACTIONS`, resetting
  `activeAttr`/progress/duration, nulling any `clearOnCancel` attrs, and emitting one `cancel`
  `ACTION_FEEDBACK` per active action.

## Two wrinkles the issue flagged

1. **`action → A.*` feedback constant.** Turned out to be a non-issue: the `A.*` action-id
   constants are *equal to* the registry `action` ids (`A.PROBE === "probe"`, etc.), so emitting
   `def.action` produces byte-identical payloads. No mapping needed.
2. **XPLOIT clears `activeExploitId`.** Handled via the new registry `clearOnCancel` field, so the
   loop stays generic and the registry is the home for that last per-action fact.

`reboot` stays excluded — it's `abortable: false` (involuntary), which is exactly why the loop is
over `ABORTABLE_TIMED_ACTIONS`, not all of `TIMED_ACTIONS`.

## Verification (no behavior change)

- New `tests/nav-cancel.test.js` derives its cases from `ABORTABLE_TIMED_ACTIONS`, so it covers the
  whole abortable set (and any future 7th action — the drift this refactor prevents): each in-progress
  action resets attr/progress/duration + `clearOnCancel`, fires exactly one `cancel` feedback with the
  right action id; an idle navigate fires none. Written as a characterization test — passed against the
  original six-branch handler *and* the refactor, proving identical behavior.
- `make check` green (1345 pass). `make census SEEDS=10` — no headless crash.

## Groundwork for #187

This is the surface #187 (make most node actions timed) touches; clearing the hand-enumeration trap
now means #187 can add actions to the registry and get nav-cancel for free.
