import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState } from "../js/core/state.js";
import { clearHandlers } from "../js/core/events.js";
import { buildNetwork as buildCorporateFoothold } from "../data/networks/corporate-foothold.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";

afterEach(() => clearHandlers());

describe("initGame", () => {
  it("initializes state from corporate-foothold network", () => {
    initGame(() => buildCorporateFoothold(), "test-seed-1");
    const s = getState();
    assert.ok(s);
    assert.equal(s.phase, "playing");
    assert.ok(Object.keys(s.nodes).length > 0);
    assert.ok(s.nodes["gateway"]);
    assert.equal(s.nodes["gateway"].visibility, "accessible");
    assert.equal(s.nodes["gateway"].accessLevel, "locked");
  });

  it("populates adjacency from graph edges", () => {
    initGame(() => buildCorporateFoothold(), "test-seed-2");
    const s = getState();
    assert.ok(s.adjacency["gateway"]?.length > 0);
    assert.ok(s.adjacency["gateway"].includes("router-1"));
  });

  it("generates vulnerabilities for nodes", () => {
    initGame(() => buildCorporateFoothold(), "test-seed-3");
    const s = getState();
    // At least one node should have vulns
    const hasVulns = Object.values(s.nodes).some(n => n.vulnerabilities?.length > 0);
    assert.ok(hasVulns, "No vulnerabilities generated");
  });

  it("generates macguffins for lootable nodes", () => {
    initGame(() => buildCorporateFoothold(), "test-seed-4");
    const s = getState();
    const lootableTypes = new Set(["fileserver", "cryptovault", "workstation", "key-server"]);
    const lootableNodes = Object.values(s.nodes).filter(n => lootableTypes.has(n.type));
    const hasMacguffins = lootableNodes.some(n => n.macguffins?.length > 0);
    assert.ok(hasMacguffins, "No macguffins generated on lootable nodes");
  });

  it("stores nodeGraph on state", () => {
    initGame(() => buildCorporateFoothold(), "test-seed-5");
    const s = getState();
    assert.ok(s.nodeGraph);
    assert.ok(typeof s.nodeGraph.getNodeState === "function");
    assert.ok(typeof s.nodeGraph.tick === "function");
  });

  it("graph and state.nodes are in sync", () => {
    initGame(() => buildCorporateFoothold(), "test-seed-6");
    const s = getState();
    for (const nodeId of Object.keys(s.nodes)) {
      const graphState = s.nodeGraph.getNodeState(nodeId);
      assert.equal(
        s.nodes[nodeId].visibility,
        graphState.visibility,
        `visibility mismatch for ${nodeId}`,
      );
      assert.equal(
        s.nodes[nodeId].accessLevel,
        graphState.accessLevel,
        `accessLevel mismatch for ${nodeId}`,
      );
    }
  });

  it("spawns ICE from meta when defined", () => {
    initGame(() => buildCorporateExchange(), "test-seed-7");
    const s = getState();
    assert.ok(s.ice);
    assert.equal(s.ice.active, true);
    assert.equal(s.ice.grade, "B");
  });

  it("graph tick advances without error", () => {
    initGame(() => buildCorporateFoothold(), "test-seed-8");
    const s = getState();
    assert.doesNotThrow(() => s.nodeGraph.tick(1));
    assert.doesNotThrow(() => s.nodeGraph.tick(10));
  });

  it("graph attribute sync bridges to state.nodes", () => {
    initGame(() => buildCorporateFoothold(), "test-seed-9");
    const s = getState();
    // Mutate via graph directly
    s.nodeGraph.setNodeAttr("gateway", "probed", true);
    // Should be synced to state.nodes
    assert.equal(s.nodes["gateway"].probed, true);
  });
});
