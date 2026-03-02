// @ts-check
// Integration tests — real game module wiring, scenario-level assertions.
//
// Design:
//   - Modules are loaded once; alert.js registers its listeners at import time.
//   - initNodeLifecycle() is called once to register the NODE_ACCESSED dispatcher.
//   - beforeEach resets game state (initState) and timers (clearAll).
//   - Event capture uses the withEvents() helper: register → run → off.
//   - Direct state mutation is used sparingly to set up conditions
//     (same pattern as cheats.js: mutate field + emit NODE_ACCESSED).

import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { NETWORK } from "../data/network.js";
import { initState, getState, isIceVisible, buyExploit } from "../js/core/state.js";
import { navigateTo, navigateAway } from "../js/core/navigation.js";
import { startIce, handleIceTick, handleIceDetect, teleportIce, ejectIce } from "../js/core/ice.js";
import { emitEvent, on, off, E } from "../js/core/events.js";
import { clearAll, tick, scheduleEvent, TIMER } from "../js/core/timers.js";
import { initNodeLifecycle } from "../js/core/node-lifecycle.js";
import { getActions, hasBehavior } from "../js/core/actions/node-types.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { generateExploit } from "../js/core/exploits.js";
import { launchExploit } from "../js/core/combat.js";
import { startTraceCountdown, recordIceDetection } from "../js/core/alert.js";
// Importing alert.js above registers its module-level NODE_ALERT_RAISED /
// NODE_RECONFIGURED listeners. No separate init call needed.
import { startExploit, cancelExploit, handleExploitExecTimer, exploitDuration } from "../js/core/actions/exploit-exec.js";
import { startProbe, cancelProbe, handleProbeScanTimer, probeDuration } from "../js/core/actions/probe-exec.js";
import { RNG, _forceNext } from "../js/core/rng.js";

// Register the node lifecycle dispatcher once for this test file.
initNodeLifecycle();

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

// ── Node initialization ───────────────────────────────────────────────────────

describe("Node initialization", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
  });

  it("fileserver has at least 1 macguffin after init", () => {
    const fs = getState().nodes["fileserver"];
    assert.ok(fs.macguffins.length >= 1, `expected ≥1 macguffin, got ${fs.macguffins.length}`);
  });

  it("gateway has no macguffins after init", () => {
    assert.equal(getState().nodes["gateway"].macguffins.length, 0);
  });

  it("ids node has eventForwardingDisabled: false after init", () => {
    assert.equal(getState().nodes["ids"].eventForwardingDisabled, false);
  });

  it("gateway has no eventForwardingDisabled property", () => {
    assert.equal(getState().nodes["gateway"].eventForwardingDisabled, undefined);
  });
});

// ── Lifecycle: iceResident ────────────────────────────────────────────────────

describe("Lifecycle: iceResident — owning security-monitor stops ICE", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
    startIce();
  });

  it("ICE starts active after initState + startIce", () => {
    assert.ok(getState().ice?.active);
  });

  it("owning security-monitor sets ice.active to false", () => {
    const s = getState();
    s.nodes["security-monitor"].accessLevel = "owned";
    emitEvent(E.NODE_ACCESSED, { nodeId: "security-monitor", label: "SEC-MON", prev: "locked", next: "owned" });
    assert.equal(getState().ice?.active, false);
  });

  it("owning security-monitor emits ICE_DISABLED", () => {
    const s = getState();
    const fired = withEvents(E.ICE_DISABLED, () => {
      s.nodes["security-monitor"].accessLevel = "owned";
      emitEvent(E.NODE_ACCESSED, { nodeId: "security-monitor", label: "SEC-MON", prev: "locked", next: "owned" });
    });
    assert.equal(fired.length, 1);
  });

  it("owning a non-resident node does not stop ICE", () => {
    const s = getState();
    s.nodes["gateway"].accessLevel = "owned";
    emitEvent(E.NODE_ACCESSED, { nodeId: "gateway", label: "INET-GW-01", prev: "locked", next: "owned" });
    assert.ok(getState().ice?.active, "ICE should remain active");
  });
});

// ── Lifecycle: monitor — trace cancellation ───────────────────────────────────

