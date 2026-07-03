# Spec — Console node-action commands act on the targeted node (#284)

## Goal

Interactive node-action console commands should operate on the **currently targeted node**, not an
explicit `<node>` argument. This converges the older verbs onto the stance SWEEP (#282) already took
(`sweep <depth>`, targeted-only), and restores two things the explicit-node forms violate:

- **The active/passive fiction** — *targeting* a node is what couples your deck to it and makes you
  detectable (MANUAL "Passive vs Active Mode"). Acting on a non-targeted node sidesteps that.
- **GUI/console symmetry** (a core project principle) — the node inspector only ever acts on the
  *selected* node; the console shouldn't have a capability the GUI can't express.

**Decision (settled with Les):** strip explicit-node args **everywhere**, including the headless
playtest harness — accept the added `target <node>` verbosity in scripts/transcripts.

## Current state (origin/main @ a284e72)

- **Core verbs** (`probe`/`dump`/`fetch`/`mine`/`kick`/`reboot`, `corrupt`) are **dynamically
  registered** in `js/core/console-commands/dynamic-actions.js` from the *selected* node's available
  actions; their `execute` already dispatches `{ nodeId: selectedNodeId }` and takes **no** node arg.
  But they register `complete: completeNodeArg` (misleadingly offers nodes) and silently ignore a
  stray arg.
- **`xploit`** (`commands.js`) accepts `xploit <node> <card>` OR (selected) `xploit <card>` — via
  `resolveNode(args[0])`.
- **`sniff`** accepts `sniff <node> [flow]` OR (selected) `sniff [flow]`.
- **`replay`** accepts `replay <node>` OR (selected) implicit.
- **`sweep`** / **`exec`** are already targeted-only (the model).
- **`target <node>`** (selection), **`status node <id>`** (read), globals (`jackout`) — keep args.
- **Helper:** `resolveImplicitNode()` (resolvers.js) returns the selected node or logs an error;
  `resolveNode(token)` resolves an explicit token. The error text currently reads
  "No node selected. Use: select <node>" — `select` is not the verb (it's `target`).
- **Harness:** `scripts/playtest.js` delegates non-harness commands to `runCommand` (`js/ui/console.js`)
  — the SAME registry — so console behavior changes flow through automatically. Its usage/help text
  (line ~113: `probe [node]  xploit <node> <card>  dump [node]`) is stale copy only. The bot dispatches
  `starnet:action { nodeId }` directly (not via console parsing) → unaffected.

## Changes

### Command surface (`js/core/console-commands/`)
- **`xploit`** → `xploit <card>` only. Drop the `<node> <card>` branch; resolve the node via
  `resolveImplicitNode()`; card arg unchanged. Update `complete` to only offer cards (from the
  selected node's hand), never nodes. Usage error → `xploit <card> (target a node first)`.
- **`sniff`** → `sniff [flow]` only. Drop the `<node>` branches; node via `resolveImplicitNode()`.
  Completion offers flows/nothing, not nodes.
- **`replay`** → `replay` (no arg); node via `resolveImplicitNode()`. Drop `completeNodeArg`.
- **Core dynamic verbs** (`dynamic-actions.js`) — change `complete: completeNodeArg` to a completion
  that offers **no node** (these take none). They already dispatch to `selectedNodeId`; make them
  ignore any stray positional arg explicitly (no behavior change, just no longer accept-and-ignore).
- **Unchanged:** `target <node>`, `untarget`, `status node <id>`, `sweep <depth>`, `exec [script]`,
  globals.

### No-target behavior
All converted verbs resolve through `resolveImplicitNode()`: with nothing targeted → a clear error and
no dispatch (no-op). Fix the shared message: `"No node selected. Use: select <node>"` →
`"No node targeted. Use: target <node>"`.

### Docs / harness
- `scripts/playtest.js` — update the usage/help text to the target-first forms
  (`probe`, `xploit <card>`, `dump`, `sniff [flow]`, …; `target <node>` shown as the selection step).
- `CLAUDE.md` — the playtest examples become target-first: `"target gateway"` then `"probe"`;
  `"target ids-1"` then `"xploit AuthBrute"`. Update the "Typical workflow" + Usage blocks.
- `MANUAL.md` — the console-command reference for these verbs drops the `<node>` arg and notes they act
  on the targeted node (reinforcing the active-mode fiction).

## Testing

- **Completions** (`completions.test.js`): the converted verbs no longer offer node candidates;
  `xploit` offers only cards; `sniff` offers flows/nothing.
- **Commands** (`commands.test.js`): with a node targeted, `xploit <card>` / `sniff [flow]` / `replay` /
  a core verb dispatch the action on the targeted node. With **no** target, each logs the
  "target a node" error and dispatches nothing (assert `dispatch`/emit not called). An explicit-node
  form no longer works (e.g. `xploit gateway AuthBrute` treats `gateway` as the card token → resolves
  no card → error, rather than acting on `gateway`).
- **GUI/console symmetry** preserved: the inspector path is unchanged (already targeted-only).
- `make check` green.

## Non-goals

- No change to `target`/`untarget`/selection mechanics, `status`, or globals.
- No change to the bot or the `starnet:action { nodeId }` dispatch contract (harness/bot dispatch
  layer is untouched — this is purely the console command surface + its docs).
- Not touching SWEEP/exec (already targeted).
