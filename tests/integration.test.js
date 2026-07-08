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
// Each test group constructs a minimal LAN fixture using node-factories.js factories.
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
} from "../js/core/node-graph/node-factories.js";
import { buildSetPieceMiniNetwork } from "../js/core/node-graph/mini-network.js";
import { initGame, getState, isIceVisible, addHeat } from "../js/core/state.js";
import { navigateTo, navigateAway } from "../js/core/navigation.js";
import { startIce, handleIceTick, handleIceDetect, teleportIce, ejectIce } from "../js/core/ice.js";
import { emitEvent, on, off, E } from "../js/core/events.js";
import { clearAll, tick, scheduleEvent, TIMER } from "../js/core/timers.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { setNodeAccessLevel, serializeState, deserializeState } from "../js/core/state.js";
import { incrementMineAttempts, setMineExhausted, setNodeVisible, setNodeProbed } from "../js/core/state/node.js";
import { flowId } from "../js/core/state/flow.js";
import { addCapturedCredential } from "../js/core/state/player.js";
import { A } from "../js/core/action-ids.js";
import { SNIFF_DURATION, REPLAY_DURATION } from "../js/core/balance.js";
import { MINE_TAPOUT } from "../js/core/mining.js";
import { startAutoBurn, initAutoBurn } from "../js/core/autoburn.js";
import { setHoard } from "../js/core/state/player.js";
import { startTraceCountdown, recordIceDetection } from "../js/core/alert.js";
import { setGlobalAlert } from "../js/core/state/alert.js";
// Importing alert.js above registers its module-level NODE_ALERT_RAISED /
// NODE_RECONFIGURED listeners. No separate init call needed.
// Old executor imports removed — timed actions now graph-native
import { RNG, _forceNext } from "../js/core/rng.js";
import { handleCheatCommand } from "../js/core/cheats.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";
import { activeIceInstances } from "../js/core/state/ice.js";
import { cmdStatusIce } from "../js/core/console-commands/cmd-status.js";
import { initActionDispatcher, buildActionContext } from "../js/core/actions/action-context.js";
import { activeProcessOnNode } from "../js/core/processes.js";
import { setNodeCoherence } from "../js/core/state/node.js";
import { DEFAULT_START_HOARD } from "../js/core/hoard.js";

/** First active ICE instance, or null. */
const firstIce = () => activeIceInstances(getState())[0] ?? null;

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
    assert.ok(firstIce()?.active);
  });

  it("owning security-monitor sets ice.active to false", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("sec-mon", "accessLevel", "owned");
    // ICE_DISABLED setIceActive(false) makes firstIce() return null
    assert.equal(firstIce(), null);
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
    assert.ok(firstIce()?.active, "ICE should remain active");
  });
});

// ── Lifecycle: monitor — trace cancellation ───────────────────────────────────

