import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "../../js/core/node-graph/runtime.js";
import { buildNetwork as buildCorporateFoothold } from "./corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "./research-station.js";
import { buildNetwork as buildCorporateExchange } from "./corporate-exchange.js";

/**
 * BFS reachability from startNode over edges.
 * @param {string} start
 * @param {[string, string][]} edges
 * @returns {Set<string>}
 */
function reachable(start, edges) {
  const adj = new Map();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  const visited = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    if (visited.has(node)) continue;
    visited.add(node);
    for (const neighbor of (adj.get(node) ?? [])) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }
  return visited;
}

// ── Shared validation ────────────────────────────────────────

function validateNetwork(name, build) {
  describe(name, () => {
    let result;

    it("builds without error", () => {
      result = build();
      assert.ok(result.graphDef);
      assert.ok(result.meta);
    });

    it("all edge endpoints exist as nodes", () => {
      const { graphDef } = build();
      const nodeIds = new Set(graphDef.nodes.map(n => n.id));
      for (const [a, b] of graphDef.edges) {
        assert.ok(nodeIds.has(a), `Edge references missing node: "${a}"`);
        assert.ok(nodeIds.has(b), `Edge references missing node: "${b}"`);
      }
    });

    it("no duplicate node IDs", () => {
      const { graphDef } = build();
      const ids = graphDef.nodes.map(n => n.id);
      const unique = new Set(ids);
      assert.equal(ids.length, unique.size, `Duplicate IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
    });

    it("start node exists and is accessible", () => {
      const { graphDef, meta } = build();
      const startNode = graphDef.nodes.find(n => n.id === meta.startNode);
      assert.ok(startNode, `Start node "${meta.startNode}" not found`);
      assert.equal(startNode.attributes.visibility, "accessible");
    });

    it("at least one lootable node reachable from start", () => {
      const { graphDef, meta } = build();
      const reached = reachable(meta.startNode, graphDef.edges);
      const lootableTypes = new Set(["fileserver", "cryptovault", "key-server", "workstation"]);
      const hasLoot = graphDef.nodes.some(n =>
        reached.has(n.id) && lootableTypes.has(n.type)
      );
      assert.ok(hasLoot, "No lootable nodes reachable from start");
    });

    it("constructs a valid NodeGraph", () => {
      const { graphDef } = build();
      const graph = new NodeGraph(graphDef);
      assert.ok(graph.getNodeIds().length > 0);
    });

    it("all nodes have standard game attributes (after trait resolution)", () => {
      const { graphDef } = build();
      const graph = new NodeGraph(graphDef);
      const requiredAttrs = ["visibility"];
      for (const nodeId of graph.getNodeIds()) {
        const attrs = graph.getNodeState(nodeId);
        for (const attr of requiredAttrs) {
          assert.ok(
            attr in attrs,
            `Node "${nodeId}" missing attribute "${attr}"`,
          );
        }
      }
    });
  });
}

// ── Test each network ────────────────────────────────────────

validateNetwork("Corporate Foothold", buildCorporateFoothold);
validateNetwork("Research Station", buildResearchStation);
validateNetwork("Corporate Exchange", buildCorporateExchange);

// ── Network-specific checks ──────────────────────────────────

describe("Corporate Foothold specifics", () => {
  it("has no ICE", () => {
    const { meta } = buildCorporateFoothold();
    assert.equal(meta.ice, null);
  });

  it("has 10-15 nodes", () => {
    const { graphDef } = buildCorporateFoothold();
    assert.ok(graphDef.nodes.length >= 10, `Only ${graphDef.nodes.length} nodes`);
    assert.ok(graphDef.nodes.length <= 15, `Too many: ${graphDef.nodes.length} nodes`);
  });
});

describe("Research Station specifics", () => {
  it("has no ICE", () => {
    const { meta } = buildResearchStation();
    assert.equal(meta.ice, null);
  });

  it("has 15-22 nodes", () => {
    const { graphDef } = buildResearchStation();
    assert.ok(graphDef.nodes.length >= 15, `Only ${graphDef.nodes.length} nodes`);
    assert.ok(graphDef.nodes.length <= 22, `Too many: ${graphDef.nodes.length} nodes`);
  });
});

describe("Corporate Exchange specifics", () => {
  it("has ICE defined", () => {
    const { meta } = buildCorporateExchange();
    assert.ok(meta.ice);
    assert.ok(meta.ice.grade);
    assert.ok(meta.ice.startNode);
  });

  it("ICE start node exists in the network", () => {
    const { graphDef, meta } = buildCorporateExchange();
    const nodeIds = new Set(graphDef.nodes.map(n => n.id));
    assert.ok(nodeIds.has(meta.ice.startNode), `ICE start node "${meta.ice.startNode}" not in graph`);
  });

  it("has 12-18 nodes", () => {
    const { graphDef } = buildCorporateExchange();
    assert.ok(graphDef.nodes.length >= 12, `Only ${graphDef.nodes.length} nodes`);
    assert.ok(graphDef.nodes.length <= 18, `Too many: ${graphDef.nodes.length} nodes`);
  });
});
