// @ts-check
// Integration tests — real game module wiring, scenario-level assertions.
//
// Design:
//   - Modules are loaded once; alert.js registers its listeners at import time.
//   - beforeEach resets game state (initState) and timers (clearAll).
//   - Event capture uses the withEvents() helper: register → run → off.
//   - Direct state mutation is used sparingly to set up conditions
//     (same pattern as cheats.js: mutate field + emit NODE_ACCESSED).
//
// Each test group constructs a minimal LAN fixture using game-types.js factories.
// This avoids coupling tests to the full network topology.
//
// SEED CONVENTION: every initGame() call passes an explicit seed string ("itest-N").
// Without a seed, initGame falls back to a Math.random()-derived seed, so any RNG
// roll a test does not explicitly force (via _forceNext) varies per run — silently
// flaky. See issue #109: a successful exploit FROM a locked node consumes THREE
// RNG.COMBAT rolls (success, flavor pick, skip-to-owned), and forcing only the
// first two leaves the skip roll seeded. See the roll-consumption block in combat.js.

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  createGateway, createRouter, createIDS, createSecurityMonitor,
  createFileserver, createFirewall, createWAN,
} from "../js/core/node-graph/game-types.js";
import { buildSetPieceMiniNetwork } from "../js/core/node-graph/mini-network.js";
import { initGame, getState, isIceVisible, buyExploit } from "../js/core/state.js";
import { navigateTo, navigateAway } from "../js/core/navigation.js";
import { startIce, handleIceTick, handleIceDetect, teleportIce, ejectIce } from "../js/core/ice.js";
import { emitEvent, on, off, E } from "../js/core/events.js";
import { clearAll, tick, scheduleEvent, TIMER } from "../js/core/timers.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { setNodeAccessLevel, serializeState, deserializeState } from "../js/core/state.js";
import { incrementMineAttempts, setMineExhausted } from "../js/core/state/node.js";
import { A } from "../js/core/action-ids.js";
import { MINE_TAPOUT } from "../js/core/mining.js";
import { generateExploit } from "../js/core/exploits.js";
import { launchExploit } from "../js/core/combat.js";
import { startTraceCountdown, recordIceDetection } from "../js/core/alert.js";
import { setGlobalAlert } from "../js/core/state/alert.js";
// Importing alert.js above registers its module-level NODE_ALERT_RAISED /
// NODE_RECONFIGURED listeners. No separate init call needed.
// Old executor imports removed — timed actions now graph-native
import { RNG, _forceNext } from "../js/core/rng.js";
import { getPrimaryIce } from "../js/core/state/ice.js";
import { initActionDispatcher, buildActionContext } from "../js/core/actions/action-context.js";

// Register the node lifecycle dispatcher once for this test file.

/**
 * Capture events of a given type emitted synchronously during fn().
 * Listener is removed after fn() returns.
 * @param {string} type
 * @param {() => void} fn
 * @returns {object[]} captured payloads
 */
function withEvents(type, fn) {
  const captured = [];
  const handler = (payload) => captured.push(payload);
  on(type, handler);
  fn();
  off(type, handler);
  return captured;
}

// ── Minimal LAN fixtures ───────────────────────────────────────────────────────

/**
 * Basic LAN with a gateway and a router. No ICE, no security.
 * Good for simple navigation and probe/exploit timing tests.
 */
function buildBasicLAN({ startCash = 0, ice = null } = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
      ],
      edges: [["gateway", "router-a"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash, moneyCost: "C", ice },
  };
}

/**
 * LAN with ICE: gateway → router-a.
 * ICE resides at router-a. Grade C by default.
 */
function buildIceLAN({ startCash = 0, grade = "C" } = {}) {
  return buildBasicLAN({
    startCash,
    ice: { grade, startNode: "router-a" },
  });
}

/**
 * Extend the basic LAN with a security monitor node.
 * ICE resides at sec-mon.
 */
function buildIceWithMonitorLAN({ startCash = 0, grade = "C" } = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
        createSecurityMonitor("sec-mon"),
      ],
      edges: [["gateway", "router-a"], ["router-a", "sec-mon"]],
      triggers: [
        // Monitor owned → cancel trace: now handled by security trait per-node trigger
        // ICE resident owned → disable ICE (network-specific, stays here)
        { id: "ice-resident-owned", when: { type: "node-attr", nodeId: "sec-mon", attr: "accessLevel", eq: "owned" }, then: [{ effect: "ctx-call", method: "disableIce", args: [] }] },
      ],
    },
    meta: { startNode: "gateway", startCash, moneyCost: "C", ice: { grade, startNode: "sec-mon" } },
  };
}

/**
 * LAN with IDS and security monitor for alert propagation tests.
 */
function buildAlertLAN({ startCash = 0, ice = null } = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createIDS("ids-1"),
        createSecurityMonitor("mon-1"),
      ],
      edges: [["gateway", "ids-1"], ["ids-1", "mon-1"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash, moneyCost: "C", ice },
  };
}

/**
 * LAN with fileserver, for loot/macguffin tests.
 */
function buildLootLAN({ startCash = 0 } = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createFileserver("fileserver-1"),
      ],
      edges: [["gateway", "fileserver-1"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash, moneyCost: "C", ice: null },
  };
}

/**
 * LAN with WAN node for darknet store tests.
 */
function buildWanLAN({ startCash = 200, ice = null } = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-a"),
        createWAN("wan"),
      ],
      edges: [["gateway", "router-a"], ["gateway", "wan"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash, moneyCost: "C", ice },
  };
}

// ── Node initialization ───────────────────────────────────────────────────────

