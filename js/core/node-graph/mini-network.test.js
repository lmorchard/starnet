// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "./runtime.js";
import { buildMiniNetwork, buildSetPieceMiniNetwork, listSetPieces } from "./mini-network.js";

describe("mini-network builder", () => {
  it("buildMiniNetwork wraps raw graphDef with gateway + WAN", () => {
    const raw = {
      nodes: [
        { id: "n1", type: "test", attributes: { label: "Node 1" } },
        { id: "n2", type: "test", attributes: { label: "Node 2" } },
      ],
      edges: [["n1", "n2"]],
    };
    const result = buildMiniNetwork(raw);
    assert.ok(result.graphDef);
    assert.ok(result.meta);
    assert.equal(result.meta.startNode, "gateway");

    const ids = result.graphDef.nodes.map((n) => n.id);
    assert.ok(ids.includes("gateway"), "should have gateway");
    assert.ok(ids.includes("wan"), "should have wan");
    assert.ok(ids.includes("n1"), "should have original node");
    assert.ok(ids.includes("n2"), "should have original node");

    // Gateway connected to first node + WAN
    assert.ok(result.graphDef.edges.some(([a, b]) => a === "gateway" && b === "n1"));
    assert.ok(result.graphDef.edges.some(([a, b]) => a === "gateway" && b === "wan"));
  });

  it("buildMiniNetwork produces valid NodeGraph", () => {
    const raw = {
      nodes: [
        { id: "n1", type: "router", attributes: { label: "Node 1", grade: "D" } },
      ],
      edges: [],
    };
    const result = buildMiniNetwork(raw);
    const graph = new NodeGraph(result.graphDef);
    assert.ok(graph.getNodeIds().length >= 2); // gateway + n1 + wan
  });

  it("buildSetPieceMiniNetwork wraps idsRelayChain", () => {
    const result = buildSetPieceMiniNetwork("idsRelayChain");
    assert.ok(result.graphDef);
    assert.ok(result.meta);
    assert.equal(result.meta.startNode, "gateway");

    const ids = result.graphDef.nodes.map((n) => n.id);
    assert.ok(ids.includes("gateway"));
    assert.ok(ids.includes("wan"));
    // Set-piece nodes should be prefixed with "sp/"
    assert.ok(ids.some((id) => id.startsWith("sp/")));
  });

  it("buildSetPieceMiniNetwork connects gateway to external ports", () => {
    const result = buildSetPieceMiniNetwork("idsRelayChain");
    // idsRelayChain has external ports: ["ids", "monitor"] → prefixed as "sp/ids", "sp/monitor"
    assert.ok(result.graphDef.edges.some(([a, b]) => a === "gateway" && b === "sp/ids"));
    assert.ok(result.graphDef.edges.some(([a, b]) => a === "gateway" && b === "sp/monitor"));
  });

  it("buildSetPieceMiniNetwork produces valid NodeGraph", () => {
    const result = buildSetPieceMiniNetwork("idsRelayChain");
    const graph = new NodeGraph(result.graphDef);
    assert.ok(graph.getNodeIds().length >= 3);
  });

  it("all set-pieces can be wrapped without error", () => {
    for (const name of listSetPieces()) {
      const result = buildSetPieceMiniNetwork(name);
      assert.ok(result.graphDef.nodes.length >= 3, `${name} should have at least gateway + wan + 1 node`);
      // Verify it constructs a valid graph
      const graph = new NodeGraph(result.graphDef);
      assert.ok(graph.getNodeIds().length >= 3, `${name} graph should have nodes`);
    }
  });

  it("throws on unknown set-piece name", () => {
    assert.throws(() => buildSetPieceMiniNetwork("nonexistent"), /Unknown set-piece/);
  });

  it("listSetPieces returns available names", () => {
    const pieces = listSetPieces();
    assert.ok(pieces.includes("idsRelayChain"));
    assert.ok(pieces.includes("deadmanCircuit"));
    assert.ok(pieces.length >= 10);
  });
});