describe("Lifecycle: monitor — cancelling an active trace is explicit", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceWithMonitorLAN(), "itest-5");
    startTraceCountdown();
  });

  it("trace is active before the test action", () => {
    assert.notEqual(getState().traceSecondsRemaining, null);
  });

  it("owning the monitor does NOT auto-cancel the trace", () => {
    // The player must explicitly run cancel-trace; merely owning the monitor (which
    // reveals connections / aggregates alerts) leaves the trace running. Ticking while
    // owned must not cancel it either — there is no owned-cancel-trace trigger.
    const s = getState();
    const fired = withEvents(E.ALERT_TRACE_CANCELLED, () => {
      s.nodeGraph.setNodeAttr("sec-mon", "accessLevel", "owned");
      s.nodeGraph.tick(5);
      s.nodeGraph.tick(5);
    });
    assert.equal(fired.length, 0, "owning the monitor must not emit ALERT_TRACE_CANCELLED");
    assert.notEqual(getState().traceSecondsRemaining, null, "trace must still be running");
  });

  it("executing cancel-trace on the owned monitor cancels the trace (emits once)", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("sec-mon", "accessLevel", "owned");
    const fired = withEvents(E.ALERT_TRACE_CANCELLED, () => {
      s.nodeGraph.executeAction("sec-mon", "cancel-trace");
    });
    assert.equal(fired.length, 1);
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

// (The legacy "Alert flow: ids alert escalates global alert" suite was removed in #173 —
//  it injected alertState/eventForwardingDisabled directly to exercise the retired
//  recomputeGlobalAlert path. The honest replacement is the "security grid: IDS->monitor
//  escalation" suite, which drives the real relay→monitor→recordMonitorAlert chain.)

// ── Action availability ───────────────────────────────────────────────────────

describe("Action availability: corrupt on ids", () => {
  before(() => {
    clearAll();
    initGame(() => buildAlertLAN(), "itest-7");
  });

  it("not available when forwardingEnabled is false", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");
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
    firstIce().detectedAtNode = "gateway"; // simulate: detection already happened here

    navigateTo("router-a");

    assert.equal(firstIce().detectedAtNode, null,
      "detectedAtNode should clear so ICE can detect at gateway again after player returns");
  });

  it("re-selecting the SAME node does NOT reset detectedAtNode", () => {
    const s = getState();
    s.selectedNodeId = "gateway";
    firstIce().detectedAtNode = "gateway";

    navigateTo("gateway");

    assert.equal(firstIce().detectedAtNode, "gateway",
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
    firstIce().attentionNodeId = "gateway";

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
    firstIce().attentionNodeId = "gateway";
    s.nodes["gateway"].accessLevel = "owned";

    // Simulate a detection dwell that is already running. The runtime tracks the
    // dwell as the instance's own dwellTimerId (keyed by iceId) — mirror that so
    // ejection cancels the right timer.
    const ice = firstIce();
    const dwellId = scheduleEvent(TIMER.ICE_DETECT, 500, { iceId: ice.id, nodeId: "gateway" });
    ice.dwellTimerId = dwellId;

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
    firstIce().attentionNodeId = "gateway";
    firstIce().detectedAtNode = "gateway";

    // handleIceTick moves ICE to a neighbor of gateway (not gateway itself)
    handleIceTick();

    assert.equal(firstIce().detectedAtNode, null,
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
    const currentNode = firstIce().attentionNodeId;

    const fired = withEvents(E.ICE_MOVED, () => {
      teleportIce(currentNode);
    });

    assert.equal(fired.length, 0, "ICE_MOVED must not fire when teleporting to current node");
  });

  it("still triggers detection check when teleporting to the current node", () => {
    const s = getState();
    const currentNode = firstIce().attentionNodeId;
    s.selectedNodeId = currentNode;
    s.nodes[currentNode].accessLevel = "owned";
    firstIce().detectedAtNode = null;

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
    assert.equal(isIceVisible(firstIce(), s.nodes, s.selectedNodeId), false);
  });

  it("ICE IS visible on a locked node when player is actively selected there", () => {
    const s = getState();
    teleportIce("gateway");
    s.selectedNodeId = "gateway";
    assert.equal(s.nodes["gateway"].accessLevel, "locked");
    assert.equal(isIceVisible(firstIce(), s.nodes, s.selectedNodeId), true);
  });

  it("ICE IS visible on an owned node regardless of selection", () => {
    const s = getState();
    teleportIce("gateway");
    s.nodes["gateway"].accessLevel = "owned";
    s.selectedNodeId = null;
    assert.equal(isIceVisible(firstIce(), s.nodes, s.selectedNodeId), true);
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
    if (!wanNeighbor || !firstIce()) { assert.ok(true, "no ICE or WAN not wired"); return; }
    startIce();
    teleportIce(wanNeighbor);
    // Run 50 ICE ticks — WAN should never be visited
    for (let i = 0; i < 50; i++) {
      handleIceTick();
    }
    assert.notEqual(firstIce()?.attentionNodeId, "wan", "ICE should never move to WAN");
  });
});

// ── Exploit success: revealed state ───────────────────────────────────────────

/**
 * Crack a node to owned via the auto-burn process: seed a generous hoard and a
 * near-dead coherence so a couple of ticks own it. This is the post-E1 path that
 * replaced the card launchExploit — XPLOIT → startAutoBurn → coherence erosion →
 * crack → owned (+ revealNeighbors). Asserts the crack landed.
 */
function crackViaAutoBurn(nodeId) {
  initAutoBurn();
  setHoard(
    Array.from({ length: 20 }, (_, i) => ({
      id: `crk${i.toString(16).padStart(5, "0")}`,
      rarity: "rare",
      types: ["unpatched-ssh"],
      disclosed: false,
    })),
  );
  setNodeCoherence(nodeId, 1); // nearly dead → cracks fast
  startAutoBurn(nodeId);
  tick(50);
  assert.equal(getState().nodes[nodeId].accessLevel, "owned",
    `precondition: ${nodeId} should be cracked to owned via auto-burn`);
}

describe("Exploit success: neighbor visibility", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildBasicLAN(), "itest-20");
  });

  it("cracking a node reveals its neighbors as revealed (???), not immediately accessible", () => {
    const s = getState();

    // Gateway neighbors should all be hidden before the crack
    const neighbors = (s.adjacency["gateway"] || []).filter(
      (nid) => s.nodes[nid]?.type !== "wan"
    );
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "hidden",
        `Precondition: ${nid} should be hidden before crack`);
    }

    crackViaAutoBurn("gateway");

    // Neighbors should be "revealed" (showing as ???), NOT "accessible"
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "revealed",
        `${nid} should be revealed (???) after crack, not immediately accessible`);
    }
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
 * LAN with a router (gateAccess: "open") between gateway and a fileserver.
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

  describe("firewall gate (gateAccess: 'owned' — reveal only on crack)", () => {
    beforeEach(() => {
      clearAll();
      initGame(() => buildFirewallGateLAN(), "itest-21");
    });

    it("node behind firewall is hidden before any recon", () => {
      const s = getState();
      assert.equal(s.nodes["hidden-fs"].visibility, "hidden",
        "fileserver behind firewall should start hidden");
    });

    it("probing the firewall does NOT reveal nodes behind it", () => {
      const s = getState();
      // A firewall's gateAccess is "owned": recon alone (PROBE) does not leak what's
      // beyond it — only gaining control (crack → owned) does.
      s.nodeGraph._ctx.resolveProbe("firewall-1");

      assert.equal(s.nodes["firewall-1"].probed, true,
        "firewall should be probed after PROBE");
      assert.equal(s.nodes["hidden-fs"].visibility, "hidden",
        "fileserver behind owned-gated firewall must stay hidden on a mere probe");
    });

    it("cracking the firewall (auto-burn → owned) DOES reveal nodes behind it", () => {
      const s = getState();
      // Probe first (does not reveal — see the test above).
      s.nodeGraph._ctx.resolveProbe("firewall-1");
      assert.equal(s.nodes["hidden-fs"].visibility, "hidden",
        "precondition: still hidden after probe");

      crackViaAutoBurn("firewall-1");
      assert.equal(s.nodes["hidden-fs"].visibility, "revealed",
        "fileserver behind firewall must be revealed once the firewall is owned");
    });
  });

  describe("router gate (gateAccess: 'probed' — reveal on recon)", () => {
    beforeEach(() => {
      clearAll();
      initGame(() => buildRouterGateLAN(), "itest-22");
    });

    it("node behind router is hidden before recon", () => {
      const s = getState();
      assert.equal(s.nodes["behind-router"].visibility, "hidden",
        "fileserver behind router should start hidden");
    });

    it("probing the router reveals nodes behind it (no exploit needed)", () => {
      const s = getState();
      // A router's gateAccess is "probed": it leaks its topology to recon. Probing
      // it is enough to reveal what's beyond — the router/firewall distinction.
      s.nodeGraph._ctx.resolveProbe("router-gate");

      assert.equal(s.nodes["router-gate"].probed, true,
        "router should be probed after PROBE");
      assert.equal(s.nodes["behind-router"].visibility, "revealed",
        "fileserver behind a probed router should be revealed on recon");
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

      // Crack the gateway (auto-burn → owned) to reveal its neighbors. The vault is
      // connected to the gate, not directly to gateway, but even if we reveal
      // everything around it, `concealed` blocks it.
      crackViaAutoBurn("gateway");

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
      graph.tick(20); // activate is timed-by-default (#187 default-flip) — let it complete

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

  it("a HIT adds a round to the hoard and increments mineAttempts", () => {
    const s = getState();
    const duration = ownGateway();
    assert.ok((s.nodes["gateway"].vulnerabilities ?? []).length > 0,
      "precondition: gateway should have at least one vulnerability");

    const hoardBefore = s.player.hoard.length;

    // Force a HIT: yield roll well below any chance, then rarity roll.
    _forceNext(RNG.MINE, 0.0);   // yield roll → hit
    _forceNext(RNG.MINE, 0.0);   // rarity roll → first bucket (common)

    const graph = s.nodeGraph;
    graph.executeAction("gateway", "mine");
    assert.equal(graph.getNodeState("gateway").mining, true, "mining must be true after action");

    tick(duration + 2);

    assert.equal(s.player.hoard.length, hoardBefore + 1, "a hit should add exactly one round to hoard");
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

  it("a MISS emits ACTION_RESOLVED with detail.outcome 'miss' and adds no round", () => {
    const s = getState();
    const duration = ownGateway();
    const hoardBefore = s.player.hoard.length;

    _forceNext(RNG.MINE, 0.999); // yield roll → miss

    const resolved = withEvents(E.ACTION_RESOLVED, () => {
      s.nodeGraph.executeAction("gateway", "mine");
      tick(duration + 2);
    }).filter((p) => p.action === A.MINE);

    assert.equal(resolved.length, 1, "exactly one mine ACTION_RESOLVED should fire");
    assert.equal(resolved[0].detail.outcome, "miss", "outcome should be 'miss'");
    assert.equal(s.player.hoard.length, hoardBefore, "a miss must not add a round");
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

describe("honey-pot trap: MINE springs the counter-trace", () => {
  beforeEach(() => {
    clearAll();
  });

  it("mining a trap node poisons it, starts the trace, and grants no round", () => {
    initGame(() => buildCorporateExchange(), "honeypot-mine-seed");
    const s = getState();
    const graph = s.nodeGraph;
    const hoardBefore = s.player.hoard.length;

    graph.executeAction("pot/honey-pot", "mine");
    graph.tick(60);

    assert.equal(graph.getNodeState("pot/honey-pot").poisoned, true, "mine must poison the node");
    assert.notEqual(getState().traceSecondsRemaining, null, "mine must start the trace");
    assert.equal(getState().player.hoard.length, hoardBefore, "mine must grant no round on a trap node");
  });
});

describe("timed-action cancel clears the operator's real progress attr (B2)", () => {
  beforeEach(() => { clearAll(); });

  it("navigating away from an in-progress DUMP resets _ta_dump_progress", () => {
    initGame(() => buildCorporateExchange(), "b2-dump-cancel-seed");
    const graph = getState().nodeGraph;

    navigateTo("pot/honey-pot");
    graph.setNodeAttr("pot/honey-pot", "probed", true); // DUMP is gated on recon (probed)
    graph.executeAction("pot/honey-pot", "dump");
    graph.tick(3); // advance but do not complete (dump duration is >= 8 ticks)

    assert.equal(graph.getNodeState("pot/honey-pot").reading, true, "dump should be in progress");
    assert.ok(graph.getNodeState("pot/honey-pot")._ta_dump_progress > 0,
      "operator should have advanced _ta_dump_progress");

    navigateAway(); // emits PLAYER_NAVIGATED → navigation-cancel handler

    const after = graph.getNodeState("pot/honey-pot");
    assert.equal(after.reading, false, "navigation must cancel the dump");
    assert.equal(after._ta_dump_progress, 0,
      "cancel must reset the operator's real progress attr, not a phantom _ta_read_progress");
  });
});

describe("cheat alert set/raise/lower (#174)", () => {
  beforeEach(() => { clearAll(); initGame(() => buildBasicLAN(), "cheat-alert"); });

  it("set forces the global alert to a level", () => {
    handleCheatCommand(["alert", "set", "red"]);
    assert.equal(getState().globalAlert, "red");
  });

  it("raise and lower step the global alert one level", () => {
    handleCheatCommand(["alert", "set", "green"]);
    handleCheatCommand(["alert", "raise"]);
    assert.equal(getState().globalAlert, "yellow");
    handleCheatCommand(["alert", "raise"]);
    assert.equal(getState().globalAlert, "red");
    handleCheatCommand(["alert", "lower"]);
    assert.equal(getState().globalAlert, "yellow");
  });

  it("lowering out of trace cancels the trace countdown", () => {
    handleCheatCommand(["alert", "set", "trace"]);
    assert.equal(getState().globalAlert, "trace");
    assert.notEqual(getState().traceSecondsRemaining, null, "trace should be running");
    handleCheatCommand(["alert", "lower"]);
    assert.equal(getState().globalAlert, "red");
    assert.equal(getState().traceSecondsRemaining, null, "lowering out of trace must cancel the countdown");
  });

  it("raise saturates at trace, lower at green", () => {
    handleCheatCommand(["alert", "set", "green"]);
    handleCheatCommand(["alert", "lower"]);
    assert.equal(getState().globalAlert, "green");
    handleCheatCommand(["alert", "set", "trace"]);
    handleCheatCommand(["alert", "raise"]);
    assert.equal(getState().globalAlert, "trace");
  });
});

describe("cheat hurt/heal heat (#295 — manual heat testing)", () => {
  beforeEach(() => { clearAll(); initGame(() => buildBasicLAN(), "cheat-heat"); });

  it("hurt heat raises heat; a small amount stays under the alarm", () => {
    assert.equal(getState().heat, 0);
    handleCheatCommand(["hurt", "heat", "5"]);
    assert.equal(getState().heat, 5);
    assert.equal(getState().globalAlert, "green", "5 heat is under the threshold — no trip");
  });

  it("heal heat lowers heat by an amount, floored at 0", () => {
    handleCheatCommand(["hurt", "heat", "5"]);
    handleCheatCommand(["heal", "heat", "2"]);
    assert.equal(getState().heat, 3);
    handleCheatCommand(["heal", "heat", "10"]); // over-heal floors at 0
    assert.equal(getState().heat, 0);
  });

  it("heal heat with no amount drops heat to 0", () => {
    handleCheatCommand(["hurt", "heat", "7"]);
    handleCheatCommand(["heal", "heat"]);
    assert.equal(getState().heat, 0);
  });

  it("hurt heat over the threshold trips the alarm and discharges (real recordHeat path)", () => {
    handleCheatCommand(["hurt", "heat", "50"]);
    assert.notEqual(getState().globalAlert, "green", "a big heat spike must trip the ladder");
    assert.ok(getState().heat < 50, "heat is discharged on a trip so it must rebuild");
  });

  it("rejects a non-positive hurt amount without changing heat", () => {
    handleCheatCommand(["hurt", "heat", "0"]);
    assert.equal(getState().heat, 0);
    handleCheatCommand(["hurt", "heat", "-3"]);
    assert.equal(getState().heat, 0);
  });
});

describe("lie low → heat cooling (anti-tedium arc)", () => {
  beforeEach(() => { clearAll(); });
  const sendAlert = (graph) => graph.sendMessage("sp/ids", { type: "alert", payload: {} });
  const climbToRed = (graph) => { sendAlert(graph); sendAlert(graph); sendAlert(graph); };
  const completeLieLow = (graph) => { graph.executeAction("wan", "lie-low"); graph.tick(60); };

  it("lie-low sheds heat and spends a use, but does NOT lower the alert (subversion does that now)", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "lielow-1");
    const graph = getState().nodeGraph;
    climbToRed(graph);                       // grid raises the alert ladder
    const alertBefore = getState().globalAlert;
    assert.notEqual(alertBefore, "green");
    addHeat(5);                              // heat built up separately

    completeLieLow(graph);

    assert.ok(getState().heat < 5, "lie-low shed heat");
    assert.equal(getState().globalAlert, alertBefore, "alert unchanged — lie-low is heat-only");
    assert.equal(graph.getNodeState("wan").lieLowUsesRemaining, 1, "one use spent");
  });

  it("exhausts after 2 uses, then the action is unavailable", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "lielow-2");
    const graph = getState().nodeGraph;
    climbToRed(graph); completeLieLow(graph);
    climbToRed(graph); completeLieLow(graph);
    assert.equal(graph.getNodeState("wan").lieLowUsesRemaining, 0);
    assert.equal(graph.getNodeState("wan").lieLowExhausted, true, "exhausted after 2 uses");
    assert.ok(!graph.getAvailableActions("wan").some((a) => a.id === "lie-low"),
      "lie-low no longer offered once exhausted");
  });

  it("is not re-offered while already in progress", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "lielow-reentry");
    const graph = getState().nodeGraph;
    graph.executeAction("wan", "lie-low");
    graph.tick(5); // mid-wait, lyingLow still true
    assert.equal(graph.getNodeState("wan").lyingLow, true, "should be lying low");
    assert.ok(!graph.getAvailableActions("wan").some((a) => a.id === "lie-low"),
      "lie-low must not be re-offered while in progress (would reset the timer)");
  });

  it("navigating away cancels an in-progress lie-low (no grid change)", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "lielow-3");
    const graph = getState().nodeGraph;
    climbToRed(graph);
    const before = getState().globalAlert;
    graph.executeAction("wan", "lie-low");
    graph.tick(5); // partial — operator has set _ta_lie-low_duration by now
    navigateAway(); // PLAYER_NAVIGATED → nav-cancel
    assert.equal(graph.getNodeState("wan").lyingLow, false, "lie-low cancelled");
    assert.equal(getState().globalAlert, before, "no grid change from a cancelled lie-low");
    // Duration must reset too, else a restart skips the operator's "start" phase.
    assert.equal(graph.getNodeState("wan")["_ta_lie-low_duration"], 0, "duration cleared on cancel");
  });

  it("re-arms (re-emits the start phase) when restarted after a cancel", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "lielow-rearm");
    const graph = getState().nodeGraph;
    graph.executeAction("wan", "lie-low");
    graph.tick(5);
    navigateAway(); // cancel mid-wait
    // Restart: a fresh "start" ACTION_FEEDBACK must fire (the overlay/log dispatcher keys off it).
    const fb = withEvents(E.ACTION_FEEDBACK, () => {
      graph.executeAction("wan", "lie-low");
      graph.tick(1);
    });
    assert.ok(fb.some((p) => p.action === A.LIE_LOW && p.phase === "start"),
      "restarting after a cancel must re-emit the lie-low start phase");
  });

  it("is a no-op while a trace is running (no use spent)", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "lielow-4");
    const graph = getState().nodeGraph;
    for (let i = 0; i < 30 && getState().traceSecondsRemaining === null; i++) sendAlert(graph);
    assert.equal(getState().globalAlert, "trace");
    completeLieLow(graph);
    assert.equal(getState().globalAlert, "trace", "lie-low must not cool an active trace");
    assert.equal(graph.getNodeState("wan").lieLowUsesRemaining, 2, "no use spent at trace");
  });
});

