# Spec: Playtest LLM Hooks

_Session: 2026-02-25-1408-playtest-llm-hooks_
_Branch: playtest-llm-hooks_

---

## Goal

Make automated playtesting practical and useful:
1. Give the game a clean interface for an LLM agent to observe state and issue commands
2. Build a Playwright-based harness that runs Claude through a full game loop, watchable in-browser
3. Generate a post-run analysis report with actionable findings

Also: add a cheat command for on-demand exploit matching, so playtest runs that get stuck on balance don't have to die early.

---

## Part 1 — Cheat: Give Matching Exploits

Add `cheat give matching [nodeId]` — generates and adds to hand one exploit card targeting each unpatched, non-hidden vulnerability on the specified node (or selected node if no arg given).

**Behavior:**
- If `nodeId` is omitted, uses `state.selectedNodeId`; errors if nothing selected
- If node hasn't been probed, errors: "probe the node first to reveal vulnerabilities"
- Generates one card per unpatched non-hidden vuln, at rarity appropriate to that vuln type
- Cards added to hand normally; `isCheating` flag set as usual

The LLM agent can use this autonomously: if `actions` shows no matching exploits for any accessible node, issue `cheat give matching` and continue. The cheat flag in the log marks it as a balance signal for the post-run analysis.

---

## Part 2 — Game Console Improvements for LLM Legibility

Two new console commands that give an LLM agent everything it needs to play:

### `actions` command

Lists every currently valid action with enough context to make a decision. Not just verb names — full contextual detail.

Example output:
```
AVAILABLE ACTIONS
─────────────────
  select <nodeId>        — select a node (accessible: INET-GW-01, router-a, fileserver-1)
  deselect               — remove presence from network
  probe                  — probe selected node: INET-GW-01 (not yet probed)
  exploit <n>            — use card against selected node:
                           1. SSHammer v1.0 [common] matches: unpatched-ssh ✓
                           2. AuthBrute mk2 [common] no match
                           3. PortKnock Zero [common] no match
  read                   — read selected node (compromised/owned, not yet read)
  loot                   — loot selected node (owned, not yet looted)
  jackout                — jack out and end run
```

Rules for what appears:
- `select` only lists accessible nodes (not `???`)
- `probe`, `exploit`, `read`, `loot`, `reconfigure`, `eject`, `reboot` only appear when valid for the currently selected node
- `exploit` lists all cards with match indicators
- `deselect` always available when a node is selected
- `jackout` always available

### `status summary` subcommand

Current `status` is good but verbose. Add a compact subcommand for the agent loop — just the key decision-relevant facts:

```
SUMMARY
───────
  Alert: green  |  Cash: ¥12,400  |  Trace: —
  ICE: active @ router-b (attention: fileserver-1)  |  Detection: —
  Selected: INET-GW-01 (owned)
  Hand: 8 cards (3 matching selected node)
  Accessible nodes: 6  |  Owned: 2  |  Lootable: 1
  Mission: collect CryptoVault-Data (¥84,000)
```

Compact enough to fit in a prompt without noise.

### Log format consistency

Establish consistent category prefixes across all log entries:

| Prefix | Category |
|---|---|
| `>>` | Player actions (probe, exploit, loot, etc.) |
| `//` | System / ICE events |
| `!!` | Alerts and warnings |
| `**` | Mission events |
| `--` | Informational / flavor |

Audit existing log entries in `log-renderer.js` and normalize them to use these prefixes.

---

## Part 3 — Playwright MCP Playtesting

Full-game playtesting is done directly in a dev session using the Playwright MCP server — no standalone script needed. The MCP tools (`browser_navigate`, `browser_snapshot`, `browser_type`, etc.) are available in-conversation and can drive the game in a real browser.

**Playtest loop (manual, per session):**
1. Navigate to the game (`npx serve .`)
2. Issue `status summary` + `actions` via the console input
3. Decide next move, type it in, observe result
4. Repeat until run ends (jackout, success, or caught)
5. Post-run: narrate analysis inline — friction points, balance observations, actionable recommendations

**This is sufficient for near-term playtesting.** A standalone automated harness (batch runs, unattended, statistical analysis) is a future session once we have more to measure.

**Note:** A future session should decouple the event bus from the DOM (`events.js` currently uses `document.dispatchEvent`) to enable running core game logic in Node.js without a browser. That would enable fast unit-level playtesting of combat, ICE AI, and alert propagation. See BACKLOG.md.

---

## Acceptance Criteria

- [ ] `cheat give matching [nodeId]` adds one matching card per unpatched vuln on the target node
- [ ] `actions` command lists valid moves with context; nothing invalid shown
- [ ] `status summary` outputs a compact single-screen state snapshot
- [ ] Log entries use consistent category prefixes throughout
- [ ] Playwright MCP playtest runs to completion with `status summary` + `actions` loop
- [ ] Post-run analysis narrated inline with friction points and actionable recommendations

---

## Out of Scope

- Standalone automated harness (batch runs, unattended) — future session
- Node.js runtime for core logic (requires decoupling event bus from DOM) — future session
- Difficulty scoring / procedural generation — future session
- Expanded level (more nodes) — follow-on session after first playtest results
- Persistent playtest history / trend analysis — future session