describe("Node initialization", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildLootLAN(), "itest-1");
  });

  it("fileserver has at least 1 macguffin after init", () => {
    const fs = getState().nodes["fileserver-1"];
    assert.ok(fs.macguffins.length >= 1, `expected ≥1 macguffin, got ${fs.macguffins.length}`);
  });

  it("gateway has no macguffins attribute (not lootable)", () => {
    // Gateways don't have the lootable trait, so no macguffins attribute
    assert.equal(getState().nodes["gateway"].macguffins, undefined);
  });

  it("ids node has forwardingEnabled: true after init", () => {
    clearAll();
    initGame(() => buildAlertLAN(), "itest-2");
    assert.equal(getState().nodes["ids-1"].forwardingEnabled, true);
  });

  it("detectable nodes have forwardingEnabled, non-detectable do not", () => {
    // forwardingEnabled comes from the detectable trait, not all nodes
    clearAll();
    initGame(() => buildAlertLAN(), "itest-3");
    assert.equal(getState().nodes["ids-1"].forwardingEnabled, true);
    // Gateway doesn't have detectable trait
    assert.equal(getState().nodes["gateway"].forwardingEnabled, undefined);
  });
});

// ── Lifecycle: iceResident ────────────────────────────────────────────────────

describe("Lifecycle: iceResident — owning security-monitor stops ICE", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceWithMonitorLAN(), "itest-4");
    startIce();
  });

  it("ICE starts active after initState + startIce", () => {
    assert.ok(getPrimaryIce()?.active);
  });

  it("owning security-monitor sets ice.active to false", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("sec-mon", "accessLevel", "owned");
    // ICE_DISABLED setIceActive(false) makes getPrimaryIce() return null
    assert.equal(getPrimaryIce(), null);
  });

  it("owning security-monitor emits ICE_DISABLED", () => {
    const s = getState();
    const fired = withEvents(E.ICE_DISABLED, () => {
      s.nodeGraph.setNodeAttr("sec-mon", "accessLevel", "owned");
    });
    assert.equal(fired.length, 1);
  });

  it("owning a non-resident node does not stop ICE", () => {
    const s = getState();
    s.nodes["gateway"].accessLevel = "owned";
    emitEvent(E.NODE_ACCESSED, { nodeId: "gateway", label: "gateway", prev: "locked", next: "owned" });
    assert.ok(getPrimaryIce()?.active, "ICE should remain active");
  });
});

// ── Lifecycle: monitor — trace cancellation ───────────────────────────────────

describe("Lifecycle: monitor — owning security-monitor cancels active trace", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceWithMonitorLAN(), "itest-5");
    startTraceCountdown();
  });

  it("trace is active before the test action", () => {
    assert.notEqual(getState().traceSecondsRemaining, null);
  });

  it("owning security-monitor emits ALERT_TRACE_CANCELLED", () => {
    const s = getState();
    const fired = withEvents(E.ALERT_TRACE_CANCELLED, () => {
      // Set via graph so the trigger fires
      s.nodeGraph.setNodeAttr("sec-mon", "accessLevel", "owned");
    });
    assert.equal(fired.length, 1);
  });

  it("traceSecondsRemaining is null after owning security-monitor", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("sec-mon", "accessLevel", "owned");
    assert.equal(getState().traceSecondsRemaining, null);
  });
});

// ── Trace ↔ global alert consistency (#114 WS3) ───────────────────────────────

describe("Trace: startTraceCountdown drives global alert to trace", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildBasicLAN(), "itest-trace-global");
  });

  // Regression: set-piece alarms call ctx.startTrace() -> startTraceCountdown()
  // directly, bypassing alert escalation. Trace must still be the visible alert
  // level so the HUD and the census peakAlert stat reflect it (matching the
  // bot-stats traceFired flag). Previously globalAlert stayed green.
  it("escalates globalAlert to trace even with no alert escalation", () => {
    assert.equal(getState().globalAlert, "green");
    const raised = withEvents(E.ALERT_GLOBAL_RAISED, () => startTraceCountdown());
    assert.equal(getState().globalAlert, "trace", "trace countdown implies trace-level alert");
    assert.ok(
      raised.some((e) => e.next === "trace"),
      "should emit ALERT_GLOBAL_RAISED { next: 'trace' }"
    );
  });

  it("does not emit a redundant raise when already at trace", () => {
    setGlobalAlert("trace");
    const raised = withEvents(E.ALERT_GLOBAL_RAISED, () => startTraceCountdown());
    assert.equal(raised.length, 0, "no duplicate raise when already trace");
    assert.equal(getState().globalAlert, "trace");
  });
});

// ── Alert flow ────────────────────────────────────────────────────────────────

describe("Alert flow: ids alert escalates global alert", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildAlertLAN(), "itest-6");
  });

  it("NODE_ALERT_RAISED on ids (with raised alertState) escalates global alert", () => {
    // In the graph path, NODE_ALERT_RAISED triggers recomputeGlobalAlert(),
    // which reads all IDS/monitor alertStates to compute the global level.
    const s = getState();
    assert.equal(s.globalAlert, "green");
    s.nodes["ids-1"].alertState = "yellow";
    emitEvent(E.NODE_ALERT_RAISED, { nodeId: "ids-1", label: "ids-1" });
    assert.ok(
      ["yellow", "red", "trace"].includes(s.globalAlert),
      `expected alert to escalate, got: ${s.globalAlert}`
    );
  });

  it("NODE_ALERT_RAISED does NOT escalate when forwarding disabled", () => {
    // When eventForwardingDisabled is set, recomputeGlobalAlert skips the detector.
    const s = getState();
    s.nodes["ids-1"].eventForwardingDisabled = true;
    s.nodes["ids-1"].alertState = "yellow";
    emitEvent(E.NODE_ALERT_RAISED, { nodeId: "ids-1", label: "ids-1" });
    assert.equal(s.globalAlert, "green",
      "global alert must not escalate when forwarding is disabled");
  });
});

// ── Action availability ───────────────────────────────────────────────────────

