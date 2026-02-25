# Notes: LAN Dungeon Prototype — Session 3

_Session: 2026-02-24-1728-lan-dungeon-3_

---

## Recap

Session 3 delivered the four planned features plus a substantial unplanned QoL pass that emerged from a live playtesting run.

**Planned features (all shipped):**
- **Mission objectives** — random target macguffin at 10x value, sidebar briefing, init log message, MISSION COMPLETE/FAILED in end screen
- **Visual juice** — `flashNode()` utility (success/failure/reveal), styled log lines (bold green/red with glow)
- **Auto-pan on node reveal** — viewport animates to fit newly visible nodes, each flashes with a dim cyan pulse
- **Wheel zoom speed** — `wheelSensitivity: 0.3` (down from 1.0 default)

**Post-playtest QoL pass (all unplanned, all shipped):**
- Implicit node targeting — `probe`, `read`, `loot`, `reconfigure`, `exploit <card>` all fall back to selected node when no node arg given
- Card index numbers in hand (`1.`, `2.`, etc.)
- `exploit 1` / `exploit 2` — numeric index using the displayed sort order
- Match highlights shown whenever a probed node is selected (not just in exploit-select mode)
- "Already probed" feedback when re-probing
- Worn card (0 uses) blocked with error message
- Roll log includes node label: `INET-GW-01 — Roll: 47 vs 36%`
- Sidebar cleared when game ends
- Tab completion: `select` added, longest-common-prefix completion, `escalate` as console command alias for `exploit`
- Graph shows node ID instead of label (matches console command syntax)

**Commits:** 9 (including 1 initial planning commit)

---

## Divergences

- **`anyOutOfView` guard removed** — the plan called for viewport nudge only when revealed nodes were off-screen. In practice this meant the initial render never nudged because Cytoscape's preset layout fit all nodes into view at startup, leaving the starting node tiny. Removed the guard entirely — always fits to visible nodes when new ones appear. This was the right call.

- **`result.levelChanged` used but not for separate flash** — the plan mentioned using this flag to distinguish "level just changed" from a plain exploit success flash. In practice we use the same success flash for both and it feels fine. The field is still available if needed later.

- **Node unlock flash not separately triggered** — the spec called for a flash on access level change. Currently the flash fires in the `launch-exploit` handler regardless of whether the level changed. The effect is correct (you still see a flash on level change), but it's the exploit result flash, not a separate unlock flash. No visible difference.

- **Huge unplanned QoL pass** — the live playtesting run surfaced enough friction that we did a second mini-session's worth of work. This was the right call but wasn't scoped.

---

## Insights

**Playtesting by the dev is extremely valuable.** Running through the game end-to-end caught things that no spec review would find: the card/node vocabulary mismatch (graph shows label, console needs ID), the absence of match highlights outside exploit-select mode, the confusing worn-card silent failure, the roll log not saying which node it was for. These are all tiny but compounding UX papercuts.

**Numeric index via sorted hand is subtle.** The `exploit 1` feature initially used the raw unsorted `state.player.hand` array, which doesn't match the displayed sort order. Cards are sorted for display based on vuln match, so `1.` in the UI was a different card than index `[0]` in the array. The fix required duplicating the sort key logic in `console.js` since sorting lives in the UI layer. Worth flagging this pattern — display-layer sort order and state-layer ordering diverging is an easy trap.

**`escalate` wasn't a console command.** It existed only as a UI button and was never wired to the console. The player saw the button label in the sidebar, tried to type it, and it silently failed. Any UI action verb should be reachable from the console — review the full button set for similar gaps.

**Context window ran out mid-session.** The conversation was long enough that a compaction happened, and the session resumed from a summary. The summary was accurate enough to continue cleanly but some nuance was lost. Keeping sessions tighter (fewer features per session) would help.

---

## Efficiency

**Went smoothly:**
- Plan was solid; execution matched plan closely for the core features
- Two-commit structure (features 1-4, then features 5-6) was clean
- Playwright-based playtesting worked well as an in-session QA pass

**Went slowly:**
- Post-playtest QoL work accumulated into a large batch; would have been cleaner as a separate planned session
- The initial zoom bug (anyOutOfView guard) required a second diagnosis pass after the first fix didn't fully solve it
- Some back-and-forth on small visual issues (card index layout breaking ec-header alignment)

---

## Process Improvements

- **Run a short playtesting pass after every session**, not just when explicitly requested. Even 10 minutes of play surfaces more friction than an hour of spec review.
- **Audit all sidebar button labels against console VERBS** at the end of each session. Any button that doesn't map to a console command is a gap.
- **Keep the session scope tighter.** 4 features + a full QoL pass was too much for one session. The QoL pass probably deserved its own brainstorm/spec step.
- **Note balance/difficulty observations explicitly in the backlog** when they come up during play. "Starting hand mismatch vs node vulnerability types" was observed but deferred — it's already in Claude's memory but should be tracked as a concrete future task.

---

## Deferred / Future Work

- **Balance: starting hand vs network vulnerability mix.** Current starting hand (weak-auth, snmp-public, unpatched-ssh, etc.) frequently doesn't match the vulnerability types on early nodes. Router-a had TOCTOU/Weak Auth/Path Traversal — only one matched the starting hand. Needs either a hand generation pass keyed to network composition, or a guaranteed "starter" vuln on the gateway.
- **Mission conditions** (e.g. never exceed yellow alert, don't trigger trace) — out of scope this session, noted in spec.
- **Visual effects backlog** (screenshake, bloom, vector glitch on countermeasure hit) — still out of scope.

---

## Conversation Turns

Approximately 30–35 back-and-forth exchanges across two conversation contexts (session split due to context window).

---

## Other Highlights

The live playtesting run reached MISSION COMPLETE with ¥93,637 extracted, though it required two cheat commands (own router-a after 4 failed exploits depleted the hand, own cryptovault after the staged side-channel vuln chain couldn't be unlocked without a specific card type). This validates both that the mission mechanic works end-to-end and that balance needs attention — a skilled player with a favorable hand should be able to complete the run legitimately.
