// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeTopology } from "./census-metrics.js";

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
