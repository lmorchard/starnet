# Notes: Playtest LLM Hooks

_Session: 2026-02-25-1408-playtest-llm-hooks_

---

## Playtest Run — LLM-driven via Playwright MCP

Two runs completed. Run 1 ended TRACED (60s countdown expired). Run 2 jacked out voluntarily — stuck at gateway, no accessible neighbors.

### Run 2 Transcript Summary

| Turn | Command | Result |
|------|---------|--------|
| 1 | `status summary` | ICE ACTIVE @ IDS-01 → RTR-B, 1 accessible, 5 cards |
| 2 | `actions` | Only action: `select gateway` |
| 3 | `select gateway` | Gateway selected, Grade D, LOCKED |
| 4 | `probe` | Vulns: open-telnet, path-traversal, weak-auth. Alert: yellow |
| 5 | `actions` | 1 match (FirmDump v3.0 / weak-auth). ICE detected during actions! |
| 6 | `exploit 1` | FAIL. Roll 62 vs 44%. Alert → RED. Message: "No matching attack surface found." |
| 7 | `exploit 1` | FAIL. Roll 72 vs 44%. Message: "target patched or not vulnerable." |
| 8 | `exploit 1` | FAIL. Roll 82 vs 44%. Card worn. Message: "Access denied." |
| 9 | `status summary` | Alert: GREEN (global). Network: 1 accessible. 0 match. |
| 10 | `cheat give matching` | Added NullRoute Pro (open-telnet), RaceSlip μ (path-traversal), PortKnock Pro (weak-auth) |
| 11 | `exploit 2` | SUCCESS. Roll 20 vs 70% (RaceSlip μ, uncommon). Gateway: COMPROMISED |
| 12 | `exploit 1` | SUCCESS. Roll 34 vs 54% (NullRoute Pro). Gateway: OWNED |
| 13 | `status summary` | Alert: GREEN (global). Network: **1 accessible, 1 owned**. Bug confirmed. |
| 14 | `actions` | No `select` line. No accessible neighbors. Dead end. |
| 15 | `read` | Gateway: nothing of value found. |
| 16 | `jackout` | Run ended: SUCCESS (jackout). Mission: FAILED. ¥0. |

---

## Findings

### CRITICAL — Blockers

**1. `accessNeighbors` not promoting revealed → accessible after gateway ownership**

After owning the gateway, neighboring nodes remain visibility=`revealed` but never become `accessible`. `status summary` shows `Network: 1 accessible` throughout. The `actions` command shows no `select` options. The game is unplayable beyond the first node.

- In Run 1, `select RTR-A` by exact node ID worked as an accidental workaround — it promoted the node to accessible on demand via "signal traced" message. This suggests `accessNeighbors` is broken but the `select` command falls through to a promotion path.
- Needs investigation in `state.js` — `accessNeighbors()` is called on compromise/own transitions but the state change isn't taking effect.

**2. Global alert not reflecting local escalation**

Gateway node reached local RED alert after failed exploits, but `status summary` showed `Alert: GREEN` throughout both runs. The two-layer alert system (detection node → security monitor → global alert) is not propagating for the gateway, likely because the gateway is not connected to or does not trigger a security monitor.

- This makes `status summary` misleading — the global alert signal is the primary threat indicator but stays GREEN while the local node burns.
- May be correct design (global alert only rises via IDS/monitor chain), but if so it needs explanation in the UI and the gateway's RED local state should factor in somehow.

---

### BUGS — High Priority

**3. Inconsistent exploit failure messages**

Three consecutive failures on the same matching card produced three different messages:
- "Exploit rejected. No matching attack surface found." — implies no vuln match (wrong, there was a match)
- "FirmDump v3.0 failed — target patched or not vulnerable." — implies card/vuln problem (wrong)
- "Access denied." — generic and ambiguous

All three are the same code path: probability roll failed on a vuln-match attempt. They should use a single consistent message, e.g.: `[EXPLOIT] FirmDump v3.0 — access denied (roll: 62 vs 44%)`.

**4. Sidebar shows wrong buttons**

On an OWNED gateway node, the sidebar shows:
- LOOT (coming soon) — even when nothing to loot / node not lootable
- SUBVERT (coming soon) — not applicable on gateway (not an IDS)
- ESCALATE (coming soon) — not applicable when already owned
- RECONFIGURE (coming soon) — not applicable on gateway (not an IDS)
- READ (done) "(coming soon)" — should disappear or show disabled state after reading

The sidebar needs contextual button gating to match the `actions` command logic. Many "(coming soon)" labels are showing for actions that are permanently inapplicable, not just unimplemented.

