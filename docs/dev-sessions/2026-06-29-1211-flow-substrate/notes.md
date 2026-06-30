# Session 0: Flow Substrate — notes

## Outcome: functionally complete, parked pending PR

Branch `flow-subversion-substrate`. All four planned phases shipped + tuned:

- **Phase 1** — `Flow` typedef + serializable `state.flows` (from `meta.flows`). Round-trip tested.
- **Phase 2** — `flow-glyphs.js` pure glyph module (5 types + encrypted), single-sourced geometry.
- **Phase 3** — edge-anchored flow layer + renderer wiring; pure `renderableFlows` selector tested.
- **Phase 4** — preview demo (toggles/density/encrypted) + flows authored into Corporate Exchange.

`make check` green throughout (1481 tests). Reach via `?network=corporate-exchange` (the hub only
launches generated networks — named networks aren't hub-reachable; noted for a later session).

## Feel tuning (with Les)

Settled values in `flow-layer.js`: `MAX_PACKETS=3`, `LANE_GAP=3`, `PHASE_STAGGER=0.4`,
`PHASE_JITTER=0.12`, `RIM_PAD=5`, stroke `0.7`. Packets travel rim-to-rim, scale with zoom,
ride parallel lanes per mixed edge, with random phase jitter. Glow comes from the global
`#starnet-bloom` (per-packet filter removed).

## Rendering: SVG → canvas

Started as per-packet SVG DOM; rewrote to a single `<canvas>` (clear + redraw per frame, all
cy reads cached in `_recompute`, no per-frame DOM/cy work). The SVG-vs-canvas A/B was a wash —
which led to the real finding below.

## Open (small) — visual confirmations not yet done

- Encrypted flow reads as concealed (dim `?`) and distinct — needs an eyeball.
- Fog-of-war: a flow renders only once both endpoints are revealed — needs an eyeball.

(Both are independent of the perf issue; couldn't self-verify — Playwright won't launch here.)

## The perf detour → its own effort

Most of the session's back half went into chasing bad FPS. The flow layer was **exonerated**:
a DevTools profile (`~/Downloads/Trace-20260630T114029.json.gz`) shows Cytoscape's canvas
renderer (`i` in vendor.js) redrawing **every frame, constantly, ~48% of CPU** — independent of
flows (≈0 in the trace), audio, bloom, GC, and deck damage (none present). Prime suspect: the
**cola layout never settling** (cola tick fns appear under the redraw). This is a pre-existing
issue on `main` and is being moved to a dedicated performance session. Related finding for that
session: **deck perturbation** represents deck damage by jittering Cytoscape node *positions*
every frame, which forces full-canvas redraws — the same cost mechanism; worth re-representing
via an overlay rather than cy-model mutation.

## Next

- Open the PR for this branch when ready (it's clean and mergeable as-is).
- Perf is now the focus, in its own worktree/session.