describe("security grid cooldown: scrub logs (#174)", () => {
  beforeEach(() => { clearAll(); });
  const ORDER = ["green", "yellow", "red", "trace"];
  const sendAlert = (graph) => graph.sendMessage("sp/ids", { type: "alert", payload: {} });

  it("scrubbing an owned monitor resets its alertCount and eases the global alert one level", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "scrub-1");
    const graph = getState().nodeGraph;
    sendAlert(graph); sendAlert(graph); sendAlert(graph); // 3 alerts (grade C): climbs to red
    const before = getState().globalAlert;
    assert.notEqual(before, "green", "grid should have climbed");
    assert.ok(graph.getNodeState("sp/monitor").alertCount > 0, "monitor should have accumulated");

    graph.setNodeAttr("sp/monitor", "accessLevel", "owned");
    graph.executeAction("sp/monitor", "scrub-logs");
    graph.tick(20); // scrub-logs is timed-by-default (#187 default-flip) — let it complete

    assert.equal(graph.getNodeState("sp/monitor").alertCount, 0, "scrub resets the monitor's count");
    assert.equal(ORDER.indexOf(getState().globalAlert), ORDER.indexOf(before) - 1,
      "scrub eases the global alert one level");
  });

  it("scrub is a no-op while a trace is running", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "scrub-2");
    const graph = getState().nodeGraph;
    for (let i = 0; i < 30 && getState().traceSecondsRemaining === null; i++) sendAlert(graph);
    assert.equal(getState().globalAlert, "trace", "should be at trace");
    const countAtTrace = graph.getNodeState("sp/monitor").alertCount;

    graph.setNodeAttr("sp/monitor", "accessLevel", "owned");
    graph.executeAction("sp/monitor", "scrub-logs");

    assert.equal(getState().globalAlert, "trace", "scrub must not cool an active trace");
    assert.equal(graph.getNodeState("sp/monitor").alertCount, countAtTrace, "no-op at trace");
  });
});

