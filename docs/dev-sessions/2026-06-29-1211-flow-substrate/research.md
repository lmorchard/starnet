# Session 0 research — flow substrate integration points

Dense file:line findings from a documentarian pass over the worktree. Grounds `plan.md`.

## 1. Edges are NOT serializable state

- Network data declares edges as plain 2-tuples: `data/networks/corporate-exchange.js:57-78`
  → `edges: [["gateway","switch-1"], ...]`, typed `[string,string][]`. No per-edge fields.
- Stored module-scoped in the UI layer, not game state: `js/ui/graph.js:141`
  `let _networkEdges = []`; assigned in `initGraph` (`graph.js:277`) and `resetGraph`
  (`graph.js:421`).
- Added to Cytoscape lazily as nodes become visible: `graph.js:460-472` — iterates
  `_networkEdges`, `cy.add({data:{id,source,target}, classes:["visible"]})` only when both
  endpoints are present. (Fog-of-war: an edge exists visually only once both endpoint nodes
  are revealed.)
- **Serialization** (`js/core/state/index.js:361-415`): `serializeState` does
  `const {nodeGraph, ...rest} = state; return {...rest, _timers, _rng, _exploitIdCounter,
  _nodeGraph: nodeGraph?.snapshot()}`. Edges appear nowhere — they round-trip as nothing.
  `state.nodes[id]` fields DO survive (part of `...rest`); a new top-level `state.flows`
  array would also survive automatically.

**Implication for plan:** model flows as first-class serializable state (top-level
`state.flows`), authored alongside `edges` in network data — NOT as a field on edge objects.

## 2. Overlay rendering — event-driven, node-anchored, no edge overlays today

- Overlay mount: `<div id="overlay-layer">` at `index.html:30` and `preview.html:157`
  (z-index 3, above graph / below modals).
- Driven by events, not a tick loop: `js/ui/visual-renderer.js:84-85` reacts to
  `E.ACTION_FEEDBACK` `{nodeId, action, phase, progress}` → `dispatchActionFeedback`
  (`visual-renderer.js:16-18`) → matched overlay `.sync(nodeId, progress)`.
- Overlay contract: `js/ui/overlays/node-overlay.js:9` — `sync(nodeId, progress)`,
  `reposition()`, `clear()`. Base class `_anchor()` uses `getCy()` +
  `cy.getElementById(nodeId).renderedPosition()` for screen coords (`node-overlay.js:15`).
- Viewport reposition: `js/ui/overlays/index.js:46` — `onViewport()` calls
  `overlays.byKey.forEach(o => o.reposition())` on every pan/zoom.
- Concrete edge-near example: NONE. Probe-sweep (`overlays/probe-sweep.js:32-83`) draws 12
  LED segments AROUND a node's dodecagon perimeter (clockwise sweep front = progress·360°).
  ICE-detect (`overlays/ice-detect.js`) draws a CCW closing N-gon ON a node. Both anchor to a
  single node; none animate along the edge between two nodes.

**Implication for plan:** need a new edge-anchored overlay that reads BOTH endpoints'
rendered positions and animates packets between them, continuously (SMIL `animateMotion`
self-loops; reposition the path on viewport). New pattern vs. per-action node overlays.

## 3. Pure geometry module pattern (to mirror for flow-glyphs.js)

- `js/ui/node-glyphs.js`: `NODE_GLYPHS` (line 26) = `Record<type,{color,body}>` (body = SVG
  markup, viewBox 0 0 64 64, stroke-only); `glyphFor(type)` (66); `glyphSvg(type)` (75);
  `glyphDataUri(type)` (85); `nodeFaceSvg/DataUri` (142/168).
- `js/ui/ice-glyphs.js`: `ICE_RED`/`ICE_MAGENTA` (7-8); `iceStrikeCage()` (18) → SVG string;
  `detectionPolygonSegments(sides=30,r=30)` (39) → `{x1,y1,x2,y2}[]` (geometry helper).
- Consumed identically: `graph.js:5-6` imports glyph/cage; `preview.js:19-20` imports
  `iceStrikeCage, ALL_GLYPH_TYPES`. Pure string/array returns, no DOM.

**Mirror:** `flow-glyphs.js` exports `FLOW_GLYPHS: Record<flowType,{color,body}>`,
`flowGlyphFor(type)`, `flowSvg(type)` (small stroked packet glyph, viewBox e.g. 0 0 12 12).

## 4. Preview harness pattern

- `js/ui/preview.js`: demo node lists `EFFECT_NODES` (32), `SHAPE_NODES` (58), `NET_NODES`
  (87) + `NET_EDGES` (94, a real 5-node cycle); all added via `initGraph` (107) with fixed
  x,y; demo nodes forced `visibility:"accessible", accessLevel:"owned"` (115,128).
- Edges in preview added with `cy.add({data:{id,source,target}})` (≈121).
- Controls (191-245): per effect → label + range slider (0..1) + value + PLAY + RESET;
  effect object `{name,nodeId,sync,clear}`; slider→`sync`, PLAY→rAF `animateEffect`,
  RESET→`clear`.

**Add demo:** define `FLOW_NODES` + a flow edge, push to `allNodes`, add edge via `cy.add`,
add a flow-types demo section + controls (toggle each packet type, density slider).

## 5. Serialization round-trip tests (to mirror)

- `serializeState`/`deserializeState`: `js/core/state/index.js:361` / `:373`. Mechanism =
  explicit field spread + `JSON.stringify`, NOT structuredClone. Plain primitives/arrays on
  `state.*` survive; `nodeGraph` is dropped + snapshotted separately.
- Round-trip test pattern: `tests/ui-state.test.js:52-60`
  (`JSON.parse(JSON.stringify(serializeState()))`, assert field present). Also
  `tests/init-game.test.js`, `tests/ice-serialization.test.js`.

**Mirror:** test that a network authored with `state.flows` survives
`JSON.parse(JSON.stringify(serializeState()))` → `deserializeState` unchanged.
