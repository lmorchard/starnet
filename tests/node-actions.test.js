import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NODE_ACTIONS, getNodeActions, getAvailableActions } from "../js/node-actions.js";
import { GLOBAL_ACTIONS, getGlobalActions } from "../js/global-actions.js";

// ── stub helpers ──────────────────────────────────────────

/** Base locked node — override fields as needed */
function lockedNode(extra = {}) {
  return /** @type {any} */ ({
    id: "test-node",
    type: "workstation",
    grade: "D",
    accessLevel: "locked",
    visibility: "accessible",
    probed: false,
    rebooting: false,
    read: false,
    macguffins: [],
    eventForwardingDisabled: false,
    ...extra,
  });
}

/** Base game state — override fields as needed */
function baseState(extra = {}) {
  return /** @type {any} */ ({
    phase: "playing",
    selectedNodeId: null,
    activeProbe: null,
    activeRead: null,
    activeLoot: null,
    executingExploit: null,
    ice: null,
    traceSecondsRemaining: null,
    nodes: {},
    player: { hand: [] },
    ...extra,
  });
}

/** Find an action by id from a registry array */
function action(id) {
  return (
    NODE_ACTIONS.find((a) => a.id === id) ??
    GLOBAL_ACTIONS.find((a) => a.id === id)
  );
}

// ── probe ─────────────────────────────────────────────────

describe("probe available", () => {
  it("available for locked unprobed node", () => {
    const a = action("probe");
    assert.ok(a.available(lockedNode(), baseState()));
  });
  it("unavailable when already probed", () => {
    const a = action("probe");
    assert.ok(!a.available(lockedNode({ probed: true }), baseState()));
  });
  it("unavailable when rebooting", () => {
    const a = action("probe");
    assert.ok(!a.available(lockedNode({ rebooting: true }), baseState()));
  });
  it("unavailable when probe already active on this node", () => {
    const a = action("probe");
    const node = lockedNode();
    assert.ok(!a.available(node, baseState({ activeProbe: { nodeId: node.id } })));
  });
  it("unavailable for compromised node", () => {
    const a = action("probe");
    assert.ok(!a.available(lockedNode({ accessLevel: "compromised" }), baseState()));
  });
  it("unavailable for owned node", () => {
    const a = action("probe");
    assert.ok(!a.available(lockedNode({ accessLevel: "owned" }), baseState()));
  });
});

// ── cancel-probe ──────────────────────────────────────────

describe("cancel-probe available", () => {
  it("available when active probe is on this node", () => {
    const a = action("cancel-probe");
    const node = lockedNode();
    assert.ok(a.available(node, baseState({ activeProbe: { nodeId: node.id } })));
  });
  it("unavailable when no active probe", () => {
    const a = action("cancel-probe");
    assert.ok(!a.available(lockedNode(), baseState()));
  });
  it("unavailable when active probe is on a different node", () => {
    const a = action("cancel-probe");
    assert.ok(!a.available(lockedNode(), baseState({ activeProbe: { nodeId: "other-node" } })));
  });
});

// ── exploit ───────────────────────────────────────────────

describe("exploit available", () => {
  it("available for locked accessible non-rebooting node", () => {
    const a = action("exploit");
    assert.ok(a.available(lockedNode(), baseState()));
  });
  it("available for compromised node", () => {
    const a = action("exploit");
    assert.ok(a.available(lockedNode({ accessLevel: "compromised" }), baseState()));
  });
  it("available for owned node (disturbance strategy)", () => {
    const a = action("exploit");
    assert.ok(a.available(lockedNode({ accessLevel: "owned" }), baseState()));
  });
  it("unavailable when rebooting", () => {
    const a = action("exploit");
    assert.ok(!a.available(lockedNode({ rebooting: true }), baseState()));
  });
  it("unavailable when exploit already executing on this node", () => {
    const a = action("exploit");
    const node = lockedNode();
    assert.ok(!a.available(node, baseState({ executingExploit: { nodeId: node.id } })));
  });
  it("unavailable for hidden node", () => {
    const a = action("exploit");
    assert.ok(!a.available(lockedNode({ visibility: "hidden" }), baseState()));
  });
});

// ── cancel-exploit ────────────────────────────────────────

