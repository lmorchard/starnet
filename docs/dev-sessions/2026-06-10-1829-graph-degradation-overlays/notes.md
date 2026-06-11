# Notes — Graph degradation overlays (#134)

## Summary

Shipped a two-layer, graph-panel-confined degradation system driven by the player's
resource pools (from #133):

- **HEALTH → liquid-light-show plasma** — an asymmetric, ever-evolving domain-warped fluid
  (WebGL overlay) with a rich cosine-palette colour cycle, breathing/drifting "oil-droplet"
  blob blooms, and high-contrast veins (refs: 1960s liquid light shows + Control's loading
  screens). The flow runs on a **heartbeat time-warp** — it surges on each lub-dub and eases
  between, the pulse growing stronger + faster as health drops. Plus a health-driven CSS
  filter on `#cy` (blur + hue-rotate + contrast) that hazes the real graph.
- **DECK INTEGRITY → graph chaos via Cytoscape's model** — **discrete events on one convex
  rate curve** (the graph is STILL between events, no continuous background motion): "did I
  see that?" above ~90% deck, ~1 event every couple seconds around 75%, near-continuous chaos
  below ~25%. Events are brief single-node *shakes* — a fine **1–2px axis-locked** tremor
  (horizontal OR vertical, never diagonal; re-jittered **every rAF frame ~60Hz** so it blurs
  rather than steps; count rises with severity, edges/labels follow) — and transient glitches
  on random nodes: blink-out, id/label scramble,
  glyph swap, flipping a discovered node back to an **undiscovered "???"** look, a **real
  connection dropping out** briefly, **phantom "???" nodes** + **phantom connections**
  (inert: `events:"no"`, non-selectable, self-removing), and **grid-backdrop glitches**
  (recolor / drop-out / spacing jump on `#graph-container`). Everything cleanly restored on heal.
  (See "Deck approach history" below — this replaced two earlier dead ends.)

Both stack and escalate toward flatline (HEALTH begins below ~90% via its threshold and caps at
the old-30% intensity; DECK is a thresholdless convex ramp — barely-there near full, chaos near
empty), and both are
confined to the graph panel — HUD/log/console text stays pristine, so as your eyes fail you
fall back to the console (the design intent). Branch `worktree-graph-degradation-overlays`
off `main`; `make check` green throughout (847 tests, lint clean).

## What shipped (6 tasks, TDD, subagent-driven)

1. **`graph-degradation-params.js`** (pure, unit-tested) — maps pools → effect params: HEALTH on
   a linear ramp below its 0.9 threshold, capped at `HEALTH_PEAK_SEVERITY` (the old-30% look);
   DECK on a thresholdless convex ramp; also `buildGraphFilterString(health)` for the `#cy` filter
   chain. The testable core; these constants are the #141 tuning knobs.
2. **`graph-degradation.js`** — injects a transparent WebGL canvas into `#graph-container`,
   one fragment shader compositing both layers, own rAF, `#cy` CSS-filter via change-gate.
   Idempotent init; graceful no-op without WebGL; `stop` resets state for clean reinit.
3. **visual-renderer wiring** — `initGraphDegradation()` once at startup; `updateFromState`
   on every `STATE_CHANGED` (same pattern as the HUD sync). No new game state.
4. **Preview harness** — dummy HEALTH/DECK sliders driving the overlay against a synthetic
   state, so it's tunable without a playthrough.
5. **MANUAL.md** — documented the degradation under low health/deck.
6. **Verification** — below.

## Architecture

The **health** overlay is a WebGL canvas that never reads Cytoscape's pixels and uses no
animated SVG filters (CSS `blur`/`hue-rotate` are cheap and jank-free). The **deck** layer
perturbs the real graph through Cytoscape's own model API (positions / styles / add-remove in
`cy.batch()`), so the graph reacts as itself rather than under a filter.

It's structured as a **lightweight particle system**: one `particles` pool, each particle a
`{ until, update?, restore }` — a lifetime, an optional per-tick update (shakes re-jitter),
and a self-cleanup. The tick loop updates live particles and reaps expired ones (each undoes
itself); a severity-scaled budget emits new ones. Adding a glitch type = write a factory that
applies its corruption and returns a `restore()`, then add a branch to the spawn roll.

**Considered + rejected (option 2):** capturing Cytoscape's canvas into a GL texture to
warp/RGB-split the *actual* graph pixels. Les's call: a warped *texture* would read as
detached from the graph's detail — so the model-perturbation route was chosen over it. See
"Deck approach history" below.

## Tuning (as shipped — the #141 knobs)

- HEALTH threshold **0.9** (effect invisible above 90% health), linear ramp below it, intensity
  capped at `HEALTH_PEAK_SEVERITY` (≈0.667, the old-30% look) to avoid a migraine-like peak. The
  whole HEALTH range is remapped onto 0→cap. Blur 2.5px, hue 40°, contrast floor 0.65 (all scaled
  by the capped severity); plasma colonies grow denser + more saturated as severity rises, with a
  toned-down heartbeat throb.
