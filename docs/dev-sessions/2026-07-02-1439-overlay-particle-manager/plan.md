# Overlay Particle Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render multiple node-overlay animations at once (every probing node shows its sweep) via a reusable, pooled overlay manager — fixing the singleton ceiling that let only one probe animate during a SWEEP fan-out.

**Architecture:** A general `OverlayManager` pools/reuses overlay elements per type and drives them keyed by `(action, nodeId)` from `ACTION_FEEDBACK`. Only **probe** is registered with it this session (smallest blast radius); the other single-node action overlays stay on the existing `dispatchActionFeedback` singleton path unchanged. A random 0–150ms view-layer start jitter destaggers a batch of simultaneous probe starts. Per-element RAF loops are kept (lab-confirmed fine at 24 concurrent).

**Tech Stack:** Vanilla JS ES modules, JSDoc `@ts-check`, `node --test`, Lit custom elements (`NodeOverlay`), Cytoscape for anchoring. `make lint` / `make test` / `make check` / `make bundle-vendor`.

## Global Constraints

- **No concurrency cap** — animate every probing node 1:1 with state (lab-confirmed: 24 concurrent read fine). (spec §Decision 4)
- **Keep per-element RAF loops** — NO shared-RAF rewrite (lab-confirmed framerate held). (spec §Decision 3)
- **Random 0–150ms start jitter is view-layer only** — probes still start on their real tick; a non-seeded `Math.random()` for the jitter is acceptable (no game-state timing change, no determinism concern). (spec §Decision 5)
- **Glow/bloom "one owner per layer"** — pooled elements live under `#overlay-layer` and inherit `#overlay-bloom`; NONE carries its own `filter="url(...)"`. (spec §Decision 6; CLAUDE.md)
- **Do NOT change single-node overlays' behavior/appearance** (exploit/dump/fetch/mine/lie-low, reticle, ice) — they stay on the existing `dispatchActionFeedback` path. Only probe migrates. (spec §What we're NOT doing)
- **Anchor on the Cytoscape element id.** `ACTION_FEEDBACK.nodeId` is `attrs.label` from the operator path but `n.id` from ctx paths; they match in practice (`label` defaults to `id`). Key the manager on `nodeId` as received. (spec §Decision 7)
- Vanilla JS + JSDoc `@ts-check`; `make check` green at each task's end; commit per task.

---

### Task 1: `OverlayManager` — pooled, multi-node, jittered

**Files:**
- Create: `js/ui/overlays/manager.js`
- Test: `tests/overlay-manager.test.js`

**Interfaces (shipped — "option B" name-keyed API; re-integrated with dispatch.js per spec addendum):**
- Produces:
  - `class OverlayManager` with constructor `(nameTags: Map<overlayName,tag>, deps?: { createOverlay?, random?, setTimer?, clearTimer? })`. `nameTags` maps a resolved overlay NAME → overlay tag name (e.g. `Map([["probe-sweep","probe-sweep-overlay"]])`). `deps` are injectable for tests (default to real `document.createElement` / `Math.random` / `setTimeout` / `clearTimeout`). The manager is keyed by overlay NAME (not action id); pooled routing by action lives in `dispatch.js` which resolves the overlay name at "start" and calls into the manager.
  - `mount(layer)` — set the DOM container pooled elements attach to.
  - `handles(overlayName): boolean` — whether this manager owns the overlay name.
  - `start(overlayName, nodeId)` — acquire an element from the pool and begin jitter-delayed animation.
  - `progress(overlayName, nodeId, progress)` — update animation progress (buffered until after jitter).
  - `end(overlayName, nodeId)` — complete or cancel; release element back to pool.
  - `repositionAll()` — reposition every active (revealed) overlay.
  - `clearAll()` — release every active overlay (call on RUN_STARTED).
  - `activeCount(overlayName): number` — count of in-flight overlays for a name (test/inspection).
  - Exported const `JITTER_MAX_MS = 150`.
- Each overlay element is expected to implement the `NodeOverlay` contract: `sync(nodeId, progress)`, `clear()`, `reposition()`.

- [ ] **Step 1: Write the failing test**

Create `tests/overlay-manager.test.js`:

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OverlayManager, JITTER_MAX_MS } from "../js/ui/overlays/manager.js";