describe("Action availability: corrupt on ids", () => {
  before(() => {
    clearAll();
    initGame(() => buildAlertLAN(), "itest-7");
  });

  it("available when compromised and forwarding enabled", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "compromised");
    graph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(actionIds.includes("corrupt"));
  });

  it("not available when forwardingEnabled is false", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "compromised");
    graph.setNodeAttr("ids-1", "forwardingEnabled", false);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(!actionIds.includes("corrupt"));
  });

  it("not available when locked (even if forwarding enabled)", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "locked");
    graph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(!actionIds.includes("corrupt"));
  });

  it("available when owned and forwarding still enabled", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");
    graph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(actionIds.includes("corrupt"));
  });
});

describe("Action availability: cancel-trace on security-monitor", () => {
  it("available when owned", () => {
    clearAll();
    initGame(() => buildAlertLAN(), "itest-8");
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("mon-1", "accessLevel", "owned");
    const actionIds = getAvailableActions(s.nodes["mon-1"], s).map((a) => a.id);
    assert.ok(actionIds.includes("cancel-trace"));
  });

  it("not available when not owned", () => {
    clearAll();
    initGame(() => buildAlertLAN(), "itest-9");
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("mon-1", "accessLevel", "locked");
    const actionIds = getAvailableActions(s.nodes["mon-1"], s).map((a) => a.id);
    assert.ok(!actionIds.includes("cancel-trace"));
  });
});

// ── ICE detection reset ───────────────────────────────────────────────────────

describe("ICE detection: detectedAtNode resets when player moves", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN(), "itest-10");
    startIce();
  });

  it("moving to a different node resets detectedAtNode to null", () => {
    const s = getState();
    s.selectedNodeId = "gateway";
    getPrimaryIce().detectedAtNode = "gateway"; // simulate: detection already happened here

    navigateTo("router-a");

    assert.equal(getPrimaryIce().detectedAtNode, null,
      "detectedAtNode should clear so ICE can detect at gateway again after player returns");
  });

  it("re-selecting the SAME node does NOT reset detectedAtNode", () => {
    const s = getState();
    s.selectedNodeId = "gateway";
    getPrimaryIce().detectedAtNode = "gateway";

    navigateTo("gateway");

    assert.equal(getPrimaryIce().detectedAtNode, "gateway",
      "detectedAtNode must not reset when player re-selects the already-selected node");
  });
});

/// ── ICE detection: player enters occupied node ───────────────────────────────

describe("ICE detection: player navigates to node where ICE is already present", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN(), "itest-11");
    startIce();
  });

  it("starts detection dwell when player enters ICE's current node", () => {
    const s = getState();
    // Place ICE at gateway (accessible from start) without triggering handleIceTick
    getPrimaryIce().attentionNodeId = "gateway";

    const events = withEvents(E.ICE_DETECT_PENDING, () => {
      navigateTo("gateway");
    });

    assert.equal(events.length, 1, "ICE_DETECT_PENDING should fire when player enters ICE's node");
    assert.equal(events[0].nodeId, "gateway");
  });
});

// ── ICE detection: eject cancels dwell ───────────────────────────────────────

describe("ICE detection: ejecting ICE cancels the pending dwell timer", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN(), "itest-12");
    startIce();
  });

  it("ejecting ICE prevents detection from firing", () => {
    // Wire up the ICE_DETECT timer → handleIceDetect (normally done in main.js)
    on(TIMER.ICE_DETECT, handleIceDetect);

    const s = getState();
    s.selectedNodeId = "gateway";
    getPrimaryIce().attentionNodeId = "gateway";
    s.nodes["gateway"].accessLevel = "owned";

    // Simulate a detection dwell that is already running
    scheduleEvent(TIMER.ICE_DETECT, 500, { nodeId: "gateway" });

    // Eject, then advance past the dwell window
    const fired = withEvents(E.ICE_DETECTED, () => {
      ejectIce();
      tick(10); // 1000ms — well past the 500ms dwell
    });

    off(TIMER.ICE_DETECT, handleIceDetect);
    assert.equal(fired.length, 0, "ICE_DETECTED must not fire after ejecting ICE");
  });
});

// ── ICE detection: reset on ICE departure ─────────────────────────────────────

describe("ICE detection: detectedAtNode resets when ICE leaves player's node", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN(), "itest-13");
    startIce();
  });

  it("detectedAtNode resets when ICE moves away from player's node", () => {
    const s = getState();
    // Position ICE at the player's node
    s.selectedNodeId = "gateway";
    getPrimaryIce().attentionNodeId = "gateway";
    getPrimaryIce().detectedAtNode = "gateway";

    // handleIceTick moves ICE to a neighbor of gateway (not gateway itself)
    handleIceTick();

    assert.equal(getPrimaryIce().detectedAtNode, null,
      "detectedAtNode should clear when ICE leaves, so it can re-detect on next visit");
  });
});

// ── ICE detection: alert escalation ──────────────────────────────────────────

