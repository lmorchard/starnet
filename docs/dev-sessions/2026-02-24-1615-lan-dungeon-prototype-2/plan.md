# Plan: LAN Dungeon Prototype — Session 2

_Session: 2026-02-24-1615-lan-dungeon-prototype-2_

## Overview

Six phases. Each phase leaves the game fully playable. Phases 1–4 are the console; 5 is exploit chaining; 6 is cheats.

---

## Phase 1 — Console UI skeleton

**Builds on:** existing log pane (`#log-entries` div, `syncLogPane` in `main.js`)

**Goal:** Add a text input to the log pane and create `js/console.js` with the plumbing — input handling, command history, submit dispatch — but no real commands yet. Unknown input gets an error message.

### Steps

1. **`index.html`** — wrap `#log-entries` and a new `<input id="console-input">` in a `#log-pane` container div.

2. **`css/style.css`** — style the input to match the terminal aesthetic: full-width, monospace, dark bg, cyan text, `> ` prompt prefix via a wrapper label or span.

3. **`js/console.js`** (new file) — export `initConsole()`:
   - Grabs `#console-input`
   - Maintains a `history[]` array and `historyIndex`
   - On `keydown`:
     - `Enter` → calls `submitCommand(input.value)`, pushes to history, clears input, resets historyIndex
     - `ArrowUp/Down` → cycles history
   - `submitCommand(raw)`:
     - Trims, ignores empty
     - Logs the raw input as a `'command'` log entry (e.g. `> probe gateway`)
     - Tokenizes into `[verb, ...args]`
     - Dispatches to `handleCommand(verb, args)`
     - `handleCommand` currently just logs `"Unknown command: <verb>"` as `'error'`

4. **`js/state.js`** — export `addLogEntry(text, type)` (rename the private `addLog` to this, update all internal callers).

5. **`js/main.js`** — import and call `initConsole()` during `init()`.

**After this phase:** A prompt appears below the log. You can type commands; they appear in the log with `> ` prefix. Unknown commands get an error. History works with arrow keys.

---

## Phase 2 — Core game commands

**Builds on:** Phase 1 console skeleton, existing `starnet:action:*` event system

**Goal:** Implement all game action commands. Commands dispatch the same custom events that buttons do, so no state logic is duplicated.

### Node and card resolution

Add two helpers to `console.js`:
- `resolveNode(token, state)` — finds a node by exact id, then by case-insensitive label prefix. Returns `null` with an error log if ambiguous or not found.
- `resolveCard(token, state)` — finds a card in hand by exact id, then by case-insensitive name prefix.

### Commands to implement

```
probe <node>            → starnet:action:probe        { nodeId, fromConsole: true }
exploit <node> <card>   → starnet:action:launch-exploit { nodeId, exploitId, fromConsole: true }
read <node>             → starnet:action:read         { nodeId, fromConsole: true }
loot <node>             → starnet:action:loot         { nodeId, fromConsole: true }
reconfigure <node>      → starnet:action:reconfigure  { nodeId, fromConsole: true }
jackout                 → starnet:action:jackout       { fromConsole: true }
```

Each command:
1. Validates argument count
2. Resolves node/card references (logs error and returns on failure)
3. Dispatches the appropriate `starnet:action:*` event with `fromConsole: true`

**After this phase:** Full game is playable via keyboard. All actions that were click-only now have a command equivalent.

---

## Phase 3 — Click-to-command echo

**Builds on:** Phase 2 commands, `addLogEntry` export from `state.js`

**Goal:** Every click action logs its equivalent command to the console, so clicking teaches the vocabulary.

### Steps

In each `starnet:action:*` handler in `main.js`, if `!evt.detail.fromConsole`, call `addLogEntry('> <command>', 'command')` before executing. Mapping:

| Event | Echoed command |
|---|---|
| `starnet:action:probe` | `probe <nodeId>` |
| `starnet:action:launch-exploit` | `exploit <nodeId> <exploitId>` |
| `starnet:action:read` | `read <nodeId>` |
| `starnet:action:loot` | `loot <nodeId>` |
| `starnet:action:reconfigure` | `reconfigure <nodeId>` |
| `starnet:action:jackout` | `jackout` |

The `fromConsole: true` flag on console-dispatched events prevents double-logging (the command was already echoed when typed).

**After this phase:** Clicking Probe on a node logs `> probe gateway` in the console. The UI and CLI feel unified.

---

## Phase 4 — Tab completion

**Builds on:** Phase 2 node/card resolution helpers

**Goal:** Tab key completes command verbs, node names, and card names contextually.

### Steps

In `console.js`, intercept `keydown Tab` (prevent default):

1. Tokenize the current input value, note cursor position
2. **Token 0 (verb):** complete against the known verb list
3. **Token 1 (node arg):** complete against visible node ids and labels
4. **Token 2 (card arg, for `exploit`):** complete against non-disclosed card names in hand