/** A fake overlay element recording sync/clear/reposition calls. */
function fakeOverlay(tag) {
  return { tag, synced: [], cleared: 0, repositioned: 0, nodeId: null, progress: null,
    sync(id, p) { this.nodeId = id; this.progress = p; this.synced.push([id, p]); },
    clear() { this.cleared++; this.nodeId = null; },
    reposition() { this.repositioned++; } };
}
/** Manager wired with fakes: elements are fakeOverlays, timers fire immediately, random=0. */
function mkManager(tags = new Map([["probe", "probe-sweep-overlay"]])) {
  const created = [];
  const mgr = new OverlayManager(tags, {
    createOverlay: (tag) => { const el = fakeOverlay(tag); created.push(el); return el; },
    random: () => 0,                       // 0 jitter → immediate reveal
    setTimer: (fn) => { fn(); return 1; },  // synchronous timer
    clearTimer: () => {},
  });
  mgr.mount({ appendChild() {} });
  return { mgr, created };
}

describe("OverlayManager — multi-node keying", () => {
  it("N concurrent starts animate N independent overlays (no clobber)", () => {
    const { mgr, created } = mkManager();
    for (const id of ["a", "b", "c"]) mgr.handleFeedback({ nodeId: id, action: "probe", phase: "start", progress: 0 });
    assert.equal(mgr.activeCount("probe"), 3, "three overlays active");
    assert.equal(created.length, 3, "three distinct elements acquired");
  });

  it("progress routes to the matching node's overlay", () => {
    const { mgr, created } = mkManager();
    mgr.handleFeedback({ nodeId: "a", action: "probe", phase: "start", progress: 0 });
    mgr.handleFeedback({ nodeId: "b", action: "probe", phase: "start", progress: 0 });
    mgr.handleFeedback({ nodeId: "b", action: "probe", phase: "progress", progress: 0.5 });
    const b = created[1];
    assert.deepEqual(b.synced.at(-1), ["b", 0.5], "b overlay synced to 0.5");
    assert.notEqual(created[0].progress, 0.5, "a overlay untouched by b's progress");
  });

  it("complete releases only that node and returns the element to the pool for reuse", () => {
    const { mgr, created } = mkManager();
    mgr.handleFeedback({ nodeId: "a", action: "probe", phase: "start", progress: 0 });
    mgr.handleFeedback({ nodeId: "a", action: "probe", phase: "complete", progress: 1 });
    assert.equal(mgr.activeCount("probe"), 0, "a released");
    assert.ok(created[0].cleared >= 1, "element cleared on release");
    mgr.handleFeedback({ nodeId: "z", action: "probe", phase: "start", progress: 0 });
    assert.equal(created.length, 1, "pool reused the freed element (no new create)");
  });

  it("ignores actions it does not own", () => {
    const { mgr, created } = mkManager();
    mgr.handleFeedback({ nodeId: "a", action: "xploit", phase: "start", progress: 0 });
    assert.equal(mgr.activeCount("xploit"), 0);
    assert.equal(created.length, 0);
    assert.equal(mgr.handles("xploit"), false);
    assert.equal(mgr.handles("probe"), true);
  });

  it("clearAll releases everything; repositionAll repositions active overlays", () => {
    const { mgr, created } = mkManager();
    mgr.handleFeedback({ nodeId: "a", action: "probe", phase: "start", progress: 0 });
    mgr.handleFeedback({ nodeId: "b", action: "probe", phase: "start", progress: 0 });
    mgr.repositionAll();
    assert.ok(created[0].repositioned >= 1 && created[1].repositioned >= 1, "both repositioned");
    mgr.clearAll();
    assert.equal(mgr.activeCount("probe"), 0, "all released on clearAll");
  });
});