describe("cancel-exploit available", () => {
  it("available when exploit executing on this node", () => {
    const a = action("cancel-exploit");
    const node = lockedNode();
    assert.ok(a.available(node, baseState({ executingExploit: { nodeId: node.id, exploitId: "e1" } })));
  });
  it("unavailable when no exploit executing", () => {
    const a = action("cancel-exploit");
    assert.ok(!a.available(lockedNode(), baseState()));
  });
  it("unavailable when exploit executing on different node", () => {
    const a = action("cancel-exploit");
    assert.ok(!a.available(lockedNode(), baseState({ executingExploit: { nodeId: "other" } })));
  });
});

// ── read ──────────────────────────────────────────────────

describe("read available", () => {
  it("available for compromised unread node", () => {
    const a = action("read");
    assert.ok(a.available(lockedNode({ accessLevel: "compromised" }), baseState()));
  });
  it("available for owned unread node", () => {
    const a = action("read");
    assert.ok(a.available(lockedNode({ accessLevel: "owned" }), baseState()));
  });
  it("unavailable when already read", () => {
    const a = action("read");
    assert.ok(!a.available(lockedNode({ accessLevel: "owned", read: true }), baseState()));
  });
  it("unavailable for locked node", () => {
    const a = action("read");
    assert.ok(!a.available(lockedNode(), baseState()));
  });
});

// ── loot ──────────────────────────────────────────────────

describe("loot available", () => {
  it("available for owned read node with uncollected macguffins", () => {
    const a = action("loot");
    assert.ok(a.available(
      lockedNode({ accessLevel: "owned", read: true, macguffins: [{ collected: false }] }),
      baseState()
    ));
  });
  it("unavailable when all macguffins collected", () => {
    const a = action("loot");
    assert.ok(!a.available(
      lockedNode({ accessLevel: "owned", read: true, macguffins: [{ collected: true }] }),
      baseState()
    ));
  });
  it("unavailable when node not read", () => {
    const a = action("loot");
    assert.ok(!a.available(
      lockedNode({ accessLevel: "owned", read: false, macguffins: [{ collected: false }] }),
      baseState()
    ));
  });
  it("unavailable when not owned", () => {
    const a = action("loot");
    assert.ok(!a.available(
      lockedNode({ accessLevel: "compromised", read: true, macguffins: [{ collected: false }] }),
      baseState()
    ));
  });
  it("unavailable when no macguffins", () => {
    const a = action("loot");
    assert.ok(!a.available(
      lockedNode({ accessLevel: "owned", read: true, macguffins: [] }),
      baseState()
    ));
  });
});

// ── eject ─────────────────────────────────────────────────

describe("eject available", () => {
  it("available when ICE active at this node", () => {
    const a = action("eject");
    const node = lockedNode({ accessLevel: "owned" });
    assert.ok(a.available(node, baseState({ ice: { active: true, attentionNodeId: node.id } })));
  });
  it("unavailable when ICE not active", () => {
    const a = action("eject");
    const node = lockedNode({ accessLevel: "owned" });
    assert.ok(!a.available(node, baseState({ ice: { active: false, attentionNodeId: node.id } })));
  });
  it("unavailable when ICE at a different node", () => {
    const a = action("eject");
    assert.ok(!a.available(lockedNode({ accessLevel: "owned" }), baseState({ ice: { active: true, attentionNodeId: "other" } })));
  });
  it("unavailable when no ICE", () => {
    const a = action("eject");
    assert.ok(!a.available(lockedNode({ accessLevel: "owned" }), baseState()));
  });
  it("unavailable when node is locked (not owned)", () => {
    const a = action("eject");
    const node = lockedNode({ accessLevel: "locked" });
    assert.ok(!a.available(node, baseState({ ice: { active: true, attentionNodeId: node.id } })));
  });
  it("unavailable when node is compromised (not owned)", () => {
    const a = action("eject");
    const node = lockedNode({ accessLevel: "compromised" });
    assert.ok(!a.available(node, baseState({ ice: { active: true, attentionNodeId: node.id } })));
  });
});

// ── reboot ────────────────────────────────────────────────

describe("reboot available", () => {
  it("available for owned non-rebooting node", () => {
    const a = action("reboot");
    assert.ok(a.available(lockedNode({ accessLevel: "owned" }), baseState()));
  });
  it("unavailable when rebooting", () => {
    const a = action("reboot");
    assert.ok(!a.available(lockedNode({ accessLevel: "owned", rebooting: true }), baseState()));
  });
  it("unavailable when not owned", () => {
    const a = action("reboot");
    assert.ok(!a.available(lockedNode({ accessLevel: "compromised" }), baseState()));
  });
});