describe("security grid: IDS->monitor escalation (#173)", () => {
  beforeEach(() => { clearAll(); });

  // Drive the graph chain directly: an alert arriving at the IDS relays to its monitor
  // (the bridge's job in real play — verified separately via playtest/census).
  const sendAlert = (graph) => graph.sendMessage("sp/ids", { type: "alert", payload: {} });
  // Send alerts until the trace starts (threshold is grade-scaled — don't hardcode it).
  const alertUntilTrace = (graph) => {
    for (let i = 0; i < 30 && getState().traceSecondsRemaining === null; i++) sendAlert(graph);
  };

  it("alerts through an un-corrupted IDS climb the global alert to trace", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "grid-seed-1");
    const graph = getState().nodeGraph;
    assert.equal(getState().globalAlert, "green");

    sendAlert(graph);
    assert.notEqual(getState().globalAlert, "green", "first alert should climb the ladder");

    alertUntilTrace(graph);
    assert.notEqual(getState().traceSecondsRemaining, null,
      "repeated alerts through the monitor must start the trace");
  });

  it("corrupting the IDS severs the chain — no escalation, no trace", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "grid-seed-2");
    const graph = getState().nodeGraph;
    graph.setNodeAttr("sp/ids", "accessLevel", "owned");
    graph.executeAction("sp/ids", "corrupt");
    graph.tick(20); // corrupt is timed-by-default (#187 default-flip) — let it complete
    assert.equal(graph.getNodeState("sp/ids").forwardingEnabled, false, "corrupt should disable forwarding");

    for (let i = 0; i < 30; i++) sendAlert(graph); // far past any grade threshold
    assert.equal(getState().globalAlert, "green", "a corrupted IDS must not escalate the global alert");
    assert.equal(getState().traceSecondsRemaining, null, "a corrupted IDS must not start a trace");
  });

  it("cancel-trace on the owned monitor cancels an in-flight grid trace", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "grid-seed-3");
    const graph = getState().nodeGraph;
    alertUntilTrace(graph);
    assert.notEqual(getState().traceSecondsRemaining, null, "trace should be running first");

    graph.setNodeAttr("sp/monitor", "accessLevel", "owned");
    assert.notEqual(getState().traceSecondsRemaining, null,
      "owning alone must NOT cancel — cancelling is explicit");
    graph.executeAction("sp/monitor", "cancel-trace");
    assert.equal(getState().traceSecondsRemaining, null,
      "running cancel-trace on the owned monitor cancels the trace");
  });
});

