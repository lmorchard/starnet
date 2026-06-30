# Session 0: Flow Substrate Spec

**Goal:** Make LAN edges carry and render typed, animated packet flows from
serializable per-edge state — the visual + data foundation for the Flow Subversion
pillar. No new player verbs, no gameplay or balance change.

**Source:** User request from 2026-06-29 (brainstorm with Les). North star:
`docs/design/flow-subversion.md`.

## Current state

- **Edges** are module-scoped in the UI layer (`_networkEdges`, `js/ui/graph.js:141`), plain
  `[source,target]` 2-tuples, added to Cytoscape lazily as nodes become visible
  (`graph.js:460-472`). **They are NOT serializable state** — `serializeState`
  (`js/core/state/index.js:361`) spreads `state.nodes` + snapshots `nodeGraph`; edges carry
  nothing through a round-trip (`research.md` §1). Lines today show nothing moving except an
  occasional ICE-movement pulse.
- **Graph overlays** are drawn by `js/ui/visual-renderer.js` onto an SVG `#overlay-layer`
  present in **three** HTML entrypoints (index / preview / playground — see memory note
  "visual-renderer has THREE HTML entrypoints"); all three need the lit importmap + overlay layer.
- **Pure geometry modules** `js/ui/node-glyphs.js` and `js/ui/ice-glyphs.js` define stroked
  vector glyphs consumed by both `graph.js` and `js/ui/preview.js`.
- **State** lives in `js/core/state/`, fully serializable; typedefs in `js/types.js`.
  Network/biome data lives under `data/`.
- **Preview harness** (`preview.html` + `js/ui/preview.js`) is where new visual effects
  must be demoable (project Design Principle).

> Exact `file:line` integration points (edge data shape, overlay draw loop, serialize
> path) are to be pinned in `research.md` during `plan`.

## Desired end state

- A `Flow` typedef in `js/types.js`:
  `{ from: string, to: string, type: 'money'|'data'|'audit'|'control'|'credential', rate: number, encrypted?: boolean }`.
  `from`/`to` are node ids (direction = `from`→`to`); `type` is the semantic packet type
  (five types — "encrypted" is not a type but a render state); `encrypted:true` conceals the
  type until revealed.
- Flows are **first-class serializable state**: a top-level `state.flows: Flow[]`, authored
  alongside `edges` in network data. (Edges are not serializable — they live only in
  Cytoscape; `research.md` §1.) Multiple flows may share one edge → a single edge carries a
  **mix** of packet types.
- The renderer draws **animated stroked-vector packets** along edges:
  - **shape** per type (◇ money / ▢ data / △ audit / › control / ⬡ credential / ⌗ encrypted),
  - **density/speed** scales with `rate`,
  - **arrow/travel direction** from `direction`,
  - **encrypted** streams render dim/dashed/scrambled (type & contents hidden),
  - the **connection line stays neutral** — all semantics ride on packets.
- Packet geometry lives in a pure module `js/ui/flow-glyphs.js` (mirrors node-/ice-glyphs),
  consumed by both `visual-renderer.js` and `preview.js`.
- Flows survive a **JSON serialize → deserialize round-trip** unchanged (test-covered).
- Preview harness gains a demo with controls showing every packet type, a mixed-type edge,
  and an encrypted edge.

## Design decisions

- **Decision:** Session 0 flows are **declarative state** (authored on edges), not yet
  produced/consumed by node-graph operators.
  - **Why:** minimal, low-risk infra that proves the data shape + rendering + serialization
    without coupling to the runtime or touching balance.
  - **Rejected:** wiring flows into node-graph operators now — premature coupling and balance
    risk; dynamic emission belongs to Session 1+ when verbs need it.
- **Decision:** connection line carries no type info; semantics ride only on packets.
  - **Why:** an edge may carry mixed packet types (a money artery also carrying audit).
  - **Rejected:** per-edge line color-coding — breaks on mixed edges.
- **Decision:** packet geometry in a pure, testable module.
  - **Why:** matches `node-glyphs.js`/`ice-glyphs.js`; shared by live renderer + preview.
- **Decision:** stroke-only vector glyphs lit by glow.
  - **Why:** the vector-beam aesthetic (no fills, no bitmap idioms) per `CLAUDE.md`.

## Patterns to follow

- Pure glyph module: `js/ui/node-glyphs.js`, `js/ui/ice-glyphs.js`.
- Overlay draw + `#overlay-layer`: `js/ui/visual-renderer.js` (update all three entrypoints).
- Preview demo + controls: `js/ui/preview.js` / `preview.html`.
- Serialize round-trip test: existing state round-trip tests under `tests/`.

## What we're NOT doing

- **No new player actions/verbs** (`SNIFF`, `TAP`, `SPLICE`, `SPOOF`, …) — Session 1.
- **No noise/heat or trace-clock changes.**
- **No operator-driven dynamic emission/consumption** of flows — declarative only.
- **No objective, scoring, skim, or loadout/store work.**
- **No change to the existing extraction loop, ICE, alert balance, or census numbers.**
- No procedural generation of flows; demo + one authored network only.

## Open questions

- **Render tech: SVG-overlay (`animateMotion`) vs. a Cytoscape canvas layer.**
  Default: SVG overlay, consistent with existing `visual-renderer` overlays. NOTE: no
  edge-anchored overlay exists today — all current overlays anchor to a single node
  (`research.md` §2), so this is new plumbing (an edge-anchored, continuously self-animating
  overlay repositioned on viewport). Revisit canvas only if particle counts force it.
- **Where flows are authored.** Resolved (`research.md` §1): a top-level `flows` array in
  network data → `state.flows`. Edges stay plain 2-tuples. One demo network gets `flows`
  populated; flow rendering is gated by endpoint visibility (an edge only exists in Cytoscape
  once both endpoints are revealed).
- **Particle-count performance bound.** Default: cap packets per edge and overall (precedent:
  the bounded audio-playback load), tuned by eye in the preview harness.

> This session is **feel-driven in its visual layer** — build the data/serialization logic
> test-first, but tune particle look/density/cadence in the preview harness with Les before
> locking values, rather than through autonomous execution.
