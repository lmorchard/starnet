// @ts-check
// Snapshot-based test: ICE detection fires at the correct node.
//
// Reproduced from a captured game state where ICE was at router-b (same node
// as the player) with a detection timer running. The visual showed ICE at
// gateway due to animation lag — this test verifies the state is correct.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";

import { deserializeState, getState } from "../js/core/state.js";
import { tick, clearAll, TIMER } from "../js/core/timers.js";
import { on, off, E } from "../js/core/events.js";
// Import alert.js to register its event listeners
import "../js/core/alert.js";
import { handleIceTick, handleIceDetect } from "../js/core/ice.js";
import { handleTraceTick } from "../js/core/alert.js";
import { initNodeLifecycle } from "../js/core/node-lifecycle.js";

initNodeLifecycle();

// Wire timer handlers (same as main.js / playtest.js)
on(TIMER.ICE_MOVE,   () => handleIceTick());
on(TIMER.ICE_DETECT, (payload) => handleIceDetect(payload));
on(TIMER.TRACE_TICK, () => handleTraceTick());

function loadSnapshot() {
  const json = readFileSync("tests/fixtures/ice-detection-at-player-node.json", "utf-8");
  const snapshot = JSON.parse(json);
  clearAll();
  deserializeState(snapshot);
}

describe("Snapshot: ICE detection at player node", () => {
  beforeEach(() => loadSnapshot());

  it("ICE is at the same node as the player", () => {
    const s = getState();
    assert.equal(s.selectedNodeId, "router-b");
    assert.equal(s.ice.attentionNodeId, "router-b");
  });

  it("detection timer is active for router-b", () => {
    const s = getState();
    assert.equal(s.ice.dwellTimerId, 10);
  });

  it("advancing ticks fires detection at router-b", () => {
    const detected = [];
    const handler = (payload) => detected.push(payload);
    on(E.ICE_DETECTED, handler);

    // Timer fires at tick 901, current is 890 — advance 15 ticks
    tick(15);

    off(E.ICE_DETECTED, handler);
    assert.equal(detected.length, 1);
    assert.equal(detected[0].nodeId, "router-b");
  });

  it("detection raises global alert", () => {
    const alerts = [];
    const handler = (payload) => alerts.push(payload);
    on(E.ALERT_GLOBAL_RAISED, handler);

    tick(15);

    off(E.ALERT_GLOBAL_RAISED, handler);
    assert.ok(alerts.length > 0);
    assert.equal(alerts[0].prev, "green");
  });

  it("after detection, ICE moves away from router-b", () => {
    tick(15); // detection fires
    tick(70); // ICE move interval
    const s = getState();
    // ICE should have moved — either to gateway or ids (router-b's neighbors)
    assert.notEqual(s.ice.attentionNodeId, "router-b");
  });
});