describe("ICE detection: alert escalation (grade-scaled, per MANUAL.md)", () => {
  // ICE detection steps the global alert up and starts the trace countdown after
  // a grade-scaled number of detections: S/A=1, B/C=2, D/F=3 (DETECTION_TRACE_
  // THRESHOLD). A single IDS suffices — trace is detection-count-gated, NOT
  // gated on counting red IDS nodes. (#114: code now matches the manual.)
  function buildIceTraceLAN(grade) {
    return {
      graphDef: {
        nodes: [
          createGateway("gateway", { attributes: { visibility: "accessible" } }),
          createIDS("ids-1"),
          createSecurityMonitor("mon-1"),
        ],
        edges: [["gateway", "ids-1"], ["ids-1", "mon-1"]],
        triggers: [],
      },
      meta: { startNode: "gateway", startCash: 0, moneyCost: "C", ice: { grade, startNode: "ids-1" } },
    };
  }

  it("grade A: a single detection starts the trace (instant)", () => {
    clearAll();
    initGame(() => buildIceTraceLAN("A"), "itest-ice-a");
    recordIceDetection("gateway");
    assert.equal(getState().globalAlert, "trace");
    assert.notEqual(getState().traceSecondsRemaining, null);
  });

  it("grade C: first detection raises alert (not trace), second starts trace", () => {
    clearAll();
    initGame(() => buildIceTraceLAN("C"), "itest-ice-c");
    recordIceDetection("gateway");
    assert.equal(getState().globalAlert, "yellow");
    assert.equal(getState().traceSecondsRemaining, null, "one detection must not trace at grade C");
    recordIceDetection("gateway");
    assert.equal(getState().globalAlert, "trace");
    assert.notEqual(getState().traceSecondsRemaining, null);
  });

  it("grade F: takes three detections to start the trace (forgiving)", () => {
    clearAll();
    initGame(() => buildIceTraceLAN("F"), "itest-ice-f");
    recordIceDetection("gateway");
    recordIceDetection("gateway");
    assert.notEqual(getState().globalAlert, "trace", "two detections must not trace at grade F");
    assert.equal(getState().traceSecondsRemaining, null);
    recordIceDetection("gateway");
    assert.equal(getState().globalAlert, "trace");
    assert.notEqual(getState().traceSecondsRemaining, null);
  });

  it("a single IDS is sufficient (not dependent on counting red detectors)", () => {
    clearAll();
    initGame(() => buildIceTraceLAN("C"), "itest-ice-single");
    const detectorCount = Object.values(getState().nodes).filter(n => n.type === "ids").length;
    assert.equal(detectorCount, 1);
    recordIceDetection("gateway");
    recordIceDetection("gateway");
    assert.equal(getState().globalAlert, "trace");
  });
});

// ── teleportIce self-teleport ─────────────────────────────────────────────────

describe("teleportIce: self-teleport does not emit ICE_MOVED", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN(), "itest-15");
    startIce();
  });

  it("does not emit ICE_MOVED when teleporting to the current node", () => {
    const currentNode = getPrimaryIce().attentionNodeId;

    const fired = withEvents(E.ICE_MOVED, () => {
      teleportIce(currentNode);
    });

    assert.equal(fired.length, 0, "ICE_MOVED must not fire when teleporting to current node");
  });

  it("still triggers detection check when teleporting to the current node", () => {
    const s = getState();
    const currentNode = getPrimaryIce().attentionNodeId;
    s.selectedNodeId = currentNode;
    s.nodes[currentNode].accessLevel = "owned";
    getPrimaryIce().detectedAtNode = null;

    const fired = withEvents(E.ICE_DETECT_PENDING, () => {
      teleportIce(currentNode);
    });

    // Grade C ICE has a dwell time (not instant), so ICE_DETECT_PENDING fires
    assert.equal(fired.length, 1, "detection check should still run on self-teleport");
  });
});

// ── Exploit execution timing ───────────────────────────────────────────────────

// ── Timed action lifecycle (graph-native) ──────────────────────────────────────
// These tests verify that the timed-action operator drives probe/exploit/read/loot
// lifecycles through the NodeGraph tick system, replacing the old executor-based
// timer handlers.

describe("Timed action: probe via graph ticks", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildBasicLAN(), "itest-16");
  });

  it("probe action sets probing attribute and completes after ticking", () => {
    const s = getState();
    const graph = s.nodeGraph;
    // Execute the probe action on the gateway via graph
    graph.executeAction("gateway", "probe");
    assert.equal(graph.getNodeState("gateway").probing, true, "probing must be true after action");

    // Tick past the duration (grade D = 20 ticks + 1 for start)
    graph.tick(22);
    assert.equal(graph.getNodeState("gateway").probing, false, "probing must be false after completion");
    assert.equal(s.nodes["gateway"].probed, true, "node must be probed after completion");
  });
});

describe("Navigation: navigateTo / navigateAway", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildBasicLAN(), "itest-17");
  });

  it("navigateTo with no in-progress action just selects the node", () => {
    const s = getState();
    navigateTo("gateway");
    assert.equal(s.selectedNodeId, "gateway");
  });
});

describe("isIceVisible: ICE visible on selected locked node", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN(), "itest-18");
    startIce();
  });

  it("ICE is NOT visible on a locked node when player is not selected there", () => {
    const s = getState();
    teleportIce("gateway");
    // gateway starts locked, no selection
    assert.equal(s.nodes["gateway"].accessLevel, "locked");
    assert.equal(s.selectedNodeId, null);
    assert.equal(isIceVisible(getPrimaryIce(), s.nodes, s.selectedNodeId), false);
  });

  it("ICE IS visible on a locked node when player is actively selected there", () => {
    const s = getState();
    teleportIce("gateway");
    s.selectedNodeId = "gateway";
    assert.equal(s.nodes["gateway"].accessLevel, "locked");
    assert.equal(isIceVisible(getPrimaryIce(), s.nodes, s.selectedNodeId), true);
  });

  it("ICE IS visible on a compromised node regardless of selection", () => {
    const s = getState();
    teleportIce("gateway");
    s.nodes["gateway"].accessLevel = "compromised";
    s.selectedNodeId = null;
    assert.equal(isIceVisible(getPrimaryIce(), s.nodes, s.selectedNodeId), true);
  });
});

// ── WAN node + darknet store ─────────────────────────────────────────────────

