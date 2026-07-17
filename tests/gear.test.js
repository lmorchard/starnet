// @ts-check
// TDD tests for js/core/gear.js — GEAR registry + resolveLoadoutEffects.
// Written before implementation (RED phase).

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  GEAR,
  ALL_GEAR_IDS,
  gearById,
  resolveLoadoutEffects,
} from "../js/core/gear.js";
import { DAMPENER_HEAT_MULT, RECON_BITE_BONUS } from "../js/core/balance.js";

describe("GEAR registry", () => {
  it("has exactly 3 items: analyzer, dampener, recon-rig", () => {
    assert.deepEqual(ALL_GEAR_IDS.sort(), ["analyzer", "dampener", "recon-rig"].sort());
  });

  it("analyzer has kind 'select'", () => {
    assert.equal(GEAR["analyzer"].kind, "select");
  });

  it("dampener has kind 'heat'", () => {
    assert.equal(GEAR["dampener"].kind, "heat");
  });

  it("recon-rig has kind 'bite'", () => {
    assert.equal(GEAR["recon-rig"].kind, "bite");
  });

  it("each item has id, name, kind, price, desc", () => {
    for (const [id, g] of Object.entries(GEAR)) {
      assert.equal(typeof g.id, "string", `${id}.id must be a string`);
      assert.equal(typeof g.name, "string", `${id}.name must be a string`);
      assert.equal(typeof g.kind, "string", `${id}.kind must be a string`);
      assert.equal(typeof g.price, "number", `${id}.price must be a number`);
      assert.equal(typeof g.desc, "string", `${id}.desc must be a string`);
      assert.equal(g.id, id, `${id}.id must match its registry key`);
    }
  });
});

describe("gearById", () => {
  it("returns the item for a known id", () => {
    const g = gearById("analyzer");
    assert.ok(g, "should return a gear object for 'analyzer'");
    assert.equal(g.id, "analyzer");
  });

  it("returns null for an unknown id", () => {
    assert.equal(gearById("phantom-gear"), null);
    assert.equal(gearById(""), null);
  });
});

describe("resolveLoadoutEffects", () => {
  it("empty loadout → neutral effects", () => {
    const fx = resolveLoadoutEffects([]);
    assert.deepEqual(fx, { selection: "blind", heatMult: 1, biteBonus: 0 });
  });

  it("undefined loadout → neutral effects (safe default)", () => {
    const fx = resolveLoadoutEffects();
    assert.deepEqual(fx, { selection: "blind", heatMult: 1, biteBonus: 0 });
  });

  it("['analyzer'] → selection 'best-match', others neutral", () => {
    const fx = resolveLoadoutEffects(["analyzer"]);
    assert.equal(fx.selection, "best-match");
    assert.equal(fx.heatMult, 1);
    assert.equal(fx.biteBonus, 0);
  });

  it("['dampener'] → heatMult = DAMPENER_HEAT_MULT, others neutral", () => {
    const fx = resolveLoadoutEffects(["dampener"]);
    assert.equal(fx.heatMult, DAMPENER_HEAT_MULT);
    assert.equal(fx.selection, "blind");
    assert.equal(fx.biteBonus, 0);
  });

  it("['recon-rig'] → biteBonus = RECON_BITE_BONUS, others neutral", () => {
    const fx = resolveLoadoutEffects(["recon-rig"]);
    assert.equal(fx.biteBonus, RECON_BITE_BONUS);
    assert.equal(fx.selection, "blind");
    assert.equal(fx.heatMult, 1);
  });

  it("['dampener','recon-rig'] → both active, selection still blind", () => {
    const fx = resolveLoadoutEffects(["dampener", "recon-rig"]);
    assert.equal(fx.heatMult, DAMPENER_HEAT_MULT);
    assert.equal(fx.biteBonus, RECON_BITE_BONUS);
    assert.equal(fx.selection, "blind");
  });

  it("all three equipped → all effects active", () => {
    const fx = resolveLoadoutEffects(["analyzer", "dampener", "recon-rig"]);
    assert.equal(fx.selection, "best-match");
    assert.equal(fx.heatMult, DAMPENER_HEAT_MULT);
    assert.equal(fx.biteBonus, RECON_BITE_BONUS);
  });
});