describe("honey-pot trap: FETCH springs the counter-trace", () => {
  beforeEach(() => {
    clearAll();
  });

  it("dumping is safe; fetching traps, pays no cash, and starts the trace", () => {
    initGame(() => buildCorporateExchange(), "honeypot-fetch-seed");
    const s = getState();
    const graph = s.nodeGraph;
    const cashBefore = s.player.cash;

    // DUMP — safe bait. resolveRead sets read:true; trap must NOT fire.
    graph.setNodeAttr("pot/honey-pot", "probed", true); // DUMP is gated on recon (probed)
    graph.executeAction("pot/honey-pot", "dump");
    graph.tick(40);
    assert.equal(graph.getNodeState("pot/honey-pot").read, true, "dump should complete");
    assert.equal(graph.getNodeState("pot/honey-pot").poisoned, false, "dump must not spring the trap");
    assert.equal(getState().traceSecondsRemaining, null, "dump must not start a trace");

    // FETCH — the snap.
    graph.executeAction("pot/honey-pot", "fetch");
    graph.tick(40);
    assert.equal(graph.getNodeState("pot/honey-pot").poisoned, true, "fetch must poison the node");
    assert.notEqual(getState().traceSecondsRemaining, null, "fetch must start the trace");
    assert.equal(getState().player.cash, cashBefore, "fetch must pay no cash on a trap node");
  });
});

