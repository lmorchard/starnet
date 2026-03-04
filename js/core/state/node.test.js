// @ts-check
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildNetwork as buildCorporateFoothold } from "../../../data/networks/corporate-foothold.js";
import { initGame, getState, getVersion } from "./index.js";
import { clearAll } from "../timers.js";
import {
  setNodeVisible, setNodeAccessLevel, setNodeProbed, setNodeAlertState,
  setNodeRead, collectMacguffins, setNodeLooted, setNodeRebooting,
  setNodeEventForwarding, setNodeVulnHidden,
} from "./node.js";

describe("state/node — node mutations", () => {
  beforeEach(() => {
    clearAll();
    initGame(() => buildCorporateFoothold());
  });

  it("setNodeVisible changes visibility and bumps version", () => {
    const v = getVersion();
    setNodeVisible("gateway", "revealed");
    assert.equal(getState().nodes["gateway"].visibility, "revealed");
    assert.equal(getVersion(), v + 1);
  });

  it("setNodeAccessLevel changes accessLevel and bumps version", () => {
    const v = getVersion();
    setNodeAccessLevel("gateway", "compromised");
    assert.equal(getState().nodes["gateway"].accessLevel, "compromised");
    assert.equal(getVersion(), v + 1);
  });

  it("setNodeProbed marks node as probed", () => {
    const v = getVersion();
    setNodeProbed("gateway");
    assert.equal(getState().nodes["gateway"].probed, true);
    assert.equal(getVersion(), v + 1);
  });

  it("setNodeAlertState changes alertState", () => {
    const v = getVersion();
    setNodeAlertState("gateway", "yellow");
    assert.equal(getState().nodes["gateway"].alertState, "yellow");
    assert.equal(getVersion(), v + 1);
  });

  it("setNodeRead marks node as read", () => {
    setNodeRead("gateway");
    assert.equal(getState().nodes["gateway"].read, true);
  });

  it("collectMacguffins returns items and total", () => {
    // Find a node that has macguffins (fileserver type should have some)
    const s = getState();
    const lootableNode = Object.values(s.nodes).find((n) => n.macguffins?.length > 0);
    if (!lootableNode) return; // skip if no macguffins in this random seed

    const v = getVersion();
    const { items, total } = collectMacguffins(lootableNode.id);
    assert.ok(items.length > 0);
    assert.ok(total > 0);
    assert.equal(getVersion(), v + 1);

    // All macguffins now collected
    lootableNode.macguffins.forEach((m) => assert.equal(m.collected, true));
  });

  it("collectMacguffins returns empty for node with no macguffins", () => {
    const { items, total } = collectMacguffins("gateway");
    assert.equal(items.length, 0);
    assert.equal(total, 0);
  });

  it("setNodeLooted marks node as looted", () => {
    setNodeLooted("gateway");
    assert.equal(getState().nodes["gateway"].looted, true);
  });

  it("setNodeRebooting sets rebooting flag", () => {
    setNodeRebooting("gateway", true);
    assert.equal(getState().nodes["gateway"].rebooting, true);
    setNodeRebooting("gateway", false);
    assert.equal(getState().nodes["gateway"].rebooting, false);
  });

  it("setNodeEventForwarding sets eventForwardingDisabled", () => {
    // Find an IDS node that has eventForwardingDisabled
    const s = getState();
    const idsNode = Object.values(s.nodes).find((n) => n.type === "ids");
    if (!idsNode) return;

    setNodeEventForwarding(idsNode.id, true);
    assert.equal(getState().nodes[idsNode.id].eventForwardingDisabled, true);
  });

  it("setNodeVulnHidden sets vulnerability hidden flag", () => {
    // Probe gateway first so it has vulns
    const s = getState();
    const node = s.nodes["gateway"];
    if (node.vulnerabilities.length === 0) return;

    setNodeVulnHidden("gateway", 0, true);
    assert.equal(getState().nodes["gateway"].vulnerabilities[0].hidden, true);
    setNodeVulnHidden("gateway", 0, false);
    assert.equal(getState().nodes["gateway"].vulnerabilities[0].hidden, false);
  });

  it("invalid nodeId is a no-op", () => {
    const v = getVersion();
    setNodeVisible("nonexistent", "accessible");
    // Version still bumps (mutate always increments) but no crash
    assert.equal(getVersion(), v + 1);
  });
});
