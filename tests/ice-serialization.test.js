// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";
import { clearAll } from "../js/core/timers.js";
import { getPrimaryIce } from "../js/core/state/ice.js";

describe("ice: multi-instance serialization round-trip", () => {
  beforeEach(() => { clearAll(); });

  it("round-trips a collection with multiple instances (mixed active/inactive)", () => {
    initGame(() => buildCorporateExchange());
    const s = getState();

    // Inject second and third instances directly into the collection
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
    s.ice.instances["ice-3"] = {
      ...s.ice.instances["ice-2"],
      id: "ice-3",
      active: false,
      enabled: false,
    };

    const snap = JSON.parse(JSON.stringify(serializeState()));

    // Reset and reinit, then deserialize back
    clearAll();
    initGame(() => buildCorporateExchange());
    deserializeState(snap);

    const rehydrated = getState();
    assert.equal(Object.keys(rehydrated.ice.instances).length, 3);
    assert.equal(rehydrated.ice.instances["ice-1"].active, true);
    assert.equal(rehydrated.ice.instances["ice-2"].hostNodeId, "gateway");
    assert.equal(rehydrated.ice.instances["ice-2"].active, true);
    assert.equal(rehydrated.ice.instances["ice-3"].active, false);

    // getPrimaryIce returns the first active instance
    const primary = getPrimaryIce();
    assert.ok(primary);
    assert.equal(primary.active, true);
  });

  it("round-trips an empty instances collection", () => {
    // Network without ICE — should serialize/deserialize cleanly
    initGame(() => buildCorporateExchange());
    const s = getState();
    s.ice.instances = {};

    const snap = JSON.parse(JSON.stringify(serializeState()));
    clearAll();
    initGame(() => buildCorporateExchange());
    deserializeState(snap);

    const rehydrated = getState();
    assert.equal(Object.keys(rehydrated.ice.instances).length, 0);
    assert.equal(getPrimaryIce(), null);
  });
});
