# Preview Harness: Modular Overlay Animations + Lit Component Gallery

**Goal:** Make adding a node-graph overlay effect a one-file change (Lit component + registry entry, no duplicated markup or scattered module globals), and give the preview harness a card/hand component gallery so visual design can be tuned in isolation.

**Source:** Issues #116 (modularize overlay animations) + #118 (mount Lit components in preview). Combined because both reshape `preview.html` / `js/ui/preview.js`.

## Current state

See `research.md` for full detail. Load-bearing facts:

- **Six overlay effects** live in `js/ui/graph.js` as parallel `current*NodeId`/`current*Progress` module globals + `sync*`/`clear*`/`_render*` quartets: probe (864-915), mine (920-982), read-sectors (984-1063), loot-rings (1066-1163, RAF+interval loop), exploit-brackets (1172-1293, brackets + interval zaps), ice-detect (1295-1351, CCW, timer-driven sibling).
- **Contract today:** `sync*(nodeId, progress∈[0,1])` updates module state + calls `_render*()`, which positions the SVG container from `cy.getElementById(id).renderedPosition()`/`renderedWidth()` and imperatively `setAttribute`s on child SVG elements by id. `clear*()` sets `opacity:0` + resets state.
- **Dispatch** in `js/ui/visual-renderer.js`: single `E.ACTION_FEEDBACK` handler (72-124) with per-action tracker vars (66-70) and a hand-written `A.*`→effect switch; `RUN_STARTED` reset (131-136) clears all + nulls trackers. ICE detect is driven separately by `E.TIMERS_UPDATED` (145-158), cleared on ICE/navigation events (138-143).
- **`onPanZoom`** (graph.js:188-206) unconditionally calls all six `_render*()` + `syncReticle()` + `_repositionIceOverlay()` so overlays track nodes during pan/zoom.
- **SVG skeleton markup is duplicated verbatim** in `index.html:29-90` and `preview.html:148-209`.
- **`preview.js` `EFFECTS` array** (132-169) is a hand-maintained `[{name,nodeId,sync,clear}]` list; controls per effect scrub progress via `effect.sync(nodeId, t)`. The progress-scrub contract (`sync(nodeId, t∈[0,1])`) is what the harness relies on.
- **Lit setup:** light-DOM components (`starnet-element.js` — `createRenderRoot(){return this}`). `index.html` has an importmap mapping `lit`→`./dist/lit.js` (8-13) + module scripts (119-130). **`preview.html` has neither** — only `dist/vendor.js` + `preview.js` (331-332), and `preview.js` imports no components.
- **Card components:** `<starnet-hand>` (props: `cards`, `selectedNode`, `executingCardId`, `execProgress`, `isSelecting`, `selectedNodeId`; match logic 62-68 needs `selectedNode.probed` + `.vulnerabilities`) renders via `exploitCardBody(card, indexLabel?)` (`exploit-card-view.js:12-32`). `ExploitCard` typedef at `js/core/types.js:49-59`. `generateExploit(rarity)` at `js/core/exploits.js:237-251`.

## Desired end state

### #116 — Modular overlays

