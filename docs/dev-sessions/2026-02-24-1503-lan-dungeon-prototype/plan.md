# Plan: LAN Dungeon Prototype

_Session: 2026-02-24-1503-lan-dungeon-prototype_

Each phase builds directly on the previous. No phase leaves orphaned code — everything integrates before moving on. Phases are sized to be completable in one focused working block.

## Architecture Notes

### Web Components

UI elements should be built as **Web Components** (native custom elements) rather than plain DOM manipulation. This keeps the project vanilla while giving encapsulation and reusability. Key components:

- `<starnet-hud>` — top bar: cash display, global alert level, jack out button
- `<starnet-node-panel>` — right sidebar: node details, action menu, exploit selection
- `<starnet-exploit-card>` — individual exploit card (used inside the panel)

### State → Component Communication

Since there's no framework, use a simple **event-driven pattern**:

1. All game state lives in `js/state.js` as a plain object
2. State mutations go through functions in `state.js` (never mutate directly)
3. After each mutation, dispatch a custom event on `document`:
   ```js
   document.dispatchEvent(new CustomEvent('starnet:statechange', { detail: getState() }));
   ```
4. Each Web Component listens for `starnet:statechange` in `connectedCallback` and re-renders itself from the event detail
5. User actions in components dispatch their own custom events upward (e.g. `starnet:action:probe`, `starnet:action:exploit`) which `main.js` handles by calling state mutation functions

This keeps components dumb (render-only) and state logic centralized.

---

## Phase 1: Project Scaffold + Graph Rendering

**Builds on:** Nothing — greenfield.
**Result:** A working `index.html` that loads Cytoscape.js and renders a static hand-crafted network graph with neon vector phosphene styling.

### Prompt

Create a single-file `index.html` (with inline or sibling CSS/JS files as needed) for a cyberpunk hacking game called **Starnet**. No build tooling — load Cytoscape.js from CDN.

Layout:
- Full-viewport dark background (`#0a0a0f` or similar near-black)
- Left/center area: the network graph (takes ~70% of width)
- Right panel: a sidebar (~30% width) for node details — initially shows "Select a node" placeholder
- Top bar: game HUD with player cash display and a "JACK OUT" button (disabled for now)

Define a static network as a plain JS object in a `data/network.js` module (use a `<script type="module">`). The network should have ~10 nodes representing a small corporate LAN:
- 1 Internet Gateway (entry point)
- 2 Routers
- 1 Firewall
- 2 Workstations
- 1 File Server
- 1 Cryptovault
- 1 IDS (intrusion detection system)
- 1 Security Monitor

Each node has: `id`, `type`, `label`, `grade` (S/A/B/C/D/F), `x`/`y` hint positions.
Define edges connecting them in a sensible topology (gateway → routers → workstations/firewall → file server/cryptovault, IDS → security monitor).

Render with Cytoscape.js using a **preset layout** (use the x/y positions). Style:
- Node background: dark (`#111`), glowing border in cyan (`#0ff`) with a box-shadow/glow effect
- Edge color: dim cyan (`#0a4`), straight lines
- Node label: terminal-green text, small monospace font
- Selected node: bright magenta border glow

Wire up a basic click handler: clicking a node logs its id to console. No gameplay yet.

---

## Phase 2: Node Visibility System

**Builds on:** Phase 1 — the static network graph is rendered.
**Result:** Nodes start hidden. The gateway is visible. Connected neighbors are revealed (but dimly styled as "unknown") when the gateway is accessed. Accessing a node reveals its neighbors.

### Prompt

Add a game state module (`js/state.js`) that tracks per-node state:

```js
// Per-node state shape:
{
  id,
  visibility: 'hidden' | 'revealed' | 'accessible',
  accessLevel: 'locked' | 'compromised' | 'owned',
  alertState: 'green' | 'yellow' | 'red',
}
```

Initialize state from the network data. The gateway node starts as `accessible`; all others start as `hidden`.

Add a `revealNeighbors(nodeId)` function: sets all directly connected hidden nodes to `revealed`.

Add an `accessNode(nodeId)` function: sets node to `accessible`, calls `revealNeighbors`.

On game init, call `accessNode` on the gateway.

Update Cytoscape.js rendering to reflect visibility state:
- `hidden` nodes: not rendered (remove from graph or set `display: none`)
- `revealed` nodes: rendered but dimly — grey border, label shows "???" or node type only, no glow
- `accessible` nodes: full neon glow as before