// ── jackout ───────────────────────────────────────────────

describe("jackout available", () => {
  it("available when phase is playing", () => {
    const a = action("jackout");
    assert.ok(a.available(null, baseState({ phase: "playing" })));
  });
  it("unavailable when phase is not playing", () => {
    const a = action("jackout");
    assert.ok(!a.available(null, baseState({ phase: "ended" })));
  });
});

// ── deselect ──────────────────────────────────────────────

describe("deselect available", () => {
  it("available when a node is selected", () => {
    const a = action("deselect");
    assert.ok(a.available(null, baseState({ selectedNodeId: "gateway" })));
  });
  it("unavailable when nothing is selected", () => {
    const a = action("deselect");
    assert.ok(!a.available(null, baseState({ selectedNodeId: null })));
  });
});

// ── select ────────────────────────────────────────────────

describe("select available", () => {
  it("available when an accessible node exists", () => {
    const a = action("select");
    const state = baseState({
      selectedNodeId: "gateway",
      nodes: {
        "router-a": { id: "router-a", visibility: "accessible", rebooting: false },
      },
    });
    assert.ok(a.available(null, state));
  });
  it("available when a revealed node exists", () => {
    const a = action("select");
    const state = baseState({
      nodes: {
        "router-a": { id: "router-a", visibility: "revealed", rebooting: false },
      },
    });
    assert.ok(a.available(null, state));
  });
  it("unavailable when no selectable nodes", () => {
    const a = action("select");
    assert.ok(!a.available(null, baseState({ nodes: {} })));
  });
});

// ── action execute() routing ──────────────────────────────

/** Build a mock ActionContext that records the last call per method */
function mockCtx(overrides = {}) {
  return /** @type {any} */ ({
    getState:      () => baseState(),
    selectNode:    () => {},
    deselectNode:  () => {},
    startProbe:    () => {},
    cancelProbe:   () => {},
    startExploit:  () => {},
    cancelExploit: () => {},
    startRead:     () => {},
    cancelRead:    () => {},
    startLoot:     () => {},
    cancelLoot:    () => {},
    ejectIce:      () => {},
    rebootNode:    () => {},
    jackOut:       () => {},
    ...overrides,
  });
}

describe("action execute() routing", () => {
  it("probe calls ctx.startProbe(node.id)", () => {
    const a = action("probe");
    const node = lockedNode();
    let called = null;
    const ctx = mockCtx({ startProbe: (id) => { called = id; } });
    a.execute(node, baseState(), ctx);
    assert.equal(called, node.id);
  });

  it("cancel-probe calls ctx.cancelProbe()", () => {
    const a = action("cancel-probe");
    let called = false;
    const ctx = mockCtx({ cancelProbe: () => { called = true; } });
    a.execute(lockedNode(), baseState(), ctx);
    assert.ok(called);
  });

  it("exploit calls ctx.startExploit(node.id, payload.exploitId)", () => {
    const a = action("exploit");
    const node = lockedNode();
    let args = null;
    const ctx = mockCtx({ startExploit: (nid, eid) => { args = [nid, eid]; } });
    a.execute(node, baseState(), ctx, { exploitId: "card-1" });
    assert.deepEqual(args, [node.id, "card-1"]);
  });

  it("cancel-exploit calls ctx.cancelExploit()", () => {
    const a = action("cancel-exploit");
    let called = false;
    const ctx = mockCtx({ cancelExploit: () => { called = true; } });
    a.execute(lockedNode(), baseState(), ctx);
    assert.ok(called);
  });

  it("read calls ctx.startRead(node.id)", () => {
    const a = action("read");
    const node = lockedNode({ accessLevel: "compromised" });
    let called = null;
    const ctx = mockCtx({ startRead: (id) => { called = id; } });
    a.execute(node, baseState(), ctx);
    assert.equal(called, node.id);
  });

  it("cancel-read calls ctx.cancelRead()", () => {
    const a = action("cancel-read");
    let called = false;
    const ctx = mockCtx({ cancelRead: () => { called = true; } });
    a.execute(lockedNode(), baseState({ activeRead: { nodeId: "test-1", timerId: 1 } }), ctx);
    assert.ok(called);
  });

  it("loot calls ctx.startLoot(node.id)", () => {
    const a = action("loot");
    const node = lockedNode({ accessLevel: "owned", read: true, macguffins: [{ collected: false }] });
    let called = null;
    const ctx = mockCtx({ startLoot: (id) => { called = id; } });
    a.execute(node, baseState(), ctx);
    assert.equal(called, node.id);
  });

  it("cancel-loot calls ctx.cancelLoot()", () => {
    const a = action("cancel-loot");
    let called = false;
    const ctx = mockCtx({ cancelLoot: () => { called = true; } });
    a.execute(lockedNode(), baseState({ activeLoot: { nodeId: "test-1", timerId: 1 } }), ctx);
    assert.ok(called);
  });

  it("eject calls ctx.ejectIce()", () => {
    const a = action("eject");
    let called = false;
    const ctx = mockCtx({ ejectIce: () => { called = true; } });
    a.execute(lockedNode(), baseState(), ctx);
    assert.ok(called);
  });

  it("reboot calls ctx.rebootNode(node.id)", () => {
    const a = action("reboot");
    const node = lockedNode({ accessLevel: "owned" });
    let called = null;
    const ctx = mockCtx({ rebootNode: (id) => { called = id; } });
    a.execute(node, baseState(), ctx);
    assert.equal(called, node.id);
  });

  it("jackout calls ctx.jackOut()", () => {
    const a = action("jackout");
    let called = false;
    const ctx = mockCtx({ jackOut: () => { called = true; } });
    a.execute(null, baseState(), ctx);
    assert.ok(called);
  });

  it("select calls ctx.selectNode(payload.nodeId)", () => {
    const a = action("select");
    let called = null;
    const ctx = mockCtx({ selectNode: (id) => { called = id; } });
    a.execute(null, baseState(), ctx, { nodeId: "router-a" });
    assert.equal(called, "router-a");
  });

  it("deselect calls ctx.deselectNode()", () => {
    const a = action("deselect");
    let called = false;
    const ctx = mockCtx({ deselectNode: () => { called = true; } });
    a.execute(null, baseState(), ctx);
    assert.ok(called);
  });
});

