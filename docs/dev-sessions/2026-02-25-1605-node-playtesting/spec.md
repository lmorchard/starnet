# Spec: Node.js Playtest Support

_Session: 2026-02-25-1605-node-playtesting_

---

## Goal

Enable game logic modules to run in Node.js so we can write a lightweight
playtest harness — no browser, no Playwright overhead.

## Background

The event bus (`events.js`) is already a pure pub/sub Map — no DOM dependency.
The remaining DOM coupling in core logic is minimal and surgical:

- `timers.js` dispatches timer fires via `document.dispatchEvent(new CustomEvent(...))`
- `main.js` wires timer callbacks via `document.addEventListener("starnet:timer:*")`
- `state.js` sets `window._starnetState` as a dev convenience

`starnet:action:*` events stay as DOM events — they originate from Cytoscape/UI
and are inherently browser-only. Only the timer dispatch/receive path needs to move.

## Scope

### In scope

- Decouple `timers.js` from DOM: fire timer events via `emitEvent()` instead
  of `document.dispatchEvent()`
- Update `main.js` to wire timer handlers via `on()` instead of
  `document.addEventListener` for `starnet:timer:*` events
- Guard `window._starnetState` in `state.js`
- Add `package.json` with `"type": "module"` at project root
- Add `scripts/playtest.js` — a Node.js script that runs a simulated game
  session and outputs a structured play-by-play log

### Out of scope

- Directory restructure (`js/core/` vs `js/ui/`) — not needed yet
- Full test suite / assertions — this session targets a runnable harness, not CI
- `cheats.js` — not imported by the playtest harness
- Browser UI modules (`main.js`, `graph.js`, `log-renderer.js`, `visual-renderer.js`,
  `console.js`) — these remain browser-only

## Playtest Harness Design

`scripts/playtest.js` should:

1. Import game modules directly (state, combat, ice, events, data/network)
2. Initialize a run with `initState(NETWORK)`
3. Start ICE with `startIce()`
4. Wire timer event handlers via `on()` — ice-move, ice-detect, reboot-complete
5. Subscribe to game events to build a structured log
6. Execute a scripted player loop: select → probe → exploit (best available card) → repeat
7. Run until `RUN_ENDED` fires
8. Print a summary: nodes owned, cash, outcome, turn count, events log

The player loop can be simple (greedy/random), since the goal is exercising the
game logic and producing a readable transcript — not optimal play.

## Success Criteria

- `node scripts/playtest.js` runs to completion without errors
- Output is a readable play-by-play log matching what you'd see in the browser console
- The browser game continues to work unchanged after all modifications
