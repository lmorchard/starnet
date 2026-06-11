# Session Notes — EXEC submenu / verb for non-core node actions

**Issue:** #135 · **Branch:** `exec-submenu-node-scripts`

## Summary

Grouped all non-core node actions ("scripts") behind a single `EXEC` affordance —
an `EXEC ▸` context-menu submenu and an `exec` console verb — separating them from
the core deck command namespace and top-level tab-completion. New set-piece-authored
node actions become scripts automatically (allowlist partition). Renamed the player
verb `eject` → `kick` to free the letter `e` for `exec`.

Executed via subagent-driven development: one implementer + spec review + code-quality
review per task, plus a final whole-branch review.

## What shipped

- **`js/core/actions/scripts.js`** (new, pure) — `CORE_NODE_VERBS` allowlist +
  `isScriptAction(id)`. A node-contextual action is a script iff its id is not core.
- **`js/core/actions/node-actions.js`** — injects a synthetic `EXEC` follow-up action
  when a node has ≥1 script; exports `getScriptActions`. `buildExecAction` closes over
  the wrapped scripts (no import cycle); `EXEC.execute` runs the chosen script directly.
- **`js/core/actions/action-context.js`** — dispatcher echo special-case: a GUI EXEC
  pick logs `exec <script>` (one echo), mirroring the `xploit <card>` pattern.
- **`js/core/console-commands/dynamic-actions.js`** — skips scripts + synthetic EXEC
  when registering dynamic verbs (scripts leave the top-level namespace).
- **`js/core/console-commands/commands.js`** — static `exec` command (list / run /
  complete); `actions` listing groups scripts under `exec`; `help` advertises `exec`.
- **`js/ui/visual-renderer.js`** — context menu filters out raw scripts; `EXEC ▸` stands in.
- **`js/ui/components/starnet-action-choices.js`** — new `render: "action"` branch so
  script choices render as labeled buttons in the existing picker.
- **`eject` → `kick`** across action-ids, game-types, traits, console, log text, bot,
  and harness. Internal mechanism unchanged: `ejectIce()` and `E.ICE_EJECTED` keep their names.
- **MANUAL.md** — node-actions table, console commands, ICE/trace/darknet/IDS sections,
  tips. `access-darknet` and `cancel-trace` reframed as exec scripts.

## Key decisions

- **Naming:** `run`/`shell`/`exec` all collided on first letters of existing core verbs
  (r=reboot, s=status, e=eject). Resolved by renaming `eject`→`kick` (frees `e`) and
  using `exec`. First-letter uniqueness matters for tab-completion ergonomics.
- **Approach A (synthetic EXEC follow-up action):** reuses the existing exploit-card
  choice picker rather than building new menu UI. Action/dispatch layer untouched —
  scripts stay dispatchable by id; only presentation changed.
- **Module boundary:** `scripts.js` stays pure (predicate only); `getScriptActions` +
  `buildExecAction` live in `node-actions.js` to avoid a `node-actions ↔ scripts` cycle.
- **`cancel-trace` under EXEC:** accepted despite being time-critical; UX-friction
  mitigation deferred to a future iteration (per #135).
- **Plan deviation (better):** picker choices use `render: "action"` + `data:{label,desc}`
  (a render-type discriminator) instead of the plan's `render: s.label`. The original
  would have rendered blank — the picker component only renders known render types.
  Caught in Task 3 code review and fixed.

## Verification

- `make check`: 792 tests pass, lint clean.
- Playtest harness `help`: shows `exec` + `kick`, no `eject`.
- Bot census (`make census SEEDS=10`): branch == main (0.2 success, identical) — no
  gameplay regression. The bot dispatches action ids directly (bypassing exec/menu),
  so its behavior is unaffected; it runs cleanly with `kick`.
- EXEC menu/picker data path confirmed via a node one-off: owned IDS menu = `mine,
  reboot, exec` (raw `corrupt` hidden), picker choice = `{id:"corrupt",
  render:"action", label:"Corrupt IDS"}`.

## Carried forward / follow-ups

- **Live browser click-through NOT run.** The Playwright Firefox build fails to launch
  in this environment, and there's no DOM/jsdom test infra. The picker render branch +
  menu filter were verified via the node data-path check + code review, not a live paint.
  **Recommend a one-line manual smoke before/after merge:** own an IDS, click
  `EXEC ▸ corrupt`, confirm `> exec corrupt` in the log and forwarding disabled.
- **`cancel-trace` UX friction** under EXEC (time-critical, two interactions deep) —
  revisit if it bites in play (#135).
- **`docs/BACKLOG.md`** line ~129 ("bot never uses eject") is doubly stale — bot uses
  `kick` now, and has used it since the evasion heuristics. Pre-existing; fix on a backlog pass.
- **Latent test hazard:** `initActionDispatcher` registers a persistent `starnet:action`
  listener (no cleanup); registered once in `tests/integration.test.js`. Fine today;
  add a guard flag if that suite grows more dispatcher-based tests.
- **`actions` listing** nested ternary in the dispatcher echo is at 3 branches — if a
  4th submenu (e.g. a `buy` picker) ever appears, refactor to a small helper.