- Deck is **discrete events on one rate curve**: per ~30Hz tick, expected events =
  `SPAWN_K` (4.5) × severity, spawned via a budget loop so MULTIPLE events fire per tick once
  severity is high. Severity is a steep convex ramp of damage taken (`DECK_CHAOS_EXP` 4.0, no
  threshold): events/sec ≈ 30·3.5·(1−deck/max)^4 → ~1 per ~95s at 90% deck ("did I see
  that?"), ~1 per ~2.4s at 75%, ~7/sec at 50%, ~33/sec at 25%, multiple-per-tick (unusable)
  below ~20%. **The two feel knobs: `SPAWN_K` = peak rate, `DECK_CHAOS_EXP` = how back-loaded
  toward empty (higher = sparser top, more dramatic descent).**
- Each event (weighted): ~50% a single-node shake (independent duration → overlapping shakes
  desync into a sequence; a 2nd node at high severity), else a transient glitch — blink /
  id-scramble / glyph-swap / undiscover / phantom node / phantom edge. Hold durations vary by
  type with a 0.6–1.7× shuffle so they overlap organically; shakes are a fixed **1–2px**
  axis-locked tremor (h or v). No continuous background motion — graph is still between events.
- NOTE: rate assumes the real-HW ~30Hz tick; the Playwright/headless harness ticks ~3Hz, so
  measured rates there are ~10× too low — judge the feel in a real browser.
- Deck glitches (severity-scaled spawn rate, ~33ms tick): per-node — blink-out / id-scramble /
  glyph-swap / undiscover-flip ("???" + glyph cleared); structural (rarer) — phantom "???" node
  or phantom edge between real nodes. Global `setBloomIntensity` is left for the base CRT look.
- All in `graph-degradation-params.js` + the module's glitch constants; tune in the preview.

## Verification

- `make check` — 847 tests, 0 fail, lint clean.
- **Preview harness** (served worktree): overlay canvas injects into `#graph-container`;
  at full health it's a true no-op (`#cy` filter falls back to CSS bloom, draw skipped);
  dragging HEALTH to 15 → `#cy` filter becomes
  `url("#starnet-bloom") blur(1.96px) hue-rotate(31.4deg) contrast(0.725)` and organic
  turbulence renders; dragging DECK down adds tear/chromatic-static; both stack. Screenshot
  captured (organic magenta turbulence + digital tearing over the node gallery).
- **In-game (`index.html`)**: canvas injects exactly once (idempotent, no double-inject),
  real Cytoscape graph present, full-health no-op, **zero console/shader errors**.
- Added `cheat hurt <health|deck> <amount>` / `cheat heal <health|deck> [amount]` (in
  `js/core/cheats.js`, tested in `cheats.test.js`) so the overlays can be triggered on demand
  in-game without grinding a damaging-ICE run — each emits `STATE_CHANGED` so the overlay + HUD
  refresh live, and routes through the orchestration wrappers so depletion still ends the run.
- Gameplay damage IS wired and tested end-to-end: `sentinel` (−health) / `spike` (−deck) ICE
  fire `damage-health`/`damage-deck` atoms on detection (`ice/dispatch.test.js`), but only spawn
  at **threat B+** (`pickIceTypeId`) — so on lower-threat runs the player never meets damage and
  never sees these overlays. Whether to widen that exposure is a deferred design call.
- A full in-game depletion playthrough (using the new cheats or a B+ run) is still the one thing
  to eyeball in real play; the visual path is identical to the preview and code-reviewed.

## Relates to

- **Expands #134** (was "plasma driven by health" → two-layer health+deck system).
- **Supersedes** the `setBloomIntensity` "bloom on deck injury" seam — deck corruption is
  better fiction. Bloom left purely for the base CRT look.
- **Atmospheric MVP precursor** to #102 (per-subsystem deck glitches) and #103 (per-wound
  health debuffs) — whole-panel-on-the-integer-pool now; per-subsystem later.
- The threshold/maxima are the **#141** tuning knobs.

## Deck approach history (three iterations)

The deck-damage visual went through three directions before landing:

1. **WebGL overlay corruption** (original v1) — tear/chromatic static drawn *over* the graph.
   Cheap, but reads as a filter on a screenshot; didn't feel like the graph itself failing.
2. **SVG `feDisplacementMap` warp of the real `#cy`** (tried on another machine) — distorted
   the actual graph, but an *animated* SVG displacement filter on the live graph layer is a
   performance dead end: the browser CPU-rasterizes the filtered layer and re-runs the whole
   filter graph (incl. `feTurbulence` regeneration on seed change) every frame. Unsalvageable.
3. **Cytoscape model perturbation** (shipped) — jitter node *render* positions + opacity via
   Cytoscape's own API (`node.position()` / `node.style()` in `cy.batch()`), throttled ~30Hz.
   The graph genuinely convulses as itself — edges whip to follow, labels track — which is the
   contextual feel options 1/2 lacked. Cheap at our node counts (a few dozen): it's ordinary
   vector re-rendering, not a per-pixel filter. **Render-only**: cy's laid-out positions aren't
   saved state (the game model in `state`/`nodeGraph` is untouched; load re-lays-out), so it
   can't corrupt a save. Base positions are snapshotted while degraded and restored on heal/stop
   purely for clean visual recovery.

**Perf caveat:** the win couldn't be measured in the Playwright/headless harness — it has no GPU
and floors *everything* (baseline included) at ~3fps. Verified functionally there (jitter,
edges-follow, opacity flicker, clean heal-restore, no errors); real-hardware fps confirmation is
on Les. The known O(pixels)-per-frame culprit (the SVG filter) is gone.

**Preview harness:** added a small edge-connected mini-network (`net-gw/rt/ws/fs/ids`) so the deck
chaos is legible — node jitter alone is undersold without edges whipping to follow.
