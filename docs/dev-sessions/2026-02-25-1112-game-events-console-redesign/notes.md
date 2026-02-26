# Notes: Game Events Console Redesign

_Running notes and final retrospective._

---

## Pre-execution notes

### TypeScript / type safety

Discussed whether to migrate to TypeScript before this session. Decision: defer.

The event system being built here is a textbook case for TypeScript — typed event payloads with discriminated unions, complex state shapes shared across modules. The codebase is approaching the complexity threshold where type drift is a real risk.

**Why deferred:** adding TypeScript simultaneously with a major architectural migration is too much change at once. Also requires committing to a build tool (esbuild/vite/tsc), which changes the zero-build dev workflow.

**Intermediate option noted:** JSDoc `@ts-check` gives VS Code type checking with no build step. Define types in `js/types.js`, add `// @ts-check` to each file. Type definitions would be reusable if/when migrating to full TS later.

**Recommendation for next session:** consider a dedicated cleanup/refactor session — TypeScript migration (or JSDoc types), module size review (`main.js` and `state.js` are getting large), general housekeeping before layering more game systems on top.

---

## Design idea: log verbosity as a game mechanic

Raised during playtesting. Rather than log filtering being a pure UI convenience, what if it's diegetic — something the player earns or installs?

The framing: the decker's console readout is a live feed of network telemetry. What you can *see* depends on what tools and footholds you have established. Possible examples:

- **ICE movement logs** — requires a "traffic analysis daemon" installed on a compromised node. Without it, ICE movements are invisible (you only find out when the dwell timer fires). With it, you see ICE's path through visible territory.
- **Alert propagation logs** — requires subverting or compromising an IDS. Once you own the IDS, you see alert events as they propagate to monitors.
- **Deep network telemetry** — a high-tier readable node might contain network maps, revealing hidden nodes or edges without needing to traverse to them.

This reframes "log verbosity" as information asymmetry, which is both thematically appropriate (decker earning visibility into a system) and mechanically interesting (tradeoffs between what you spend exploits on vs. what you can see). Pairs well with the idea of ICE tracing paths through your network — if ICE can read your movements, your tools let you read its.

Worth designing properly in a future session once the core loop is more stable.

---

## Future flavor: exploit card IDs

Currently exploit cards get auto-incrementing IDs (`exploit-1`, `exploit-2`, ...) — a global counter that carries across runs. These are stable within a run and work fine for LLM playtesting scripts (use the ID directly rather than the positional index, which shifts with sort order).

For a future flavor/polish pass: consider giving cards more legible IDs derived from their vulnerability type and a short suffix — e.g. `ssh-1`, `fw-2`, `privesc-3`. Would make the log and console interactions feel more diegetic and be easier to reference at a glance.

---

## Retrospective

This session ran in two distinct phases across multiple context windows.

### Phase 1: Event Bus Architecture Migration

The core goal of this phase was an 8-step architectural migration: introduce a typed pub/sub event system (`events.js`), decouple all log rendering from state mutations, extract rendering to `visual-renderer.js` and `log-renderer.js`, and add LLM-legible console commands (`help`, `status <noun>`, `log [n]`). All 8 steps were completed. The game is now event-driven — `state.js` and `ice.js` emit typed events; log-renderer and visual-renderer subscribe independently. The console can observe full game state without the visual graph.

Commits:
- `e98a547` — Fix: edge fog-of-war, initial zoom, single-node viewport
- `10c84ba` — Polish: card sort, console warnings, log height

(The primary migration commits precede this conversation; these are the playtesting follow-up fixes.)

### Phase 2: DRY Playtest Harness + Bug Cascade

The second phase addressed technical debt that had accumulated in the playtest harness and then fixed a cascade of bugs exposed by the refactor.

**Refactor: DRY Playtest Harness**

The playtest harness (`scripts/playtest.js`) had grown to ~650 lines by duplicating most of `js/console.js`'s command dispatch logic. The root problem was that `console.js`'s `dispatch()` used `document.dispatchEvent(new CustomEvent(...))` — DOM-bound, unusable in Node.js.

Changes:
1. **Created `js/log.js`** — pure log buffer with no DOM dependency. `LOG_ENTRY` events via the events bus serve as the shared interface.
2. **Updated `js/console.js`** — `dispatch()` changed from DOM to `emitEvent()` from the events bus, enabling Node.js reuse.
3. **Updated `js/main.js`** — all 15 `document.addEventListener("starnet:action:xxx")` migrated to `on()` from events bus.
4. **Updated `js/visual-renderer.js`** — all 5 `document.dispatchEvent(new CustomEvent(...))` migrated to `emitEvent()`.
5. **Slimmed `scripts/playtest.js`** from ~650 → ~185 lines — now imports `runCommand` from `console.js`, adds 11 headless action handlers.

**Refactor: cancelIceDwell moved to ice.js**

`cancelIceDwell()` logic lived in `main.js` and `playtest.js` but belonged in `ice.js`. Moved two module-level `on()` calls into `ice.js`, with a guard to avoid cancelling the timer when re-selecting the same node.

