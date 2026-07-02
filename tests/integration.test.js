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
import { initGame, getState, isIceVisible, buyExploit, addHeat } from "../js/core/state.js";
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
import { handleCheatCommand } from "../js/core/cheats.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";
import { activeIceInstances } from "../js/core/state/ice.js";
import { cmdStatusIce } from "../js/core/console-commands/cmd-status.js";
import { initActionDispatcher, buildActionContext } from "../js/core/actions/action-context.js";

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

  it("available when open and forwarding enabled", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "open");
    graph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(actionIds.includes("corrupt"));
  });

  it("not available when forwardingEnabled is false", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "open");
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

  it("ICE IS visible on a open node regardless of selection", () => {
    const s = getState();
    teleportIce("gateway");
    s.nodes["gateway"].accessLevel = "open";
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
    // 'open', not 'owned'.
    _forceNext(RNG.COMBAT, 0);    // success
    _forceNext(RNG.COMBAT, 0);    // flavor pick
    _forceNext(RNG.COMBAT, 0.99); // bypass skip-to-owned
    launchExploit("gateway", s.player.hand[0].id);

    assert.equal(gateway.accessLevel, "open",
      "Gateway should be open after successful exploit");

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

    assert.equal(gateway.accessLevel, "open");
    assert.equal(gateway.probed, true,
      "a successful exploit should count as a probe (open ⇒ probed)");
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

    it("opening the firewall does NOT reveal nodes behind it", () => {
      const s = getState();
      // RNG.COMBAT is consumed three times on a from-locked success:
      //   1) success roll, 2) success-flavor pick, 3) skipToOwnedChance roll.
      // Force the third > skipChance so the access level lands on
      // 'open', not 'owned'.
      _forceNext(RNG.COMBAT, 0);    // success
      _forceNext(RNG.COMBAT, 0);    // flavor pick
      _forceNext(RNG.COMBAT, 0.99); // bypass skip-to-owned
      launchExploit("firewall-1", s.player.hand[0].id);

      assert.equal(s.nodes["firewall-1"].accessLevel, "open",
        "firewall should be open after first successful exploit");
      assert.equal(s.nodes["hidden-fs"].visibility, "hidden",
        "fileserver behind owned-gated firewall must remain hidden when firewall is only open");
    });

    it("owning the firewall DOES reveal nodes behind it", () => {
      const s = getState();

      // First exploit: locked → open (block skip-to-owned with third roll)
      _forceNext(RNG.COMBAT, 0);    // success
      _forceNext(RNG.COMBAT, 0);    // flavor pick
      _forceNext(RNG.COMBAT, 0.99); // bypass skip-to-owned
      launchExploit("firewall-1", s.player.hand[0].id);
      assert.equal(s.nodes["firewall-1"].accessLevel, "open");
      assert.equal(s.nodes["hidden-fs"].visibility, "hidden",
        "precondition: still hidden after open");

      // Second exploit: open → owned (no skip roll on this transition)
      _forceNext(RNG.COMBAT, 0);    // success
      _forceNext(RNG.COMBAT, 0);    // flavor pick
      launchExploit("firewall-1", s.player.hand[1].id);
      assert.equal(s.nodes["firewall-1"].accessLevel, "owned",
        "firewall should be owned after second exploit");
      assert.equal(s.nodes["hidden-fs"].visibility, "revealed",
        "fileserver behind firewall must be revealed once firewall is owned");
    });
  });

  describe("router gate (gateAccess: 'open')", () => {
    beforeEach(() => {
      clearAll();
      initGame(() => buildRouterGateLAN(), "itest-22");
    });

    it("node behind router is hidden before exploit", () => {
      const s = getState();
      assert.equal(s.nodes["behind-router"].visibility, "hidden",
        "fileserver behind router should start hidden");
    });

    it("opening the router reveals nodes behind it", () => {
      const s = getState();

      // RNG.COMBAT is consumed three times on a from-locked success:
      //   1) success roll, 2) success-flavor pick, 3) skipToOwnedChance roll.
      // Force the third > skipChance so the access level lands on
      // 'open', not 'owned'.
      _forceNext(RNG.COMBAT, 0);    // success
      _forceNext(RNG.COMBAT, 0);    // flavor pick
      _forceNext(RNG.COMBAT, 0.99); // bypass skip-to-owned
      launchExploit("router-gate", s.player.hand[0].id);

      assert.equal(s.nodes["router-gate"].accessLevel, "open",
        "router should be open after first successful exploit");
      assert.equal(s.nodes["behind-router"].visibility, "revealed",
        "fileserver behind open-gated router should be revealed on open");
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

describe("honey-pot trap: MINE springs the counter-trace", () => {
  beforeEach(() => {
    clearAll();
  });

  it("mining a trap node poisons it, starts the trace, and grants no card", () => {
    initGame(() => buildCorporateExchange(), "honeypot-mine-seed");
    const s = getState();
    const graph = s.nodeGraph;
    const handBefore = s.player.hand.length;

    graph.executeAction("pot/honey-pot", "mine");
    graph.tick(60);

    assert.equal(graph.getNodeState("pot/honey-pot").poisoned, true, "mine must poison the node");
    assert.notEqual(getState().traceSecondsRemaining, null, "mine must start the trace");
    assert.equal(getState().player.hand.length, handBefore, "mine must grant no card on a trap node");
  });
});

describe("timed-action cancel clears the operator's real progress attr (B2)", () => {
  beforeEach(() => { clearAll(); });

  it("navigating away from an in-progress DUMP resets _ta_dump_progress", () => {
    initGame(() => buildCorporateExchange(), "b2-dump-cancel-seed");
    const graph = getState().nodeGraph;

    navigateTo("pot/honey-pot");
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

  it("scrubbing a open monitor resets its alertCount and eases the global alert one level", () => {
    initGame(() => buildSetPieceMiniNetwork("idsRelayChain"), "scrub-1");
    const graph = getState().nodeGraph;
    sendAlert(graph); sendAlert(graph); sendAlert(graph); // 3 alerts (grade C): climbs to red
    const before = getState().globalAlert;
    assert.notEqual(before, "green", "grid should have climbed");
    assert.ok(graph.getNodeState("sp/monitor").alertCount > 0, "monitor should have accumulated");

    graph.setNodeAttr("sp/monitor", "accessLevel", "open");
    graph.executeAction("sp/monitor", "scrub-logs");

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

    graph.setNodeAttr("sp/monitor", "accessLevel", "open");
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
    firstIce().attentionNodeId = "ids-1";

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

// ── Exploit card id uniqueness ────────────────────────────────────────────────
// Regression: card ids are minted `${vuln}-${counter}`, but the counter resets per
// session while profile cards persist across sessions — so a carried card and a
// freshly-minted one can share an id. The exploit pipeline keys off `id` and takes
// the first match, so the second card silently no-ops (the reported "SnmpWalker X
// does nothing" bug — first match was a disclosed/0-uses card).

describe("Exploit cards: duplicate id reconciliation", () => {
  const DUP_ID = "stale-firmware-1";
  const makeDupHand = () => ([
    // Mirrors the reported save: same id, first is dead, second is the one the
    // player tries to play.
    { id: DUP_ID, name: "AuthBrute Prime", rarity: "common", quality: 0.22, targetVulnTypes: ["stale-firmware"], decayState: "disclosed", usesRemaining: 0, instanceId: "inv-0" },
    { id: DUP_ID, name: "SnmpWalker X",    rarity: "common", quality: 0.47, targetVulnTypes: ["stale-firmware"], decayState: "fresh",     usesRemaining: 3, instanceId: "inv-6" },
  ]);

  function buildDupHandLAN() {
    return {
      graphDef: {
        nodes: [
          createGateway("gateway", { attributes: { visibility: "accessible" } }),
          createRouter("router-a"),
        ],
        edges: [["gateway", "router-a"]],
        triggers: [],
      },
      meta: { startNode: "gateway", startCash: 0, moneyCost: "C", ice: null, startHandCards: makeDupHand() },
    };
  }

  beforeEach(() => {
    clearAll();
    initGame(buildDupHandLAN, "itest-dupid");
  });

  it("gives each hand card a unique id at game init", () => {
    const ids = getState().player.hand.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `hand ids must be unique, got: ${ids.join(", ")}`);
  });

  it("lets the live duplicate-id card execute instead of no-opping on the dead one", () => {
    const snmp = getState().player.hand.find((c) => c.name === "SnmpWalker X");
    assert.ok(snmp, "SnmpWalker X present in hand");
    // The GUI/console dispatch the clicked card's own id; with a collision this
    // resolves to the first (disclosed) card and returns early.
    getState().nodeGraph._ctx.startExploit("gateway", snmp.id);
    assert.equal(getState().nodes["gateway"].exploiting, true, "the fresh card's exploit should start");
  });

  it("reconciles duplicate ids when loading a serialized save", () => {
    const snap = serializeState();
    snap.player.hand = makeDupHand(); // simulate a corrupt save like the reported one
    deserializeState(snap);
    const ids = getState().player.hand.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `loaded hand ids must be unique, got: ${ids.join(", ")}`);
  });
});
