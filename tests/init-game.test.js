import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState, serializeState, deserializeState } from "../js/core/state.js";
import { activeIceInstances } from "../js/core/state/ice.js";
import { getType } from "../js/core/ice/index.js";
import { clearHandlers } from "../js/core/events.js";
import { clearAll } from "../js/core/timers.js";
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
    const ice = activeIceInstances(getState())[0];
    assert.ok(ice);
    assert.equal(ice.active, true);
    assert.equal(ice.grade, "B");
  });

  it("spawns one instance per meta.ice.instances entry (ice-1..ice-N)", () => {
    // Reuse a real generated graphDef but override meta.ice with a 3-instance list.
    const base = buildCorporateExchange();
    const ids = base.graphDef.nodes.map(n => n.id);
    const startNodes = [ids[0], ids[1], ids[2]];
    const build = () => ({
      graphDef: base.graphDef,
      meta: {
        ...base.meta,
        ice: { instances: startNodes.map(sn => ({ startNode: sn, grade: "A" })) },
      },
    });
    initGame(build, "multi-instance-seed");
    const s = getState();
    assert.equal(Object.keys(s.ice.instances).length, 3);
    ["ice-1", "ice-2", "ice-3"].forEach((id, i) => {
      const inst = s.ice.instances[id];
      assert.ok(inst, `${id} should exist`);
      assert.equal(inst.id, id);
      assert.equal(inst.active, true);
      assert.equal(inst.grade, "A");
      assert.equal(inst.hostNodeId, startNodes[i]);
      assert.equal(inst.attentionNodeId, startNodes[i]);
    });
  });

  it("single-monitor (legacy) meta.ice → exactly one ice-1 (parity)", () => {
    // corporate-exchange uses the legacy { startNode, grade } shape.
    initGame(() => buildCorporateExchange(), "parity-seed");
    const s = getState();
    assert.equal(Object.keys(s.ice.instances).length, 1);
    const inst = s.ice.instances["ice-1"];
    assert.ok(inst);
    assert.equal(inst.id, "ice-1");
    assert.equal(inst.active, true);
    assert.equal(inst.grade, "B");
    // Post-#133 integration: every spawned instance (including legacy single-ICE
    // networks) gets a registry-driven type, with focus/behaviorPattern derived
    // from it — not the old hardcoded 'standard-ice'/'roaming'.
    const typeDef = getType(inst.typeId);
    assert.ok(typeDef, `typeId ${inst.typeId} should resolve to a registered ICE type`);
    assert.equal(inst.focus, typeDef.focus ?? "roaming");
    assert.equal(inst.behaviorPattern, typeDef.behaviorPattern ?? "standard");
  });

  it("empty instances list → no ICE instances", () => {
    const base = buildCorporateExchange();
    const build = () => ({
      graphDef: base.graphDef,
      meta: { ...base.meta, ice: { instances: [] } },
    });
    initGame(build, "empty-instances-seed");
    const s = getState();
    assert.equal(Object.keys(s.ice.instances).length, 0);
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

  it("player state includes health and deckIntegrity pools", () => {
    clearAll();
    initGame(() => buildCorporateExchange());
    const s = getState();
    assert.equal(s.player.health.current, 100);
    assert.equal(s.player.health.max, 100);
    assert.equal(s.player.deckIntegrity.current, 100);
    assert.equal(s.player.deckIntegrity.max, 100);
  });
});

describe("save/load round-trip with NodeGraph", () => {
  it("preserves node attributes through serialize/deserialize", () => {
    initGame(() => buildCorporateFoothold(), "save-test-1");
    const s = getState();
    s.nodeGraph.setNodeAttr("gateway", "probed", true);

    const snapshot = serializeState();
    assert.ok(snapshot._nodeGraph, "snapshot should include _nodeGraph");

    // Deserialize into fresh state
    deserializeState(JSON.parse(JSON.stringify(snapshot)));
    const s2 = getState();
    assert.ok(s2.nodeGraph, "restored state should have nodeGraph");
    assert.equal(s2.nodes["gateway"].probed, true);
    assert.equal(s2.nodeGraph.getNodeState("gateway").probed, true);
  });

  it("preserves graph qualities through round-trip", () => {
    initGame(() => buildCorporateFoothold(), "save-test-2");
    const s = getState();
    s.nodeGraph.setQuality("test-quality", 42);

    const snapshot = serializeState();
    deserializeState(JSON.parse(JSON.stringify(snapshot)));
    const s2 = getState();
    assert.equal(s2.nodeGraph.getQuality("test-quality"), 42);
  });

  it("graph still ticks after restore", () => {
    initGame(() => buildCorporateFoothold(), "save-test-3");
    const snapshot = serializeState();
    deserializeState(JSON.parse(JSON.stringify(snapshot)));
    const s2 = getState();
    assert.doesNotThrow(() => s2.nodeGraph.tick(5));
  });
});
