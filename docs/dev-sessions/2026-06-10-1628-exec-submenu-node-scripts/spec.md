# EXEC submenu / verb for non-core node actions

**Issue:** [#135](https://github.com/lmorchard/starnet/issues/135)
**Branch:** `exec-submenu-node-scripts`

## Problem

Set-piece node actions (`unlock-vault`, `extract-token`, `extract-key`,
`decrypt-loot`, `scan-vault`) and security-subversion actions (`corrupt`,
`spoof`, `disarm`) are registered as both top-level context-menu buttons and
**flat console verbs** — indistinguishable from core deck commands like `probe`,
`xploit`, `dump`, `fetch`. They crowd the context menu and pollute the top-level
tab-completion namespace.

Conceptually these are **scripts run on a compromised node**, not core deck
operations. They should be grouped behind a single `EXEC` affordance — a menu
entry and a console verb — so the core deck namespace stays clean and new
set-piece actions don't leak into it.

## Goals

- Group all non-core node actions under one `EXEC` entry in the graph context menu.
- Provide an `exec` console verb: `exec` lists the selected node's scripts;
  `exec <script>` runs one; tab-completion completes script ids after `exec `.
- Remove script actions from the top-level console verb namespace and
  top-level tab-completion.
- Future set-piece-authored node actions become scripts **by default** — no
  per-action tagging required.
- Preserve the **GUI/console symmetry invariant**: picking a script in the menu
  and typing `exec <script>` produce identical state changes and log output.

## Non-goals

- No change to *what* any script does — only how it's presented and dispatched.
- No new menu-rendering paradigm (flyouts, nested panels). We reuse the existing
  follow-up choice picker.
- `cancel-trace` lands under EXEC despite being time-critical. UX-friction
  mitigation is explicitly deferred to a future iteration (noted in #135).
- Scripts that themselves declare a `followup` are out of scope (none exist
  today). If one is added later, nesting EXEC → script-followup needs design.

## Scope: the core/script partition

**Core top-level verbs (stay flat, unchanged):**
`probe`, `xploit`, `dump`, `fetch`, `mine`, `kick` (renamed from `eject`),
`reboot`, `abort`, `target`, `untarget`, `jackout`.

Meta console commands (`status`, `actions`, `darknet`, `buy`, `log`, `help`,
`cheat`) are not node actions and are untouched.

**EXEC scripts (grouped under `exec`):**
`corrupt`, `spoof`, `disarm`, `unlock-vault`, `extract-token`, `extract-key`,
`decrypt-loot`, `scan-vault`, `cancel-trace`, `access-darknet`, **and every
future set-piece-authored node action by default.**

**Partition rule:** a node-contextual action is a *script* iff its id is **not**
in the core allowlist `CORE_NODE_VERBS`. This is an allowlist (everything else is
a script), so new set-piece actions are scripts automatically.

```
CORE_NODE_VERBS = { probe, xploit, dump, fetch, mine, kick,
                    reboot, abort, target, untarget, jackout, exec }
```

(`exec` itself is in the set so the synthetic action is never treated as a script.)

## Naming and the `eject` → `kick` rename

`run`, `shell`, and `exec` all collide on first letters already taken by core
verbs (`r`=reboot, `s`=status, `e`=eject). To use **`exec`** with a unique first
letter, **rename `eject` → `kick`** (the letter `k` is unused).

- Change the **player-facing** verb/label/id: `A.EJECT` constant becomes `A.KICK`
  with value `"kick"`, label `"KICK"`, and all help/console text.
- **Do not** rename the internal mechanism: the `ejectIce()` ctx method and the
  `E.ICE_EJECTED` event keep their names — they describe the mechanic (pushing
  ICE to an adjacent node), not the player verb.

## Design (Approach A — synthetic EXEC follow-up action)

The action/dispatch layer stays intact: **all** node actions (core *and*
scripts) remain in `getAvailableActions()` and remain dispatchable by id. We add
one synthetic action and change only the *presentation* layers.

### 1. Partition module — `js/core/actions/scripts.js` (new)

- `CORE_NODE_VERBS` set (above).
- `isScriptAction(id)` → `!CORE_NODE_VERBS.has(id)`.
- `getScriptActions(node, state)` → the node's available actions filtered by
  `isScriptAction`.
- `buildExecAction(scripts)` → the synthetic `EXEC` ActionDef (below).

### 2. Synthetic EXEC action — injected in `getAvailableActions()` (`node-actions.js`)

After assembling global + graph actions, if the node has ≥1 script, append:

```
{
  id: A.EXEC,                       // "exec"
  label: "EXEC",
  desc: () => "run a script on this node",
  followup: {
    title: () => "EXEC",
    choices: (node, state) =>
      getScriptActions(node, state).map(s => ({
        id: s.id, payloadKey: "scriptId", render: s.label, data: {},
      })),
    empty: () => "no scripts available",
  },
  execute: (node, state, ctx, payload) => {
    const script = getAvailableActions(node, state).find(a => a.id === payload.scriptId);
    script?.execute?.(node, state, ctx, { nodeId: node.id });
  },
}
```

The raw script actions stay in the returned array (so the dispatcher and EXEC
can find them by id); presentation layers hide them.

### 3. Dispatcher echo — `action-context.js`

Mirror the existing `xploit` special-case so the GUI EXEC pick echoes the script
name, not `exec`:

```
const logStr =
  (actionId === A.XPLOIT && ...) ? `xploit ${...}`
  : (actionId === A.EXEC && payload.scriptId) ? `exec ${payload.scriptId}`
  : actionId + (nodeId ? ` ${nodeId}` : "");
```

Because EXEC.execute invokes the script's `execute` **directly** (not a
re-dispatch), there is exactly one `COMMAND_ISSUED` echo and the script's own
effect logs follow — identical to how `xploit <card>` reads today.

### 4. Context menu — `visual-renderer.js#syncContextMenu`

Filter the raw script actions out of the menu list (`!isScriptAction(a.id)`).
The synthetic EXEC action remains and, having a `followup`, renders with the
existing `hasFollowup` ▸ indicator. Clicking it opens the existing
`starnet:open-choices` picker, populated with the node's scripts. Picking a
script dispatches `starnet:action { actionId: "exec", scriptId }` — handled by
EXEC.execute. **No new component or rendering path.**

The same filter must be applied anywhere else raw node actions are rendered as
buttons (e.g. `starnet-node-panel` sidebar) — audit during implementation.

### 5. Console — drop scripts from the verb namespace, add `exec`

- **`dynamic-actions.js`:** skip script actions when registering dynamic verbs
  (`if (isScriptAction(action.id)) continue;`). Core node verbs
  (`probe`/`dump`/`fetch`/`mine`/`kick`/`reboot`/`abort`) keep registering as
  today.
- **`commands.js`:** add a static `exec` command:
  - `complete(args, partial, state)` → script ids for the selected node
    (`getScriptActions`), formatted as `{ insertTexts, displayTexts }`.
  - `execute(args)`:
    - no arg → print `scripts on <nodeId>: <id> <id> …` (or "no scripts" / "no
      node selected").
    - `exec <id>` → `emitEvent("starnet:action", { actionId: <id>,
      nodeId: selected, fromConsole: true })`. The dispatcher finds and runs the
      script; an unknown/unavailable id falls through to the existing
      `"<id>: not available."` error.

### 6. `actions` console command + help text

Update the `actions` listing and `help` text so scripts are shown grouped under
`exec` rather than as bare verbs, and so `kick` replaces `eject`.

## Data flow

```
GUI:   click node ▸ EXEC ▸ pick "corrupt"
       → starnet:action { actionId:"exec", scriptId:"corrupt", nodeId }
       → dispatcher echoes "exec corrupt"
       → EXEC.execute → corrupt.execute(node,state,ctx)         → effects + logs

Console: > exec corrupt
       → console echoes raw "> exec corrupt"
       → starnet:action { actionId:"corrupt", nodeId, fromConsole:true }
       → corrupt.execute(node,state,ctx)                        → effects + logs
```

Both paths converge on the same script `execute`, same state mutation, same
effect log lines. Symmetry preserved.

## Files touched

| File | Change |
|---|---|
| `js/core/action-ids.js` | `EJECT`→`KICK`; add `EXEC: "exec"` |
| `js/core/actions/scripts.js` | **new** — `CORE_NODE_VERBS`, `isScriptAction`, `getScriptActions`, `buildExecAction` |
| `js/core/actions/node-actions.js` | inject synthetic EXEC when node has scripts |
| `js/core/actions/action-context.js` | EXEC echo special-case |
| `js/core/node-graph/game-types.js` | `EJECT_ACTION` label/id → KICK |
| `js/core/node-graph/traits.js` | EJECT template ref → KICK |
| `js/ui/visual-renderer.js` | filter raw scripts from context menu |
| `js/ui/components/starnet-node-panel.js` | filter raw scripts (if it lists actions) — audit |
| `js/core/console-commands/dynamic-actions.js` | skip scripts |
| `js/core/console-commands/commands.js` | add `exec` command; update `actions`/`help`; `eject`→`kick` text |
| `MANUAL.md` | node-actions reference, console commands, new EXEC section, kick rename |

## Testing

Bugs/behaviors pinned with tests before/alongside implementation:

- **Partition predicate:** `isScriptAction` returns false for every core verb,
  true for known scripts; `getScriptActions` returns exactly the scripts for a
  representative set-piece node.
- **EXEC injection:** a node with scripts gains an `EXEC` action with a
  non-empty followup; a node with no scripts does not.
- **EXEC dispatch (GUI path):** dispatching `starnet:action { actionId:"exec",
  scriptId:"corrupt" }` produces the same state change as dispatching
  `corrupt` directly (assert observable consequence, e.g. forwarding disabled),
  and exactly one `COMMAND_ISSUED` echo reading `exec corrupt`.
- **Console `exec`:** `exec corrupt` runs the script; `exec` with no arg lists
  scripts; tab-completion returns script ids; an unknown id errors cleanly.
- **Namespace separation:** after selecting a node with scripts, the dynamic
  console registry contains no script verbs (only core verbs + `exec`).
- **`kick` rename:** `kick` dispatches the former `eject` behavior end-to-end;
  `E.ICE_EJECTED` still fires; no `eject` verb remains registered.

Run `make check` (lint + test). Bot harness reads action ids directly — the
`eject`→`kick` rename and any code that referenced `A.EJECT` must be updated so
`scripts/bot-player.js` and `scripts/playtest.js` stay green; smoke-test with the
playtest harness.

## Acceptance criteria

- Core verbs remain top-level in both menu and console.
- Scripts no longer appear as top-level verbs or top-level tab-completions.
- `EXEC ▸` appears in the context menu exactly when the node has ≥1 script and
  opens the existing picker.
- `exec` lists / runs / tab-completes the selected node's scripts.
- `eject` is renamed to `kick` end-to-end; internal `ejectIce`/`ICE_EJECTED`
  names unchanged.
- MANUAL.md reflects EXEC and the `kick` rename.
- `make check` passes; playtest harness smoke test passes.