When a node is clicked:
- If `accessible`: show its details in the sidebar (Phase 3 will flesh this out, for now just log)
- If `revealed`: show a "NODE DETECTED — access required" message in the sidebar
- If `hidden`: nothing

---

## Phase 3: Node Detail Panel

**Builds on:** Phase 2 — nodes have visibility/access states; clicking an accessible node should show details.
**Result:** Clicking an accessible node populates the right sidebar with node info. Clicking a revealed node shows a locked state. The sidebar is styled in terminal/HUD aesthetic.

### Prompt

Build out the right sidebar as a node detail panel. When a node is clicked, render into the sidebar:

**For an accessible node:**
```
[NODE TYPE ICON/LABEL]
ID: net-04
Type: File Server
Grade: C
Access: LOCKED | COMPROMISED | OWNED
Alert: ● GREEN | ● YELLOW | ● RED
─────────────────────────────
[Actions area — placeholder "No actions yet"]
```

**For a revealed (not yet accessible) node:**
```
[???]
UNKNOWN NODE
Signal detected on network.
Gain access to a connected node to probe further.
```

Style using monospace font, terminal green text on dark background, with alert state rendered as a colored dot (green/yellow/red glow). Grade displayed with color coding (S/A = red/hard, F = dim/easy).

Store a reference to the currently selected node ID in game state. Re-render the panel whenever state changes (a simple `renderPanel()` function called after every state update).

---

## Phase 4: Exploit Card Data + Player Hand

**Builds on:** Phase 3 — node detail panel exists; we now need exploit cards to display and use.
**Result:** A set of exploit card definitions and vulnerability type definitions exist. The player starts with a generated hand of cards. Cards are displayed in the sidebar below node details when a node is selected.

### Prompt

Create `js/exploits.js` defining:

**Vulnerability types** — an array of ~15 plausible vulnerability entries, each with:
- `id` (slug)
- `name` (e.g. "Unpatched SSH Daemon")
- `description` (flavor text, security-jargon style, 1 sentence)
- `rarity`: `'common'` | `'uncommon'` | `'rare'`

**Exploit card definitions** — a function `generateExploit(rarity)` that creates an exploit card:
- `id` (unique)
- `name` (e.g. "SSHammer v2.1", "PortBleed Injector")
- `targetVulnTypes`: array of 1–3 vulnerability type ids this exploit works against
- `quality`: float 0.0–1.0 (affects success chance; rare exploits have higher base quality)
- `rarity`: common / uncommon / rare
- `decayState`: `'fresh'` | `'worn'` | `'disclosed'`
- `usesRemaining`: integer (common: 3, uncommon: 5, rare: 8)

In `js/state.js`, add player state:
```js
player: {
  cash: 0,
  hand: [], // array of exploit cards
}
```

Initialize with a starting hand: 4 common exploits, 1 uncommon.

Add to each node's state a `vulnerabilities` array, generated from the node's grade:
- Grade S/A: 1–2 vulnerabilities, uncommon/rare only
- Grade B/C: 2–3 vulnerabilities, common/uncommon mix
- Grade D/F: 3–4 vulnerabilities, mostly common

In the sidebar, below node details, render the player's exploit hand as cards:
- Card name, rarity badge, quality bar, decay state, target vuln types
- Disabled/greyed if `decayState === 'disclosed'`
- Not yet clickable — just displayed

---

## Phase 5: Actions Menu + Probe Action

**Builds on:** Phase 4 — node details panel and exploit hand are displayed.
**Result:** The node detail panel shows available actions based on access level. The Probe action is implemented: it reveals the node's vulnerability names and slightly raises local alert.

### Prompt

Replace the "No actions yet" placeholder in the node detail panel with a dynamic action menu. Actions available depend on the node's `accessLevel`:

**locked:**
- `[PROBE]` — reveal vulnerability names (costs nothing, raises alert slightly)
- `[EXPLOIT]` — attempt to gain access (leads to exploit card selection)

**compromised:**
- `[ESCALATE]` — attempt to gain full ownership (exploit card selection)
- `[READ]` — scan node contents (may reveal macguffins or hidden connections)
- `[RECONFIGURE]` — modify node behavior (stub for now — logs "not yet implemented")

**owned:**
- `[LOOT]` — collect macguffins (stub for now)
- `[SUBVERT]` — deceive connected security monitors (stub)
- `[RECONFIGURE]` — full config access