Completion logic: if exactly one match, replace the current token and append a space; if multiple matches, log the options as a `'meta'` entry (unix-style) without changing the input.

**After this phase:** `pr<Tab>` → `probe `, `probe ga<Tab>` → `probe gateway `, `exploit gateway sn<Tab>` → fills in the matching card name.

---

## Phase 5 — Staged vulnerability chaining

**Builds on:** existing vulnerability model in `exploits.js`, `launchExploit` in `state.js`

**Goal:** Some vulnerabilities start hidden and are only revealed after a specific exploit type succeeds on that node. Demonstrates: initial foothold opens deeper attack surface.

### Data model changes (`exploits.js`)

Add two fields to the vulnerability object shape:
```js
hidden: false,       // if true, not shown until unlocked
unlockedBy: null,    // vuln type id — revealed after a card targeting this type succeeds
```

`generateVulnerabilities` generates vulns with `hidden: false, unlockedBy: null` (no change to existing behaviour).

### Exploit resolution changes (`state.js` — `launchExploit`)

After a successful exploit, after advancing access level, check for staged vulns:
```js
const usedTypes = exploit.targetVulnTypes;
node.vulnerabilities.forEach(v => {
  if (v.hidden && v.unlockedBy && usedTypes.includes(v.unlockedBy)) {
    v.hidden = false;
    addLogEntry(`${node.label}: deeper attack surface revealed.`, 'success');
  }
});
```

### Sidebar display (`main.js`)

Filter `node.vulnerabilities` to exclude `hidden: true` entries before rendering the vuln list.

### Network data (`data/network.js`)

Add an optional `stagedVulnerabilities` array to node definitions. In `state.js` `initState`, after calling `generateVulnerabilities(n.grade)`, append any `stagedVulnerabilities` from the network node definition (with `hidden: true` pre-set on each).

Add staged vulns to two nodes to demonstrate the chain:
- **`fileserver`**: after exploiting its `path-traversal` vuln, a hidden `kernel-exploit` unlocks
- **`cryptovault`**: after exploiting its initial vuln, a hidden `hardware-backdoor` unlocks (rare second-stage needed to fully own it)

**After this phase:** Probing the fileserver shows 1–2 vulns. Successfully exploiting it reveals an additional deeper vuln in the sidebar. The cryptovault rewards a two-stage chain.

---

## Phase 6 — Cheat commands

**Builds on:** console command dispatch (Phase 2), state mutations

**Goal:** A set of `cheat *` commands for playtesting. Clearly marked in code. Set `isCheating` on first use.

### State changes (`state.js`)

- Add `isCheating: false` to initial state
- Export `setCheating()` — sets `isCheating: true`, emits (idempotent)
- Export `forceGlobalAlert(level)` — sets `globalAlert` directly (bypasses escalation-only rule), triggers trace countdown if needed; used only by cheats

### Cheats module (`js/cheats.js`) — new file

Top-of-file comment block: `// ── CHEAT COMMANDS — development/playtesting only ──`

Export `handleCheatCommand(args, getStateFn)` → returns `true` if handled:

```
cheat give card [common|uncommon|rare]
  → generateExploit(rarity), push to state.player.hand, emit

cheat give cash <amount>
  → state.player.cash += amount, emit

cheat set alert <green|yellow|red|trace>
  → forceGlobalAlert(level)

cheat own <node>
  → node.accessLevel = 'owned', node.visibility = 'accessible',
    revealNeighbors(nodeId), emit
```

Each handler calls `setCheating()` before executing.

### Console wiring (`console.js`)

In `handleCommand`, if verb is `cheat`, forward `args` to `handleCheatCommand`.

### HUD indicator (`main.js` — `syncHud`)

When `state.isCheating`, render a `// CHEAT` label in the HUD (styled magenta or red) to make the tainted run obvious.

**After this phase:** `cheat give card rare` adds a rare exploit to hand. `cheat own fileserver` immediately owns a node. `cheat set alert green` resets alert for testing. HUD shows `// CHEAT` for the rest of the run.

---

## File change summary

| File | Change |
|---|---|
| `index.html` | Wrap log pane, add console input |
| `css/style.css` | Console input styles |
| `js/console.js` | **NEW** — all console logic |
| `js/cheats.js` | **NEW** — cheat command handlers |
| `js/state.js` | Export `addLogEntry`, `setCheating`, `forceGlobalAlert`; add `isCheating`; staged vuln reveal in `launchExploit` |
| `js/main.js` | Init console, click-echo on action handlers, CHEAT HUD indicator |
| `js/exploits.js` | Add `hidden`/`unlockedBy` fields to vuln shape |
| `data/network.js` | Add `stagedVulnerabilities` to fileserver + cryptovault |