describe("Lifecycle: monitor — owning security-monitor cancels active trace", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
    startTraceCountdown();
  });

  it("trace is active before the test action", () => {
    assert.notEqual(getState().traceSecondsRemaining, null);
  });

  it("owning security-monitor emits ALERT_TRACE_CANCELLED", () => {
    const s = getState();
    const fired = withEvents(E.ALERT_TRACE_CANCELLED, () => {
      s.nodes["security-monitor"].accessLevel = "owned";
      emitEvent(E.NODE_ACCESSED, { nodeId: "security-monitor", label: "SEC-MON", prev: "locked", next: "owned" });
    });
    assert.equal(fired.length, 1);
  });

  it("traceSecondsRemaining is null after owning security-monitor", () => {
    const s = getState();
    s.nodes["security-monitor"].accessLevel = "owned";
    emitEvent(E.NODE_ACCESSED, { nodeId: "security-monitor", label: "SEC-MON", prev: "locked", next: "owned" });
    assert.equal(getState().traceSecondsRemaining, null);
  });
});

// ── Alert flow ────────────────────────────────────────────────────────────────

describe("Alert flow: ids alert propagates to security-monitor", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
  });

  it("NODE_ALERT_RAISED on ids fires ALERT_PROPAGATED", () => {
    const fired = withEvents(E.ALERT_PROPAGATED, () => {
      emitEvent(E.NODE_ALERT_RAISED, { nodeId: "ids", label: "IDS-01" });
    });
    assert.equal(fired.length, 1);
    assert.equal(fired[0].fromNodeId, "ids");
  });

  it("NODE_ALERT_RAISED on ids (with raised alertState) escalates global alert", () => {
    // state.js always raises the node's alertState before emitting NODE_ALERT_RAISED.
    // Simulate that here: set ids to yellow, then fire the event.
    const s = getState();
    assert.equal(s.globalAlert, "green");
    s.nodes["ids"].alertState = "yellow";
    emitEvent(E.NODE_ALERT_RAISED, { nodeId: "ids", label: "IDS-01" });
    assert.ok(
      ["yellow", "red", "trace"].includes(s.globalAlert),
      `expected alert to escalate, got: ${s.globalAlert}`
    );
  });

  it("NODE_ALERT_RAISED does NOT propagate when forwarding disabled", () => {
    const s = getState();
    s.nodes["ids"].eventForwardingDisabled = true;
    const fired = withEvents(E.ALERT_PROPAGATED, () => {
      emitEvent(E.NODE_ALERT_RAISED, { nodeId: "ids", label: "IDS-01" });
    });
    assert.equal(fired.length, 0);
  });
});

// ── Action availability ───────────────────────────────────────────────────────

describe("Action availability: reconfigure on ids", () => {
  before(() => {
    clearAll();
    initState(NETWORK);
  });

  it("available when compromised and forwarding enabled", () => {
    const s = getState();
    const node = { ...s.nodes["ids"], accessLevel: "compromised", eventForwardingDisabled: false };
    const actionIds = getActions(node, s).map((a) => a.id);
    assert.ok(actionIds.includes("reconfigure"));
  });

  it("not available when eventForwardingDisabled is true", () => {
    const s = getState();
    const node = { ...s.nodes["ids"], accessLevel: "compromised", eventForwardingDisabled: true };
    const actionIds = getActions(node, s).map((a) => a.id);
    assert.ok(!actionIds.includes("reconfigure"));
  });

  it("not available when locked (even if forwarding enabled)", () => {
    const s = getState();
    const node = { ...s.nodes["ids"], accessLevel: "locked", eventForwardingDisabled: false };
    const actionIds = getActions(node, s).map((a) => a.id);
    assert.ok(!actionIds.includes("reconfigure"));
  });

  it("available when owned and forwarding still enabled", () => {
    const s = getState();
    const node = { ...s.nodes["ids"], accessLevel: "owned", eventForwardingDisabled: false };
    const actionIds = getActions(node, s).map((a) => a.id);
    assert.ok(actionIds.includes("reconfigure"));
  });
});

