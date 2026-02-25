# Plan: Playtest LLM Hooks

_Session: 2026-02-25-1408-playtest-llm-hooks_

---

## Overview

Three commits:
1. **`cheat give matching`** — `exploits.js` + `cheats.js`
2. **`actions` + `status summary`** — `console.js`
3. **Log prefix audit** — `log-renderer.js` cleanup

---

## Step 1 — `generateExploitForVuln(vulnId)` in `exploits.js`

**Context:** `cheat give matching` needs to generate an exploit card that specifically targets a given vulnerability type. The existing `generateExploit(rarity)` picks `targetVulnTypes` randomly. We need a targeted variant.

**Add to `exploits.js`:**

```js
// Generates an exploit card that specifically targets a given vuln type.
// Uses the vuln's own rarity to determine card tier.
export function generateExploitForVuln(vulnId) {
  const vuln = VULNERABILITY_TYPES.find((v) => v.id === vulnId);
  if (!vuln) return generateExploit(); // fallback
  const r = vuln.rarity;
  const name = randomFrom(EXPLOIT_NAMES[r]) + " " + randomFrom(EXPLOIT_SUFFIXES);
  return {
    id: `exploit-${_exploitIdCounter++}`,
    name,
    rarity: r,
    quality: randomQuality(r),
    targetVulnTypes: [vulnId],
    decayState: "fresh",
    usesRemaining: USES_BY_RARITY[r],
  };
}
```

Export it alongside `generateExploit` and `generateStartingHand`. Run `make check`.

---

## Step 2 — `cheat give matching [nodeId]` in `cheats.js`

**Context:** `cheats.js` handles `cheat give ...` in `cheatGive()`. Add a new `"matching"` subcommand.

**In `cheatGive()`**, add a branch for `what === "matching"`:

```js
if (what === "matching") {
  // Resolve node from arg or selection
  const token = args[1];
  const s = getState();
  let node = token
    ? (s.nodes[token] || Object.values(s.nodes).find(n => n.label.toLowerCase().startsWith(token.toLowerCase())))
    : (s.selectedNodeId ? s.nodes[s.selectedNodeId] : null);

  if (!node) {
    addLogEntry("No node selected. Usage: cheat give matching [nodeId]", "error");
    return false;
  }
  if (!node.probed) {
    addLogEntry(`${node.label}: probe the node first to reveal vulnerabilities.`, "error");
    return false;
  }
  const targets = node.vulnerabilities.filter(v => !v.patched && !v.hidden);
  if (targets.length === 0) {
    addLogEntry(`${node.label}: no unpatched vulnerabilities to match.`, "error");
    return false;
  }
  targets.forEach(v => {
    const card = generateExploitForVuln(v.id);
    s.player.hand.push(card);
    addLogEntry(`CHEAT: Added ${card.rarity} exploit "${card.name}" targeting ${v.id}.`, "success");
  });
  activateCheat();
  return true;
}
```

Also update `cheatHelp()` and the help text in `cmdHelp()` in `console.js` to include the new command.

Update the `import` in `cheats.js` to import `generateExploitForVuln`.

Run `make check`. **Commit: `Add: cheat give matching — targeted exploit for playtesting`**

---

## Step 3 — `actions` command in `console.js`

**Context:** The `actions` command is the LLM agent's primary decision interface. It reads current game state and enumerates every valid action with enough context to act without guessing.

**Add `cmdActions()` function:**

Logic — build lines array:
1. Always add `jackout`
2. If no selected node:
   - Add `select <nodeId>` listing all accessible non-rebooting node IDs
3. If a node is selected (`sel = s.nodes[s.selectedNodeId]`):
   - Always add `deselect`
   - Add `select <nodeId>` listing other accessible nodes
   - Add `probe` if `!sel.probed && sel.visibility === "accessible"`
   - Add `exploit <n>` if `sel.visibility === "accessible"` — list all cards sorted by `exploitSortKey`, with `✓` for matching vulns (only meaningful if probed)
   - Add `read` if `(sel.accessLevel === "compromised" || sel.accessLevel === "owned") && !sel.read`
   - Add `loot` if `sel.accessLevel === "owned" && sel.read && sel.macguffins.some(m => !m.collected)`
   - Add `reconfigure` if `sel.type === "ids" && !sel.eventForwardingDisabled && sel.accessLevel !== "locked"`
   - Add `eject` if `s.ice?.active && s.ice.attentionNodeId === s.selectedNodeId`
   - Add `reboot` if `sel.accessLevel === "owned" && !sel.rebooting`
   - Add `cheat give matching` if `sel.probed` (as a balance-rescue escape hatch, clearly labeled)