describe("OverlayManager — random start jitter (view-layer)", () => {
  it("defers the first sync until the jitter timer fires; buffers progress until then", () => {
    let fire = null; // capture the scheduled callback instead of firing it
    const created = [];
    const mgr = new OverlayManager(new Map([["probe", "probe-sweep-overlay"]]), {
      createOverlay: (tag) => { const el = fakeOverlay(tag); created.push(el); return el; },
      random: () => 1,                                  // max jitter
      setTimer: (fn, ms) => { fire = { fn, ms }; return 1; },
      clearTimer: () => {},
    });
    mgr.mount({ appendChild() {} });
    mgr.handleFeedback({ nodeId: "a", action: "probe", phase: "start", progress: 0 });
    assert.ok(fire && fire.ms <= JITTER_MAX_MS && fire.ms > 0, "a jitter delay in (0, 150] was scheduled");
    assert.equal(created[0].synced.length, 0, "not synced during the jitter window");
    mgr.handleFeedback({ nodeId: "a", action: "probe", phase: "progress", progress: 0.4 }); // buffered
    assert.equal(created[0].synced.length, 0, "progress buffered, still not synced");
    fire.fn(); // jitter elapses
    assert.deepEqual(created[0].synced.at(-1), ["a", 0.4], "on reveal, syncs the buffered progress");
  });

  it("cancel during the jitter window never shows the overlay and cancels the timer", () => {
    let cleared = 0;
    const created = [];
    const mgr = new OverlayManager(new Map([["probe", "probe-sweep-overlay"]]), {
      createOverlay: (tag) => { const el = fakeOverlay(tag); created.push(el); return el; },
      random: () => 1,
      setTimer: () => 42,
      clearTimer: (h) => { cleared = h; },
    });
    mgr.mount({ appendChild() {} });
    mgr.handleFeedback({ nodeId: "a", action: "probe", phase: "start", progress: 0 });
    mgr.handleFeedback({ nodeId: "a", action: "probe", phase: "cancel", progress: 0 });
    assert.equal(cleared, 42, "jitter timer cancelled");
    assert.equal(created[0].synced.length, 0, "overlay never synced (never shown)");
    assert.equal(mgr.activeCount("probe"), 0, "released");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/overlay-manager.test.js`
Expected: FAIL — `Cannot find module '../js/ui/overlays/manager.js'`.

- [ ] **Step 3: Implement `js/ui/overlays/manager.js`**

```js
// @ts-check
// OverlayManager — pools/reuses node-overlay elements and drives them keyed by (action, nodeId),
// so multiple nodes animate the same action at once (e.g. a SWEEP fan-out shows every probing node).
// General: any action registered in `actionTags` is rendered here; this session registers only probe.
// A random 0–150ms start jitter destaggers a batch of simultaneous starts (view-layer only).

/** @typedef {{ sync(nodeId: string, progress: number): void, clear(): void, reposition(): void }} OverlayLike */

export const JITTER_MAX_MS = 150;

export class OverlayManager {
  /**
   * @param {Map<string,string>} actionTags  action id → overlay tag name
   * @param {{ createOverlay?: (tag:string)=>OverlayLike, random?: ()=>number,
   *           setTimer?: (fn:()=>void, ms:number)=>any, clearTimer?: (h:any)=>void }} [deps]
   */
  constructor(actionTags, deps = {}) {
    this._tags = actionTags;
    this._create = deps.createOverlay ?? ((tag) => /** @type {any} */ (document.createElement(tag)));
    this._random = deps.random ?? Math.random;
    this._setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this._clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h));
    /** @type {Map<string, OverlayLike[]>} tag → free element pool */
    this._pools = new Map();
    /** @type {Map<string, Map<string, any>>} action → nodeId → entry */
    this._active = new Map();
    /** @type {any} */ this._layer = null;
  }

  /** @param {any} layer DOM container pooled elements attach to */
  mount(layer) { this._layer = layer; }

  /** @param {string} action */
  handles(action) { return this._tags.has(action); }

  /** @param {string} action */
  activeCount(action) { return this._active.get(action)?.size ?? 0; }

  /** @param {{ nodeId?: string, action: string, phase: string, progress?: number }} payload */
  handleFeedback({ nodeId, action, phase, progress }) {
    if (!nodeId || !this._tags.has(action)) return;
    if (phase === "start") {
      let byNode = this._active.get(action);
      if (!byNode) { byNode = new Map(); this._active.set(action, byNode); }
      if (byNode.has(nodeId)) return; // already animating this node
      const tag = /** @type {string} */ (this._tags.get(action));
      const el = this._acquire(tag);
      const entry = { el, tag, nodeId, revealed: false, pending: /** @type {number} */ (progress ?? 0), timer: null };
      // View-layer jitter: delay the first render by a random 0–JITTER_MAX_MS so a batch of
      // simultaneous starts (a sweep fan-out) doesn't flash in lockstep.
      entry.timer = this._setTimer(() => {
        entry.revealed = true; entry.timer = null;
        entry.el.sync(entry.nodeId, entry.pending);
      }, this._random() * JITTER_MAX_MS);
      byNode.set(nodeId, entry);
    } else if (phase === "progress") {
      const entry = this._active.get(action)?.get(nodeId);
      if (!entry) return;
      if (entry.revealed) entry.el.sync(nodeId, /** @type {number} */ (progress));
      else entry.pending = /** @type {number} */ (progress); // buffered until reveal
    } else if (phase === "complete" || phase === "cancel") {
      const byNode = this._active.get(action);
      const entry = byNode?.get(nodeId);
      if (!entry) return;
      if (entry.timer != null) this._clearTimer(entry.timer);
      this._release(entry.tag, entry.el);
      byNode.delete(nodeId);
    }
  }

  repositionAll() {
    for (const byNode of this._active.values())
      for (const entry of byNode.values())
        if (entry.revealed) entry.el.reposition();
  }

  clearAll() {
    for (const byNode of this._active.values())
      for (const entry of byNode.values()) {
        if (entry.timer != null) this._clearTimer(entry.timer);
        this._release(entry.tag, entry.el);
      }
    this._active.clear();
  }

  /** @param {string} tag @returns {OverlayLike} */
  _acquire(tag) {
    const free = this._pools.get(tag);
    if (free && free.length) return /** @type {OverlayLike} */ (free.pop());
    const el = this._create(tag);
    if (this._layer) this._layer.appendChild(el);
    return el;
  }

  /** @param {string} tag @param {OverlayLike} el */
  _release(tag, el) {
    el.clear();
    let free = this._pools.get(tag);
    if (!free) { free = []; this._pools.set(tag, free); }
    free.push(el);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/overlay-manager.test.js`
Expected: PASS (all cases, both describe blocks).

- [ ] **Step 5: Lint + commit**

Run: `make lint` — expect clean.
```bash
git add js/ui/overlays/manager.js tests/overlay-manager.test.js
git commit -m 'Overlay manager: pooled multi-node overlays + view-layer start jitter'
```

---

### Task 2: Route probe through the manager (mountOverlays + visual-renderer)

**Files:**
- Modify: `js/ui/overlays/index.js` (`mountOverlays` ~L23-32, `initializeGraphOverlays` ~L43-59)
- Modify: `js/ui/visual-renderer.js` (~L18 import, ~L91-93 wiring, ~L107-110 RUN_STARTED)
- Test: `tests/overlay-manager.test.js` (append an integration test)

**Interfaces:**
- Consumes: `OverlayManager` (Task 1); `OVERLAY_DESCRIPTORS` (`registry.js`); `A.PROBE` (`action-ids.js`); `onViewport` (`graph.js`).
- Produces: `mountOverlays(container)` now returns `{ byKey, byAction, manager }` where `manager` is an `OverlayManager` owning `A.PROBE` (mounted to `container`), and `byAction` **excludes** probe (probe is no longer a singleton). `initializeGraphOverlays` repositions the manager on viewport. `visual-renderer` routes probe `ACTION_FEEDBACK` to the manager and everything else to the existing `dispatchActionFeedback`; RUN_STARTED clears the manager too.

- [ ] **Step 1: Write the failing integration test**

Append to `tests/overlay-manager.test.js`:

```js
import { mountOverlays } from "../js/ui/overlays/index.js";
import { A } from "../js/core/action-ids.js";

describe("mountOverlays — probe is managed, others stay singletons", () => {
  it("returns a manager owning probe, and byAction excludes probe", () => {
    // jsdom-free: mountOverlays uses document.createElement; guard with a minimal stub if needed.
    const fakeLayer = { appendChild() {} };
    const { byAction, manager } = mountOverlays(fakeLayer);
    assert.ok(manager, "a manager is returned");
    assert.equal(manager.handles(A.PROBE), true, "manager owns probe");
    assert.equal(byAction.has(A.PROBE), false, "probe removed from the singleton byAction map");
    assert.ok(byAction.has(A.XPLOIT), "other actions still singletons in byAction");
  });
});
```

(If `mountOverlays` can't run under `node --test` because it constructs real custom elements, this test belongs with the DOM-capable suite — check how `tests/overlay-registry.test.js` handles element construction and mirror it, e.g. a `globalThis.document` stub. If a stub is already established there, reuse it.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/overlay-manager.test.js`
Expected: FAIL — `manager` is undefined / `byAction` still has probe.

- [ ] **Step 3: Update `mountOverlays` + `initializeGraphOverlays`**

In `js/ui/overlays/index.js`, add imports and build the manager. Replace the `mountOverlays` body so probe routes to a manager:

```js
import { OverlayManager } from "./manager.js";
import { A } from "../../core/action-ids.js";

// Actions rendered by the pooled multi-node manager (this session: probe only — the SWEEP fan-out
// case). Others stay on the singleton byAction path until they too need concurrency.
const MANAGED_ACTIONS = new Map([[A.PROBE, "probe-sweep-overlay"]]);

export function mountOverlays(container) {
  const byKey = new Map();
  const byAction = new Map();
  const manager = new OverlayManager(MANAGED_ACTIONS);
  manager.mount(container);
  for (const d of OVERLAY_DESCRIPTORS) {
    if (d.driver === "action-feedback" && d.action && MANAGED_ACTIONS.has(d.action)) continue; // pooled, not a singleton
    const el = document.createElement(d.tag);
    container.appendChild(el);
    byKey.set(d.key, el);
    if (d.driver === "action-feedback" && d.action) byAction.set(d.action, el);
  }
  return { byKey, byAction, manager };
}
```

Update the `@returns` JSDoc to `{ byKey, byAction, manager }`. In `initializeGraphOverlays`, add manager reposition next to the existing byKey one:

```js
  onViewport(() => overlays.byKey.forEach((o) => o.reposition()));
  onViewport(() => overlays.manager.repositionAll());
```

- [ ] **Step 4: Route feedback in `visual-renderer.js`**

At the wiring site (currently ~L91-93):

```js
  const activeNodeIds = new Map();
  on(E.ACTION_FEEDBACK, (payload) => {
    if (overlays.manager.handles(payload.action)) overlays.manager.handleFeedback(payload);
    else dispatchActionFeedback(overlays.byAction, activeNodeIds, payload, { onXploitProgress: updateExploitProgress });
  });
```

Note: `updateExploitProgress` is driven only for xploit (a non-managed action), so it stays on the dispatch branch — no behavior change. In the RUN_STARTED reset (~L107-110), add:

```js
    overlays.manager.clearAll();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/overlay-manager.test.js`
Expected: PASS.

- [ ] **Step 6: Full check**

Run: `make check`
Expected: green (lint + full suite; `overlay-dispatch.test.js` still passes — dispatch is unchanged).

- [ ] **Step 7: Commit**

```bash
git add js/ui/overlays/index.js js/ui/visual-renderer.js tests/overlay-manager.test.js
git commit -m 'Overlay manager: route probe overlays through the pooled manager'
```

---

### Task 3: Preview — probe demo via the manager + a permanent multi-node sweep demo

**Files:**
- Modify: `js/ui/preview.js` (probe demo wiring ~L220-225 EFFECTS; the temp lab hook added earlier)
- Delete/replace: `js/ui/preview-sweep-lab.js` (throwaway lab → fold into a permanent demo, or remove the hook)
- Modify: `preview.html` if a dedicated demo section is added

**Interfaces:**
- Consumes: the `manager` now returned by `initializeGraphOverlays().overlays` (Task 2).
- Produces: the preview drives the probe demo through `manager.handleFeedback` (single node), plus a permanent "Sweep Fan-out" demo that drives N nodes through the manager (formalizing the lab). No throwaway `preview-sweep-lab.js` left behind.

- [ ] **Step 1: Point the probe demo at the manager**

Probe is no longer in `overlays.byKey`, so the registry-driven `EFFECTS` entry for probe must drive the manager instead. In `js/ui/preview.js`, where `EFFECTS` is built (~L220-225), special-case the managed probe action:

```js
const { overlays, flowLayer } = initializeGraphOverlays(overlayLayer);
const { manager } = overlays;

// Drive the probe demo through the manager (it's pooled, not a byKey singleton). start on t=0,
// complete on t>=1, progress in between — the same ACTION_FEEDBACK phases the game emits.
function driveProbeDemo(nodeId, t) {
  const phase = t <= 0 ? "start" : t >= 1 ? "complete" : "progress";
  manager.handleFeedback({ nodeId, action: A.PROBE, phase, progress: t });
}
```

Then in the `EFFECTS` map, for the probe descriptor use `driveProbeDemo` for `sync`/`clear` instead of `overlays.byKey.get("probe")`. (Import `A` from `../core/action-ids.js` in preview.js if not already.) Verify: the other overlays' EFFECTS are unchanged (still `byKey`-driven).

- [ ] **Step 2: Replace the throwaway lab with a permanent multi-node demo**

Convert `js/ui/preview-sweep-lab.js` into a permanent, tidy "Sweep Fan-out" demo that drives the grid nodes through `manager.handleFeedback` (start → ramped progress → complete) with the fan-out / stagger / duration controls (the random-jitter is now the manager's job — the demo just fires N starts). Keep the sidebar `.section` placement from the lab. Update the `preview.js` hook to call the renamed/kept demo. Remove any purely-throwaway bits (the direct-instance mounting that bypassed the manager) — the demo should exercise the REAL manager path.

(If time-boxing: at minimum, delete `preview-sweep-lab.js` + its import hook so no throwaway ships; the fan-out demo can be a follow-up. But prefer keeping a real multi-node demo — the "new visual effects must be added to the preview harness" rule.)

- [ ] **Step 3: Build vendor + manual browser check**

Run: `make bundle-vendor`
Then serve (`npx serve . -l <port>`) and open `preview.html`. Confirm: the probe demo animates (single node), and the Sweep Fan-out demo animates N concurrent probe sweeps through the manager with the random jitter. No console errors.

- [ ] **Step 4: Lint + commit**

Run: `make lint` — clean.
```bash
git add js/ui/preview.js js/ui/preview-sweep-lab.js preview.html
git commit -m 'Overlay manager: preview probe demo via manager + permanent sweep fan-out demo'
```

---

### Task 4: Verification

**Files:** none (verification + optional MANUAL touch-up)

- [ ] **Step 1: Full suite + lint**

Run: `make check`
Expected: green. Confirm `tests/overlay-dispatch.test.js`, `tests/overlay-registry.test.js`, `tests/overlay-manager.test.js` all pass.

- [ ] **Step 2: In-game concurrent-sweep smoke (browser)**

`make bundle-vendor`, serve, open `index.html`. Drive a SWEEP fan-out: use the `cheat own <router>` console command to reveal a router's children, then SWEEP from an owned upstream node so multiple children probe at once. Confirm MULTIPLE probe radars animate simultaneously (the bug #1 fix), with the slight random stagger. Confirm a single PROBE still animates normally, and that XPLOIT / DUMP / FETCH / MINE / LIE-LOW overlays are unchanged (single-node path untouched).

- [ ] **Step 3: Pan/zoom + new-run checks**

While a fan-out sweep animates, pan/zoom — confirm all active radars re-anchor (repositionAll). Start a new run mid-sweep — confirm overlays clear (clearAll).

- [ ] **Step 4: MANUAL.md**

SWEEP's player-facing behavior is unchanged; this is a rendering fidelity fix. Confirm `MANUAL.md` needs no edit (it should not describe "one probe animates at a time"). Edit only if a discrepancy exists.

- [ ] **Step 5: Commit any doc touch-up**

```bash
git add MANUAL.md
git commit -m 'Overlay manager: manual check (no behavior change)'
```
(Skip if nothing changed.)

---

## Self-review notes

- **Spec coverage:** multi-node keying + pooling (§Decision 1,2) → Task 1; keep per-element loops (§3) → honored (manager doesn't touch overlay RAF); no cap (§4) → no cap in the manager; random jitter (§5) → Task 1 jitter; bloom one-owner (§6) → pooled elements under `#overlay-layer`, no per-element filter added (Task 2/3); nodeId keying (§7) → manager keys on received `nodeId`, Task 2 integration test. General manager, probe first client (not probe-only special-casing) → `MANAGED_ACTIONS` map is general; only probe registered. Single-node overlays untouched → dispatch path unchanged (Task 2). Lab scaffolding retired → Task 3.
- **Type consistency:** `OverlayManager(actionTags, deps)`, `handleFeedback`, `handles`, `repositionAll`, `clearAll`, `activeCount`, `mount`, `JITTER_MAX_MS`, `MANAGED_ACTIONS` used identically across tasks. `mountOverlays` → `{ byKey, byAction, manager }` consistently.
- **Risk:** the `mountOverlays` test may need a `document` stub to run under `node --test` (Task 2 Step 1 flags this — mirror `overlay-registry.test.js`). Real DOM/visual behavior is covered by the browser smokes (Task 3/4), not unit tests.