describe("Action availability: cancel-trace on security-monitor", () => {
  it("available when owned and trace is active", () => {
    clearAll();
    initState(NETWORK);
    const s = getState();
    s.traceSecondsRemaining = 60;
    const node = { ...s.nodes["security-monitor"], accessLevel: "owned" };
    const actionIds = getActions(node, s).map((a) => a.id);
    assert.ok(actionIds.includes("cancel-trace"));
  });

  it("not available when traceSecondsRemaining is null", () => {
    clearAll();
    initState(NETWORK);
    const s = getState();
    assert.equal(s.traceSecondsRemaining, null, "trace should not be active after init");
    const node = { ...s.nodes["security-monitor"], accessLevel: "owned" };
    const actionIds = getActions(node, s).map((a) => a.id);
    assert.ok(!actionIds.includes("cancel-trace"));
  });

  it("not available when not owned", () => {
    clearAll();
    initState(NETWORK);
    const s = getState();
    s.traceSecondsRemaining = 60;
    const node = { ...s.nodes["security-monitor"], accessLevel: "locked" };
    const actionIds = getActions(node, s).map((a) => a.id);
    assert.ok(!actionIds.includes("cancel-trace"));
  });
});

// ── ICE detection reset ───────────────────────────────────────────────────────

describe("ICE detection: detectedAtNode resets when player moves", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
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
    initState(NETWORK);
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
    initState(NETWORK);
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
    initState(NETWORK);
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
  // Network has grade C ICE; DETECTION_TRACE_THRESHOLD for C is 2.
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
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
    initState(NETWORK);
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

// ── Grade overrides ───────────────────────────────────────────────────────────

describe("Grade overrides: ids direct-trace behavior", () => {
  it("Grade-S ids includes direct-trace behavior", () => {
    assert.ok(hasBehavior({ type: "ids", grade: "S" }, "direct-trace"));
  });

  it("Grade-A ids includes direct-trace behavior", () => {
    assert.ok(hasBehavior({ type: "ids", grade: "A" }, "direct-trace"));
  });

  it("Grade-B ids does NOT include direct-trace", () => {
    assert.ok(!hasBehavior({ type: "ids", grade: "B" }, "direct-trace"));
  });

  it("Grade-C ids does NOT include direct-trace", () => {
    assert.ok(!hasBehavior({ type: "ids", grade: "C" }, "direct-trace"));
  });
});

// ── Exploit execution timing ───────────────────────────────────────────────────

describe("Exploit execution timing", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
    startIce();
  });

  it("startExploit sets executingExploit on state", () => {
    const s = getState();
    const card = s.player.hand[0];
    s.selectedNodeId = "gateway";
    const started = startExploit("gateway", card.id);
    assert.ok(started, "startExploit should return true");
    assert.notEqual(s.executingExploit, null, "executingExploit should be set");
    assert.equal(s.executingExploit.nodeId, "gateway");
    assert.equal(s.executingExploit.exploitId, card.id);
  });

  it("exploit does not resolve immediately after startExploit", () => {
    const s = getState();
    const card = s.player.hand[0];
    s.selectedNodeId = "gateway";
    const resolved = withEvents(E.EXPLOIT_SUCCESS, () => {
      startExploit("gateway", card.id);
    }).concat(withEvents(E.EXPLOIT_FAILURE, () => {}));
    assert.equal(resolved.length, 0, "exploit must not resolve synchronously");
    assert.notEqual(s.executingExploit, null, "executingExploit must remain set");
  });

  it("exploit resolves after ticking past its duration", () => {
    on(TIMER.EXPLOIT_EXEC, handleExploitExecTimer);
    const s = getState();
    const card = s.player.hand[0];
    s.selectedNodeId = "gateway";
    startExploit("gateway", card.id);

    const durationMs = exploitDuration(card.quality);
    const ticksNeeded = Math.ceil(durationMs / 100) + 2;

    let resolved = false;
    const handler = () => { resolved = true; };
    on(E.EXPLOIT_SUCCESS, handler);
    on(E.EXPLOIT_FAILURE, handler);
    tick(ticksNeeded);
    off(E.EXPLOIT_SUCCESS, handler);
    off(E.EXPLOIT_FAILURE, handler);
    off(TIMER.EXPLOIT_EXEC, handleExploitExecTimer);

    assert.ok(resolved, "exploit must resolve (success or failure) after ticking past its duration");
    assert.equal(s.executingExploit, null, "executingExploit must be cleared after resolution");
  });

  it("cancelExploit clears executingExploit and emits EXPLOIT_INTERRUPTED", () => {
    const s = getState();
    const card = s.player.hand[0];
    s.selectedNodeId = "gateway";
    startExploit("gateway", card.id);
    assert.notEqual(s.executingExploit, null);

    const fired = withEvents(E.EXPLOIT_INTERRUPTED, () => {
      cancelExploit();
    });
    assert.equal(fired.length, 1, "EXPLOIT_INTERRUPTED must fire once");
    assert.equal(fired[0].exploitName, card.name);
    assert.equal(s.executingExploit, null, "executingExploit must be null after cancel");
  });

  it("starting a second exploit while one is running returns false and logs error", () => {
    const s = getState();
    const [card1, card2] = s.player.hand;
    s.selectedNodeId = "gateway";
    startExploit("gateway", card1.id);

    const logErrors = withEvents(E.LOG_ENTRY, () => {
      const result = startExploit("gateway", card2.id);
      assert.equal(result, false, "second startExploit must return false");
    }).filter((e) => e.type === "error");

    assert.ok(logErrors.length > 0, "guard must emit a LOG_ENTRY error");
    assert.equal(s.executingExploit.exploitId, card1.id, "first exploit must remain active");
  });

  it("ICE detection timer fires independently during exploit execution", () => {
    on(TIMER.EXPLOIT_EXEC, handleExploitExecTimer);
    on(TIMER.ICE_DETECT,   handleIceDetect);

    const s = getState();
    const card = s.player.hand[0];
    s.selectedNodeId = "gateway";
    s.ice.attentionNodeId = "gateway";

    startExploit("gateway", card.id);
    // Schedule a fast ICE detection that fires before the exploit resolves
    scheduleEvent(TIMER.ICE_DETECT, 200, { nodeId: "gateway" });

    let exploitResolved = false;
    let iceDetected = false;
    on(E.EXPLOIT_SUCCESS, () => { exploitResolved = true; });
    on(E.EXPLOIT_FAILURE, () => { exploitResolved = true; });
    on(E.ICE_DETECTED,    () => { iceDetected = true; });

    // Tick past the full exploit duration
    const durationMs = exploitDuration(card.quality);
    tick(Math.ceil(durationMs / 100) + 2);

    off(TIMER.EXPLOIT_EXEC, handleExploitExecTimer);
    off(TIMER.ICE_DETECT,   handleIceDetect);

    assert.ok(iceDetected,     "ICE detection must fire during exploit execution window");
    assert.ok(exploitResolved, "exploit must still resolve after ICE detection");
  });
});

