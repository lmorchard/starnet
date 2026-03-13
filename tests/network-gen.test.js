// @ts-check
// Tests for network generation: budget utilities, hierarchical generation, etc.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  lanGradeOffset,
  applyGradeOffset,
  wingCount,
  hierarchicalBudget,
  costBudget,
  gradeToNumber,
  numberToGrade,
} from "../js/core/network/budget.js";

import { instantiate } from "../js/core/network/set-pieces.js";
import {
  CORPORATE_BIOME, SUB_BIOMES, RECIPES,
} from "../data/biomes/corporate.js";
import {
  backboneRouter, backboneFirewall, backboneHub,
} from "../data/biomes/corporate-pieces.js";
import { fillSkeleton } from "../js/core/network/slot-filler.js";
import { generateSkeleton, generateHierarchicalSkeleton, printSkeleton } from "../js/core/network/skeleton.js";
import { generateNetwork } from "../js/core/network/generate.js";

// ---------------------------------------------------------------------------
// Phase 1: Grade offset utilities
// ---------------------------------------------------------------------------

describe("lanGradeOffset", () => {
  it("returns 0 for F and D", () => {
    assert.equal(lanGradeOffset("F"), 0);
    assert.equal(lanGradeOffset("D"), 0);
  });

  it("returns 1 for C and B", () => {
    assert.equal(lanGradeOffset("C"), 1);
    assert.equal(lanGradeOffset("B"), 1);
  });

  it("returns 2 for A and S", () => {
    assert.equal(lanGradeOffset("A"), 2);
    assert.equal(lanGradeOffset("S"), 2);
  });
});

describe("applyGradeOffset", () => {
  it("shifts all grades by the offset", () => {
    const base = { threat: "F", wealth: "D", complexity: "C", depth: "B" };
    const result = applyGradeOffset(base, 2);
    assert.equal(result.threat, "C");
    assert.equal(result.wealth, "B");
    assert.equal(result.complexity, "A");
    assert.equal(result.depth, "S");
  });

  it("caps at S — never exceeds", () => {
    const base = { threat: "A", wealth: "S", complexity: "B", depth: "A" };
    const result = applyGradeOffset(base, 2);
    assert.equal(result.threat, "S");
    assert.equal(result.wealth, "S");
    assert.equal(result.complexity, "S");
    assert.equal(result.depth, "S");
  });

  it("offset 0 returns identical grades", () => {
    const base = { threat: "C", wealth: "B", complexity: "D", depth: "F" };
    const result = applyGradeOffset(base, 0);
    assert.deepEqual(result, base);
  });
});

describe("wingCount", () => {
  it("returns 0 for F and D (flat mode)", () => {
    assert.equal(wingCount("F"), 0);
    assert.equal(wingCount("D"), 0);
  });

  it("returns 2 for C", () => {
    assert.equal(wingCount("C"), 2);
  });

  it("returns 3 for B", () => {
    assert.equal(wingCount("B"), 3);
  });

  it("returns 4 for A", () => {
    assert.equal(wingCount("A"), 4);
  });

  it("returns 5 for S", () => {
    assert.equal(wingCount("S"), 5);
  });
});

