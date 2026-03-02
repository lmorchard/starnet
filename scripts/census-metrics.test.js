// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeTopology, estimateResources, weightedAvgQuality } from "./census-metrics.js";

// ── Helper: build a minimal network ──────────────────────────────────────────

function makeNetwork(nodes, edges, startNode = "gw-1") {
  return {
    nodes,
    edges,
    startNode,
    ice: { grade: "C" },
  };
}

// ── analyzeTopology ──────────────────────────────────────────────────────────

describe("analyzeTopology", () => {
  it("counts nodes and groups by type", () => {
    const net = makeNetwork(
      [
        { id: "wan-1", type: "wan", grade: "D" },
        { id: "gw-1", type: "gateway", grade: "D" },
        { id: "rtr-1", type: "router", grade: "C" },
        { id: "fs-1", type: "fileserver", grade: "B" },
      ],
      [
        { source: "wan-1", target: "gw-1" },
        { source: "gw-1", target: "rtr-1" },
        { source: "rtr-1", target: "fs-1" },
      ],
    );
    const t = analyzeTopology(net);
    assert.equal(t.nodeCount, 4);
    assert.deepStrictEqual(t.nodesByType, {
      wan: 1, gateway: 1, router: 1, fileserver: 1,
    });
  });

  it("finds shortest critical path via BFS", () => {
    // Two paths to fileserver: gw→rtr-a→fs (length 3) and gw→rtr-b→ws→fs (length 4)
    const net = makeNetwork(
      [
        { id: "gw-1", type: "gateway", grade: "D" },
        { id: "rtr-a", type: "router", grade: "C" },
        { id: "rtr-b", type: "router", grade: "C" },
        { id: "ws-1", type: "workstation", grade: "D" },
        { id: "fs-1", type: "fileserver", grade: "B" },
      ],
      [
        { source: "gw-1", target: "rtr-a" },
        { source: "gw-1", target: "rtr-b" },
        { source: "rtr-a", target: "fs-1" },
        { source: "rtr-b", target: "ws-1" },
        { source: "ws-1", target: "fs-1" },
      ],
    );
    const t = analyzeTopology(net);
    assert.deepStrictEqual(t.criticalPath, ["gw-1", "rtr-a", "fs-1"]);
    assert.equal(t.critPathLength, 3);
  });

  it("extracts grades along critical path excluding wan/gateway", () => {
    const net = makeNetwork(
      [
        { id: "wan-1", type: "wan", grade: "D" },
        { id: "gw-1", type: "gateway", grade: "D" },
        { id: "rtr-1", type: "router", grade: "C" },
        { id: "fw-1", type: "firewall", grade: "A" },
        { id: "fs-1", type: "fileserver", grade: "B" },
      ],
      [
        { source: "wan-1", target: "gw-1" },
        { source: "gw-1", target: "rtr-1" },
        { source: "rtr-1", target: "fw-1" },
        { source: "fw-1", target: "fs-1" },
      ],
    );
    const t = analyzeTopology(net);
    assert.deepStrictEqual(t.critPathGrades, ["C", "A", "B"]);
  });

  it("counts gates on critical path", () => {
    const net = makeNetwork(
      [
        { id: "gw-1", type: "gateway", grade: "D" },
        { id: "fw-1", type: "firewall", grade: "A" },
        { id: "fw-2", type: "firewall", grade: "A" },
        { id: "fs-1", type: "fileserver", grade: "S" },
      ],
      [
        { source: "gw-1", target: "fw-1" },
        { source: "fw-1", target: "fw-2" },
        { source: "fw-2", target: "fs-1" },
      ],
    );
    const t = analyzeTopology(net);
    assert.equal(t.critPathGates, 2);
  });

  it("detects set piece heuristic (extra firewalls + fileservers)", () => {
    const net = makeNetwork(
      [
        { id: "gw-1", type: "gateway", grade: "D" },
        { id: "rtr-1", type: "router", grade: "C" },
        { id: "fw-1", type: "firewall", grade: "A" },
        { id: "fw-2", type: "firewall", grade: "B" },
        { id: "fs-1", type: "fileserver", grade: "B" },
        { id: "fs-2", type: "fileserver", grade: "C" },
        { id: "ws-1", type: "workstation", grade: "D" },
      ],
      [
        { source: "gw-1", target: "rtr-1" },
        { source: "rtr-1", target: "fw-1" },
        { source: "fw-1", target: "fs-1" },
        { source: "gw-1", target: "fw-2" },
        { source: "fw-2", target: "fs-2" },
        { source: "rtr-1", target: "ws-1" },
      ],
    );
    const t = analyzeTopology(net);
    assert.equal(t.setPieceFired, true);
  });

  it("no set piece when counts are normal", () => {
    const net = makeNetwork(
      [
        { id: "gw-1", type: "gateway", grade: "D" },
        { id: "rtr-1", type: "router", grade: "C" },
        { id: "fw-1", type: "firewall", grade: "A" },
        { id: "fs-1", type: "fileserver", grade: "B" },
      ],
      [
        { source: "gw-1", target: "rtr-1" },
        { source: "rtr-1", target: "fw-1" },
        { source: "fw-1", target: "fs-1" },
      ],
    );
    const t = analyzeTopology(net);
    assert.equal(t.setPieceFired, false);
  });

  it("returns ICE grade from network", () => {
    const net = makeNetwork(
      [
        { id: "gw-1", type: "gateway", grade: "D" },
        { id: "fs-1", type: "fileserver", grade: "B" },
      ],
      [{ source: "gw-1", target: "fs-1" }],
    );
    net.ice.grade = "A";
    const t = analyzeTopology(net);
    assert.equal(t.iceGrade, "A");
  });

  it("returns empty path when no lootable target exists", () => {
    const net = makeNetwork(
      [
        { id: "gw-1", type: "gateway", grade: "D" },
        { id: "rtr-1", type: "router", grade: "C" },
      ],
      [{ source: "gw-1", target: "rtr-1" }],
    );
    const t = analyzeTopology(net);
    assert.deepStrictEqual(t.criticalPath, []);
    assert.equal(t.critPathLength, 0);
  });
});