---

### BALANCE — Medium Priority

**5. Common card + vuln-match probability too low on Grade D**

44% success rate even with a matching common card on a Grade D (lowest security) node is too punishing. Three consecutive failures burned the only matching card before a single success. Expected successes from 3 uses = 1.32 — so statistically you burn the card after 1 success and 2 failures on average. That feels right for Grade B/C, not D/F.

Recommendation: Grade D vuln-match probability for common cards should be ~65-70%. The cheat flag was triggered (correctly signaling a balance problem), and the uncommon card at 70% felt appropriate by comparison.

**6. ICE detection fires during/immediately after probe**

Both runs: ICE detected the player during or immediately after `probe`, before a single exploit attempt. This compresses the action window to near-zero on the first node. The detection timer is either very short or ICE is pre-positioned adjacent to the gateway at run start.

- Run 2: ICE was at IDS-01 → RTR-B at start — already active, already moving.
- ICE reached the gateway during the `actions` read between probe and first exploit.

Recommendation: Either increase the initial detection grace period or ensure ICE starts farther from the gateway. The opening node should give the player 2-3 actions before ICE pressure begins.

---

### OBSERVATIONS — LLM Interface Quality

**`status summary` — works well**
Clean, scannable, gives the essential snapshot. The ICE location and detection timer fields are useful. Main gap: global alert doesn't reflect local node state (see bug #2).

**`actions` — the key decision command**
The exploit list with `✓ match` / `no match` indicators is the most useful output for LLM decision-making. Without `actions`, the hand sort in the sidebar isn't sufficient to know which cards are useful.

**`cheat give matching` — works exactly as designed**
Generated 3 targeted cards for the 3 gateway vulns in one command, labeled [CHEAT], immediately sorted to top of hand. The balance-signal intent works: the cheat was triggered precisely because the starting hand had only 1 weak match for 3 vulns, and even that card failed 3 times.

**Card name ≠ card target vuln**
FirmDump targets weak-auth. SnmpWalker targets buffer-overflow. Names imply specific attack methods but targets are disconnected from names. The `actions` command makes targets visible, but the underlying mismatch adds cognitive load. Consider making card names reflective of their target vuln type, or at least consistent within a family.

---

## Actionable Recommendations (Prioritized)

### Priority 1 — Fix Before Next Playtest
1. **Fix `accessNeighbors`** — game cannot progress past gateway without this
2. **Fix global alert propagation or clarify local vs global in `status summary`**

### Priority 2 — Fix Soon
3. **Unify exploit failure message** — one consistent message for probability failure
4. **Fix sidebar button gating** — only show contextually applicable actions; hide permanently-inapplicable "coming soon" buttons

### Priority 3 — Balance Pass
5. **Increase Grade D/F common card vuln-match probability** (~65% from ~44%)
6. **Increase ICE detection grace window** on opening node (probe → first exploit should be safe)

### Priority 4 — Polish
7. **Align card names to target vuln types** for legibility (or accept the disconnect and document it as a flavor choice)

---

## Post-Fix Playtest — Run 3

All Priority 1-3 fixes applied (commit `8c41def`). Re-playtested to verify.

### Run 3 Transcript Summary

| Turn | Command | Result |
|------|---------|--------|
| 1 | `status summary` | ICE ACTIVE @ SEC-MON → INET-GW-01 (✅ fix confirmed) |
| 2 | `select gateway` | Grade D, LOCKED |
| 3 | `probe` | Vulns: deserialization, buffer-overflow, unpatched-ssh |
| 4 | `exploit 1` (StackSmash Pro / buffer-overflow) | SUCCESS. Roll 71 vs 75%. Gateway: COMPROMISED |
| 5 | `exploit 4` (PathEscape Zero / uncommon) | SUCCESS. Roll 22 vs 90%. Gateway: OWNED |
| 6 | `actions` | `accessible: router-a, router-b, firewall… (✅ accessNeighbors fix confirmed)` |
| 7 | `eject` | ICE pushed to adjacent node |
| 8 | `read` | Gateway: nothing of value |
| 9 | `status summary` | Network: **4 accessible, 1 owned** (✅). Mission: not collected |
| 10 | `select router-a` | Grade C, LOCKED. Sidebar: PROBE only (✅ clean) |
| 11 | `probe` | Vulns: stale-firmware, path-traversal. Alert: YELLOW |
| 12 | `cheat give matching` | Added PortKnock μ (stale-firmware), PathEscape X (path-traversal). TRACE INITIATED! |
| 13 | `exploit 2` (PathEscape X / uncommon) | SUCCESS. Roll 27 vs 72%. RTR-A: COMPROMISED. TRACE: 45s |
| 14 | `exploit 2` (PathEscape X again) | SUCCESS. Roll 48 vs 72%. RTR-A: OWNED. TRACE: 30s |
| 15 | `read` | RTR-A: nothing of value. TRACE: 12s |
| 16 | `jackout` | Run ended: SUCCESS (clean disconnect). Mission: FAILED. ¥0 |