describe("WAN node", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildWanLAN({ ice: { grade: "C", startNode: "router-a" } }), "itest-24");
  });

  it("WAN node starts visible and accessible", () => {
    const s = getState();
    const wan = s.nodes["wan"];
    assert.ok(wan, "wan node should exist");
    assert.equal(wan.visibility, "accessible");
  });

  it("access-darknet action is available on WAN node while playing", () => {
    const s = getState();
    const wan = s.nodes["wan"];
    const actions = getAvailableActions(wan, s);
    assert.ok(actions.some((a) => a.id === "access-darknet"), "access-darknet should be available on WAN");
  });

  it("access-darknet action is NOT available on gateway node", () => {
    const s = getState();
    const gateway = s.nodes["gateway"];
    const actions = getAvailableActions(gateway, s);
    assert.ok(!actions.some((a) => a.id === "access-darknet"), "access-darknet should not be on gateway");
  });

  it("standard node actions (probe, exploit, read) are not available on WAN", () => {
    const s = getState();
    const wan = s.nodes["wan"];
    const actions = getAvailableActions(wan, s);
    const blocked = ["probe", "xploit", "dump", "fetch", "reboot"];
    for (const id of blocked) {
      assert.ok(!actions.some((a) => a.id === id), `${id} should not be on WAN`);
    }
  });

  it("ICE movement skips WAN even when adjacent", () => {
    const s = getState();
    // In our fixture, WAN is adjacent to gateway
    const wanNeighbor = Object.keys(s.adjacency).find(nid =>
      s.adjacency[nid]?.includes("wan")
    );
    if (!wanNeighbor || !getPrimaryIce()) { assert.ok(true, "no ICE or WAN not wired"); return; }
    startIce();
    teleportIce(wanNeighbor);
    // Run 50 ICE ticks — WAN should never be visited
    for (let i = 0; i < 50; i++) {
      handleIceTick();
    }
    assert.notEqual(getPrimaryIce()?.attentionNodeId, "wan", "ICE should never move to WAN");
  });
});

describe("buyExploit", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildBasicLAN({ startCash: 1000 }), "itest-19");
  });

  it("adds card to hand and deducts cash", () => {
    const s = getState();
    const before = s.player.cash;
    const card = generateExploit("common");
    const result = buyExploit(card, 100);
    assert.equal(result, true);
    assert.equal(s.player.cash, before - 100);
    assert.ok(s.player.hand.some((c) => c.id === card.id), "card should be in hand");
  });

  it("returns false and leaves state unchanged when cash < price", () => {
    const s = getState();
    s.player.cash = 50;
    const handBefore = s.player.hand.length;
    const card = generateExploit("common");
    const result = buyExploit(card, 100);
    assert.equal(result, false);
    assert.equal(s.player.cash, 50);
    assert.equal(s.player.hand.length, handBefore);
  });
});

// ── Exploit success: revealed state ───────────────────────────────────────────

describe("Exploit success: neighbor visibility", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildBasicLAN(), "itest-20");
  });

  it("successfully exploiting a locked node leaves neighbors as revealed (???), not accessible", () => {
    const s = getState();
    const gateway = s.nodes["gateway"];

    // Gateway neighbors should all be hidden before exploit
    const neighbors = (s.adjacency["gateway"] || []).filter(
      (nid) => s.nodes[nid]?.type !== "wan"
    );
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "hidden",
        `Precondition: ${nid} should be hidden before exploit`);
    }

    // RNG.COMBAT is consumed three times on a from-locked success:
    //   1) success roll, 2) success-flavor pick, 3) skipToOwnedChance roll.
    // Force the third > skipChance so the access level lands on
    // 'compromised', not 'owned'.
    _forceNext(RNG.COMBAT, 0);    // success
    _forceNext(RNG.COMBAT, 0);    // flavor pick
    _forceNext(RNG.COMBAT, 0.99); // bypass skip-to-owned
    launchExploit("gateway", s.player.hand[0].id);

    assert.equal(gateway.accessLevel, "compromised",
      "Gateway should be compromised after successful exploit");

    // Neighbors should be "revealed" (showing as ???), NOT "accessible"
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "revealed",
        `${nid} should be revealed (???) after exploit, not immediately accessible`);
    }
  });

  it("a successful blind exploit also marks the node probed", () => {
    const s = getState();
    const gateway = s.nodes["gateway"];
    assert.equal(gateway.probed, false, "precondition: gateway should start unprobed");

    // Blind exploit (never probed) — force success, flavor, no skip-to-owned
    _forceNext(RNG.COMBAT, 0);
    _forceNext(RNG.COMBAT, 0);
    _forceNext(RNG.COMBAT, 0.99);
    launchExploit("gateway", s.player.hand[0].id);

    assert.equal(gateway.accessLevel, "compromised");
    assert.equal(gateway.probed, true,
      "a successful exploit should count as a probe (compromised ⇒ probed)");
  });
});

// ── gate-access: nodes behind gates are inaccessible until conditions met ────

/**
 * LAN with a firewall (gateAccess: "owned") between gateway and a fileserver.
 * gateway → firewall → fileserver
 */
function buildFirewallGateLAN({ startCash = 0 } = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createFirewall("firewall-1", { attributes: { grade: "D" } }),
        createFileserver("hidden-fs"),
      ],
      edges: [["gateway", "firewall-1"], ["firewall-1", "hidden-fs"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash, moneyCost: "C", ice: null },
  };
}

/**
 * LAN with a router (gateAccess: "compromised") between gateway and a fileserver.
 * gateway → router → fileserver
 */
function buildRouterGateLAN({ startCash = 0 } = {}) {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createRouter("router-gate"),
        createFileserver("behind-router"),
      ],
      edges: [["gateway", "router-gate"], ["router-gate", "behind-router"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash, moneyCost: "C", ice: null },
  };
}