describe("ice runtime: iterates all active instances", () => {
  // Wire the ICE_MOVE timer → handleIceTick. This mirrors what main.js does:
  // each per-instance timer carries an iceId, so the handler forwards the payload.
  // The handler is registered once for the suite and persists across tests;
  // we do NOT call clearHandlers() here to avoid breaking the module-level
  // alert.js / ice.js listeners that other tests in this file depend on.
  const iceMoveHandler = (payload) => handleIceTick(payload);
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
      moveTimerId: null,
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
  const iceMoveHandler = (payload) => handleIceTick(payload);
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

// ── Phase 4: KICK + status enumerate all active ICE instances ─────────────────

/** Inject a second active ICE instance at the given node, returning it. */
function injectIceInstance(id, nodeId, grade) {
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

describe("KICK availability: enumerates all active ICE instances", () => {
  beforeEach(() => {
    clearAll();
    // gateway → router-a → sec-mon; reveal all so each is a real, queryable node.
    initGame(() => buildIceWithMonitorLAN({ grade: "B" }), "itest-kick-multi");
    const s = getState();
    for (const n of Object.values(s.nodes)) n.visibility = "accessible";
  });

  it("KICK is available at each instance's node and not at an ICE-free node", () => {
    const s = getState();
    // KICK is a graph action gated on accessLevel === "owned"; own all three so
    // the action is offered and the only differentiator is ICE presence.
    for (const id of Object.keys(s.nodes)) setNodeAccessLevel(id, "owned");
    // Place the primary instance on gateway, a second instance on router-a.
    s.ice.instances["ice-1"].active = true;
    s.ice.instances["ice-1"].attentionNodeId = "gateway";
    injectIceInstance("ice-2", "router-a", "B");

    const gatewayActions = getAvailableActions(s.nodes["gateway"], s).map((a) => a.id);
    const routerActions = getAvailableActions(s.nodes["router-a"], s).map((a) => a.id);
    const secMonActions = getAvailableActions(s.nodes["sec-mon"], s).map((a) => a.id);

    assert.ok(gatewayActions.includes(A.KICK), "KICK should be available where ice-1 is");
    assert.ok(routerActions.includes(A.KICK), "KICK should be available where ice-2 is");
    assert.ok(!secMonActions.includes(A.KICK), "KICK should NOT be available at an ICE-free node");
  });
});

describe("status ice: enumerates all active ICE instances", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceWithMonitorLAN({ grade: "B" }), "itest-status-multi");
    const s = getState();
    for (const n of Object.values(s.nodes)) n.visibility = "accessible";
  });

  it("lists one line per active instance when there are multiple", () => {
    const s = getState();
    // Make both instances visible: ice-1's attention node is selected; ice-2's
    // attention node is owned (isIceVisible passes for owned/open nodes).
    s.selectedNodeId = "gateway";
    s.nodes["gateway"].accessLevel = "owned";
    s.nodes["router-a"].accessLevel = "owned";
    s.ice.instances["ice-1"].active = true;
    s.ice.instances["ice-1"].attentionNodeId = "gateway";
    injectIceInstance("ice-2", "router-a", "B");

    const lines = withEvents(E.LOG_ENTRY, () => cmdStatusIce()).map((e) => e.text);
    const joined = lines.join("\n");

    // Both instances' attention-node labels must appear.
    const gwLabel = s.nodes["gateway"].label;
    const raLabel = s.nodes["router-a"].label;
    assert.ok(joined.includes(gwLabel), `expected gateway label "${gwLabel}" in:\n${joined}`);
    assert.ok(joined.includes(raLabel), `expected router-a label "${raLabel}" in:\n${joined}`);
  });

  it("single active instance: output shape unchanged", () => {
    const s = getState();
    s.selectedNodeId = "gateway";
    s.nodes["gateway"].accessLevel = "owned";
    s.ice.instances["ice-1"].active = true;
    s.ice.instances["ice-1"].attentionNodeId = "gateway";

    const lines = withEvents(E.LOG_ENTRY, () => cmdStatusIce()).map((e) => e.text);

    assert.deepEqual(lines.slice(0, 3), [
      "## STATUS: ICE",
      "- status: ACTIVE  grade: B",
      `- attention: ${s.nodes["gateway"].label}  resident: ${s.nodes["sec-mon"].label}`,
    ]);
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

  it("EXEC.execute runs the chosen script (forwarding disabled on completion), same as dispatching it directly", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    s.nodeGraph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const exec = getAvailableActions(s.nodes["ids-1"], s).find((a) => a.id === A.EXEC);
    exec.execute(s.nodes["ids-1"], s, {}, { scriptId: "corrupt", nodeId: "ids-1" });
    // corrupt is timed (#187 Phase 5) — EXEC only arms it; tick to completion (grade C: 15 ticks
    // + 1 to resolve duration from the table).
    s.nodeGraph.tick(16);
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
    firstIce().attentionNodeId = "ids-1";

    const ids = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(ids.includes("kick"), "kick should be available on owned node with ICE present");
    assert.ok(!ids.includes("eject"), "eject must be gone — rename is complete");

    const fired = withEvents(E.ICE_EJECTED, () => {
      s.nodeGraph.executeAction("ids-1", "kick");
      // kick is timed (#187 Phase 2) — dispatch only arms it; tick to completion (duration:5).
      s.nodeGraph.tick(5);
    });
    assert.ok(fired.length > 0, "kick must fire ICE_EJECTED (internal mechanism unchanged)");
  });
});

describe("kick is timed (#187 Phase 2)", () => {
  it("arms on dispatch, ejects ICE only on completion", () => {
    clearAll();
    initGame(() => buildAlertLAN({ ice: { grade: "C", startNode: "ids-1" } }), "itest-kick-timed");
    const s = getState();
    s.nodeGraph.setNodeAttr("ids-1", "accessLevel", "owned");
    startIce();
    firstIce().attentionNodeId = "ids-1";

    const atDispatch = withEvents(E.ICE_EJECTED, () => {
      s.nodeGraph.executeAction("ids-1", "kick");
    });
    assert.equal(atDispatch.length, 0, "kick does NOT eject at dispatch — only arms");
    assert.equal(s.nodeGraph.getNodeState("ids-1")._ta_active_kick, true, "kick armed");

    const atCompletion = withEvents(E.ICE_EJECTED, () => {
      s.nodeGraph.tick(5); // duration
    });
    assert.equal(atCompletion.length, 1, "ICE ejected exactly once on completion");
    assert.equal(s.nodeGraph.getNodeState("ids-1")._ta_active_kick, false, "kick no longer active");
  });
});