### Fixes Verified ✅

- **`accessNeighbors` fix**: After gateway OWNED, `actions` showed accessible neighbors. Navigation to RTR-A worked.
- **Combat odds**: PathEscape X (uncommon) on Grade C with match = 72%. Two consecutive successes.
- **Sidebar buttons**: ESCALATE + READ on compromised; REBOOT + READ on owned. No spurious SUBVERT/RECONFIGURE.
- **ICE start position**: ICE began at SEC-MON and took ~15s before first detection pressure.
- **`actions` output**: Listed accessible nodes. `status summary` showed local node alert.
- **Consistent fail flavors**: No failures this run, but code restructured (pool selection by context).

### New Bugs Found in Run 3

**1. ICE looping between nodes**
`[ICE] Moving: ??? → INET-GW-01` fired ~15 times during the run. After ejecting ICE from gateway, it returned immediately (and repeatedly). ICE appears to oscillate between gateway and RTR-A rather than tracking purposefully. The "???" as origin node is suspect — ICE's previous-node tracking may be broken or pointing to a hidden node.

**2. Console errors for routine ICE messages**
All ICE movement messages log at ERROR level (red in console), including routine `Moving:` events. These should be INFO or at most WARN. The red noise drowns out actual errors.

**3. "[NODE] Signal detected." triple-fires**
On first exploit of RTR-A, `[NODE] Signal detected.` fired 3 times in succession. This may be multiple connected IDS-like nodes responding, but the cause is unclear and the redundancy is noisy.

**4. Mission macguffin depth vs TRACE window**
The mission target (Proprietary Binary Archive) appears to live in fileserver or cryptovault — at least 3 nodes deep from gateway. The full path requires: probe + 2 exploits each for gateway, router-a, fileserver = 9 actions minimum. TRACE fired after ~30s of the 60s window, leaving insufficient time to reach node 3. Need either: longer TRACE window, shallower mission placement, or a smarter starting hand with broader coverage.

**5. Two `cheat give matching` calls needed**
Cards matched gateway vulns (buffer-overflow, unpatched-ssh) but not RTR-A vulns (stale-firmware, path-traversal). Highlights that the starting hand of 5 doesn't cover the network's vuln diversity well. Players need to adapt or the hand should be seeded with broader coverage.

---

## Session Retrospective

### What We Built
- `generateExploitForVuln(vulnId)` in `exploits.js` — targeted card generation for LLM play
- `cheat give matching` command — balance rescue + cheat flag signal
- `actions` command — LLM's primary decision interface with card match indicators
- `status summary` command — fast game-state snapshot (alert, ICE, network, hand, mission)
- Fixed `accessNeighbors` wiring in `launchExploit()` — game-breaking traversal bug
- Improved combat odds: matchBonus 0.2 → 0.4, context-aware fail flavors (3 pools)
- Cleaned sidebar buttons: removed always-stub SUBVERT/ESCALATE/RECONFIGURE/LOOT
- Fixed ICE start position: pinned to `security-monitor` (3 hops from gateway)

### What Worked
- LLM playtesting via Playwright MCP is highly effective — found and reproduced bugs that human play might miss
- `actions` command is the right abstraction for LLM decision-making
- `cheat give matching` worked exactly as designed: triggered when hand had no useful cards, gave precise targeted exploits
- The fixes landed cleanly — no regressions introduced, sidebar is much cleaner

### What Didn't Work
- Starting hand has insufficient vuln diversity for a 4-5 node dungeon — `cheat give matching` triggered twice
- ICE looping bug discovered post-fix — ICE oscillates instead of tracking (fixed in cbc6d64)
- 60s TRACE window is too tight for the current network depth and card economy
- Console errors for routine ICE events create noise that obscures real errors (fixed in cbc6d64)