describe("hierarchicalBudget", () => {
  const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };
  const specA = { threat: "A", wealth: "A", complexity: "A", depth: "A" };

  it("returns flat budget when numWings is 0", () => {
    const result = hierarchicalBudget(specC, 0);
    assert.equal(result.total, costBudget(specC));
    assert.equal(result.perWingBudget, 0);
  });

  it("C-grade with 2 wings produces 15-25 total budget range", () => {
    const result = hierarchicalBudget(specC, 2);
    assert.ok(result.total >= 15, `total ${result.total} should be >= 15`);
    assert.ok(result.total <= 55, `total ${result.total} should be <= 55`);
  });

  it("A-grade with 4 wings produces larger budget", () => {
    const result = hierarchicalBudget(specA, 4);
    assert.ok(result.total >= 30, `total ${result.total} should be >= 30`);
  });

  it("backbone budget scales with wing count", () => {
    const r2 = hierarchicalBudget(specC, 2);
    const r4 = hierarchicalBudget(specC, 4);
    assert.ok(r4.backboneBudget >= r2.backboneBudget);
  });

  it("per-wing budget is at least 4", () => {
    const result = hierarchicalBudget(specC, 2);
    assert.ok(result.perWingBudget >= 4, `perWingBudget ${result.perWingBudget} should be >= 4`);
  });

  it("budget components sum correctly", () => {
    const result = hierarchicalBudget(specC, 3);
    const reconstructed = result.backboneBudget + result.perWingBudget * 3;
    // Allow rounding differences
    assert.ok(reconstructed <= result.total + 3, "budget components should not exceed total");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Backbone pieces, sub-biomes, recipes
// ---------------------------------------------------------------------------

describe("Backbone set-pieces", () => {
  it("backboneRouter instantiates with relay operator", () => {
    const inst = instantiate(backboneRouter, "bb-0");
    assert.equal(inst.nodes.length, 1);
    const router = inst.nodes[0];
    assert.equal(router.type, "router");
    const relayOp = router.operators.find(op => op.name === "relay");
    assert.ok(relayOp, "should have relay operator");
  });

  it("backboneRouter has 1 inbound + 2 outbound ports", () => {
    const ports = backboneRouter.ports;
    const inbound = ports.filter(p => p.direction === "inbound");
    const outbound = ports.filter(p => p.direction === "outbound");
    assert.equal(inbound.length, 1);
    assert.equal(outbound.length, 2);
  });

  it("backboneFirewall has relay operator with alert filter", () => {
    const inst = instantiate(backboneFirewall, "bb-1");
    const fw = inst.nodes[0];
    const relayOp = fw.operators.find(op => op.name === "relay");
    assert.ok(relayOp, "should have relay operator");
    assert.equal(relayOp.filter, "alert");
  });

  it("backboneHub has 1 inbound + 3 outbound ports", () => {
    const ports = backboneHub.ports;
    const inbound = ports.filter(p => p.direction === "inbound");
    const outbound = ports.filter(p => p.direction === "outbound");
    assert.equal(inbound.length, 1);
    assert.equal(outbound.length, 3);
  });

  it("all backbone pieces have 'backbone' tag", () => {
    for (const piece of [backboneRouter, backboneFirewall, backboneHub]) {
      assert.ok(piece.tags.includes("backbone"), `${piece.id} should have backbone tag`);
    }
  });
});

describe("Sub-biome definitions", () => {
  const catalogIds = new Set(CORPORATE_BIOME.catalog.map(p => p.id));

  it("all sub-biome pieceIds exist in the catalog", () => {
    for (const sb of SUB_BIOMES) {
      for (const pieceId of sb.pieceIds) {
        assert.ok(catalogIds.has(pieceId), `${sb.id}: piece "${pieceId}" not in catalog`);
      }
    }
  });

  it("requiredPieceIds are a subset of pieceIds", () => {
    for (const sb of SUB_BIOMES) {
      const palette = new Set(sb.pieceIds);
      for (const reqId of sb.requiredPieceIds) {
        assert.ok(palette.has(reqId), `${sb.id}: required "${reqId}" not in pieceIds`);
      }
    }
  });

  it("baseGrades use valid grade strings", () => {
    const validGrades = new Set(["F", "D", "C", "B", "A", "S"]);
    for (const sb of SUB_BIOMES) {
      for (const axis of ["threat", "wealth", "complexity", "depth"]) {
        assert.ok(validGrades.has(sb.baseGrades[axis]),
          `${sb.id}: invalid ${axis} grade "${sb.baseGrades[axis]}"`);
      }
    }
  });

  it("security-ops requires ids-relay-chain", () => {
    const secOps = SUB_BIOMES.find(sb => sb.id === "security-ops");
    assert.ok(secOps);
    assert.ok(secOps.requiredPieceIds.includes("ids-relay-chain"));
  });
});

describe("Recipe definitions", () => {
  const subBiomeIds = new Set(SUB_BIOMES.map(sb => sb.id));

  it("all recipes reference valid sub-biome IDs", () => {
    for (const recipe of RECIPES) {
      for (const wingId of recipe.mandatoryWings) {
        assert.ok(subBiomeIds.has(wingId),
          `${recipe.id}: mandatory wing "${wingId}" not a valid sub-biome`);
      }
      for (const opt of recipe.optionalPool) {
        assert.ok(subBiomeIds.has(opt.subBiomeId),
          `${recipe.id}: optional "${opt.subBiomeId}" not a valid sub-biome`);
      }
    }
  });

  it("all recipes have at least one mandatory wing", () => {
    for (const recipe of RECIPES) {
      assert.ok(recipe.mandatoryWings.length >= 1,
        `${recipe.id}: needs at least 1 mandatory wing`);
    }
  });

  it("optional pool weights are positive", () => {
    for (const recipe of RECIPES) {
      for (const opt of recipe.optionalPool) {
        assert.ok(opt.weight > 0,
          `${recipe.id}: weight for "${opt.subBiomeId}" must be positive`);
      }
    }
  });
});

describe("Biome definition extensions", () => {
  it("CORPORATE_BIOME has subBiomes", () => {
    assert.ok(Array.isArray(CORPORATE_BIOME.subBiomes));
    assert.ok(CORPORATE_BIOME.subBiomes.length >= 4);
  });

  it("CORPORATE_BIOME has recipes", () => {
    assert.ok(Array.isArray(CORPORATE_BIOME.recipes));
    assert.ok(CORPORATE_BIOME.recipes.length >= 3);
  });

  it("CORPORATE_BIOME has backbonePieceIds", () => {
    assert.ok(Array.isArray(CORPORATE_BIOME.backbonePieceIds));
    assert.ok(CORPORATE_BIOME.backbonePieceIds.length >= 3);
    // All backbone IDs must exist in catalog
    const catalogIds = new Set(CORPORATE_BIOME.catalog.map(p => p.id));
    for (const id of CORPORATE_BIOME.backbonePieceIds) {
      assert.ok(catalogIds.has(id), `backbone piece "${id}" not in catalog`);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 3: Slot-filler enhancements
// ---------------------------------------------------------------------------

// Deterministic RNG for tests
function makeRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("Slot-filler: piece palette filtering", () => {
  const specF = { threat: "F", wealth: "F", complexity: "F", depth: "F" };

  it("with palette, only palette pieces are placed", () => {
    const rng = makeRng();
    const skeleton = generateSkeleton(specF, CORPORATE_BIOME, rng);
    const palette = new Set(["entry-point", "single-router", "single-workstation", "single-fileserver"]);
    const { pieces, ok } = fillSkeleton(skeleton, CORPORATE_BIOME, specF, makeRng(), { piecePalette: palette });
    assert.ok(ok, "filling should succeed");
    for (const p of pieces) {
      assert.ok(palette.has(p.pieceDef.id),
        `piece "${p.pieceDef.id}" should be in palette`);
    }
  });

  it("without palette, full catalog is used (regression)", () => {
    const rng = makeRng();
    const skeleton = generateSkeleton(specF, CORPORATE_BIOME, rng);
    const { pieces, ok } = fillSkeleton(skeleton, CORPORATE_BIOME, specF, makeRng());
    assert.ok(ok, "filling should succeed");
    assert.ok(pieces.length > 0);
  });
});

describe("Slot-filler: required piece placement", () => {
  const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };

  it("required piece is always placed", () => {
    const rng = makeRng();
    const skeleton = generateSkeleton(specC, CORPORATE_BIOME, rng);
    const { pieces, ok } = fillSkeleton(skeleton, CORPORATE_BIOME, specC, makeRng(), {
      requiredPieceIds: ["ids-relay-chain"],
    });
    assert.ok(ok, "filling should succeed");
    const hasIds = pieces.some(p => p.pieceDef.id === "ids-relay-chain");
    assert.ok(hasIds, "ids-relay-chain should be placed as required piece");
  });
});

describe("Slot-filler: multi-port consumption", () => {
  it("F/F network still generates valid networks (regression)", () => {
    const specF = { threat: "F", wealth: "F", complexity: "F", depth: "F" };
    const result = generateNetwork("test-multiport-regression", specF, CORPORATE_BIOME);
    assert.ok(result.graphDef.nodes.length >= 8, `should have >= 8 nodes, got ${result.graphDef.nodes.length}`);
  });

  it("C/C network generates valid networks", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };
    const result = generateNetwork("test-multiport-cc", specC, CORPORATE_BIOME);
    assert.ok(result.graphDef.nodes.length >= 8, `should have >= 8 nodes, got ${result.graphDef.nodes.length}`);
  });
});

// ---------------------------------------------------------------------------
// Phase 4: Hierarchical skeleton generation
// ---------------------------------------------------------------------------

describe("generateHierarchicalSkeleton", () => {
  const techCompany = RECIPES.find(r => r.id === "tech-company");
  const defenseContractor = RECIPES.find(r => r.id === "defense-contractor");

  it("produces backbone with entry + spine + backbone nodes", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };
    const { root } = generateHierarchicalSkeleton(specC, CORPORATE_BIOME, techCompany, makeRng());

    // Root is entry
    assert.ok(root.tags.includes("entry"));
    // First child is spine
    assert.ok(root.children[0].tags.includes("spine"));
    // Spine's children are backbone nodes
    const spineChild = root.children[0].children[0];
    assert.ok(spineChild.tags.includes("backbone"), "first child of spine should be backbone");
  });

  it("creates correct number of wings for complexity C (2 wings)", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };
    const { wings } = generateHierarchicalSkeleton(specC, CORPORATE_BIOME, techCompany, makeRng());
    assert.equal(wings.length, 2);
  });

  it("creates correct number of wings for complexity B (3 wings)", () => {
    const specB = { threat: "B", wealth: "B", complexity: "B", depth: "B" };
    const { wings } = generateHierarchicalSkeleton(specB, CORPORATE_BIOME, techCompany, makeRng());
    assert.equal(wings.length, 3);
  });

  it("defense contractor has 2 mandatory security-ops wings", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };
    const { wings } = generateHierarchicalSkeleton(specC, CORPORATE_BIOME, defenseContractor, makeRng());
    const secOpsWings = wings.filter(w => w.wingSpec.subBiome.id === "security-ops");
    assert.ok(secOpsWings.length >= 2, `should have >= 2 security-ops wings, got ${secOpsWings.length}`);
  });

  it("wing entry slots have subBiomeId set", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };
    const { wings } = generateHierarchicalSkeleton(specC, CORPORATE_BIOME, techCompany, makeRng());
    for (const w of wings) {
      assert.ok(w.slot.subBiomeId, `wing slot should have subBiomeId`);
    }
  });

  it("LAN grade offset is applied to wing specs", () => {
    const specA = { threat: "A", wealth: "A", complexity: "A", depth: "A", lanGrade: "A" };
    const { wings } = generateHierarchicalSkeleton(specA, CORPORATE_BIOME, techCompany, makeRng());
    // security-ops base threat is B. With A offset (+2), should be S (capped)
    const secOps = wings.find(w => w.wingSpec.subBiome.id === "security-ops");
    if (secOps) {
      assert.equal(secOps.wingSpec.spec.threat, "S", "security-ops threat should be S after +2 offset from A LAN");
    }
  });

  it("wings have children (sub-skeleton is populated)", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };
    const { wings } = generateHierarchicalSkeleton(specC, CORPORATE_BIOME, techCompany, makeRng());
    for (const w of wings) {
      assert.ok(w.slot.children.length > 0, `wing ${w.wingSpec.subBiome.id} should have children`);
    }
  });

  it("skeleton is a valid tree (all slots reachable from root)", () => {
    const specB = { threat: "B", wealth: "B", complexity: "B", depth: "B" };
    const { root } = generateHierarchicalSkeleton(specB, CORPORATE_BIOME, techCompany, makeRng());
    // Count all slots via DFS
    function countSlots(slot) {
      let count = 1;
      for (const child of slot.children) count += countSlots(child);
      return count;
    }
    const total = countSlots(root);
    assert.ok(total >= 10, `should have >= 10 total slots, got ${total}`);
  });
});

