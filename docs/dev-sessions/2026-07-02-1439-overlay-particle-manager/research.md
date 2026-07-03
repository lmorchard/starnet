# Research — overlay particle manager (concurrent node animations)

Origin: bug #1 from the reactive-substrate (#286) playtest — a SWEEP fans out to N probing nodes
(state proven: 6 at once), but only ONE probe animation renders. Root cause is architectural: the
overlay pipeline is single-node-per-action end to end.

## The singleton pipeline (the thing to change)

- **One element per action.** `mountOverlays()` (`js/ui/overlays/index.js:23-32`) creates exactly one
  custom element per `OVERLAY_DESCRIPTORS` entry (`js/ui/overlays/registry.js:21-29`) and returns
  `byAction: Map<action, element>` (6 action-feedback overlays) + `byKey` (+ice). 7 elements total.
- **One in-flight node per action.** `dispatchActionFeedback` (`js/ui/overlays/dispatch.js:20-34`)
  tracks `activeNodeIds: Map<action, nodeId>` (`visual-renderer.js:91`). `start` overwrites the single
  entry (`dispatch.js:26`); `progress` syncs that one node (`:28`); `complete`/`cancel` clears the one
  overlay (`:30-32`). → concurrent starts clobber each other; only the last animates.
- **One target per overlay element.** `NodeOverlay` anchors to a single `this.nodeId`
  (`node-overlay.js:144-150`, `_anchor()` → `cy.getElementById(this.nodeId)`); `sync(nodeId, progress)`
  re-targets it (`:183-201`).
- **RUN_STARTED reset** clears every overlay + `activeNodeIds` (`visual-renderer.js:107-110`).
- **Reposition on pan/zoom:** `onViewport(() => byKey.forEach(o => o.reposition()))`
  (`overlays/index.js:47`), fired from `graph.js` pan/zoom/position handlers.

## Perf / bloom constraints (govern the "particle manager" design)

- **Up to 2 RAF loops per active overlay:** the smoothing loop (`_raf`, `node-overlay.js:194-198`,
  parks on convergence) + the time loop (`_timeRaf`, `startTimeLoop`, runs until cleared). N concurrent
  overlays → up to 2N loops. A single shared manager RAF (particle-system style) is the efficiency win.
  - Time-loop users: `exploit-brackets` (+smoothing), `loot-rings`, `lie-low-clock`. Smoothing-only:
    `probe-sweep`, `mine-scan`. Neither: `read-sectors`, `ice-detect`, `selection-reticle`.
- **Bloom is per-element, one owner:** `#overlay-layer > * { filter: url(#overlay-bloom) }`
  (`css/style.css:178-180`); the light single-pass filter is in `graph.js:176-179`
  (`ensureBloomFilter`). CLAUDE.md rule: an overlay must NOT carry its own `filter="url(...)"` on top of
  the layer filter (double re-raster → real fps drops, the `graph-perf` session). `.flow-layer` opts out
  (`style.css:185-189`) and self-composites. Pooled overlay elements inherit `#overlay-bloom` for free;
  each is its own node-sized re-raster box.
- No stated FPS target; guidance is "no continuous animate loop / heavy filter on a per-frame element."
  See memory: cytoscape-continuous-redraw-perf.

## Overlay inventory (which need multi-node?)

All 6 action overlays + ice are **single-node in practice** today (the game runs one action instance per
action-type at a time). Files in `js/ui/overlays/`: `probe-sweep.js` (A.PROBE), `mine-scan.js` (A.MINE),
`read-sectors.js` (A.DUMP), `loot-rings.js` (A.FETCH), `exploit-brackets.js` (A.XPLOIT),
`lie-low-clock.js` (A.LIE_LOW), `ice-detect.js` (ICE timer), `selection-reticle.js`. All extend
`NodeOverlay` except non-DOM helpers and `flow-layer.js` (canvas, multi-edge, its own model).

- **Needs N>1 now:** only **probe** (SWEEP fan-out).
- **Would want N>1 later:** ICE (multi-instance), adversarial cascades (#286/#288 hostile pulses).
- **Inherently 1:** exploit/dump/fetch/mine/lie-low (one player action at a time), selection reticle.

## Preview harness (the lab's port target — nearly free)

`preview.js` is 100% registry-driven: `EFFECT_NODES` (`:33-40`), control rows (`:204-217`), and `EFFECTS`
(`:220-225`) are all generated from `OVERLAY_DESCRIPTORS`. It mounts overlays via the SAME
`initializeGraphOverlays()` the game uses (`preview.js:165`). **Adding/altering an overlay in
`registry.js` flows into the preview automatically — no `preview.js` edits.** A multi-node demo needs a
new preview control that drives >1 node at once.

## ACTION_FEEDBACK contract (the keying detail)

Payload: `{ nodeId, action, phase: start|progress|complete|cancel, progress: 0..1, durationTicks? }`.
- Emitted by the `timed-action` operator (`operators.js:417,457,483`) with `nodeId: attrs.label`, and by
  ctx paths (`game-ctx.js:111,126,148,196,334,406`) with `nodeId: n.id` (structural id).
- **`attrs.label` defaults to `id`** (`node-factories.js:39`), so usually equal — but they're distinct.
  `_anchor()` needs the Cytoscape element id. A multi-node manager keys by this nodeId; the label-vs-id
  mismatch is a latent gotcha to normalize.

## Design implications (for the spec)

1. Make the pipeline keyed by **(action, nodeId)**: dispatch tracks a set/map of active nodes per action;
   `progress`/`complete`/`cancel` act on the event's own `nodeId`, not a single tracked one.
2. A **manager pools + reuses overlay elements** per type (acquire on start, release on complete/cancel),
   and ideally drives all active instances from **one shared RAF** (retire per-element loops) — Les's
   "particle manager, reuse elements, find efficiencies."
3. Single-node actions are the degenerate N=1 case → no behavior change for them.
4. **Feel-driven**: the LOOK of N concurrent animations (density, glow budget, whether to cap/stagger)
   can't be specified — needs an interactive lab (gitignored `tmp/`) before porting to production.