### Second Round of Fixes (cbc6d64)
Post-Run-3 bugs found and fixed before closing the session:
- **ICE oscillation**: Grade C/B ICE was pathfinding back to `lastDisturbedNodeId` even after detecting there, causing gateway↔neighbor oscillation. Fix: skip pathfinding if `detectedAtNode === target`, fall back to random walk.
- **ICE log level**: ICE movement events were emitting at `"error"` level, appearing as `console.error()` and rendering red in the log pane. Changed to `"info"`.
- **Signal detected spam**: On gateway exploit (locked→compromised), `revealNeighbors` cascaded 8 NODE_REVEALED events across the network (3 direct + 5 deeper). The 3 from `accessNeighbors` (revealed→accessible) were spurious and now suppressed via `unlocked: true` flag. Down to 8 total (was 11), which reflects real fog-of-war reveals.

### Remaining Backlog
1. TRACE window / network depth balance — 60s is too tight for the 3-node mission path at current card economy
2. Starting hand coverage vs network vuln diversity — `cheat give matching` triggered twice in a single run
3. "Signal detected." still fires 8x on gateway compromise — batching or a quiet reveal mode would help LLM readability

---

## Continuation Session — Fixes, Refactoring, and Meandering

This session continued from where the previous left off, with no formal plan — driven by bug reports and architectural observations as they surfaced.

### What Was Done

**Bug fixes:**
- `cheat trace end` verified: `cancelTraceCountdown()` now resets `globalAlert` to `"red"` and clears the HUD correctly
- `cheat give matching` card restore: spent/disclosed cards now have uses reset instead of adding duplicates to hand
- Node `alertState` resets to `"green"` on OWNED (both `launchExploit` and `cheatOwn`)
- ICE reboot scope: `rebootNode` was forcing ICE home on any node reboot; now only fires if ICE's `attentionNodeId` matches the rebooted node
- ICE dwell timer / adjacent detection: `checkIceDetection` was not cancelling the pending timer when ICE moved away from the player's node; fix: `cancelAllByType("ice-detect")` in the early-return path
- ICE dwell timer cancelled on player node select: timer persisted visually between player move and ICE's next tick; `cancelIceDwell()` now called in the `starnet:action:select` handler
- `activateCheat()` always emits: `setCheating()` only called `emit()` on first use; subsequent cheats (e.g. `give matching`) didn't re-render the hand. Fixed by calling `emit()` unconditionally in `activateCheat()`

**Refactoring:**
- ICE disable on own → event-driven: removed inline check from `launchExploit`; added `on(E.NODE_ACCESSED, ...)` listener in `ice.js`
- Extracted full alert subsystem to `alert.js`: propagation, global alert recompute, trace countdown, ICE detection recording. Uses event listeners (`NODE_ALERT_RAISED`, `NODE_RECONFIGURED`) to avoid circular imports with `state.js`
- Moved `applyCardDecay` to `combat.js`
- Moved `launchExploit` to `combat.js`: after discussion landed on "state.js deps aren't a concern for this game's scale"; initial instinct was a separate `exploit-action.js` but that was over-engineering
- `state.js` exports `ALERT_ORDER` and `emit` for downstream consumers
- `console.error` → `console.warn` for game threat events in `log-renderer.js`

### What Worked
- Incremental bug-finding via conversation: each fix surfaced the next issue naturally
- Event-driven architecture is paying off — ICE disable, alert propagation, card decay all refactored cleanly into their own modules without circular imports
- `combat.js` is now a coherent "exploit combat" module: resolution + decay + launch action

### What Didn't Work / Observations
- The session was explicitly "meandering" — no spec, no plan, just working through things as they came up. This is fine for maintenance/cleanup but means work isn't prioritized; a few lower-value refactors happened before higher-value balance work
- The `exploit-action.js` detour: created the file, then immediately questioned it, then deleted it and put the code in `combat.js`. The right call, but the architecture debate added a turn. Worth settling the "where does orchestration live?" question earlier
- `state.js` is still large but now only contains: init, node access, probe, read/loot, reconfigure, reboot, ICE mutations, selection, cheats. Cleaner but could go further if a reason arises
- The `activateCheat()` emit bug was a good example of a subtle render gap — state mutation with no guaranteed re-render. Worth auditing other places where mutations happen outside the normal `emit()` flow

### Conversation Turns
~25 turns in this continuation (on top of ~30 in the prior session)

### Remaining Backlog (Updated)
1. TRACE window / network depth balance — 60s is too tight for the 3-node mission path at current card economy
2. Starting hand coverage vs network vuln diversity
3. "Signal detected." still fires 8x on gateway compromise
4. `state.js` still has probe, read/loot, reboot mixed in — could extract further if complexity warrants
5. Card names vs target vuln types still disconnected (flavor vs legibility tradeoff unresolved)
