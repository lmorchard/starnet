# Graph Render Performance — investigation + fix

**Goal:** The game drops to ~40fps (and runs uneven/jaggy) during normal play. Find why and fix
it, so the graph holds a steady frame rate.

**Source:** User report + DevTools profile `~/Downloads/Trace-20260630T114029.json.gz`
(2026-06-30). Surfaced while building the flow substrate; flows were ruled out.

## What the profile shows (definitive)

- **Cytoscape's canvas renderer (`i` in `vendor.js`) is ~48% of all CPU self-time** — 28.7s of a
  ~59s trace. Its children are renderer functions (`Xs.render`, `Ll.drawLayeredElements`,
  `getPixelRatio`). It sits at the profile **root** (a scheduled callback), i.e. Cytoscape is
  **redrawing its full canvas every frame, continuously.**
- Everything else is small by comparison: GC ~950ms (1.6%), Paint 366ms, Layout 310ms,
  Composite/Layerize ~230ms each. So it is **not** GC, **not** the `#starnet-bloom` filter,
  **not** paint/composite, **not** the flow layer (≈0 in the trace).

## Ruled out

- **Flow substrate** — `flow-layer.js` ≈0 in the trace; the canvas renderer is unrelated.
- **Audio** — drop persists with music + SFX disabled.
- **Selection reticle bloom** — exempting it from the bloom didn't help.
- **Deck perturbation** — early-returns at deck severity 0 (`deck-perturbation.js:188`); the
  reported drop happened with **no deck damage**, so it isn't the cause *here*. BUT it remains a
  known cost when active: it jitters node *positions* every frame, forcing full-canvas redraws —
  the same mechanism. Re-representing deck damage via an overlay (not cy-model mutation) is in
  scope as a follow-on.

## Leading hypothesis

Something keeps the Cytoscape canvas **marked dirty every frame**, so the renderer never idles.
Candidates, in rough priority:
1. A perpetual **node/element animation** (e.g. an alert pulse loop via `node.animate` in
   `graph.js:~87`) left running, or `cy.animated()` stuck true.
2. The **cola layout** not settling / being re-kicked (cola tick fns `overlapX`/`findIter` appear
   under the redraw, though small).
3. Some code calling `cy` in a way that requests a render each frame.

`DEFAULT_LAYOUT_ALGO = "cola"` (continuous physics); hand-crafted nets use `preset`, generated
nets lay out with cola. Whether the trace was a generated or named network matters.

## Immediate next step — pin the trigger in the browser (console probes)

Run with the game open and dropping frames:

```js
// 1) Is an animation driving renders?
_cy.animated()
_cy.nodes().filter(n => n.animated()).map(n => n.id())   // perpetually-animating nodes

// 2) Count actual redraws/sec (idle, no interaction):
let n=0, r=_cy.renderer(), orig=r.redraw.bind(r);
r.redraw=(...a)=>{n++;return orig(...a)};
setTimeout(()=>{ console.log('redraws/sec~', (n/3).toFixed(0)); r.redraw=orig; }, 3000);

// 3) Does stopping element animations recover fps?
_cy.elements().stop();
```

- `_cy.animated()` true / `stop()` recovers fps → perpetual element animation (find + bound it).
- redraws/sec ~ 60 while idle → confirms continuous redraw regardless of trigger.
- Also note: **generated network (hub) or named (`?network=`)?**

## Desired end state

Cytoscape idles (no redraws) when nothing is changing; steady frame rate during play. Deck-damage
representation reconsidered if it can't be made cheap. Specifics depend on the trigger found above.

## What we're NOT doing (yet)

- Not rewriting the renderer or swapping Cytoscape.
- Not touching the flow substrate (separate, parked branch).
- Not a blanket "disable effects" — fix the specific continuous-redraw cause.

## Open questions

- Exact continuous-redraw trigger — **blocks the fix; resolve via the console probes above.**
- Was the profile on a generated vs named network — default assumption: generated (cola), confirm.