Implement the **Probe** action fully:
- Mark node as `probed: true` in state
- Reveal the node's vulnerability type names in the detail panel (previously shown as `[UNKNOWN]`)
- Raise node `alertState` one step: green → yellow
- If node has a connection to a detection node that isn't subverted, propagate a "probe event" to it (increment its alert state too)
- Re-render the panel and update the node's Cytoscape styling to reflect new alert state (edge/border color shifts: green → yellow → red)

---

## Phase 6: Exploit Action + Combat Resolution

**Builds on:** Phase 5 — action menu exists; Probe is implemented. Now wire up the exploit mechanic.
**Result:** The Exploit action lets the player select an exploit card from their hand and resolves success/failure against the node's vulnerabilities.

### Prompt

Implement the **Exploit** action flow in `js/combat.js`:

**UI flow:**
1. Player clicks `[EXPLOIT]` (or `[ESCALATE]`)
2. Sidebar switches to "SELECT EXPLOIT" mode — shows the player's hand with eligible cards highlighted (cards that match at least one of the node's known or unknown vulnerabilities)
3. Player clicks a card to launch it
4. Resolution plays out, result shown in sidebar, state updated

**Resolution logic** (`js/combat.js`):

```js
function resolveExploit(exploit, node) {
  // 1. Check for vulnerability match
  const knownVulns = node.vulnerabilities.filter(v => node.probed || true); // unknown vulns can still be hit by luck
  const matchingVulns = knownVulns.filter(v => exploit.targetVulnTypes.includes(v.id));

  // Base success chance from exploit quality vs node grade
  const gradeModifier = { S: 0.05, A: 0.15, B: 0.3, C: 0.5, D: 0.7, F: 0.9 };
  const matchBonus = matchingVulns.length > 0 ? 0.2 : 0;
  const successChance = Math.min(0.95, exploit.quality * gradeModifier[node.grade] + matchBonus);

  const roll = Math.random();
  const success = roll <= successChance;

  return { success, roll, successChance, matchingVulns };
}
```

**On success:**
- `locked` → `compromised`; `compromised` → `owned`
- Call `revealNeighbors(nodeId)` if newly compromised/owned
- Decrement `usesRemaining` on the exploit card; if 0, set `decayState: 'worn'`
- Show success message with flavor text

**On failure:**
- Raise node alert state (green → yellow → red)
- Roll against a `disclosureChance` (based on node grade: S=0.8, F=0.0) — if disclosed, set exploit `decayState: 'disclosed'`
- Decrement `usesRemaining`
- Propagate alert event to connected detection nodes
- Show failure message with flavor text

Re-render node styling, panel, and exploit hand after resolution.

---

## Phase 7: Alert System + Security Monitor Propagation

**Builds on:** Phase 6 — node alert states update on exploit actions. Now wire the two-layer alert system.
**Result:** Detection nodes propagate alert events to security monitor nodes. Global dungeon alert level rises based on security monitor state. The HUD displays the global alert level.

### Prompt

Implement the two-layer alert system in `js/state.js`:

**Detection nodes** (IDS type): when their alert state rises, they emit an event to connected security monitor nodes — unless they have been `subverted` or their connection has been `reconfigured` to drop events.

**Security monitor nodes**: aggregate incoming alert events. Each incoming red-alert event from a detection node raises the global alert level.

**Global alert level** in player state:
```js
globalAlert: 'green' | 'yellow' | 'red' | 'trace'
```

Thresholds (tune as needed):
- 1 yellow detection event → global yellow
- 1 red detection event → global red
- 2+ red detection events, or security monitor itself red → global trace

When global alert hits `trace`:
- Start a trace countdown timer (60 seconds)
- Display countdown prominently in the HUD (red, pulsing)
- On countdown expiry: end the run as a loss

Update the HUD top bar to show global alert level with color coding and a pulsing animation on red/trace.

Add a `propagateAlertEvent(fromNodeId)` function called whenever a detection node's alert state changes. It checks if the connection to the security monitor is intact (not reconfigured/subverted) before propagating.

Stub out `[RECONFIGURE]` on IDS nodes to set a `eventForwardingDisabled: true` flag, preventing propagation. This makes the security-subversion puzzle functional.

---

## Phase 8: Macguffins + Looting

**Builds on:** Phase 7 — full alert system running. Now add loot.
**Result:** Certain nodes contain macguffins. The Loot action collects them and adds cash to the player wallet. The HUD wallet display updates.

