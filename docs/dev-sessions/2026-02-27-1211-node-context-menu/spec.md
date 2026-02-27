# Spec: Node Context Menu

## Goal

Replace the action buttons in the sidebar with a floating popup menu anchored near the
selected node in the graph. Actions should feel spatially grounded — close to the thing
being acted on — rather than remote in a panel on the opposite side of the screen.

## Behaviour

### Trigger
- Selecting a node immediately blooms the context menu near that node.
- Deselecting (clicking away, pressing Escape, issuing `deselect`) dismisses it.
- No secondary click required — menu appears as part of selection, not as a separate step.

### Position
- Menu floats near the selected node in graph space, anchored to one side.
- Stays attached to the node on pan/zoom (same mechanism as probe sweep, ICE detect ring).
- Fixed offset: below-right of the node's rendered position. No edge-detection for now —
  accept occasional clipping; iterate with playtesting.

### Content
- Renders from `getAvailableActions(node, state)` — the same call already used by the
  sidebar and console `actions` command. No new action logic needed.
- Each item shows: action label + short description (from `ActionDef.desc()`).
- When an action is in progress (exploit running, probe scanning), the menu naturally
  reflects the updated available actions (e.g. only `cancel-exploit` shown).
- Menu re-renders on every `STATE_CHANGED` event, same as the sidebar currently does.

### Interaction
- Clicking an action item dispatches `starnet:action` with the action's id and nodeId —
  identical to the existing sidebar button behaviour.
- Console and context menu remain symmetric: same actions available, same outcomes.

### Dismissal
- Menu hides when node is deselected.
- Menu hides when the run ends (`RUN_STARTED` / jack out).

### Deselect action
- `deselect` is included as an action item in the context menu (dispatches `starnet:action`
  with `actionId: "deselect"`), making it consistent with all other actions.
- The `[ DESELECT ]` button currently in the sidebar node header is removed.
- Clicking the graph background (existing cytoscape unselect handler) continues to work.

## Sidebar changes

The sidebar node panel shrinks to metadata only:
- Node label + type badge
- Grade, access level, alert state
- Vulnerability list (when probed)
- Active timer(s) (probe/exploit countdowns)

Action buttons are removed from the sidebar entirely.

> **Future session note:** The metadata sidebar is still spatially remote from the graph.
> Consider whether node metadata should also become a diegetic popup (a tooltip-style
> overlay anchored to the node) — or whether the sidebar earns its place as a "decker
> readout" panel. Deferred; out of scope for this session.

## Visual style

- Consistent with the phosphene aesthetic: dark background, terminal-green or cyan text,
  magenta accents for selected state.
- No CDN library — pure CSS/HTML, positioned absolutely over the graph container.
- Subtle bloom-in animation (opacity + slight upward translate) on appear; instant dismiss.
- Action items use the same hover/active styling as sidebar buttons currently do.

## Out of scope

- Pie/radial layout (considered, deferred — popup list first).
- Node metadata as a graph-anchored popup (future session).
- Keyboard navigation within the menu (future).
- Touch/mobile interaction.
