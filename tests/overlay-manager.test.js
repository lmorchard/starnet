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
