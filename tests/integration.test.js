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

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  createGateway, createRouter, createIDS, createSecurityMonitor,
  createFileserver, createWAN,
} from "../js/core/node-graph/game-types.js";
import { initGame, getState, isIceVisible, buyExploit } from "../js/core/state.js";
import { navigateTo, navigateAway } from "../js/core/navigation.js";
import { startIce, handleIceTick, handleIceDetect, teleportIce, ejectIce } from "../js/core/ice.js";
import { emitEvent, on, off, E } from "../js/core/events.js";
import { clearAll, tick, scheduleEvent, TIMER } from "../js/core/timers.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { generateExploit } from "../js/core/exploits.js";
import { launchExploit } from "../js/core/combat.js";
import { startTraceCountdown, recordIceDetection } from "../js/core/alert.js";
// Importing alert.js above registers its module-level NODE_ALERT_RAISED /
// NODE_RECONFIGURED listeners. No separate init call needed.
// Old executor imports removed — timed actions now graph-native
import { RNG, _forceNext } from "../js/core/rng.js";

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
    initGame(() => buildLootLAN());
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
    initGame(() => buildAlertLAN());
    assert.equal(getState().nodes["ids-1"].forwardingEnabled, true);
  });

  it("detectable nodes have forwardingEnabled, non-detectable do not", () => {
    // forwardingEnabled comes from the detectable trait, not all nodes
    clearAll();
    initGame(() => buildAlertLAN());
    assert.equal(getState().nodes["ids-1"].forwardingEnabled, true);
    // Gateway doesn't have detectable trait
    assert.equal(getState().nodes["gateway"].forwardingEnabled, undefined);
  });
});

// ── Lifecycle: iceResident ────────────────────────────────────────────────────

describe("Lifecycle: iceResident — owning security-monitor stops ICE", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceWithMonitorLAN());
    startIce();
  });

  it("ICE starts active after initState + startIce", () => {
    assert.ok(getState().ice?.active);
  });

  it("owning security-monitor sets ice.active to false", () => {
    const s = getState();
    s.nodeGraph.setNodeAttr("sec-mon", "accessLevel", "owned");
    assert.equal(getState().ice?.active, false);
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
    assert.ok(getState().ice?.active, "ICE should remain active");
  });
});

// ── Lifecycle: monitor — trace cancellation ───────────────────────────────────

describe("Lifecycle: monitor — owning security-monitor cancels active trace", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceWithMonitorLAN());
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

// ── Alert flow ────────────────────────────────────────────────────────────────

describe("Alert flow: ids alert escalates global alert", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildAlertLAN());
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

describe("Action availability: reconfigure on ids", () => {
  before(() => {
    clearAll();
    initGame(() => buildAlertLAN());
  });

  it("available when compromised and forwarding enabled", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "compromised");
    graph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(actionIds.includes("reconfigure"));
  });

  it("not available when forwardingEnabled is false", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "compromised");
    graph.setNodeAttr("ids-1", "forwardingEnabled", false);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(!actionIds.includes("reconfigure"));
  });

  it("not available when locked (even if forwarding enabled)", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "locked");
    graph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(!actionIds.includes("reconfigure"));
  });

  it("available when owned and forwarding still enabled", () => {
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");
    graph.setNodeAttr("ids-1", "forwardingEnabled", true);
    const actionIds = getAvailableActions(s.nodes["ids-1"], s).map((a) => a.id);
    assert.ok(actionIds.includes("reconfigure"));
  });
});

describe("Action availability: cancel-trace on security-monitor", () => {
  it("available when owned", () => {
    clearAll();
    initGame(() => buildAlertLAN());
    const s = getState();
    const graph = s.nodeGraph;
    graph.setNodeAttr("mon-1", "accessLevel", "owned");
    const actionIds = getAvailableActions(s.nodes["mon-1"], s).map((a) => a.id);
    assert.ok(actionIds.includes("cancel-trace"));
  });

  it("not available when not owned", () => {
    clearAll();
    initGame(() => buildAlertLAN());
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
    initGame(() => buildIceLAN());
    startIce();
  });

  it("moving to a different node resets detectedAtNode to null", () => {
    const s = getState();
    s.selectedNodeId = "gateway";
    s.ice.detectedAtNode = "gateway"; // simulate: detection already happened here

    navigateTo("router-a");

    assert.equal(s.ice.detectedAtNode, null,
      "detectedAtNode should clear so ICE can detect at gateway again after player returns");
  });

  it("re-selecting the SAME node does NOT reset detectedAtNode", () => {
    const s = getState();
    s.selectedNodeId = "gateway";
    s.ice.detectedAtNode = "gateway";

    navigateTo("gateway");

    assert.equal(s.ice.detectedAtNode, "gateway",
      "detectedAtNode must not reset when player re-selects the already-selected node");
  });
});

/// ── ICE detection: player enters occupied node ───────────────────────────────

describe("ICE detection: player navigates to node where ICE is already present", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN());
    startIce();
  });

  it("starts detection dwell when player enters ICE's current node", () => {
    const s = getState();
    // Place ICE at gateway (accessible from start) without triggering handleIceTick
    s.ice.attentionNodeId = "gateway";

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
    initGame(() => buildIceLAN());
    startIce();
  });

  it("ejecting ICE prevents detection from firing", () => {
    // Wire up the ICE_DETECT timer → handleIceDetect (normally done in main.js)
    on(TIMER.ICE_DETECT, handleIceDetect);

    const s = getState();
    s.selectedNodeId = "gateway";
    s.ice.attentionNodeId = "gateway";
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
    initGame(() => buildIceLAN());
    startIce();
  });

  it("detectedAtNode resets when ICE moves away from player's node", () => {
    const s = getState();
    // Position ICE at the player's node
    s.selectedNodeId = "gateway";
    s.ice.attentionNodeId = "gateway";
    s.ice.detectedAtNode = "gateway";

    // handleIceTick moves ICE to a neighbor of gateway (not gateway itself)
    handleIceTick();

    assert.equal(s.ice.detectedAtNode, null,
      "detectedAtNode should clear when ICE leaves, so it can re-detect on next visit");
  });
});

