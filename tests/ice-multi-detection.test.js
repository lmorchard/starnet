// @ts-check
// Phase 1: per-instance ICE detection, dwell, and alert.
//
// Verifies that every active ICE instance on the player's selected node dwells
// and detects independently — one ICE_DETECT timer per instance, keyed by iceId,
// cancelled by id (not cancelAllByType). Each detection sources the single
// global alert/trace.

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  createGateway, createRouter,
} from "../js/core/node-graph/game-types.js";
import { initGame, getState } from "../js/core/state.js";
import { startIce, handleIceTick, handleIceDetect, ejectIce } from "../js/core/ice.js";
import { handleTraceTick } from "../js/core/alert.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { A } from "../js/core/action-ids.js";
import { emitEvent, on, off, E } from "../js/core/events.js";
import { clearAll, tick, TIMER } from "../js/core/timers.js";
import "../js/core/alert.js";

function buildIceLAN({ startCash = 0, grade = "C" } = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
      ],
      edges: [["gateway", "router-a"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash, moneyCost: "C", ice: { grade, startNode: "gateway" } },
  };
}

function withEvents(type, fn) {
  const captured = [];
  const handler = (payload) => captured.push(payload);
  on(type, handler);
  fn();
  off(type, handler);
  return captured;
}

/** Inject a second active instance at the given node. */
function injectInstance(id, nodeId, grade) {
  const s = getState();
  s.ice.instances[id] = {
    id,
    typeId: `patrol-${grade}`,
    hostNodeId: nodeId,
    attentionNodeId: nodeId,
    active: true,
    enabled: true,
    grade,
    focus: "roaming",
    behaviorPattern: "standard",
    dwellTimerId: null,
    moveTimerId: null,
    detectedAtNode: null,
    detectionCount: 0,
  };
  return s.ice.instances[id];
}

describe("ice multi-instance detection", () => {
  const moveHandler = () => handleIceTick();
  const detectHandler = (p) => handleIceDetect(p);
  const traceHandler = () => handleTraceTick();

  before(() => {
    on(TIMER.ICE_MOVE, moveHandler);
    on(TIMER.ICE_DETECT, detectHandler);
    on(TIMER.TRACE_TICK, traceHandler);
  });
  after(() => {
    off(TIMER.ICE_MOVE, moveHandler);
    off(TIMER.ICE_DETECT, detectHandler);
    off(TIMER.TRACE_TICK, traceHandler);
  });

  beforeEach(() => {
    clearAll();
    // Grade B: dwell 4500ms, trace threshold 2 — gives room for two detections
    // before trace and a generous dwell window.
    initGame(() => buildIceLAN({ grade: "B" }));
  });

  it("two instances on the player's node both detect, one per iceId", () => {
    const s = getState();
    // Player selects gateway; ice-1 already resides there.
    s.selectedNodeId = "gateway";
    s.ice.instances["ice-1"].attentionNodeId = "gateway";
    injectInstance("ice-2", "gateway", "B");

    // Kick off the dwell for both instances via PLAYER_NAVIGATED.
    const detected = withEvents(E.ICE_DETECTED, () => {
      emitNav("gateway");
      // Dwell is 4500ms = 45 ticks; advance well past it.
      tick(60);
    });

    const ids = detected.map((p) => p.iceId).sort();
    assert.equal(detected.length, 2, `expected 2 detections, got ${detected.length}`);
    assert.deepEqual(ids, ["ice-1", "ice-2"]);
    for (const p of detected) assert.equal(p.nodeId, "gateway");
  });

  it("cancelling instance A's dwell leaves instance B's dwell intact", () => {
    const s = getState();
    s.selectedNodeId = "gateway";
    s.ice.instances["ice-1"].attentionNodeId = "gateway";
    injectInstance("ice-2", "gateway", "B");

    // Start both dwells.
    emitNav("gateway");

    // Eject instance ice-1 — this cancels ITS dwell only (departure for ice-1).
    const detected = withEvents(E.ICE_DETECTED, () => {
      ejectIce("ice-1");
      tick(60);
    });

    // ice-2 still on gateway and still dwelling → exactly one detection, for ice-2.
    assert.equal(detected.length, 1, `expected 1 detection, got ${detected.length}`);
    assert.equal(detected[0].iceId, "ice-2");
  });

  it("KICK at a node boots the instance on THAT node, not a co-active instance elsewhere", () => {
    const s = getState();
    // ice-1 dwells on router-a; ice-2 dwells on the player's owned target (gateway).
    s.ice.instances["ice-1"].attentionNodeId = "router-a";
    injectInstance("ice-2", "gateway", "B");
    // Gateway is owned so KICK is available; it has router-a as a neighbor to eject toward.
    s.nodeGraph.setNodeAttr("gateway", "accessLevel", "owned");

    // Dispatch KICK at gateway via the real action path.
    const ejected = withEvents(E.ICE_EJECTED, () => {
      const node = s.nodes["gateway"];
      const action = getAvailableActions(node, s).find((a) => a.id === A.KICK);
      assert.ok(action, "KICK should be available on owned gateway with ICE present");
      action.execute(node, s, {}, { nodeId: "gateway" });
    });

    // The instance at gateway (ice-2) is the one ejected and moved off gateway.
    assert.equal(ejected.length, 1, `expected 1 eject, got ${ejected.length}`);
    assert.equal(ejected[0].iceId, "ice-2", "the instance AT gateway must be ejected");
    assert.notEqual(getState().ice.instances["ice-2"].attentionNodeId, "gateway", "ice-2 must move off gateway");
    // ice-1 (elsewhere) must not move.
    assert.equal(getState().ice.instances["ice-1"].attentionNodeId, "router-a", "ice-1 must NOT move");
  });

  it("single active instance detects exactly once", () => {
    const s = getState();
    s.selectedNodeId = "gateway";
    s.ice.instances["ice-1"].attentionNodeId = "gateway";

    const detected = withEvents(E.ICE_DETECTED, () => {
      emitNav("gateway");
      tick(60);
    });

    assert.equal(detected.length, 1);
    assert.equal(detected[0].iceId, "ice-1");
  });
});

