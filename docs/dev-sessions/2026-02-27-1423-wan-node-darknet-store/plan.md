# Plan: WAN Node + Darknet Store

## Files Touched

- `data/network.js` — add WAN node + edge to gateway
- `js/node-types.js` — add `wan` type with `access-darknet` action
- `js/state.js` — starting cash ¥500; `buyExploit()` mutation; WAN node starts accessible
- `js/ice.js` — exclude WAN from movement candidates
- `js/timers.js` — add `pauseTimers()` / `resumeTimers()`
- `js/graph.js` — add WAN to NODE_SHAPES
- `js/main.js` — wire `access-darknet` → `ctx.openDarknetsStore()`; import pause/resume
- `js/visual-renderer.js` — `openDarknetsStore(state, onBuy)` modal + store catalog
- `css/style.css` — store modal styling
- `tests/integration.test.js` — new tests for WAN/store logic

---

## Phase 1 — WAN node in network + type registry

### `data/network.js`

Add WAN node (above gateway in y-coordinate so layout places it "outward"):

```js
{ id: "wan", type: "wan", label: "WAN", grade: "D", x: 400, y: -80 },
```

Add edge:
```js
{ source: "wan", target: "gateway" },
```

### `js/node-types.js`

Add `wan` entry to `NODE_TYPES`:

```js
"wan": {
  behaviors: [],
  actions: [
    {
      id: "access-darknet",
      label: "ACCESS DARKNET",
      available: (_node, state) => state.phase === "playing",
      desc: () => "Access the darknet broker to purchase exploit cards.",
      execute: (_node, _state, ctx) => ctx.openDarknetsStore(),
    },
  ],
},
```

### `js/graph.js`

Add WAN to `NODE_SHAPES`:
```js
"wan": "cut-rectangle",
```

---

## Phase 2 — State changes

### `js/state.js`

1. **Starting cash:** `cash: 0` → `cash: 500`

2. **WAN starts accessible:** After the main node-init loop in `initState`, set any
   `type === "wan"` node to `accessLevel: "accessible"` so it bypasses fog-of-war.

3. **New export — `buyExploit(card, price)`:**
   ```js
   export function buyExploit(card, price) {
     if (state.player.cash < price) return false;
     state.player.cash -= price;
     state.player.hand.push(card);
     emit();
     return true;
   }
   ```

---

## Phase 3 — ICE exclusion

### `js/ice.js`

In `handleIceTick()`, filter WAN from the movement candidate pool:

```js
const neighbors = (s.adjacency[attentionNodeId] || [])
  .filter((n) => s.nodes[n]?.type !== "wan");
if (neighbors.length === 0) return;
```

---

## Phase 4 — Timer pause/resume

### `js/timers.js`

```js
let _paused = false;
export function pauseTimers() { _paused = true; }
export function resumeTimers() { _paused = false; }
```

Guard `tick()` at the top:
```js
export function tick(n = 1) {
  if (_paused) return;
  // ... existing body unchanged
}
```

---

## Phase 5 — Action wiring

### `js/main.js`

- Import `pauseTimers`, `resumeTimers` from `timers.js`
- Import `openDarknetsStore` from `visual-renderer.js`
- Import `buyExploit` from `state.js`

Add to `ActionContext`:
```js
openDarknetsStore: () => {
  pauseTimers();
  openDarknetsStore(getState(), (card, price) => buyExploit(card, price));
},
```

The modal calls `resumeTimers()` internally on close (imported directly in visual-renderer.js).

---

## Phase 6 — Store modal + CSS

### `js/visual-renderer.js`

**Store catalog** — generated fresh at each `RUN_STARTED`. Module-level `let storeCatalog = []`.

On `E.RUN_STARTED`:
```js
storeCatalog = VULNERABILITY_TYPES.map((v) => ({
  vulnId: v.id,
  name: v.name,
  rarity: v.rarity,
  price: v.rarity === "rare" ? 500 : v.rarity === "uncommon" ? 250 : 100,
}));
```

**`openDarknetsStore(state, onBuy)`:**

- Creates `#darknet-store-modal` div, appends to `#app`
- Lists all catalog entries with name, rarity, vuln target, price, `[ BUY ]` button
- `[ BUY ]` is disabled when `state.player.cash < price`
- On BUY click: call `onBuy(generateExploitForVuln(vulnId), price)` → `STATE_CHANGED`
  fires → hand strip re-renders. Re-render the wallet amount in-place and re-evaluate
  disabled states on buy buttons.
- `[ CLOSE ]` removes modal, calls `resumeTimers()`
- Import `generateExploitForVuln` from `exploits.js`
- Import `resumeTimers` from `timers.js`

### `css/style.css`

```css
#darknet-store-modal — full-cover overlay, dark semi-opaque bg, high z-index, flex column
.store-header       — // DARKNET BROKER title + wallet display
.store-card-list    — scrollable list area
.store-card-row     — one row per catalog entry: name, rarity, vuln, price, BUY button
.store-buy-btn      — same style as ctx-item buttons; :disabled muted
.store-close-btn    — [ CLOSE ] at bottom, same style as existing action buttons
```

---

## Phase 7 — Tests

New describe block in `tests/integration.test.js`:

- WAN node `accessLevel` is `"accessible"` immediately after `initState`
- `access-darknet` is in `getAvailableActions` result for WAN node (phase: playing)
- `access-darknet` is NOT in `getAvailableActions` for gateway node
- `buyExploit` adds the card to `state.player.hand` and deducts `price` from cash
- `buyExploit` returns `false` and leaves state unchanged when cash < price
- ICE movement from gateway skips WAN even when WAN is in the adjacency list

`make check` — all existing + new tests pass.

---

## Commit strategy

Single branch `wan-node-darknet-store`. Commit after each phase, or one combined commit
for phases 1–4 (pure logic) and a second for phases 5–6 (UI). PR to main after Phase 7.
