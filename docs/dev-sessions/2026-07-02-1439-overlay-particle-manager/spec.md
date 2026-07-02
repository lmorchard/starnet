# Spec — overlay particle manager (concurrent node animations)

**Status:** brainstorm complete; awaiting spec review before planning.
**Origin:** bug #1 from the reactive-substrate SWEEP work (#286). A sweep fans out to N probing nodes
(state proven: 6+ at once) but only ONE probe animation renders. Evidence + code map in `research.md`.
**Type:** FEEL-DRIVEN + a small rendering rearchitecture — plan an interactive-lab phase, not autonomous build.

## Goal

Let the graph render **multiple node-overlay animations at once**, so the visuals faithfully reflect
game state (every node currently being probed shows its probe sweep). Do it via a reusable overlay
**manager that pools/reuses elements**, so the capability generalizes to future multi-node cases
(ICE instances, adversarial cascades) without re-solving.

## Current state (the singleton pipeline)

One element per action type + one tracked node per action, end to end:
- `mountOverlays()` creates one element per `OVERLAY_DESCRIPTORS` entry → `byAction: Map<action,element>`
  (`js/ui/overlays/index.js:23-32`, `registry.js:21-29`).
- `dispatchActionFeedback` tracks `activeNodeIds: Map<action,nodeId>` (`dispatch.js:20-34`,
  `visual-renderer.js:91`) — `start` overwrites the single entry, so concurrent probes clobber each
  other and only the last animates.
- `NodeOverlay` anchors to a single `this.nodeId` (`node-overlay.js:144-201`).

## Desired end state

- A node action emitting `ACTION_FEEDBACK` for several nodes concurrently shows an independent overlay
  per node; each tracks its own progress and tears down on its own `complete`/`cancel`.
- Single-node actions (exploit/dump/fetch/mine/lie-low) are unchanged — the degenerate N=1 case.
- The concurrent-animation LOOK (how many at once reads well / stays legible) and PERF (does N
  animating overlays hold framerate) are tuned by seeing it in a lab, then locked into the spec/code.

## Design decisions

1. **Key the pipeline by `(action, nodeId)`.** `dispatch.js` tracks active nodes per action as a set/map
   (not a single id); `progress`/`complete`/`cancel` act on the event's OWN `nodeId`. Reasoning: the
   root cause is the single-slot tracker; keying by node is the minimal correct model.
2. **A manager pools + reuses overlay elements per type.** Acquire an element on a node's `start`,
   drive it on `progress`, release it back to the pool on `complete`/`cancel`. Reuse released elements
   rather than churning DOM. Reasoning: Les's "overlay particle manager, reuse elements, efficiencies";
   avoids unbounded element creation on wide sweeps.
3. **Keep each pooled element's existing RAF loop** (smoothing/time). **LAB-CONFIRMED:** 24 concurrent
   real probe overlays (looping, FPS meter on) held framerate, so the single shared "particle" RAF is
   NOT needed. Not doing the shared-RAF rewrite — it would touch every overlay (code that isn't broken)
   for no measured gain.
4. **No concurrency cap — animate every probing node (1:1 with state).** **LAB-CONFIRMED:** up to 24
   simultaneous sweeps read fine, no clutter or fps issue, so no cap / aggregate cue.
5. **Random start jitter on a sweep batch (view-layer, cosmetic).** **LAB-CONFIRMED:** when a batch of
   probe overlays starts in the same frame (a sweep fan-out), offset each overlay's ANIMATION start by a
   random 0–150ms. This is purely visual — the probe timed-action still starts on its real tick, so
   there is NO game-state timing change and NO determinism concern (a non-seeded `Math.random()` for the
   view jitter is acceptable). A lone probe's jitter is imperceptible. Reasoning: the staggered wave
   reads as propagation and looks better than a hard simultaneous flash.
6. **Preserve the glow/bloom "one owner per layer" rule.** Pooled elements live under `#overlay-layer`
   and inherit `#overlay-bloom` (`css/style.css:178-180`); none carries its own `filter="url(...)"`
   (the `graph-perf` fps trap). Reposition-on-pan/zoom must cover pooled elements too
   (`overlays/index.js:47`).
7. **Normalize the `nodeId` keying.** `ACTION_FEEDBACK` carries `attrs.label` from the operator path but
   `n.id` from ctx paths (`research.md`); they usually match (`label` defaults to `id`) but the manager
   must key/anchor on the Cytoscape element id consistently. Pin this down so pooled anchoring is correct.

## Interactive-lab phase — DONE ✓

Ran a real N-concurrent-probe-overlay lab (`js/ui/preview-sweep-lab.js`, temporary scaffolding in the
preview harness). Findings locked into decisions #3–#5 above: **no cap** (24 concurrent read fine),
**random 0–150ms view-layer start jitter** on a batch, **keep per-element RAF loops** (framerate held).
Port target: fold these into the production manager + tests; keep a permanent multi-node preview demo
(replacing/retiring the throwaway lab scaffolding).

Original phase intent (for the record):
- Stand up a lab that mounts **N real concurrent probe-sweep overlays** on N nodes (extend the preview
  harness with a temporary multi-node "sweep fan-out" driver + an fps meter + a fan-out-count/stagger
  slider; or a gitignored `tmp/` page importing the real overlay against a minimal cy). Use the REAL
  overlay + real bloom so both look and perf are honest.
- With Les, tune: how many concurrent sweeps reads well (cap? none?), whether to stagger their phase,
  and whether per-element RAF loops hold framerate at realistic fan-out (→ decides decision #3).
- Lock the findings (cap value, stagger, shared-RAF yes/no) into this spec, THEN port to the production
  manager + tests once.

## Patterns to follow

- Overlay mount/registry: `js/ui/overlays/index.js`, `registry.js` (registry-driven — a new/changed
  overlay flows into `preview.js` automatically: `EFFECT_NODES`/controls/`EFFECTS` at `preview.js:33-40,
  204-225`).
- Dispatch state machine: `js/ui/overlays/dispatch.js` (pure, unit-testable without DOM — extend its
  tests for the multi-node keying).
- Base overlay lifecycle: `js/ui/overlays/node-overlay.js` (`sync`/`clear`/`reposition`, managed RAF).
- Bloom ownership: `graph.js:176-179` (`ensureBloomFilter`), `css/style.css:178-189`; CLAUDE.md
  "Glow/bloom — one owner per layer."
- Perf guardrail: memory `cytoscape-continuous-redraw-perf` (profile-first; no per-frame heavy filter).

## What we're NOT doing

- **NOT** the full shared-RAF particle-system rewrite up front (deferred to a lab-proven need; keep
  per-element loops).
- **NOT** probe-only special-casing — build the general manager (probe is the first client).
- **NOT** changing single-node overlays' behavior/appearance (exploit/dump/fetch/mine/lie-low, reticle).
- **NOT** wiring adversarial-cascade or multi-instance-ICE overlays in this session (the manager enables
  them later; not in scope now).
- **NOT** touching `flow-layer.js` (canvas, its own model, already self-composites).
- **NOT** changing the SWEEP game logic (that shipped in #286/#294); this is purely the render layer.

## Risks

1. **Perf at high fan-out** — mitigated by the lab measurement gate (decision #3) before committing.
2. **label-vs-id keying** (decision #6) — a wrong key anchors an overlay to the wrong/no node; pin it in
   the plan with a focused test.
3. **Pool teardown leaks** — a released element that keeps a RAF loop or stays visible; `clear()` must
   fully stop loops (it does today, `node-overlay.js:208-215`) and the pool must reset on `RUN_STARTED`.