### Prompt

Add macguffin data to `js/exploits.js` (or a new `js/loot.js`):

Define ~10 macguffin types with `name`, `description` (technobabble flavor), and `cashValue` range:
- "Encrypted Research Dossier" — $2,000–$8,000
- "Corporate Cryptowallet Fragment" — $5,000–$20,000
- "Auth Credential Dump" — $1,000–$4,000
- "Proprietary Binary Archive" — $3,000–$10,000
- "Executive Correspondence Bundle" — $2,000–$6,000
- etc.

In network data, assign 1–2 macguffins to loot nodes (file server, cryptovault, certain workstations). Macguffins are hidden until the node is `read` (READ action) or `owned`.

Implement the **READ** action:
- If node is `compromised` or `owned`: reveal macguffins present (show in panel with name, description, cash value)
- If already read: show previously revealed contents

Implement the **LOOT** action (requires `owned`):
- Collect all macguffins from the node
- Add their cash values to `player.cash`
- Mark node as looted (no repeat looting)
- Update HUD wallet display
- Show a loot summary in the sidebar with flavor text

---

## Phase 9: Jack Out + End Screen

**Builds on:** Phase 8 — loot collection and alert system both functional.
**Result:** The JACK OUT button works. The run ends either by voluntary jack-out or trace expiry. An end screen shows the run score.

### Prompt

Implement run-end logic in `js/state.js`:

**Jack Out** (voluntary):
- Player clicks "JACK OUT" button in HUD (always enabled once game starts)
- Confirm with a brief "JACKING OUT..." animation (optional — can be instant)
- Call `endRun('success')`

**Trace expiry** (involuntary):
- When trace countdown hits 0, call `endRun('caught')`

**`endRun(outcome)`:**
- Stop all timers
- Calculate final score: `player.cash` (0 if caught, or partial if desired)
- Render an end screen overlay:

```
╔══════════════════════════════╗
║   RUN COMPLETE / TRACED      ║
║                              ║
║   CASH EXTRACTED: $12,400    ║
║   NODES COMPROMISED: 4       ║
║   NODES OWNED: 2             ║
║   MACGUFFINS LOOTED: 3       ║
║                              ║
║   [RUN AGAIN]                ║
╚══════════════════════════════╝
```

Style in the neon terminal aesthetic. "RUN AGAIN" resets state and reinitializes the game with the same static network.

---

## Phase 10: Aesthetic Polish

**Builds on:** Phase 9 — full game loop is functional.
**Result:** Visual styling is elevated to match the cyberpunk vector phosphene aesthetic. Node/edge states have distinct visual treatments. The UI feels cohesive.

### Prompt

Polish the visual presentation:

**Graph styling** (Cytoscape.js):
- Node shapes: hexagon for security/IDS nodes, rectangle for servers, ellipse for workstations/routers, diamond for gateway
- Alert state → border glow color: green glow (#0f0), yellow (#ff0), red (#f00) with CSS animation pulse
- Access level → node fill: locked = near-black, compromised = dark blue, owned = dark green
- Revealed-but-locked nodes: dim grey, dashed border, label "???"
- Edges: animate a traveling "packet" dot along owned paths (Cytoscape edge animation or CSS)
- Selected node: bright magenta ring

**Sidebar + HUD:**
- Monospace font throughout (e.g. `Courier New`, `IBM Plex Mono`, or similar available from Google Fonts CDN)
- Action buttons styled as terminal commands with `[BRACKETS]`
- Exploit cards rendered with rarity color coding: common = grey, uncommon = cyan, rare = magenta
- Quality displayed as a segmented bar
- Alert level in HUD pulses when yellow/red/trace

**Misc:**
- Scanline overlay CSS effect on the graph panel (subtle CRT feel)
- Node click produces a brief flash/highlight on the graph
- Smooth sidebar transitions when switching between nodes

---

## Implementation Order Summary

| Phase | Deliverable |
|-------|-------------|
| 1 | Static graph rendered with neon styling |
| 2 | Node visibility + progressive revelation |
| 3 | Node detail sidebar |
| 4 | Exploit card data + player hand display |
| 5 | Action menu + Probe action |
| 6 | Exploit action + combat resolution |
| 7 | Alert system + security monitor propagation |
| 8 | Macguffins + looting |
| 9 | Jack out + end screen |
| 10 | Aesthetic polish |
