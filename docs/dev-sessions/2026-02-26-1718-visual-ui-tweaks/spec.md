# Spec: Hand Strip + Pie Menu

## Phase 1 — Hand Strip Redesign

### Problem
The exploit hand lives in the lower-right sidebar. Cards are wide horizontal panels
stacking vertically. The progress fill sweeps left-to-right. When the executing label
appears it pushes the card taller, causing layout shift. The sidebar mixes informational
content (node detail) with the always-visible hand.

### Design

**New layout:**
A `#hand-strip` div sits between the graph canvas and the log pane, spanning the full
width of `#graph-column`. Cards are arranged side-by-side in a single horizontally-
scrolling row (no wrapping).

**Card shape:**
Cards become narrow vertical tiles (~130px wide, fixed height ~160px). Content stacks
top-to-bottom: index, name, rarity, quality pips, uses, vuln targets. The executing
label is always present in the DOM but hidden (`visibility: hidden`) when not executing,
so it never causes layout shift.

**Progress fill:**
Change fill direction from left-to-right to bottom-to-top. The `::before` pseudo-element
uses `transform-origin: bottom center` and `scaleY` instead of `scaleX`.

**Sidebar:**
`#sidebar-hand` is removed. The sidebar shows only node info (grade, access, alert,
vulns, timers, macguffins) — no action buttons (those move to the pie menu in Phase 2).

---

## Phase 2 — Pie Menu for Node Actions

### Problem
Action buttons are buried in the sidebar. The graph is the primary interaction surface;
actions should be accessible directly from nodes.

### Design

Load the `cytoscape-cxtmenu` extension. On right-click or long-press of any visible
node, a radial pie menu appears showing available actions for that node's current state.

**Pie menu replaces sidebar action buttons entirely.** The sidebar is purely informational
after this change.

**Dynamic commands:** the `commands` option is a function that receives the clicked
element and returns an array based on `getState()` at that moment.

**Commands per state:**

| Condition | Items shown |
|-----------|-------------|
| Always (selected node) | DESELECT |
| Locked + unprobed + not scanning | PROBE |
| Active probe here | CANCEL PROBE |
| Locked/compromised + probed + hand not empty | EXPLOIT (best card) |
| Executing exploit here | CANCEL EXPLOIT |
| Compromised or owned + unread | READ |
| Owned + has uncollected loot | LOOT |
| IDS + owned/compromised + forwarding enabled | RECONFIGURE |
| Owned + ICE present here | EJECT |
| Owned + not rebooting | REBOOT |
| Owned security-monitor + trace active | CANCEL TRACE |

For EXPLOIT: dispatches `launch-exploit` with the highest-priority card from the sorted
hand (same sort order as the hand strip). This avoids cluttering the pie with per-card
items.

**Styling:** override ctxmenu's default light theme with the game's dark phosphene
palette (dark bg, green text, cyan active state, monospace labels).

---

## Acceptance Criteria

- Hand strip is visible below the graph, above the log, full width
- Cards are narrow vertical tiles in a single scrolling row
- Progress fill sweeps bottom-to-top during exploit execution
- Card height stays constant when executing label appears/disappears
- Right-clicking (or long-pressing) a visible node opens a pie menu
- Pie menu items match the node's current available actions
- Clicking a pie item executes the action and updates game state
- Sidebar shows only node info (no action buttons)
- Styles match the cyberpunk vector aesthetic
