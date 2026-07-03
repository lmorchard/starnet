# Console Targeted-Node Commands — Implementation Plan (#284)

> **For agentic workers:** TDD each task (failing test → minimal change → green → commit). Two tasks:
> command surface + tests, then docs. Autonomous-friendly (no feel-driven parts).

**Goal:** Interactive node-action console commands act on the currently **targeted** node — drop the
explicit `<node>` arg from `xploit`/`sniff`/`replay`, clean the core verbs' misleading node completion,
and update the harness/docs to target-first.

**Architecture:** All converted verbs resolve their node via the existing `resolveImplicitNode()`
(selected node or a clear error). Core dynamic verbs already dispatch to `selectedNodeId`; only their
tab-completion + stray-arg handling change. `scripts/playtest.js` delegates to the same `runCommand`, so
its behavior follows automatically — only its help text + `CLAUDE.md`/`MANUAL.md` need edits.

**Tech stack:** Vanilla ES modules, JSDoc `@ts-check`, node:test.

## Global constraints (from spec)

- Strip explicit-node args **everywhere** (incl. the playtest harness) — accept target-first verbosity.
- **Keep args:** `target <node>`, `status node <id>`, globals (`jackout`). Don't touch `sweep`/`exec`
  (already targeted), selection mechanics, or the `starnet:action { nodeId }` dispatch contract (bot
  dispatches directly, unaffected).
- `@ts-check`; seeded `initGame` in tests; `make check` green.

---

## Task 1 — Command surface + tests

**Files:**
- Modify `js/core/console-commands/commands.js` — `xploit`, `sniff`, `replay` verbs.
- Modify `js/core/console-commands/dynamic-actions.js` — core-verb `complete`.
- Modify `js/core/console-commands/resolvers.js` — `resolveImplicitNode()` error message.
- Test: `js/core/console-commands/commands.test.js`, `js/core/console-commands/completions.test.js`.

**Read first:** the top of `commands.js` for the exact imported helper names
(`resolveNode`, `resolveImplicitNode`, `resolveCard`, `dispatch`, `fromCards`, `fromNodes`, `fromList`,
`visibleIncidentFlows`, `resolveFlow`, `flowDesc`, `flowId`, `addLogEntry`) — use the real names.

**Key changes:**

`resolvers.js` `resolveImplicitNode()` — fix the message (verb is `target`, not `select`):
```js
addLogEntry("No node targeted. Use: target <node>", "error");
```

`commands.js` `xploit` → card-only, node from the target:
```js
{ verb: "xploit",
  complete(args, partial, state) {
    // Only cards (from the targeted node's hand ordering). Never node candidates.
    if (args.length === 0 && state.selectedNodeId) return fromCards(state.player.hand, partial);
    return null;
  },
  execute(args) {
    const node = resolveImplicitNode();                 // targeted node or logs the error
    if (!node) return;
    if (args.length < 1) { addLogEntry("Usage: xploit <card>  (target a node first)", "error"); return; }
    const card = resolveCard(args.join(" "));
    if (!card) return;
    dispatch(A.XPLOIT, { nodeId: node.id, exploitId: card.id });
  },
},
```

`commands.js` `sniff` → flow-only:
```js
{ verb: "sniff",
  complete() { return null; },                          // no node candidates; flows aren't node-completed
  execute(args) {
    const s = getState();
    const node = resolveImplicitNode();
    if (!node) return;
    const ref = args.length >= 1 ? args.join(" ") : null;
    const flows = visibleIncidentFlows(s, node.id);
    if (flows.length === 0) { addLogEntry(`no flows on ${node.id}.`, "meta"); return; }
    if (!ref) {
      addLogEntry(`flows on ${node.id}:`, "meta");
      flows.forEach((f, i) => addLogEntry(`  ${i + 1}. ${flowDesc(f, node.id)}`, "meta"));
      return;
    }
    const flow = resolveFlow(flows, ref);
    if (!flow) { addLogEntry(`sniff: no flow "${ref}" on ${node.id}.`, "error"); return; }
    dispatch(A.SNIFF, { nodeId: node.id, flowId: flowId(flow) });
  },
},
```

`commands.js` `replay` → no arg:
```js
{ verb: "replay",
  execute() {
    const node = resolveImplicitNode();
    if (!node) return;
    dispatch(A.REPLAY, { nodeId: node.id });
  },
},
```
(Drop `complete: completeNodeArg` from `replay`. After this + the dynamic-actions change, if
`completeNodeArg` is imported but no longer used, remove its import/definition; if still used elsewhere,
leave it — grep before deleting.)