describe("gate-access: nodes behind gates are inaccessible until conditions met", () => {

  describe("firewall gate (gateAccess: 'owned')", () => {
    beforeEach(() => {
      clearAll();
      initGame(() => buildFirewallGateLAN(), "itest-21");
    });

    it("node behind firewall is hidden before any exploit", () => {
      const s = getState();
      assert.equal(s.nodes["hidden-fs"].visibility, "hidden",
        "fileserver behind firewall should start hidden");
    });

    it("compromising the firewall does NOT reveal nodes behind it", () => {
      const s = getState();
      // RNG.COMBAT is consumed three times on a from-locked success:
      //   1) success roll, 2) success-flavor pick, 3) skipToOwnedChance roll.
      // Force the third > skipChance so the access level lands on
      // 'compromised', not 'owned'.
      _forceNext(RNG.COMBAT, 0);    // success
      _forceNext(RNG.COMBAT, 0);    // flavor pick
      _forceNext(RNG.COMBAT, 0.99); // bypass skip-to-owned
      launchExploit("firewall-1", s.player.hand[0].id);

      assert.equal(s.nodes["firewall-1"].accessLevel, "compromised",
        "firewall should be compromised after first successful exploit");
      assert.equal(s.nodes["hidden-fs"].visibility, "hidden",
        "fileserver behind owned-gated firewall must remain hidden when firewall is only compromised");
    });

    it("owning the firewall DOES reveal nodes behind it", () => {
      const s = getState();

      // First exploit: locked → compromised (block skip-to-owned with third roll)
      _forceNext(RNG.COMBAT, 0);    // success
      _forceNext(RNG.COMBAT, 0);    // flavor pick
      _forceNext(RNG.COMBAT, 0.99); // bypass skip-to-owned
      launchExploit("firewall-1", s.player.hand[0].id);
      assert.equal(s.nodes["firewall-1"].accessLevel, "compromised");
      assert.equal(s.nodes["hidden-fs"].visibility, "hidden",
        "precondition: still hidden after compromised");

      // Second exploit: compromised → owned (no skip roll on this transition)
      _forceNext(RNG.COMBAT, 0);    // success
      _forceNext(RNG.COMBAT, 0);    // flavor pick
      launchExploit("firewall-1", s.player.hand[1].id);
      assert.equal(s.nodes["firewall-1"].accessLevel, "owned",
        "firewall should be owned after second exploit");
      assert.equal(s.nodes["hidden-fs"].visibility, "revealed",
        "fileserver behind firewall must be revealed once firewall is owned");
    });
  });

  describe("router gate (gateAccess: 'compromised')", () => {
    beforeEach(() => {
      clearAll();
      initGame(() => buildRouterGateLAN(), "itest-22");
    });

    it("node behind router is hidden before exploit", () => {
      const s = getState();
      assert.equal(s.nodes["behind-router"].visibility, "hidden",
        "fileserver behind router should start hidden");
    });

    it("compromising the router reveals nodes behind it", () => {
      const s = getState();

      // RNG.COMBAT is consumed three times on a from-locked success:
      //   1) success roll, 2) success-flavor pick, 3) skipToOwnedChance roll.
      // Force the third > skipChance so the access level lands on
      // 'compromised', not 'owned'.
      _forceNext(RNG.COMBAT, 0);    // success
      _forceNext(RNG.COMBAT, 0);    // flavor pick
      _forceNext(RNG.COMBAT, 0.99); // bypass skip-to-owned
      launchExploit("router-gate", s.player.hand[0].id);

      assert.equal(s.nodes["router-gate"].accessLevel, "compromised",
        "router should be compromised after first successful exploit");
      assert.equal(s.nodes["behind-router"].visibility, "revealed",
        "fileserver behind compromised-gated router should be revealed on compromise");
    });
  });

  describe("concealed node (quality-based gate via combination lock)", () => {
    beforeEach(() => {
      clearAll();
      initGame(() => buildSetPieceMiniNetwork("combinationLock"), "itest-25");
    });

    it("vault starts concealed and hidden", () => {
      const s = getState();
      const vault = s.nodes["sp/vault"];
      assert.ok(vault, "vault node should exist in state");
      assert.equal(vault.concealed, true, "vault should start concealed");
      assert.equal(vault.visibility, "hidden", "vault should start hidden");
    });

    it("vault remains hidden even when gateway neighbors are revealed", () => {
      const s = getState();

      // Probe the gateway to reveal its neighbors (the switches and gate)
      // The vault is connected to the gate, not directly to gateway,
      // but even if we reveal everything around it, concealed blocks it.
      // First, exploit gateway to reveal neighbors
      _forceNext(RNG.COMBAT, 0);
      _forceNext(RNG.COMBAT, 0);
      launchExploit("gateway", s.player.hand[0].id);

      // Vault should still be hidden because it's concealed
      const vault = s.nodes["sp/vault"];
      assert.equal(vault.concealed, true, "vault must remain concealed");
      assert.equal(vault.visibility, "hidden", "concealed vault must stay hidden");
    });

    it("vault becomes visible after all combination lock switches are activated", () => {
      const s = getState();
      const graph = s.nodeGraph;

      // Activate all 3 switches via the node graph (same pattern as set-pieces.test.js)
      for (const sw of ["sp/switch-a", "sp/switch-b", "sp/switch-c"]) {
        graph.setNodeAttr(sw, "accessLevel", "owned");
        graph.executeAction(sw, "activate");
      }

      const vault = s.nodes["sp/vault"];
      assert.equal(vault.concealed, false,
        "vault should no longer be concealed after all switches activated");
      // The revealNode ctx call sets visibility to "revealed"
      assert.notEqual(vault.visibility, "hidden",
        "vault should be visible (revealed or accessible) after trigger fires");
    });
  });
});

// ── Mine action ──────────────────────────────────────────────────────────────
// End-to-end: owning a node enables MINE, a timed action that on completion rolls
// a grade×attempts yield chance. Hit → node-intrinsic exploit card to hand; miss →
// nothing. Either way mineAttempts increments; once the next yield drops below the
// tap-out threshold, mineExhausted is set and the action disappears.

