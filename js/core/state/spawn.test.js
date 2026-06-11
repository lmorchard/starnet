// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateExchange } from "../../../data/networks/corporate-exchange.js"; // meta.ice grade B
import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js"; // meta.ice grade C
import { initGame, getState } from "../state.js";
import { getType } from "../ice/index.js";
import { clearAll } from "../timers.js";

beforeEach(() => clearAll());

describe("typed ICE spawn", () => {
  it("spawned ICE has a registry-resolvable typeId (not legacy 'standard-ice')", () => {
    initGame(() => buildCorporateExchange(), "spawn-1");
    const ice = Object.values(getState().ice.instances)[0];
    assert.notEqual(ice.typeId, "standard-ice");
    assert.ok(getType(ice.typeId), `typeId ${ice.typeId} must resolve in the registry`);
    assert.match(ice.typeId, /^(patrol-classic-B|sentinel|spike)$/);
  });

  it("below B, the spawn stays classic", () => {
    initGame(() => buildCorporateFoothold(), "spawn-2"); // grade C
    const ice = Object.values(getState().ice.instances)[0];
    assert.equal(ice.typeId, "patrol-classic-C");
  });
});