// ── sniff/replay operator bridge ──────────────────────────────────────────────
// SNIFF and REPLAY are *program* actions (program-actions.js) — they carry an `execute`
// callback, not a graph `effects` list, and never pass through node synthesis. Unlike
// `kick` above (a NodeDef action, dispatched via `graph.executeAction`), the dispatch path
// here is `getAvailableActions(node, state).find(...).execute(node, state, ctx, payload)` —
// the same lookup `initActionDispatcher` performs internally, minus the dispatcher's own
// event-listener registration. Registering `initActionDispatcher` a second time here would
// double the "starnet:action" listener count for the rest of this file (it's registered
// exactly once, later, in the "EXEC dispatch echo" `before()` below) and double-execute
// every action dispatched from that point on — the same trap noted for `kick`.
//
// ABORT, by contrast, IS a NodeDef action (present on every "hackable" node via the
// structural `active-abortable-timed-action` condition), so it's exercised the normal way:
// `graph.executeAction(nodeId, "abort")`.

describe("sniff/replay are timed (#187 Phase 2)", () => {
  beforeEach(() => { clearAll(); });

  /**
   * corporate-exchange's switch-2 -> fw-1 credential flow, with switch-2 probed/accessible
   * and fw-1's endpoint revealed (fog-of-war: SNIFF's flow picker hides flows to hidden nodes).
   */
  function armSniffFixture(seed) {
    initGame(() => buildCorporateExchange(), seed);
    const s = getState();
    const cred = s.flows.find((f) => f.type === "credential");
    const fid = flowId(cred);
    setNodeVisible("switch-2", "accessible");
    setNodeProbed("switch-2");
    setNodeVisible("fw-1", "revealed");
    return { s, fid };
  }

  /** The SNIFF ActionDef + target node, as getAvailableActions would surface them. */
  function sniffAction(s) {
    const node = s.nodes["switch-2"];
    const action = getAvailableActions(node, s).find((a) => a.id === A.SNIFF);
    assert.ok(action, "SNIFF available");
    return { node, action };
  }

  it("sniff arms on dispatch and reveals the flow only on completion", () => {
    const { s, fid } = armSniffFixture("itest-sniff-timed-1");
    const { node, action } = sniffAction(s);

    const atDispatch = withEvents(E.FLOW_SNIFFED, () => {
      action.execute(node, s, {}, { flowId: fid });
    });
    assert.equal(atDispatch.length, 0, "sniff does NOT resolve at dispatch — only arms");
    assert.equal(s.nodeGraph.getNodeState("switch-2")._ta_active_sniff, true, "sniff armed");
    assert.equal(s.nodeGraph.getNodeState("switch-2")._sniff_flow_id, fid, "flowId stashed as a node attr");

    const atCompletion = withEvents(E.FLOW_SNIFFED, () => {
      s.nodeGraph.tick(SNIFF_DURATION);
    });
    assert.equal(atCompletion.length, 1, "flow sniffed exactly once on completion");
    assert.equal(s.nodeGraph.getNodeState("switch-2")._ta_active_sniff, false, "sniff no longer active");
  });

  it("abort mid-sniff reveals nothing", () => {
    const { s, fid } = armSniffFixture("itest-sniff-timed-2");
    const { node, action } = sniffAction(s);

    action.execute(node, s, {}, { flowId: fid });
    s.nodeGraph.tick(3); // partway through SNIFF_DURATION

    const sniffed = withEvents(E.FLOW_SNIFFED, () => {
      s.nodeGraph.executeAction("switch-2", "abort");
      s.nodeGraph.tick(SNIFF_DURATION);
    });
    assert.equal(sniffed.length, 0, "cancelled sniff never resolves");
    assert.equal(s.nodeGraph.getNodeState("switch-2")._ta_active_sniff, false, "abort clears the active flag");
  });

  it("replay arms and grants owned access only on completion", () => {
    initGame(() => buildCorporateExchange(), "itest-replay-timed-1");
    const s = getState();
    setNodeVisible("fw-1", "accessible");
    addCapturedCredential(s.nodes["fw-1"].trustsCredential);

    const node = s.nodes["fw-1"];
    const action = getAvailableActions(node, s).find((a) => a.id === A.REPLAY);
    assert.ok(action, "REPLAY available");
    action.execute(node, s, {}, {});
    assert.notEqual(s.nodes["fw-1"].accessLevel, "owned", "replay does not resolve at dispatch");

    s.nodeGraph.tick(REPLAY_DURATION);
    assert.equal(s.nodes["fw-1"].accessLevel, "owned");
  });

  it("re-arming sniff reuses the operator (no accumulation)", () => {
    const { s, fid } = armSniffFixture("itest-sniff-timed-3");
    const { node, action } = sniffAction(s);

    action.execute(node, s, {}, { flowId: fid });
    s.nodeGraph.tick(SNIFF_DURATION);

    const second = getAvailableActions(s.nodes["switch-2"], s).find((a) => a.id === A.SNIFF);
    assert.ok(second, "SNIFF re-offered once the first sniff completes (node idle again)");
    second.execute(s.nodes["switch-2"], s, {}, { flowId: fid });

    const ops = s.nodeGraph.snapshot().nodes.find((n) => n.id === "switch-2").operators;
    const count = ops.filter((o) => o.name === "timed-action" && o.action === A.SNIFF).length;
    assert.equal(count, 1, "operator attached once, reused thereafter");
  });

  it("a save/load round-trip mid-sniff preserves the armed operator", () => {
    const { s, fid } = armSniffFixture("itest-sniff-timed-4");
    const { node, action } = sniffAction(s);

    action.execute(node, s, {}, { flowId: fid });
    s.nodeGraph.tick(3); // partway

    const snap = JSON.parse(JSON.stringify(serializeState()));
    deserializeState(snap);
    const restored = getState();

    const sniffed = withEvents(E.FLOW_SNIFFED, () => {
      restored.nodeGraph.tick(SNIFF_DURATION); // finish the remaining ticks
    });
    assert.equal(sniffed.length, 1, "restored sniff completes and resolves once");
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

    // corrupt is timed (#187 Phase 5) — the dispatch only arms it; tick to completion
    // (grade C: 15 ticks + 1 to resolve duration from the table).
    s.nodeGraph.tick(16);
    assert.equal(getState().nodes["ids-1"].forwardingEnabled, false, "script ran");
  });
});