// ── getAvailableActions integration parity ────────────────

describe("getAvailableActions integration parity", () => {
  it("locked unprobed node: probe + jackout, no read/loot/reboot", () => {
    const node = lockedNode();
    const state = baseState({ selectedNodeId: node.id });
    const ids = getAvailableActions(node, state).map((a) => a.id);
    assert.ok(ids.includes("probe"), "should include probe");
    assert.ok(ids.includes("jackout"), "should include jackout");
    assert.ok(ids.includes("deselect"), "should include deselect");
    assert.ok(!ids.includes("read"), "should not include read");
    assert.ok(!ids.includes("loot"), "should not include loot");
    assert.ok(!ids.includes("reboot"), "should not include reboot");
    assert.ok(!ids.includes("cancel-probe"), "should not include cancel-probe");
  });

  it("owned read node with loot: reboot + loot + exploit, no probe/read", () => {
    const node = lockedNode({
      accessLevel: "owned",
      read: true,
      macguffins: [{ collected: false }],
    });
    const state = baseState({ selectedNodeId: node.id });
    const ids = getAvailableActions(node, state).map((a) => a.id);
    assert.ok(ids.includes("reboot"), "should include reboot");
    assert.ok(ids.includes("loot"), "should include loot");
    assert.ok(ids.includes("exploit"), "should include exploit (disturbance)");
    assert.ok(ids.includes("jackout"), "should include jackout");
    assert.ok(!ids.includes("probe"), "should not include probe");
    assert.ok(!ids.includes("read"), "should not include read");
  });

  it("active exploit on node: only cancel-exploit (no probe/exploit/read)", () => {
    const node = lockedNode();
    const state = baseState({
      selectedNodeId: node.id,
      executingExploit: { nodeId: node.id, exploitId: "e1" },
    });
    const ids = getAvailableActions(node, state).map((a) => a.id);
    assert.ok(ids.includes("cancel-exploit"), "should include cancel-exploit");
    assert.ok(!ids.includes("probe"), "should not include probe");
    assert.ok(!ids.includes("exploit"), "should not include exploit");
    assert.ok(!ids.includes("read"), "should not include read");
  });

  it("null node: only global actions returned", () => {
    const state = baseState({ phase: "playing" });
    const ids = getAvailableActions(null, state).map((a) => a.id);
    assert.ok(ids.includes("jackout"), "should include jackout");
    assert.ok(!ids.includes("probe"), "should not include probe");
    assert.ok(!ids.includes("read"), "should not include read");
  });
});
