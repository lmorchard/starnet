# Plan: Node.js Playtest Support

_Session: 2026-02-25-1605-node-playtesting_

---

## Step 1 — Decouple `timers.js` from DOM

**Context:** `timers.js` currently dispatches timer fires via
`document.dispatchEvent(new CustomEvent("starnet:timer:*", ...))`. This is the
only place in the timer system that touches the DOM. Swapping to `emitEvent()`
removes the last DOM dependency from a core logic module.

**Changes:**
- Add `import { emitEvent } from "./events.js"` to `timers.js`
- In `scheduleEvent`: replace `document.dispatchEvent(new CustomEvent(...))` with
  `emitEvent(\`starnet:timer:${type}\`, { ...payload, timerId: id })`
- Same replacement in `scheduleRepeating`

**Result:** `timers.js` is Node-compatible. No callers change yet — `main.js`
still listens via `document.addEventListener`, which will break. Fixed in Step 2.

---

## Step 2 — Update `main.js` timer listeners

**Context:** `main.js` listens to three `starnet:timer:*` events via
`document.addEventListener`. After Step 1, these won't fire anymore since timers
now dispatch via the pub/sub bus. Move these three listeners to `on()`.

**Changes in `main.js`:**
- Add `on` to the import from `./events.js`
- Replace:
  ```js
  document.addEventListener("starnet:timer:ice-move", () => handleIceTick());
  document.addEventListener("starnet:timer:ice-detect", (evt) => handleIceDetect(evt.detail));
  document.addEventListener("starnet:timer:reboot-complete", (evt) => completeReboot(evt.detail.nodeId));
  ```
  With:
  ```js
  on("starnet:timer:ice-move", () => handleIceTick());
  on("starnet:timer:ice-detect", (payload) => handleIceDetect(payload));
  on("starnet:timer:reboot-complete", (payload) => completeReboot(payload.nodeId));
  ```

**Result:** Browser game fully functional again. `main.js` uses `on()` for game
logic events and `document.addEventListener` only for UI action events
(`starnet:action:*`), which is the correct split.

---

## Step 3 — Guard `window` in `state.js`

**Context:** `state.js::emit()` sets `window._starnetState = state` as a dev
convenience for browser console inspection. This throws in Node.js where `window`
is undefined.

**Change:**
```js
// Before:
window._starnetState = state;

// After:
if (typeof window !== "undefined") window._starnetState = state;
```

**Result:** `state.js` is Node-compatible. No behavior change in the browser.

---

## Step 4 — Add `package.json`

**Context:** Node.js requires `"type": "module"` to treat `.js` files as ES
modules (matching the `import`/`export` syntax already used throughout).

**Create `package.json` at project root:**
```json
{
  "name": "starnet-game",
  "type": "module",
  "private": true
}
```

`private: true` prevents accidental npm publish. No dependencies needed — the
game logic has none.

**Result:** `node scripts/playtest.js` will parse ES module syntax correctly.

---

## Step 5 — Write `scripts/playtest.js`

**Context:** With core logic modules now Node-compatible, write the playtest
harness. It should run a complete game loop — select, probe, exploit, loot —
until `RUN_ENDED` fires, logging a structured play-by-play.

**Player strategy (greedy):**
1. Get all accessible nodes not yet owned
2. Select one, probe it
3. Find best matching exploit card (highest quality among cards targeting a known vuln)
4. Exploit until owned or no cards available
5. Read and loot if owned
6. Repeat from 1; jack out if stuck with no progress

**Wire-up:**
- Import game modules: `state.js`, `combat.js`, `ice.js`, `events.js`, `data/network.js`
- Import `alert.js` (registers its listeners at module load)
- `on("starnet:timer:ice-move", () => handleIceTick())`
- `on("starnet:timer:ice-detect", (p) => handleIceDetect(p))`
- `on("starnet:timer:reboot-complete", (p) => completeReboot(p.nodeId))`
- Subscribe to `E.LOG_ENTRY` to print game events
- Subscribe to `E.RUN_ENDED` to print summary and exit

**Result:** `node scripts/playtest.js` runs a full game, prints a readable
transcript, and exits with the run outcome.

---

## Step 6 — Verify browser unchanged

**Context:** Sanity check that all browser functionality still works after the
three code changes (timers, main, state). Quick smoke test in the browser.

**Test:**
- Reload `http://localhost:3000`
- Run: `probe gateway`, `exploit gateway 1`, verify ICE moves and detection timers appear
- Confirm 0 console errors

---

## Commit sequence

1. After Steps 1–3: `"Decouple timers + state from DOM for Node.js compat"`
2. After Step 4: `"Add package.json — type: module"`
3. After Step 5: `"Add scripts/playtest.js — Node.js game simulation harness"`