// ── Probe execution timing ────────────────────────────────────────────────────

describe("Probe execution timing", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
    startIce();
  });

  it("startProbe sets activeProbe on state", () => {
    const s = getState();
    const started = startProbe("gateway");
    assert.ok(started, "startProbe should return true");
    assert.notEqual(s.activeProbe, null, "activeProbe should be set");
    assert.equal(s.activeProbe.nodeId, "gateway");
  });

  it("probe does not complete immediately after startProbe", () => {
    const s = getState();
    const probed = withEvents(E.NODE_PROBED, () => {
      startProbe("gateway");
    });
    assert.equal(probed.length, 0, "NODE_PROBED must not fire synchronously");
    assert.equal(s.nodes["gateway"].probed, false, "node must not be probed immediately");
    assert.notEqual(s.activeProbe, null, "activeProbe must remain set");
  });

  it("probe completes after ticking past its duration", () => {
    on(TIMER.PROBE_SCAN, handleProbeScanTimer);
    const s = getState();
    startProbe("gateway");

    const durationMs = probeDuration(s.nodes["gateway"].grade);
    const ticksNeeded = Math.ceil(durationMs / 100) + 2;

    let probeCompleted = false;
    const handler = () => { probeCompleted = true; };
    on(E.NODE_PROBED, handler);
    tick(ticksNeeded);
    off(E.NODE_PROBED, handler);
    off(TIMER.PROBE_SCAN, handleProbeScanTimer);

    assert.ok(probeCompleted, "NODE_PROBED must fire after ticking past the scan duration");
    assert.equal(s.activeProbe, null, "activeProbe must be cleared after completion");
    assert.equal(s.nodes["gateway"].probed, true, "node must be probed after completion");
  });

  it("cancelProbe clears activeProbe and emits PROBE_SCAN_CANCELLED", () => {
    const s = getState();
    startProbe("gateway");
    assert.notEqual(s.activeProbe, null);

    const fired = withEvents(E.PROBE_SCAN_CANCELLED, () => {
      cancelProbe();
    });
    assert.equal(fired.length, 1, "PROBE_SCAN_CANCELLED must fire once");
    assert.equal(fired[0].nodeId, "gateway");
    assert.equal(s.activeProbe, null, "activeProbe must be null after cancel");
    assert.equal(s.nodes["gateway"].probed, false, "node must not be probed after cancel");
  });

  it("starting a second probe while one is running returns false and logs error", () => {
    const s = getState();
    startProbe("gateway");

    const logErrors = withEvents(E.LOG_ENTRY, () => {
      const result = startProbe("gateway");
      assert.equal(result, false, "second startProbe must return false");
    }).filter((e) => e.type === "error");

    assert.ok(logErrors.length > 0, "guard must emit a LOG_ENTRY error");
    assert.equal(s.activeProbe.nodeId, "gateway", "first probe must remain active");
  });
});