describe("ice multi-instance move cadence (per-instance timers)", () => {
  // Wire the move handler WITH payload so per-instance iceId routing is exercised.
  const moveHandler = (p) => handleIceTick(p);
  before(() => {
    on(TIMER.ICE_MOVE, moveHandler);
  });
  after(() => {
    off(TIMER.ICE_MOVE, moveHandler);
  });

  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN({ grade: "S" }));
  });

  it("instances of different grades move on independent cadences", () => {
    const s = getState();
    // Primary instance is grade S (move interval 4000ms = 40 ticks).
    s.ice.instances["ice-1"].grade = "S";
    s.ice.instances["ice-1"].attentionNodeId = "gateway";
    // Inject a slow grade-D instance (move interval 12000ms = 120 ticks).
    injectInstance("ice-2", "router-a", "D");

    const moves = withEvents(E.ICE_MOVED, () => {
      startIce();
      tick(240); // 6 S-intervals, 2 D-intervals
    });

    const sMoves = moves.filter((m) => m.iceId === "ice-1").length;
    const dMoves = moves.filter((m) => m.iceId === "ice-2").length;

    assert.ok(sMoves > 0, "S instance should have moved");
    assert.ok(dMoves > 0, "D instance should have moved");
    assert.ok(
      sMoves > dMoves,
      `S (${sMoves}) should move strictly more than D (${dMoves}) — independent cadence`,
    );
  });

  it("single instance schedules exactly one move timer at its grade interval", () => {
    const s = getState();
    // Grade S: interval 4000ms = 40 ticks.
    s.ice.instances["ice-1"].grade = "S";
    s.ice.instances["ice-1"].attentionNodeId = "gateway";

    const moves = withEvents(E.ICE_MOVED, () => {
      startIce();
      tick(200); // 200 / 40 = 5 intervals
    });

    const myMoves = moves.filter((m) => m.iceId === "ice-1").length;
    assert.equal(myMoves, 5, `expected 5 S-grade moves over 200 ticks, got ${myMoves}`);
  });

  it("startIce() is idempotent — a second call does not double move cadence", () => {
    const s = getState();
    // Grade S: interval 4000ms = 40 ticks.
    s.ice.instances["ice-1"].grade = "S";
    s.ice.instances["ice-1"].attentionNodeId = "gateway";

    const moves = withEvents(E.ICE_MOVED, () => {
      startIce();
      startIce(); // back-to-back: must cancel the first call's timer, not stack
      tick(200); // 200 / 40 = 5 intervals
    });

    const myMoves = moves.filter((m) => m.iceId === "ice-1").length;
    assert.equal(
      myMoves,
      5,
      `expected 5 S-grade moves over 200 ticks after two startIce() calls, got ${myMoves}`,
    );
  });
});

// PLAYER_NAVIGATED is what the ice runtime listens to; emit it directly so the
// test does not depend on navigation.js side effects.
function emitNav(nodeId) {
  emitEvent(E.PLAYER_NAVIGATED, { nodeId });
}