- A base class `NodeOverlay extends StarnetElement` (light-DOM Lit) providing the shared lifecycle: positioning a node-anchored SVG from the Cytoscape node, show/hide, and the `sync(nodeId, progress)` / `clear()` / `reposition()` contract. Async-render-safe: `sync()` before first render no-ops gracefully (query lazily / guard on render-complete).
- **Six subclasses**, one file each (e.g. `js/ui/overlays/probe-sweep.js`): `render()` returns the static SVG skeleton (the *single source* of that effect's markup); an `update(progress)` (or equivalent) does the imperative per-frame `setAttribute` geometry that exists today. Loop effects (loot-rings, exploit-brackets) own their RAF/interval handles as **instance fields**, started/stopped in `sync`/`clear` — no module globals.
- **A registry** mapping action id → overlay instance (and the ICE-detect overlay registered for its timer-driven path). `visual-renderer` dispatch, `onPanZoom` re-render, and `RUN_STARTED` reset all **iterate the registry** instead of hardcoded switches/lists. Adding an effect = new subclass file + one registry entry.
- **No duplicated SVG markup.** `index.html` and `preview.html` each host an empty overlay layer (e.g. `<div class="overlay-layer">`) into which the overlay custom elements are placed; the skeleton lives only in each component's `render()`.
- **Preview auto-discovers** effects from the registry — the hand-maintained `EFFECTS` array is gone; demo nodes + scrub controls are generated from the registry.
- Behavior parity: every effect looks and animates as it does today (probe CW pie, mine Lissajous lock-on, read-sectors fill, loot rings, exploit brackets+zaps, ICE CCW sweep), including pan/zoom tracking, RUN_STARTED clearing, and the ICE-detect "snap to full then clear" completion.

### #118 — Card gallery in preview

- A **component gallery section** in `preview.html` that mounts real `<starnet-hand>` (and the `exploitCardBody` rendering it uses) with a **fixed, deterministic matrix** of mock `ExploitCard`s plus a mock `selectedNode`, spanning: rarity {common, uncommon, rare} × quality {low, mid, high} × wear {fresh, worn, disclosed} × match {match, no-match}. All states visible at once, no in-game grinding, no RNG.
- `preview.html` gains the Lit importmap + loads the needed component modules (same enabling change the overlay components require).
- The gallery lives alongside the existing effect/shape/alert sections — one design surface.
- Structured so adding more components later (HUD, mission pane, …) is a small additive step, but only cards/hand ship this session.

## Design decisions

- **Decision:** Overlays are light-DOM Lit components (`NodeOverlay extends StarnetElement`), one per effect.
  - **Why:** The whole UI is already light-DOM Lit; `render()` becomes the single source of the SVG skeleton (kills the index/preview duplication), and instance fields replace error-prone module globals (the `cy` TDZ class of bug). Per-frame work stays imperative (`setAttribute` against own children) to preserve the proven math and avoid 60fps Lit re-renders.
  - **Rejected:** Plain-JS self-injecting classes — lighter but a parallel pattern divorced from the rest of the UI; also rejected full reactive Lit re-render per frame (unnecessary churn for tiny SVGs, awkward for the loop effects).

- **Decision:** A registry (action id → overlay instance) is the single source for dispatch, pan/zoom re-render, RUN_STARTED reset, and preview discovery.
  - **Why:** Eliminates the four parallel hand-maintained lists/switches that each new effect had to touch; "adding an effect = one subclass + one registry entry."
  - **Rejected:** Keeping the explicit switch — that's the boilerplate #116 exists to remove.

- **Decision:** ICE-detect is a `NodeOverlay` subclass like the rest, but stays driven by its `E.TIMERS_UPDATED` path (not folded into `ACTION_FEEDBACK`).
  - **Why:** ICE detection is adversarial (CCW, timer-driven, distinct clear triggers) — it shares the overlay *contract* but not the action-feedback *driver*. Forcing it into ACTION_FEEDBACK would distort both.
  - **Rejected:** A separate sibling base class — unnecessary; the `sync/clear/reposition` contract fits it fine, only the caller differs.

- **Decision:** Migrate all six effects in this session (big-bang), one combined PR.
  - **Why:** A half-migrated registry (some effects on the registry, some on the old path) is a worse intermediate state than either end; the boilerplate removal is the whole point. Both issues touch `preview.html`/`preview.js`, so one PR avoids conflicting churn.
  - **Rejected:** Core-four-first / two stacked PRs (per Les) — kept as a fallback only if the refactor destabilizes.

- **Decision:** Card gallery uses a hand-authored deterministic matrix, cards/hand only.
  - **Why:** The point (supporting #117) is to see the full state space at a glance and tune visuals against it; RNG draws don't guarantee edge-state coverage. Cards first per #118; structure for later components without building them now.
  - **Rejected:** Seeded `generateExploit()` (coverage not guaranteed); mounting HUD/mission/etc. now (scope creep).

- **Decision:** Overlay components live in a new `js/ui/overlays/` directory (base + six subclasses + registry); the gallery mock data + wiring lives in `preview.js` (or a small `js/ui/preview-gallery.js` helper).
  - **Why:** Keeps the overlay family cohesive and separate from the general-purpose `components/` (which are game-UI panels), and keeps preview-only mock data out of production modules.
  - **Rejected:** Putting overlays under `components/` (mixes node-anchored effects with UI panels); inlining mock cards into a shipped module.

## Patterns to follow

- **Light-DOM Lit component:** `js/ui/components/starnet-element.js:1-8` — extend `StarnetElement`, `static properties`, `render()` returns `html`/`svg`, `customElements.define()` at file end.
- **Existing imperative render math (preserve verbatim):** probe `js/ui/graph.js:877-915`, mine `941-982`, read `1010-1063`, loot `1096-1163`, exploit `1261-1293` + `_tickZaps` `1197-1241`, ice `1317-1351`. Node anchoring via `node.renderedPosition()` / `renderedWidth()` (e.g. 884-892).
- **Dispatch to refactor:** `js/ui/visual-renderer.js:66-158` (ACTION_FEEDBACK handler, trackers, RUN_STARTED, ICE timer path).
- **Pan/zoom hook:** `js/ui/graph.js:188-206`.
- **Preview effect driver to replace:** `js/ui/preview.js:108-201` (`animateEffect`, `EFFECTS`, control wiring); demo nodes `23-31`.
- **SVG skeletons (de-duplicate from):** `index.html:29-90`, `preview.html:148-209`.
- **Card components:** `js/ui/components/starnet-hand.js:8-95` (props + match logic 62-68), `exploit-card-view.js:12-32` (`exploitCardBody`). `ExploitCard` `js/core/types.js:49-59`. Mock cards mirror `generateExploit` output shape (`js/core/exploits.js:237-251`); a mock `selectedNode` needs `{probed:true, vulnerabilities:[{id, patched, hidden}]}` for match testing.
- **Importmap + module loading:** copy `index.html:8-13` (importmap) + the component `<script type=module>` pattern (119-130) into `preview.html`.

## What we're NOT doing

- **Not** changing any effect's visual appearance, timing, or animation math — this is a structural refactor with behavior parity, not a redesign.
- **Not** revisiting SVG-vs-canvas for any effect (open question in #116 — deferred).
- **Not** folding ICE-detect into the ACTION_FEEDBACK dispatch.
- **Not** mounting any components beyond `<starnet-hand>` / card view (no HUD, mission pane, node panel, store, end screen this session) — #118 "beyond cards" is explicitly deferred.
- **Not** touching `#117` (exploit legibility: vuln glyphs, quality color, etc.) — this session builds the *surface* to tune those, not the changes themselves.
- **Not** adding component-gallery coverage to automated tests beyond what behavior-parity requires (gallery is a manual design surface).
- **Not** changing the action dispatch event contract (`E.ACTION_FEEDBACK` payload shape, action ids) — only how the renderer consumes it.

## Open questions

- **Async first-render timing for overlays.** Lit renders asynchronously, so an overlay's SVG children may not exist when `sync()` is first called. **Default:** guard the imperative update — query children lazily and no-op (or buffer the latest progress and apply on `firstUpdated`). Confirm during execute that no effect flickers on first trigger. Does not block planning.
- **Overlay-layer hosting in preview vs game.** Whether overlay elements are placed declaratively in the HTML overlay layer or instantiated from the registry by JS. **Default:** registry instantiates and appends them into the `.overlay-layer` div on init (so the registry stays the single source and preview/game stay symmetric). Does not block planning.