// ── Phase 3: XPLOIT → auto-burn wiring ───────────────────────────────────────
//
// TDD: these tests were written BEFORE the wiring was implemented.
// They verify that:
//   1. Dispatching XPLOIT launches an autoburn process (not the old card timed-action).
//   2. A seeded hoard at run-start gives the auto-burn process ammo to crack a soft node.
//   3. The full probe→XPLOIT→crack→owned→dump flow works headlessly.
//   4. Console `xploit` (arg-less) launches the same process as the GUI dispatch.
// Seed: "itest-xploit-autoburn" for determinism.

describe("Phase 3: XPLOIT → coherence auto-burn (wiring)", () => {
  // Soft LAN: gateway accessible, router-a exploitable (visibility: accessible, grade C)
  function buildXploitLAN() {
    return {
      graphDef: {
        nodes: [
          createGateway("gateway", { attributes: { visibility: "accessible" } }),
          createRouter("router-a", { attributes: { visibility: "accessible" } }),
        ],
        edges: [["gateway", "router-a"]],
        triggers: [],
      },
      meta: { startNode: "gateway", startCash: 0, moneyCost: "C", ice: null },
    };
  }

  beforeEach(() => {
    clearAll();
    initGame(() => buildXploitLAN(), "itest-xploit-autoburn");
    initActionDispatcher(buildActionContext());
  });

  it("DEFAULT_START_HOARD is exported from hoard.js", () => {
    // Phase 3: hoard.js must export DEFAULT_START_HOARD
    assert.ok(DEFAULT_START_HOARD, "DEFAULT_START_HOARD exported");
    assert.ok(DEFAULT_START_HOARD.common > 0, "has common rounds");
  });

  it("run-start seeds player.hoard with DEFAULT_START_HOARD rounds (not empty)", () => {
    // Phase 3: initState must seed player.hoard from DEFAULT_START_HOARD
    const hoard = getState().player.hoard;
    assert.ok(hoard.length > 0, `player.hoard should be seeded at run-start, got length ${hoard.length}`);
  });

  it("dispatching XPLOIT starts an autoburn process on the target node", () => {
    // Make router-a accessible + probed so XPLOIT is available
    const g = getState().nodeGraph;
    g.setNodeAttr("router-a", "visibility", "accessible");
    g.setNodeAttr("router-a", "accessLevel", "locked");
    g.setNodeAttr("router-a", "probed", true);

    // Dispatch XPLOIT via the action system (no exploitId — auto-burn is arg-less)
    emitEvent("starnet:action", { actionId: A.XPLOIT, nodeId: "router-a" });

    assert.ok(
      activeProcessOnNode(getState(), "router-a"),
      "an autoburn process should be active on router-a after XPLOIT dispatch"
    );
  });

  it("XPLOIT dispatch does NOT start the old timed-action (exploiting attr is not true)", () => {
    const g = getState().nodeGraph;
    g.setNodeAttr("router-a", "visibility", "accessible");
    g.setNodeAttr("router-a", "accessLevel", "locked");
    g.setNodeAttr("router-a", "probed", true);

    emitEvent("starnet:action", { actionId: A.XPLOIT, nodeId: "router-a" });

    // The old timed-action path set node.exploiting = true; auto-burn must NOT do that
    assert.notEqual(
      getState().nodes["router-a"].exploiting,
      true,
      "auto-burn must not set the old exploiting timed-action flag to true"
    );
  });

  it("full flow: probe → XPLOIT auto-burn → crack → owned", () => {
    // Setup: make router-a soft (grade F-equivalent: set coherence low)
    const g = getState().nodeGraph;
    g.setNodeAttr("router-a", "visibility", "accessible");
    g.setNodeAttr("router-a", "accessLevel", "locked");
    g.setNodeAttr("router-a", "probed", true);
    setNodeCoherence("router-a", 5); // very low — will crack in a few rounds

    const accessedEvents = [];
    on(E.NODE_ACCESSED, (p) => accessedEvents.push(p));

    // Launch auto-burn via action dispatch
    emitEvent("starnet:action", { actionId: A.XPLOIT, nodeId: "router-a" });
    assert.ok(activeProcessOnNode(getState(), "router-a"), "process started");

    // Run until crack
    tick(200);

    assert.equal(getState().nodes["router-a"].accessLevel, "owned", "router-a cracked to owned");
    assert.ok(accessedEvents.some((e) => e.next === "owned"), "NODE_ACCESSED{next:owned} emitted");
    assert.equal(getState().processes.length, 0, "process cleaned up after crack");
  });

  it("console xploit (arg-less) starts an autoburn process — same as GUI dispatch", () => {
    // Point selection at router-a so the console verb has a target
    const g = getState().nodeGraph;
    g.setNodeAttr("router-a", "visibility", "accessible");
    g.setNodeAttr("router-a", "accessLevel", "locked");
    g.setNodeAttr("router-a", "probed", true);

    // Select the node (console resolveImplicitNode reads selectedNodeId)
    emitEvent("starnet:action", { actionId: A.SELECT, nodeId: "router-a" });

    // Issue arg-less xploit via the console command
    emitEvent("starnet:action", { actionId: A.XPLOIT, nodeId: "router-a" });

    assert.ok(
      activeProcessOnNode(getState(), "router-a"),
      "console xploit must start an autoburn process (arg-less dispatch)"
    );
  });
});