describe("mine action", () => {
  /** Number of ticks needed to complete a mine on a given grade. */
  const MINE_DURATION = { S: 70, A: 60, B: 50, C: 40, D: 35, F: 30 };

  /** Own the gateway and return its grade-appropriate mine duration. */
  function ownGateway() {
    const s = getState();
    setNodeAccessLevel("gateway", "owned");
    const grade = s.nodes["gateway"].grade ?? "D";
    return MINE_DURATION[grade] ?? MINE_DURATION.D;
  }

  beforeEach(() => {
    clearAll();
    initGame(() => buildBasicLAN(), "itest-23");
  });

  it("a HIT adds an exploit card to hand and increments mineAttempts", () => {
    const s = getState();
    const duration = ownGateway();
    assert.ok((s.nodes["gateway"].vulnerabilities ?? []).length > 0,
      "precondition: gateway should have at least one vulnerability");

    const handBefore = s.player.hand.length;

    // Force a HIT: yield roll well below any chance, then rarity/vuln picks.
    _forceNext(RNG.MINE, 0.0);   // yield roll → hit
    _forceNext(RNG.MINE, 0.0);   // rarity roll → first bucket
    _forceNext(RNG.MINE, 0.0);   // vuln index pick

    const graph = s.nodeGraph;
    graph.executeAction("gateway", "mine");
    assert.equal(graph.getNodeState("gateway").mining, true, "mining must be true after action");

    tick(duration + 2);

    assert.equal(s.player.hand.length, handBefore + 1, "a hit should add exactly one card to hand");
    assert.equal(s.nodes["gateway"].mineAttempts, 1, "mineAttempts should be 1 after one completion");
    assert.equal(s.nodes["gateway"].mining, false, "mining should clear after completion");
  });

  it("emits action-feedback progress events during the mine (per-tick progress feedback, drives ICE noise via ice.js)", () => {
    const s = getState();
    const duration = ownGateway();

    _forceNext(RNG.MINE, 0.0);
    _forceNext(RNG.MINE, 0.0);
    _forceNext(RNG.MINE, 0.0);

    const captured = [];
    const handler = (p) => captured.push(p);
    on(E.ACTION_FEEDBACK, handler);
    s.nodeGraph.executeAction("gateway", "mine");
    tick(duration + 2);
    off(E.ACTION_FEEDBACK, handler);

    const progress = captured.filter((p) => p.action === A.MINE && p.phase === "progress");
    assert.ok(progress.length > 0, "at least one mine progress feedback event must fire");
  });

  it("drives to tap-out and removes the MINE action when exhausted", () => {
    const s = getState();
    const grade = s.nodes["gateway"].grade ?? "D";
    const duration = ownGateway();

    let guard = 0;
    while (!s.nodes["gateway"].mineExhausted) {
      assert.ok(guard++ < 100, "tap-out should be reached within a sane number of attempts");
      _forceNext(RNG.MINE, 0.999); // yield roll → miss
      s.nodeGraph.executeAction("gateway", "mine");
      tick(duration + 2);
    }

    assert.equal(s.nodes["gateway"].mineExhausted, true, "node should be exhausted");
    const actionIds = getAvailableActions(s.nodes["gateway"], s).map((a) => a.id);
    assert.ok(!actionIds.includes(A.MINE),
      "MINE action must not be available once the vein is tapped out");
  });

  it("a MISS emits ACTION_RESOLVED with detail.outcome 'miss' and adds no card", () => {
    const s = getState();
    const duration = ownGateway();
    const handBefore = s.player.hand.length;

    _forceNext(RNG.MINE, 0.999); // yield roll → miss

    const resolved = withEvents(E.ACTION_RESOLVED, () => {
      s.nodeGraph.executeAction("gateway", "mine");
      tick(duration + 2);
    }).filter((p) => p.action === A.MINE);

    assert.equal(resolved.length, 1, "exactly one mine ACTION_RESOLVED should fire");
    assert.equal(resolved[0].detail.outcome, "miss", "outcome should be 'miss'");
    assert.equal(s.player.hand.length, handBefore, "a miss must not add a card");
  });

  it("ABORT cancels an in-progress mine", () => {
    const s = getState();
    ownGateway();

    s.nodeGraph.executeAction("gateway", "mine");
    tick(2);
    assert.equal(s.nodes["gateway"].mining, true, "precondition: mining in progress");

    s.nodeGraph.executeAction("gateway", "abort");
    assert.equal(s.nodes["gateway"].mining, false, "mining should be false after abort");
  });

  it("mineAttempts and mineExhausted survive a serialize/deserialize round-trip", () => {
    setNodeAccessLevel("gateway", "owned");

    incrementMineAttempts("gateway");
    incrementMineAttempts("gateway");
    incrementMineAttempts("gateway");
    incrementMineAttempts("gateway");
    setMineExhausted("gateway", true);

    const snapshot = JSON.parse(JSON.stringify(serializeState()));
    deserializeState(snapshot);

    const after = getState();
    assert.equal(after.nodes["gateway"].mineAttempts, 4, "mineAttempts should survive round-trip");
    assert.equal(after.nodes["gateway"].mineExhausted, true, "mineExhausted should survive round-trip");
  });

  it("MINE_TAPOUT threshold is the documented ~5%", () => {
    assert.equal(MINE_TAPOUT, 0.05);
  });
});