**Bug: ICE detection timer not appearing in sidebar**

Root cause: `moveIceAttention()` fires `STATE_CHANGED` before `checkIceDetection()` schedules the dwell timer, so the sidebar rendered with no timer entry. Fixed by adding `emit()` after scheduling the timer.

**Bug: ICE detection timer countdown not updating**

Root cause: `STATE_CHANGED` only fires on game events, not on every tick. Fixed by emitting `STATE_CHANGED` every 100ms when visible timers are active.

**Bug: ICE position animation re-triggered every tick**

The 400ms position animate call was being invoked on every tick once `STATE_CHANGED` fired at 10Hz. Fixed by guarding `iceNode.animate()` with the existing `moved` flag.

**Bug: Exploit cards flickering / unclickable during ICE detection countdown**

Full sidebar and hand pane re-renders every 100ms (via `STATE_CHANGED`) destroyed and recreated click listeners faster than a click could complete. Fixed by introducing `E.TIMERS_UPDATED` — tick loop emits this instead of `STATE_CHANGED`. The `TIMERS_UPDATED` handler does only targeted in-place DOM updates (ICE timer slot, trace countdown text).

**Fix: Console status commands revealed ICE location prematurely**

`status full`, `status summary`, `status ice`, and `status node` all unconditionally printed ICE's position, including when ICE was on unexplored nodes. The graph renderer already gated ICE visibility on `compromised`/`owned` nodes. Extracted `isIceVisible(ice, nodes)` into `state.js` as the single source of truth; both `graph.js` and `console.js` now use it.

Commits (Phase 2):
- `9255f73` — Refactor: DRY playtest harness via shared log.js + events bus action dispatch
- `3357f8b` — Refactor: cancelIceDwell called internally by ice.js on selection events
- `9383536` — Fix: re-selecting same node must not reset ICE dwell timer
- `00fb2b6` — Fix: ICE detection timer not appearing in sidebar
- `1b130d6` — Fix: ICE detection timer countdown not updating in sidebar
- `80845e0` — Fix: ICE position animation re-triggered on every tick during countdown
- `7e5a02d` — Fix: exploit cards flickering/unclickable during ICE detection countdown
- `621db83` — Fix: console status commands revealed ICE location before player could see it

---

### Divergences

Phase 1 ran significantly over its original scope — playtesting uncovered a cluster of bugs and UX rough edges. Phase 2 was unplanned entirely; it grew from the observation that the harness was duplicating too much code.

### Technical Insights

- **DOM decoupling is foundational.** The entire harness duplication problem stemmed from `console.js` using `document.dispatchEvent`. Migrating to the internal events bus unlocked reuse everywhere. Design rule: never use the DOM event bus for internal game events.
- **"Emit before schedule" ordering bug class.** Whenever you call `emit()` and then schedule a timer in the same function, the sidebar will render before the timer exists. Pattern: schedule first, then emit.
- **Render-on-tick has side effects.** Increasing render frequency exposed the animation re-trigger bug and the click-listener destruction bug. Any stateful visual effect that runs on every `STATE_CHANGED` needs a "has the underlying data changed?" guard.
- **Separate timer renders from game-state renders.** The `TIMERS_UPDATED` event pattern (lightweight in-place DOM update, no full re-render) is the right model for any display that needs to update at tick frequency.
- **Visibility rules must be shared.** When graph rendering and console output apply different visibility rules, information leaks result. The `isIceVisible()` helper in `state.js` is the canonical pattern: one function, imported by both.
- **Cytoscape shadow properties** (`shadow-blur`, `shadow-opacity`, etc.) are NOT valid in Cytoscape's stylesheet. Visual alert effects must use border/background/opacity animations instead.
- **Single-node fit**: `cy.fit()` on a single node zooms in excessively. Must special-case: `cy.zoom(1.5); cy.center(node)`.
- **`fromConsole` flag plumbing.** `dispatch()` in `console.js` injects `fromConsole: true`. Action handlers use this to suppress echoing the command to the log (console already showed it). Easy to forget when adding new handlers.

### Efficiency

Phase 1's 8-step migration ran cleanly — each step was well-scoped and left the game functional. Phase 2's refactor core was clean; the bug cascade that followed was slower, requiring multiple browser test-observe-fix cycles. The ICE timer bugs required understanding timing across three layers (state mutation, event emission, timer scheduling).

### Cost

Not tracked.

### Conversation turns

Approximately 45–50 total exchanges across all context windows for this session.

### Process Improvements

- **Scaffold the session directory at start.** Even for "quick refactor" sessions, a 2-line spec gives the retro context.
- **Document the "schedule before emit" ordering rule** — this bit us once and will bite again.
- **After increasing render frequency, always audit visual effects** for "fires on every render" bugs.
- **Timebox playtesting** within a feature session, or schedule a separate polish session.
- **File bugs, don't fix them mid-session.** When playtesting reveals bugs outside the session spec, note them and defer.
