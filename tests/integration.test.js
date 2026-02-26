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
import { initState, getState } from "../js/state.js";
import { startIce } from "../js/ice.js";
import { emitEvent, on, off, E } from "../js/events.js";
import { clearAll } from "../js/timers.js";
import { initNodeLifecycle } from "../js/node-lifecycle.js";
import { getActions, hasBehavior } from "../js/node-types.js";
import { startTraceCountdown } from "../js/alert.js";
// Importing alert.js above registers its module-level NODE_ALERT_RAISED /
// NODE_RECONFIGURED listeners. No separate init call needed.

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