// ── Navigation: navigateTo / navigateAway ─────────────────────────────────────

describe("Navigation: navigateTo cancels in-progress actions", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
    startIce();
  });

  it("navigateTo cancels a running exploit and emits EXPLOIT_INTERRUPTED", () => {
    const s = getState();
    const card = s.player.hand[0];
    s.selectedNodeId = "gateway";
    startExploit("gateway", card.id);
    assert.notEqual(s.executingExploit, null);

    const interrupted = withEvents(E.EXPLOIT_INTERRUPTED, () => {
      navigateTo("router");
    });
    assert.equal(interrupted.length, 1, "EXPLOIT_INTERRUPTED must fire once");
    assert.equal(s.executingExploit, null, "executingExploit must be null after navigateTo");
    assert.equal(s.selectedNodeId, "router");
  });

  it("navigateTo cancels a running probe scan and emits PROBE_SCAN_CANCELLED", () => {
    const s = getState();
    startProbe("gateway");
    assert.notEqual(s.activeProbe, null);

    const cancelled = withEvents(E.PROBE_SCAN_CANCELLED, () => {
      navigateTo("router");
    });
    assert.equal(cancelled.length, 1, "PROBE_SCAN_CANCELLED must fire once");
    assert.equal(s.activeProbe, null, "activeProbe must be null after navigateTo");
    assert.equal(s.selectedNodeId, "router");
  });

  it("navigateTo with no in-progress action just selects the node", () => {
    const s = getState();
    navigateTo("gateway");
    assert.equal(s.selectedNodeId, "gateway");
    assert.equal(s.executingExploit, null);
    assert.equal(s.activeProbe, null);
  });
});

describe("Navigation: navigateAway cancels in-progress actions", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
    startIce();
  });

  it("navigateAway cancels a running exploit and emits EXPLOIT_INTERRUPTED", () => {
    const s = getState();
    const card = s.player.hand[0];
    s.selectedNodeId = "gateway";
    startExploit("gateway", card.id);

    const interrupted = withEvents(E.EXPLOIT_INTERRUPTED, () => {
      navigateAway();
    });
    assert.equal(interrupted.length, 1, "EXPLOIT_INTERRUPTED must fire once");
    assert.equal(s.executingExploit, null);
    assert.equal(s.selectedNodeId, null);
  });

  it("navigateAway cancels a running probe scan and emits PROBE_SCAN_CANCELLED", () => {
    const s = getState();
    startProbe("gateway");

    const cancelled = withEvents(E.PROBE_SCAN_CANCELLED, () => {
      navigateAway();
    });
    assert.equal(cancelled.length, 1, "PROBE_SCAN_CANCELLED must fire once");
    assert.equal(s.activeProbe, null);
    assert.equal(s.selectedNodeId, null);
  });
});

describe("isIceVisible: ICE visible on selected locked node", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
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
    initState(NETWORK);
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

  it("ICE movement from gateway skips WAN even when adjacent", () => {
    const s = getState();
    assert.ok(s.adjacency["gateway"]?.includes("wan"), "wan should be adjacent to gateway");
    teleportIce("gateway");
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
    initState(NETWORK);
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
    initState(NETWORK);
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