// ── ICE detection: alert escalation ──────────────────────────────────────────

describe("ICE detection: alert escalation", () => {
  // buildAlertLAN has an IDS node; recordIceDetection raises alert on all IDS nodes.
  // recomputeGlobalAlert needs 2 red detectors for trace. Two IDS nodes ensure that
  // after 2 detections, both reach red (green→yellow, yellow→red) triggering trace.
  function buildDualIdsLAN() {
    return {
      graphDef: {
        nodes: [
          createGateway("gateway", { attributes: { visibility: "accessible" } }),
          createIDS("ids-1"),
          createIDS("ids-2"),
          createSecurityMonitor("mon-1"),
        ],
        edges: [["gateway", "ids-1"], ["gateway", "ids-2"], ["ids-1", "mon-1"]],
        triggers: [],
      },
      meta: { startNode: "gateway", startCash: 0, moneyCost: "C", ice: { grade: "C", startNode: "ids-1" } },
    };
  }

  beforeEach(() => {
    clearAll();
    initGame(() => buildDualIdsLAN());
  });

  it("first detection escalates global alert from green to yellow", () => {
    const s = getState();
    assert.equal(s.globalAlert, "green");
    recordIceDetection("gateway");
    assert.equal(s.globalAlert, "yellow");
  });

  it("second detection (threshold met) escalates to trace", () => {
    const s = getState();
    recordIceDetection("gateway");
    recordIceDetection("gateway");
    assert.equal(s.globalAlert, "trace");
  });

  it("second detection (threshold met) starts trace countdown", () => {
    const s = getState();
    recordIceDetection("gateway");
    recordIceDetection("gateway");
    assert.notEqual(s.traceSecondsRemaining, null,
      "trace countdown must start when detection threshold is met");
  });
});

// ── teleportIce self-teleport ─────────────────────────────────────────────────

describe("teleportIce: self-teleport does not emit ICE_MOVED", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildIceLAN());
    startIce();
  });

  it("does not emit ICE_MOVED when teleporting to the current node", () => {
    const s = getState();
    const currentNode = s.ice.attentionNodeId;

    const fired = withEvents(E.ICE_MOVED, () => {
      teleportIce(currentNode);
    });

    assert.equal(fired.length, 0, "ICE_MOVED must not fire when teleporting to current node");
  });

  it("still triggers detection check when teleporting to the current node", () => {
    const s = getState();
    const currentNode = s.ice.attentionNodeId;
    s.selectedNodeId = currentNode;
    s.nodes[currentNode].accessLevel = "owned";
    s.ice.detectedAtNode = null;

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
    initGame(() => buildBasicLAN());
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
    initGame(() => buildBasicLAN());
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
    initGame(() => buildIceLAN());
    startIce();
  });

  it("ICE is NOT visible on a locked node when player is not selected there", () => {
    const s = getState();
    teleportIce("gateway");
    // gateway starts locked, no selection
    assert.equal(s.nodes["gateway"].accessLevel, "locked");
    assert.equal(s.selectedNodeId, null);
    assert.equal(isIceVisible(s.ice, s.nodes, s.selectedNodeId), false);
  });

  it("ICE IS visible on a locked node when player is actively selected there", () => {
    const s = getState();
    teleportIce("gateway");
    s.selectedNodeId = "gateway";
    assert.equal(s.nodes["gateway"].accessLevel, "locked");
    assert.equal(isIceVisible(s.ice, s.nodes, s.selectedNodeId), true);
  });

  it("ICE IS visible on a compromised node regardless of selection", () => {
    const s = getState();
    teleportIce("gateway");
    s.nodes["gateway"].accessLevel = "compromised";
    s.selectedNodeId = null;
    assert.equal(isIceVisible(s.ice, s.nodes, s.selectedNodeId), true);
  });
});

// ── WAN node + darknet store ─────────────────────────────────────────────────

describe("WAN node", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildWanLAN({ ice: { grade: "C", startNode: "router-a" } }));
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
    const blocked = ["probe", "exploit", "read", "loot", "reboot"];
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
    if (!wanNeighbor || !s.ice) { assert.ok(true, "no ICE or WAN not wired"); return; }
    startIce();
    teleportIce(wanNeighbor);
    // Run 50 ICE ticks — WAN should never be visited
    for (let i = 0; i < 50; i++) {
      handleIceTick();
    }
    assert.notEqual(s.ice?.attentionNodeId, "wan", "ICE should never move to WAN");
  });
});

describe("buyExploit", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildBasicLAN({ startCash: 1000 }));
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
    initGame(() => buildBasicLAN());
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

    // Force combat roll to succeed + flavor pick
    _forceNext(RNG.COMBAT, 0);
    _forceNext(RNG.COMBAT, 0);
    launchExploit("gateway", s.player.hand[0].id);

    assert.equal(gateway.accessLevel, "compromised",
      "Gateway should be compromised after successful exploit");

    // Neighbors should be "revealed" (showing as ???), NOT "accessible"
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "revealed",
        `${nid} should be revealed (???) after exploit, not immediately accessible`);
    }
  });
});
