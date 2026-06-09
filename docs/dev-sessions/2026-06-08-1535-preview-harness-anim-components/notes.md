## Retrospective

### Recap
Combined session for #116 (modularize node-graph overlay animations) and #118 (card
gallery in the preview harness). Shipped as PR #120 (squashed to one commit):

- Six per-action overlay effects → light-DOM Lit `NodeOverlay` components, each owning
  its SVG skeleton + per-frame imperative math; loop effects (loot/exploit) own their
  RAF/interval as instance fields.
- A pure `registry.js` is the single source — dispatch, pan/zoom + node-drag re-anchor,
  RUN_STARTED reset, and the preview all iterate it.
- `graph.js` made overlay-agnostic via an `onViewport(fn)` hook.
- Card gallery: real `<starnet-hand>` fed a deterministic rarity×quality×wear×match matrix.
- Plus three follow-ons added mid-session: overlays follow node drag; ACTION_FEEDBACK
  dispatch extracted into a pure tested function; selection reticle migrated to a
  `<selection-reticle>` component (eliminating the last duplicated SVG).

### Scope drift
- Spec planned 4 phases; shipped 7 + 2 review fixes. The 3 follow-ons came from Les asking
  "any further improvements while we're in here" after the core landed.
- **The spec undershot #116's own stated goal.** #116 said "kill duplicated SVG markup,"
  but the spec deliberately carved the selection reticle *out* (left it in graph.js). The
  reticle was in fact duplicated across the HTML files too — so "no duplicated SVG" wasn't
  truly delivered until Phase 7 pulled it back in. Lesson: when an issue names a property
  ("no duplication"), inventory *every* instance at spec time before scoping any out.
- Color-as-agency question surfaced late → correctly deferred to BACKLOG.md, kept out of
  the parity PR.

### Surprises
- **No jsdom** in the test setup → the overlay components / Lit elements can't be imported
  in node tests (`HTMLElement` undefined). This shaped the entire testing strategy: test the
  *pure* parts (registry, dispatch state machine, card matrix), verify the DOM rendering
  manually via Playwright.
- **`playground.html` is a third `visual-renderer` entrypoint** — Lit-free by design (no
  importmap, plain `<div>` stubs for components, old static effect SVGs). Not in the spec's
  mental model; only surfaced via Copilot review (see Misses).
- The new overlay files type-checked clean under tsc even though they touch Cytoscape —
  `getCy()` returns `any` (graph.js is `@ts-nocheck`/lint-excluded), so the `@ts-nocheck`
  fallback the plan budgeted for wasn't needed.

### Workflow friction
- Low. The two documentarian research agents paid off big — the file:line map made the
  verbatim effect ports low-risk and fast.
- Per-phase `plan.md` checkboxes worked well as the live tracker + resume mechanism; didn't
  need the Task tools.
- Minor: the Playwright MCP screenshot output dir was pinned to a *different* worktree
  (`research-pentest-action`); had to fall back to the default temp dir.

### Misses
- **The big one: entrypoint/importer inventory.** I verified index.html + preview.html
  thoroughly but never asked "what *else* imports `visual-renderer` — the module whose
  dependency graph I just changed?" Adding a bare-specifier `"lit"` import (transitively, via
  the overlay components) broke `playground.html` at module load. Copilot caught it; the
  branch self-review should have. **Next time: when a shared module gains a new import
  (especially a bare specifier needing an importmap), grep all its importers and all HTML
  entrypoints — not just the pages you're actively working in.**
- Minor: the `cardGalleryGroups()` module-global `_id` counter made it non-deterministic
  across repeated calls despite being documented "deterministic/pure" — also a Copilot catch.
  Cheap fix (call-local counter), but the doc claim should have prompted the determinism
  check when writing it.

### Memory candidates
- **Three `visual-renderer` entrypoints** (index/preview/playground), each needing the lit
  importmap + `#overlay-layer`. Genuine gotcha — caused the one regression this session.

### Skill candidates
- **dev-session self-review (pr.md / execute.md): add an "importer/entrypoint inventory"
  check.** For any shared module whose imports changed, grep its importers and the project's
  HTML entrypoints before claiming verification. Generalizable; would have caught the
  playground regression.

### User retro answers (Les)
- **Scope growth:** OK as an *audible* (call it situationally when the context is hot), but
  NOT as a rule/default. Don't habitually expand scope; it's fine to offer/take when it fits.
- **Combined-issue PR:** #116 + #118 in one PR read clean — combining issues that share a
  surface is fine, not something to avoid.