describe("ice runtime: iterates all active instances", () => {
  // Wire the ICE_MOVE timer → handleIceTick. This mirrors what main.js does.
  // The handler is registered once for the suite and persists across tests;
  // we do NOT call clearHandlers() here to avoid breaking the module-level
  // alert.js / ice.js listeners that other tests in this file depend on.
  const iceMoveHandler = () => handleIceTick();
  before(() => {
    on(TIMER.ICE_MOVE, iceMoveHandler);
  });
  after(() => {
    off(TIMER.ICE_MOVE, iceMoveHandler);
  });

  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN({ grade: "D" }));
  });

  it("two active instances both move on a tick", () => {
    const s = getState();
    // Inject a second active instance directly into the collection.
    s.ice.instances["ice-2"] = {
      id: "ice-2",
      typeId: "patrol-classic-D",
      hostNodeId: "gateway",
      attentionNodeId: "gateway",
      active: true,
      enabled: true,
      grade: "D",
      focus: "roaming",
      behaviorPattern: "patrol-random",
      dwellTimerId: null,
      detectedAtNode: null,
      detectionCount: 0,
    };

    startIce();

    const before1 = s.ice.instances["ice-1"].attentionNodeId;
    const before2 = s.ice.instances["ice-2"].attentionNodeId;

    // Advance one ICE_MOVE interval. D grade = 12000ms / 100ms-per-tick = 120 ticks.
    // (tick() takes a tick count, not milliseconds.)
    tick(120);

    const after1 = s.ice.instances["ice-1"].attentionNodeId;
    const after2 = s.ice.instances["ice-2"].attentionNodeId;

    // In the 2-node LAN (gateway ↔ router-a), both must have moved.
    assert.notEqual(after1, before1);
    assert.notEqual(after2, before2);
  });
});

describe("ice events: iceId in payload", () => {
  const iceMoveHandler = () => handleIceTick();
  before(() => {
    on(TIMER.ICE_MOVE, iceMoveHandler);
  });
  after(() => {
    off(TIMER.ICE_MOVE, iceMoveHandler);
  });

  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN({ grade: "D" }));
  });

  it("ICE_MOVED payload carries iceId", () => {
    startIce();
    const payloads = withEvents(E.ICE_MOVED, () => {
      tick(120); // one D-grade movement interval (12000ms / 100ms per tick)
    });
    assert.ok(payloads.length > 0, "expected at least one ICE_MOVED");
    assert.equal(payloads[0].iceId, "ice-1");
  });

  it("ICE_EJECTED payload carries iceId", () => {
    const payloads = withEvents(E.ICE_EJECTED, () => {
      ejectIce();
    });
    assert.ok(payloads.length > 0, "expected at least one ICE_EJECTED");
    assert.equal(payloads[0].iceId, "ice-1");
  });
});

// ── EXEC synthetic action injection ──────────────────────────────────────────

describe("EXEC synthetic action injection", () => {
  beforeEach(() => { clearAll(); initGame(() => buildAlertLAN(), "itest-exec"); });

  it("a node with a script (owned IDS → corrupt) gains an EXEC action whose followup lists the script", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actions = getAvailableActions(s.nodes["ids-1"], s);
    const exec = actions.find((a) => a.id === A.EXEC);
    assert.ok(exec, "EXEC should be present");
    assert.ok(exec.followup, "EXEC should carry a followup");
    const choiceIds = exec.followup.choices(s.nodes["ids-1"], s).map((c) => c.id);
    assert.ok(choiceIds.includes("corrupt"), "corrupt should be an EXEC choice");
    const corruptChoice = exec.followup.choices(s.nodes["ids-1"], s).find((c) => c.id === "corrupt");
    assert.equal(corruptChoice.render, "action", "script choices use the 'action' render type");
    assert.equal(corruptChoice.payloadKey, "scriptId");
    assert.ok(corruptChoice.data.label, "choice carries a display label");
  });

  it("a node with no scripts gets no EXEC action", () => {
    const s = getState();
    const actions = getAvailableActions(s.nodes["gateway"], s);
    assert.ok(!actions.some((a) => a.id === A.EXEC), "no EXEC when no scripts");
  });

  it("EXEC.execute runs the chosen script (forwarding disabled), same as dispatching it directly", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const exec = getAvailableActions(s.nodes["ids-1"], s).find((a) => a.id === A.EXEC);
    exec.execute(s.nodes["ids-1"], s, {}, { scriptId: "corrupt", nodeId: "ids-1" });
    assert.equal(s.nodes["ids-1"].forwardingEnabled, false);
  });
});

// ── kick action (renamed from eject) ─────────────────────────────────────────

describe("kick action (renamed from eject)", () => {
  it("kick is the verb on an owned node with ICE present, and ejects ICE", () => {
    clearAll();
    initGame(() => buildAlertLAN({ ice: { grade: "C", startNode: "ids-1" } }), "itest-kick");
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    startIce();
    getPrimaryIce().attentionNodeId = "ids-1";

    const ids = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(ids.includes("kick"), "kick should be available on owned node with ICE present");
    assert.ok(!ids.includes("eject"), "eject must be gone — rename is complete");

    const fired = withEvents(E.ICE_EJECTED, () => {
      s.nodeGraph.executeAction("ids-1", "kick");
    });
    assert.ok(fired.length > 0, "kick must fire ICE_EJECTED (internal mechanism unchanged)");
  });
});

// ── EXEC dispatch echo ────────────────────────────────────────────────────────

describe("EXEC dispatch echo", () => {
  before(() => { initActionDispatcher(buildActionContext()); });

  it("dispatching exec with a scriptId echoes 'exec <script>' once and runs the script", () => {
    clearAll();
    initGame(() => buildAlertLAN(), "itest-exec-echo");
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);

    const echoes = [];
    const h = ({ cmd }) => echoes.push(cmd);
    on(E.COMMAND_ISSUED, h);
    emitEvent("starnet:action", { actionId: "exec", nodeId: "ids-1", scriptId: "corrupt" });
    off(E.COMMAND_ISSUED, h);

    assert.deepEqual(echoes, ["exec corrupt"], "exactly one echo reading 'exec corrupt'");
    assert.equal(getState().nodes["ids-1"].forwardingEnabled, false, "script ran");
  });
});
