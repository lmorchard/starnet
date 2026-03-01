# Spec: Timed Loot Action with Ripple Ring Animation

## Context

Probe and read were converted from instant to timed actions in previous sessions. Loot is still instant (`collectMacguffins` + `addCash` flip). This session makes loot take time (scaled by node grade) and adds a progress animation: concentric translucent rings emit from the node center and grow outward to the reticle border, representing items being extracted.

## Timing

Duration table (grade → ms), slightly faster than read since the hard work is already done:

```
{ S: 3000, A: 2500, B: 2000, C: 1200, D: 1000, F: 600 }
```

## Animation

- Concentric rings of random thickness (1-3px) emit from center and grow to reticle edge
- Rings are translucent cyan-green (`rgba(0, 255, 160, 0.3)`) — distinct from read (green) and probe (cyan)
- Multiple rings visible simultaneously, spawned at regular intervals during the loot
- Each ring fades as it reaches the edge
- Visual-only state (not serialized), uses Math.random() for ring thickness variation

## Mechanics

Follows the read-exec.js pattern exactly:

- `ActiveLoot` type: `{ nodeId, timerId }`
- `activeLoot` field on GameState (null when not looting)
- `LOOT_EXTRACT` timer type
- `LOOT_EXTRACT_STARTED` / `LOOT_EXTRACT_CANCELLED` events
- Auto-cancel on `PLAYER_NAVIGATED`
- `startLoot` / `cancelLoot` / `handleLootExtractTimer` lifecycle
- `cancel-loot` action and console command
