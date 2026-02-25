# Spec: LAN Dungeon Prototype — Session 3

_Session: 2026-02-24-1728-lan-dungeon-3_
_Branch: lan-dungeon-3_

## Features

### 1. Mission Objectives

A pre-designated target macguffin gives the run a concrete goal and a reward for achieving it.

**Briefing:**
- At game init, a mission target is selected and displayed in two places:
  - **Sidebar**: a "MISSION" section (above or below the hand pane) naming the target macguffin
  - **Console log**: an init message like `// MISSION: Retrieve [target name]`

**Target macguffin:**
- One macguffin in the network is flagged as the mission target
- It behaves identically to normal macguffins during play (probe → read → loot)
- Its cash value is multiplied 10x vs its base value
- The mission target is visible in the MISSION briefing by name, but its location is not revealed — the player must find it

**Payout:**
- Bonus only applies on successful jackout (not if caught)
- Run completion screen / metrics track mission success separately (e.g. "MISSION: COMPLETE" or "MISSION: FAILED")

**Out of scope this session:**
- Mission conditions (e.g. never exceed yellow alert, never trigger trace)
- Multiple simultaneous mission objectives
- Procedural mission generation

---

### 2. Visual Juice — Exploit & Node Unlock Feedback

Add clear visual feedback when an exploit succeeds or fails, and when a node's access level changes.

**Cytoscape node flash (graph panel):**
- Exploit **success**: brief pulse on the node — cyan → bright white → back to normal cyan
- Exploit **failure**: brief red flash on the node
- Node **unlock / access level change**: same success pulse (cyan → white → cyan)
- Flash duration: ~400–600ms, CSS transition or Cytoscape style animation

**Sidebar log line styling:**
- Exploit success log entry: styled green (distinct from default terminal-green body text — e.g. brighter, bold, or accented)
- Exploit failure log entry: styled red
- Nothing more dramatic than a highlighted line — no banners, modals, or auto-dismissing overlays

---

### 3. Auto-Pan/Zoom on Node Reveal

When new nodes become visible (transition from `hidden` to `revealed` or `accessible`), the graph should adjust to ensure they're in view.

**Behavior:**
- When `revealNeighbors` or `accessNeighbors` adds new visible nodes, compute the bounding box of the newly revealed nodes
- Pan/zoom the viewport just enough to include them — do not necessarily fit the entire graph (too disorienting if the player is zoomed into a cluster)
- Newly revealed nodes also flash briefly (distinct color — e.g. dim cyan pulse) to draw the player's attention

**UX:**
- The camera adjustment should feel like a nudge, not a reset
- If newly revealed nodes are already in view, no adjustment needed

---

### 4. Mouse Wheel Zoom Speed

The current Cytoscape zoom step on mouse wheel is too fast. Reduce it by approximately half to two-thirds.

- Target: 33–50% of current wheel zoom sensitivity
- Adjust the relevant Cytoscape `wheelSensitivity` config parameter

---

## Acceptance Criteria

- [ ] Mission target macguffin is assigned at game init; name appears in sidebar and console log
- [ ] Mission target macguffin has 10x cash value when looted
- [ ] Run completion (jackout) distinguishes mission success vs failure in the outcome display
- [ ] Exploit success triggers a cyan→white node flash and a green-highlighted log line
- [ ] Exploit failure triggers a red node flash and a red-highlighted log line
- [ ] Node unlock triggers the same success pulse as exploit success
- [ ] Newly revealed nodes trigger a pan/zoom nudge and a node flash
- [ ] Mouse wheel zoom is noticeably slower (~half to two-thirds of current)