`dynamic-actions.js` — core verbs take no node; stop offering node completion (remove the
`complete: completeNodeArg` line from the `registerCommand`). `execute` already dispatches
`{ nodeId: getState().selectedNodeId }` and ignores args — leave that.

**Steps (TDD):**
1. **Completions test** (`completions.test.js`): with a selected node, `xploit` completion returns only
   card candidates (assert none of the returned insertTexts are node ids); with no selection returns
   `null`. `sniff`, `replay`, and a core verb (`probe`) return `null` / no node candidates. Run → some
   FAIL (they offer nodes today). Make the `complete` edits. Run → PASS.
2. **Command test** (`commands.test.js`): mirror the file's existing setup (initGame with a seed + a
   selected node; it already spies on dispatch/emit). Assert: targeted `xploit <card>` dispatches
   `A.XPLOIT {nodeId:<target>, exploitId}`; `sniff` with no arg lists flows and `sniff <flow>` dispatches
   `A.SNIFF {nodeId:<target>}`; `replay` dispatches `A.REPLAY {nodeId:<target>}`. Run → FAIL. Make the
   `execute` edits + the `resolveImplicitNode` message. Run → PASS.
3. **No-target test** (`commands.test.js`): with `selectedNodeId` null, each verb logs the
   "No node targeted…" error and dispatches nothing (assert the dispatch spy count is 0). Also assert
   that with a node targeted, `runCommand("xploit gateway AuthBrute")` treats `"gateway AuthBrute"` as
   the card token → `resolveCard` finds none → error, and does NOT dispatch an xploit on `gateway`
   (proves the explicit-node form is gone). Run → PASS.
4. `make check` green. Commit: `feat: console node-actions act on the targeted node (#284)`.

---

## Task 2 — Harness help + docs

**Files:**
- Modify `scripts/playtest.js` — usage/help text (the `console.error("...probe [node]  xploit <node>
  <card>  dump [node]")` line, ~113).
- Modify `CLAUDE.md` — the playtest "Usage" block + "Typical workflow" block.
- Modify `MANUAL.md` — the console-command reference for the converted verbs.

**Key changes:**
- `playtest.js` usage line → target-first, no node args on the action verbs, e.g.:
  `probe   xploit <card>   dump   fetch   mine   sniff [flow]   replay   sweep <depth>   target <node>`.
- `CLAUDE.md` Usage block — the two stale examples become target-first:
  - `node scripts/playtest.js "xploit ids-1 AuthBrute"    # explicit node + card` →
    two lines: `"target ids-1"` then `"xploit AuthBrute"` (drop the "explicit node + card" comment).
  - `--state ... "probe gateway"` → `"target gateway"` then `"probe"`.
  - `"xploit 2"  # xploit with card #2 (targeted node)` is already card-only — keep (it relies on a
    prior `target`). Add a one-line note that action verbs act on the targeted node.
  - "Typical workflow" block already does `target gateway` → `probe` → `xploit 4`; verify it needs no
    change (it shouldn't) beyond the note.
- `MANUAL.md` — in the console-commands / node-actions reference, drop the `<node>` arg from
  probe/xploit/dump/fetch/mine/sniff/replay and add one sentence that these act on the **targeted**
  node (reinforces the active-mode fiction). Keep `target <node>` and `status node <id>`.

**Steps:**
1. Grep the stale forms: `grep -rn "xploit ids-1\|probe gateway\|<node> <card>\|probe \[node\]\|dump \[node\]" scripts/playtest.js CLAUDE.md MANUAL.md` — audit each.
2. Update the three files per above.
3. `make check` (docs don't run tests, but confirm nothing else references removed behavior). Commit:
   `docs: target-first console usage in playtest/CLAUDE/MANUAL (#284)`.

---

## Self-review notes
- **Spec coverage:** xploit/sniff/replay + core-verb completion + no-target message (Task 1); playtest +
  CLAUDE + MANUAL (Task 2); tests (Task 1). All spec sections mapped.
- **Non-goals honored:** no change to target/untarget/status/globals, sweep/exec, or the dispatch contract.
- **Verify during execution:** confirm the real helper names in `commands.js` imports before editing;
  confirm `completeNodeArg` usage before deleting it; the command-test file's existing dispatch-spy
  mechanism is the seam for the assertions (don't invent a new one).
