# Notes: Node.js Playtest Support

_Session: 2026-02-25-1605-node-playtesting_

---

## Recap

Built a headless Node.js playtest harness for Starnet — no browser, no Playwright.
The core work:

- **Virtual tick clock** (`timers.js`): replaced OS `setTimeout`/`setInterval` with a
  pure-data tick counter. All timers are serializable. Browser drives via one master
  `setInterval(() => tick(1), TICK_MS)` in `main.js`; harness calls `tick(n)` directly.
- **Trace countdown** folded into the tick system (`alert.js`): `scheduleRepeating` for
  the 60s countdown, eliminating a separate `setInterval`.
- **Full state serialization** (`state.js`): `serializeState()` / `deserializeState()`
  bundle game state + timer snapshot into one JSON object. Self-contained — includes
  `nodes`, `adjacency`, and all timer state.
- **Playtest harness** (`scripts/playtest.js`): single-command REPL. Each invocation
  loads state, runs one command, prints events, saves state, exits. `--state <file>` flag
  for named scenarios/checkpoints.
- **CLAUDE.md docs**: headless harness documented so future sessions know it exists.

Then ran two playtest sessions and fixed everything found:

**4 game bugs:**
1. Exploit ID collision — `_exploitIdCounter` restarted at 1 each process, new cards got
   duplicate IDs, `hand.find()` returned the wrong card
2. `applyCardDecay` logic inverted — set "worn" at 0 uses (should be "disclosed"); "worn"
   should trigger at 1 use remaining
3. `lootNode` empty path — said "Already looted" without setting `node.looted = true`,
   so it fired every time on empty nodes
4. `readNode` no guard — no early return on re-reads, emitted "N items found" repeatedly

**2 harness gaps:**
5. Phase/outcome not shown in `status summary`
6. `ice.active` not cleared after jackout — found to be a genuine game state bug, not just
   a display issue

**Post-fix cleanup:**
- `TIMER` constants exported from `timers.js`; all magic `"starnet:timer:..."` strings
  replaced across 5 files
- `scripts/playtest-state.json` removed from tracking and gitignored

---

## Divergences from Plan

- **`console.js` DOM coupling confirmed**: as anticipated, `runCommand()` couldn't be
  imported. Command dispatch was implemented inline in the harness (probe/exploit/select
  etc. map directly to state functions).
- **`cheats.js` also DOM-coupled** (one dep: `addLogEntry`). Cheat logic implemented
  inline by importing the underlying state functions directly.
- **`_exploitIdCounter` needed in serialization**: not in the original plan. The counter
  needs to survive state round-trips or newly generated cards collide with existing hand
  IDs.
- **ICE-after-jackout fix landed in `state.js`**: initially planned as a harness listener
  (`on(STATE_CHANGED, stopIce)`). Realized the right fix is `endRun()` setting
  `ice.active = false` directly — `clearAllTimers()` already handles the timers, so the
  flag just wasn't being cleared. A STATE_CHANGED listener would have had reentrancy
  issues (disableIce emits STATE_CHANGED again).
- **TIMER constants** were not in the plan — added as a natural cleanup after noticing
  the magic strings during the ICE listener work.
- **Plan's commit sequence was merged**: Steps 5+6 landed together, Steps 7+8 landed
  together with serialization.

---

## Insights

**Virtual tick clock design**: storing the full event name (e.g., `"starnet:timer:ice-move"`)
in the timer entry — not a short type — was the cleanest final form. The `tick()` loop
calls `emitEvent(entry.type, ...)` directly with no template literal. TIMER constants
provide the single source of truth. Only the definition site has the string.

**ID collision root cause**: `_exploitIdCounter` is module-level state, restarts at 1
each Node.js process. A saved state with `exploit-1` through `exploit-5` in hand, then
a cheat-added card that also gets `exploit-1`, causes `hand.find(c => c.id === exploitId)`
to silently return the wrong card. Fix required exporting the counter and round-tripping
it through serialization.

**endRun should own its cleanup**: `clearAllTimers()` is already in `endRun`. Setting
`ice.active = false` belongs there too — it's state cleanup, not a side effect of some
external observation. Putting it in a STATE_CHANGED listener creates reentrancy risk if
anything in the cleanup path re-emits.

**Playtest harness ROI**: within two sessions (one clean, one cheated) we found 4 real
bugs that had been silently present. The harness pays for itself immediately. The cheat
commands (`own`, `give matching`, `set alert`) are essential for isolating specific
mechanics quickly.

**applyCardDecay bug was present but invisible**: "worn at 0 uses" instead of "disclosed"
means cards appeared as worn when they were actually spent. In normal browser play this
is hard to notice; the harness `status hand` output made it immediately legible.

---

## Efficiency

Smooth parts:
- The virtual tick clock refactor was clean and well-scoped — replacing OS handles with
  a Map of plain data is a conceptually simple change.
- The harness design (single-command, load/run/save/exit) worked well; calling game
  functions directly rather than going through `console.js` was the right call.
- `make check` (tsc) caught two type gaps quickly (missing `traceTimerId` in GameState
  typedef, missing `unlocked?` in `NodeRevealedPayload`).

Slower parts:
- The ICE-after-jackout fix went through two attempts: first a STATE_CHANGED listener
  (added, then removed), then the correct placement in `endRun`. The reentrancy issue
  with `disableIce` wasn't immediately obvious.
- Context compaction mid-session meant the ICE fix was in flight when the conversation
  was summarized; needed to reconstruct the in-progress state at the start of the next
  context.

---

## Process Improvements

- **Save checkpoints before long playtest sequences** using `--state <file>`. We ran
  playtests from a fresh reset each time; named state files would let us resume from
  mid-run to reproduce a specific bug faster.
- **Seeded RNG is the next natural step**: runs are still probabilistic. For regression
  testing (verifying a specific bug is fixed), determinism matters. The exploit ID fix
  is a preview of how subtle state coupling can be without reproducibility.
- **Consider a `status diff` or event log replay**: the harness prints events per
  command, but there's no persistent event history. A growing log in the state file
  would make longer sessions easier to review.

---

## Conversation Turns

Approximately 15–18 back-and-forth exchanges across two context windows.

---

## Other Highlights

- The two-session playtest structure (clean run first, then cheated) was effective:
  the clean run surfaced UX-level observations (probe IDS immediately triggers TRACE,
  ¥0 jackout because no lootable nodes were reached), while the cheated run isolated
  mechanics bugs by removing the RNG friction.
- `lootNode`'s empty-path bug was elegant in its failure mode: because `node.looted`
  was never set, every subsequent loot attempt on an empty node would re-enter the empty
  path and say "Already looted" — a message that was both wrong (should be "Nothing to
  loot") and infinite (the guard that would stop it never fired).
- The TIMER constants refactor was a natural consequence of adding the ICE listener:
  looking at the harness `on()` calls, the pattern of magic strings became obvious.
  Good example of a small cleanup that's easy to do in the moment but hard to motivate
  as a standalone task.
