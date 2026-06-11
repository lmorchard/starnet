// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initRng } from "./rng.js";
import { flagMissionMacguffin } from "./loot.js";

describe("flagMissionMacguffin: trap safety", () => {
  it("never selects a macguffin on a trap node", () => {
    initRng("loot-trap-test-1");
    const nodes = [
      { id: "pot/honey-pot", trap: true, macguffins: [{ id: "bait-1", name: "Bait", cashValue: 100 }] },
    ];
    assert.equal(flagMissionMacguffin(nodes), null, "trap-only network has no valid mission target");
  });

  it("selects a real (non-trap) macguffin when one exists", () => {
    initRng("loot-trap-test-2");
    const nodes = [
      { id: "pot/honey-pot", trap: true, macguffins: [{ id: "bait-1", name: "Bait", cashValue: 100 }] },
      { id: "office/fileserver", macguffins: [{ id: "real-1", name: "Real", cashValue: 200 }] },
    ];
    const target = flagMissionMacguffin(nodes);
    assert.equal(target?.id, "real-1");
  });
});