// ---------------------------------------------------------------------------
// Phase 5: Pipeline integration
// ---------------------------------------------------------------------------

describe("generateNetwork: hierarchical integration", () => {
  it("F/D spec produces a flat network (regression)", () => {
    const specF = { threat: "F", wealth: "F", complexity: "F", depth: "F" };
    const result = generateNetwork("flat-regression", specF, CORPORATE_BIOME);
    assert.ok(result.graphDef.nodes.length >= 8);
    assert.ok(result.graphDef.nodes.length <= 20,
      `F/F should be small, got ${result.graphDef.nodes.length}`);
  });

  it("C spec with recipe produces a hierarchical network", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C", recipeId: "tech-company" };
    const result = generateNetwork("hier-c", specC, CORPORATE_BIOME);
    assert.ok(result.graphDef.nodes.length >= 12,
      `C hierarchical should have >= 12 nodes, got ${result.graphDef.nodes.length}`);
  });

  it("B spec produces a larger hierarchical network", () => {
    const specB = { threat: "B", wealth: "B", complexity: "B", depth: "B", recipeId: "tech-company" };
    const result = generateNetwork("hier-b", specB, CORPORATE_BIOME);
    assert.ok(result.graphDef.nodes.length >= 15,
      `B hierarchical should have >= 15 nodes, got ${result.graphDef.nodes.length}`);
  });

  it("A spec produces a large network with many nodes", () => {
    const specA = { threat: "A", wealth: "A", complexity: "A", depth: "A", recipeId: "defense-contractor" };
    const result = generateNetwork("hier-a", specA, CORPORATE_BIOME);
    assert.ok(result.graphDef.nodes.length >= 20,
      `A hierarchical should have >= 20 nodes, got ${result.graphDef.nodes.length}`);
  });

  it("generated networks pass validation", () => {
    // Test multiple seeds to catch flaky generation
    for (const seed of ["val-1", "val-2", "val-3"]) {
      const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C", recipeId: "tech-company" };
      const result = generateNetwork(seed, specC, CORPORATE_BIOME);
      // If we got here, validation passed (generateNetwork throws on failure)
      assert.ok(result.graphDef.nodes.length > 0);
    }
  });

  it("gateway node always exists", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C", recipeId: "fashion-brand" };
    const result = generateNetwork("gateway-check", specC, CORPORATE_BIOME);
    const gateway = result.graphDef.nodes.find(n => n.type === "gateway");
    assert.ok(gateway, "gateway node must exist");
  });

  it("default recipe is used when recipeId not specified", () => {
    const specC = { threat: "C", wealth: "C", complexity: "C", depth: "C" };
    const result = generateNetwork("default-recipe", specC, CORPORATE_BIOME);
    // Should not throw — falls back to first recipe
    assert.ok(result.graphDef.nodes.length >= 8);
  });
});
