# Spec: WAN Node + Darknet Store

## Goal

Add a WAN node that sits "outward" from the gateway — the boundary between the LAN dungeon
and the (future) overworld. Selecting it and triggering "ACCESS DARKNET" opens a placeholder
store modal where the player can spend ¥ to buy exploit cards. The LAN is paused while
shopping; the run resumes when the store is closed.

This is explicitly a placeholder for the eventual overworld/meta-loop. The WAN node's spatial
and mechanical position in the graph anticipates that future: it is the LAN exit, not a
hack target.

---

## WAN Node

### Topology

- One WAN node per network, added in `data/network.js`
- Adjacent only to `gateway`; `gateway` is also adjacent to `wan`
- WAN is never connected to any other node in the LAN

### Visibility / Access

- Always visible at run start (no fog of war — it's the direction the player came from)
- Always accessible (no exploit required — the player owns this connection)
- Cannot be probed, exploited, read, looted, or rebooted — none of these actions are
  available on WAN
- Available action: `[ ACCESS DARKNET ]` (dispatches `starnet:action` with
  `actionId: "access-darknet"`)

### ICE

- ICE never moves to or through the WAN node
- WAN is excluded from ICE pathfinding/movement candidates

### Visual Style

- Distinct from LAN nodes: different shape, muted color — it's infrastructure, not a target
- Label: `WAN`
- No access-level fill, no alert border, no ICE indicator
- Always rendered at full opacity (never dim/hidden)

---

## Darknet Store

### Trigger

Dispatching `access-darknet` on the WAN node:
1. Pauses the LAN (stops all timers)
2. Renders the store modal over the graph
3. LAN resumes when the store is dismissed

### Store Catalog

- Stocks the full range of exploit cards (one of every exploit type in the game)
- Unlimited stock — same card can be bought multiple times
- Fixed ¥ price per card (placeholder; economy not yet tuned)
- Purchased cards added to `state.player.hand`

### Starting Cash

- Player starts each run with ¥500 (placeholder) so the store is useful immediately
  without requiring a loot run first

### Store UI

- Modal overlay, dark background, consistent with run-end screen aesthetic
- Header: `// DARKNET BROKER`
- Current wallet balance shown prominently
- Card list: name, vuln type(s), quality pips, price, `[ BUY ]` button
- `[ BUY ]` disabled if player cannot afford
- `[ CLOSE ]` dismisses modal and resumes the LAN
- Buying deducts ¥ and adds card to hand; wallet updates in place (no full page reload)

### Timer Pause

- Freeze the LAN by stopping the timer tick while the modal is open
- Resume ticking when modal closes
- No log entry for opening/closing (meta action, not a game event)

---

## Out of Scope

- Selling cards back
- Store stock varying by run / network difficulty
- LAN continuing to run while shopping (deliberate deferral)
- WAN as actual overworld exit portal
- Tuned store prices
- ICE/alert consequences for visiting WAN
- Forced graph layout position for WAN node