Example output format:
```
AVAILABLE ACTIONS
─────────────────
  jackout                 — disconnect and end run
  select <nodeId>         — accessible: router-a, fileserver-1, ids-node-1
  deselect                — clear selection
  probe                   — scan INET-GW-01 for vulnerabilities
  exploit <n>             — attack INET-GW-01 (owned):
                            1. SSHammer v1.0 [common]  targets: unpatched-ssh  ✓ match
                            2. AuthBrute mk2 [common]  targets: weak-auth  no match
  read                    — scan node contents
  cheat give matching     — add matching exploits (balance rescue — sets cheat flag)
```

**Wire it up:**
- Add `"actions"` to the `VERBS` array
- Add `case "actions": return cmdActions();` in `handleCommand`

Run `make check`. **Commit: `Add: actions + status summary commands for LLM playtesting`** (after next step)

---

## Step 4 — `status summary` subcommand in `console.js`

**Context:** `cmdStatus()` dispatches on `args[0]`. Add `"summary"` as a new case.

**Add `cmdStatusSummary()` function:**

```
SUMMARY
───────
  Alert: GREEN  |  Cash: ¥12,400  |  Trace: —
  ICE: ACTIVE @ router-b → fileserver-1  |  Detection: 4s remaining
  Selected: INET-GW-01 [server] owned
  Hand: 5 cards  (2 match selected node)
  Network: 6 accessible  |  2 owned  |  1 lootable
  Mission: retrieve CryptoVault-Data (¥84,000)  — NOT YET COLLECTED
```

Fields:
- `Alert`: `s.globalAlert.toUpperCase()` + trace countdown if active
- `ICE`: `ACTIVE @ residentLabel → attentionLabel` or `NONE` / `INACTIVE`; include detection timer if pending
- `Selected`: node id, type, access level; `none` if nothing selected
- `Hand`: total count + how many match selected node (count where `exploitSortKey(card, sel) === 0`)
- `Network`: accessible count, owned count, lootable count (owned + read + has uncollected macguffins)
- `Mission`: target name + value + collected status; `none` if no mission

**Wire it up:** Add `case "summary":` to `cmdStatus` switch, and add `"summary"` to `STATUS_NOUNS` for tab completion.

**Commit: `Add: actions + status summary commands for LLM playtesting`**

---

## Step 5 — Log prefix audit in `log-renderer.js`

**Context:** The existing `[CATEGORY]` prefix style (`[NODE]`, `[EXPLOIT]`, `[ICE]`, `[ALERT]`, `[MISSION]`, `[SYS]`) is already machine-readable and more informative than single-character symbols. Keep this style. The goal is consistency — ensure every entry has a prefix and no categories are missing or mixed.

**Audit checklist:**
- All `[NODE]` entries ✓ (already consistent)
- All `[EXPLOIT]` entries ✓
- All `[ICE]` entries ✓
- All `[ALERT]` entries ✓
- All `[MISSION]` entries ✓
- `[SYS]` for run start/end ✓
- `console.js` command echo uses `> command` — fine as-is (player input echo)
- `cheats.js` uses `CHEAT: ...` prefix — normalize to `[CHEAT]` for consistency
- `cmdStatus`, `cmdHelp`, `cmdLog` use `## STATUS`, `[SYS]` — fine as-is (meta output, not events)

**Changes:**
- In `cheats.js`: change `CHEAT: ` prefix to `[CHEAT] ` in all `addLogEntry` calls
- Verify no entries in `log-renderer.js` are missing a `[CATEGORY]` prefix

Run `make check`. **Commit: `Polish: normalize log prefixes for LLM legibility`**

---

## Step 6 — Playwright MCP Playtest

**Context:** With `actions` and `status summary` working, run a full playtest using the Playwright MCP server directly in the dev session.

**Playtest procedure:**
1. Start the server: `make serve`
2. Navigate to `http://localhost:3000` via MCP
3. Each turn: issue `status summary` + `actions`, read output via snapshot, decide next command, type it in
4. Continue until run ends (jackout, success, or caught)
5. Capture full log via `log 100`
6. Write inline analysis: friction points, balance signals, actionable recommendations

This is the deliverable — a real playtest run with findings that feed the next session.

---

## Notes

- `generateExploitForVuln` is a pure addition to `exploits.js` — no existing code changes
- `cheat give matching` follows the exact pattern of existing cheat commands
- `actions` is read-only — no state mutations, pure display
- `status summary` is read-only — no state mutations
- The log prefix changes are cosmetic/string-only — no logic changes
- Run `make check` after each step