// ── weightedAvgQuality ───────────────────────────────────────────────────────

describe("weightedAvgQuality", () => {
  it("computes correct average for F hand", () => {
    // F hand: 2 common (0.375), 3 uncommon (0.60), 1 rare (0.825)
    const avg = weightedAvgQuality(["common", "common", "uncommon", "uncommon", "uncommon", "rare"]);
    const expected = (0.375 * 2 + 0.60 * 3 + 0.825 * 1) / 6;
    assert.ok(Math.abs(avg - expected) < 0.001, `expected ~${expected.toFixed(4)}, got ${avg.toFixed(4)}`);
  });

  it("computes correct average for S hand", () => {
    // S hand: 5 uncommon (0.60), 3 rare (0.825)
    const avg = weightedAvgQuality(["uncommon", "uncommon", "uncommon", "uncommon", "uncommon", "rare", "rare", "rare"]);
    const expected = (0.60 * 5 + 0.825 * 3) / 8;
    assert.ok(Math.abs(avg - expected) < 0.001, `expected ~${expected.toFixed(4)}, got ${avg.toFixed(4)}`);
  });

  it("returns 0 for empty hand", () => {
    assert.equal(weightedAvgQuality([]), 0);
  });
});

// ── estimateResources ────────────────────────────────────────────────────────

describe("estimateResources", () => {
  it("F/F: low expected uses, large surplus", () => {
    // F-grade nodes: gradeModifier 0.90, avg quality ~0.5125
    // successProb = min(0.95, 0.5125 * 0.90 + 0.40) = min(0.95, 0.861) = 0.861
    // expectedUses per node = 2 / 0.861 ≈ 2.32
    const topology = { critPathGrades: ["F", "D"] };
    const est = estimateResources(topology, "F");

    assert.equal(est.perNode.length, 2);
    assert.ok(est.totalExpectedUses < 8, `expected <8 total uses, got ${est.totalExpectedUses.toFixed(1)}`);
    assert.equal(est.cardDeficit, 0);  // should have surplus
    assert.equal(est.startingCash, 1000);
    assert.equal(est.handSize, 6);
  });

  it("S/S: high expected uses", () => {
    // S-grade nodes: gradeModifier 0.05, avg quality ~0.684
    // successProb = min(0.95, 0.684 * 0.05 + 0.40) = min(0.95, 0.434) = 0.434
    // expectedUses per node = 2 / 0.434 ≈ 4.61
    const topology = { critPathGrades: ["A", "S", "S", "A", "S"] };
    const est = estimateResources(topology, "S");

    assert.ok(est.totalExpectedUses > 15, `expected >15 total uses, got ${est.totalExpectedUses.toFixed(1)}`);
    assert.equal(est.startingCash, 2500);
    assert.equal(est.handSize, 8);
  });

  it("starting uses matches hand composition", () => {
    const topology = { critPathGrades: ["C"] };
    const est = estimateResources(topology, "B");

    // B hand: 1 common (3) + 4 uncommon (5 each) + 2 rare (8 each) = 3 + 20 + 16 = 39
    assert.equal(est.startingUses, 39);
  });

  it("estimates darknet cost for deficit", () => {
    // Create a very long, hard critical path with a weak hand (F) to force a deficit
    // F hand: 27 starting uses. 10 S-grade nodes × ~4.7 uses each ≈ 47 uses needed.
    const topology = { critPathGrades: ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"] };
    const est = estimateResources(topology, "F");

    assert.ok(est.cardDeficit > 0, `expected positive deficit, got ${est.cardDeficit.toFixed(1)}`);
    assert.ok(est.estDarknetCost > 0, "expected darknet cost when deficit exists");
    // Cost should be in multiples of 250 (uncommon card price)
    assert.equal(est.estDarknetCost % 250, 0);
  });
});
