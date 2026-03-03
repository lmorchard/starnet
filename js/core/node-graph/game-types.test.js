import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "./runtime.js";
import { mockCtx } from "./ctx.js";
import {
  createGateway, createRouter, createIDS, createSecurityMonitor,
  createFileserver, createCryptovault, createFirewall, createWAN,
  ACTION_TEMPLATES,
} from "./game-types.js";

// ── Factory output shape ─────────────────────────────────────

describe("factory output shape", () => {
  const factories = [
    ["gateway", createGateway],
    ["router", createRouter],
    ["ids", createIDS],
    ["security-monitor", createSecurityMonitor],
    ["fileserver", createFileserver],
    ["cryptovault", createCryptovault],
    ["firewall", createFirewall],
    ["wan", createWAN],
  ];

  for (const [name, factory] of factories) {
    it(`${name} factory produces valid NodeDef`, () => {
      const def = factory(`test-${name}`);
      assert.equal(def.id, `test-${name}`);
      assert.equal(def.type, name);
      assert.ok(def.attributes);
      assert.ok(Array.isArray(def.operators));
      assert.ok(Array.isArray(def.actions));
      // All nodes have these base attributes
      assert.equal(typeof def.attributes.visibility, "string");
      assert.equal(typeof def.attributes.accessLevel, "string");
      assert.equal(typeof def.attributes.probed, "boolean");
    });
  }
});

// ── Default attributes ───────────────────────────────────────

describe("default attributes", () => {
  it("gateway defaults to hidden/locked", () => {
    const gw = createGateway("gw");
    assert.equal(gw.attributes.visibility, "hidden");
    assert.equal(gw.attributes.accessLevel, "locked");
    assert.equal(gw.attributes.gateAccess, "compromised");
  });

  it("config overrides default attributes", () => {
    const gw = createGateway("gw", {
      grade: "A",
      attributes: { visibility: "accessible" },
    });
    assert.equal(gw.attributes.grade, "A");
    assert.equal(gw.attributes.visibility, "accessible");
  });

  it("ids defaults forwardingEnabled to true", () => {
    const ids = createIDS("ids-1");
    assert.equal(ids.attributes.forwardingEnabled, true);
    assert.equal(ids.attributes.gateAccess, "owned");
  });

  it("firewall defaults to grade A with gateAccess owned", () => {
    const fw = createFirewall("fw-1");
    assert.equal(fw.attributes.grade, "A");
    assert.equal(fw.attributes.gateAccess, "owned");
  });

  it("wan starts accessible and owned", () => {
    const wan = createWAN("wan-1");
    assert.equal(wan.attributes.visibility, "accessible");
    assert.equal(wan.attributes.accessLevel, "owned");
  });

  it("fileserver has lootCount attribute", () => {
    const fs = createFileserver("fs-1");
    assert.deepEqual(fs.attributes.lootCount, [1, 2]);
  });

  it("cryptovault has higher default grade", () => {
    const cv = createCryptovault("cv-1");
    assert.equal(cv.attributes.grade, "B");
    assert.deepEqual(cv.attributes.lootCount, [1, 3]);
  });
});

// ── Operators ────────────────────────────────────────────────

describe("operators", () => {
  it("router has relay operator", () => {
    const r = createRouter("r-1");
    assert.equal(r.operators.length, 1);
    assert.equal(r.operators[0].name, "relay");
  });

  it("ids has relay(filter:alert) and flag(on:alert)", () => {
    const ids = createIDS("ids-1");
    assert.equal(ids.operators.length, 2);
    assert.equal(ids.operators[0].name, "relay");
    assert.equal(ids.operators[0].filter, "alert");
    assert.equal(ids.operators[1].name, "flag");
    assert.equal(ids.operators[1].on, "alert");
  });

  it("security-monitor has flag(on:alert)", () => {
    const mon = createSecurityMonitor("mon-1");
    assert.equal(mon.operators.length, 1);
    assert.equal(mon.operators[0].name, "flag");
    assert.equal(mon.operators[0].on, "alert");
  });

  it("gateway, fileserver, cryptovault, firewall, wan have no operators", () => {
    for (const factory of [createGateway, createFileserver, createCryptovault, createFirewall, createWAN]) {
      const def = factory("test");
      assert.equal(def.operators.length, 0, `${def.type} should have no operators`);
    }
  });
});

// ── Action availability via NodeGraph ────────────────────────

describe("action availability", () => {
  it("probe available on locked unprobed gateway", () => {
    const gw = createGateway("gw", { attributes: { visibility: "accessible" } });
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(actions.some(a => a.id === "probe"));
  });

  it("probe not available when already probed", () => {
    const gw = createGateway("gw", { attributes: { visibility: "accessible", probed: true } });
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(!actions.some(a => a.id === "probe"));
  });

  it("exploit available on accessible node", () => {
    const gw = createGateway("gw", { attributes: { visibility: "accessible" } });
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(actions.some(a => a.id === "exploit"));
  });

  it("exploit not available on hidden node", () => {
    const gw = createGateway("gw");
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(!actions.some(a => a.id === "exploit"));
  });

  it("read available on compromised unread fileserver", () => {
    const fs = createFileserver("fs", {
      attributes: { visibility: "accessible", accessLevel: "compromised" },
    });
    const graph = new NodeGraph({ nodes: [fs], edges: [] });
    const actions = graph.getAvailableActions("fs");
    assert.ok(actions.some(a => a.id === "read"));
  });

  it("loot available on owned read fileserver", () => {
    const fs = createFileserver("fs", {
      attributes: { visibility: "accessible", accessLevel: "owned", read: true },
    });
    const graph = new NodeGraph({ nodes: [fs], edges: [] });
    const actions = graph.getAvailableActions("fs");
    assert.ok(actions.some(a => a.id === "loot"));
  });

  it("loot not available when already looted", () => {
    const fs = createFileserver("fs", {
      attributes: { visibility: "accessible", accessLevel: "owned", read: true, looted: true },
    });
    const graph = new NodeGraph({ nodes: [fs], edges: [] });
    const actions = graph.getAvailableActions("fs");
    assert.ok(!actions.some(a => a.id === "loot"));
  });

  it("reconfigure available on compromised IDS with forwarding enabled", () => {
    const ids = createIDS("ids-1", {
      attributes: { visibility: "accessible", accessLevel: "compromised" },
    });
    const graph = new NodeGraph({ nodes: [ids], edges: [] });
    const actions = graph.getAvailableActions("ids-1");
    assert.ok(actions.some(a => a.id === "reconfigure"));
  });

  it("reconfigure not available when forwarding already disabled", () => {
    const ids = createIDS("ids-1", {
      attributes: { visibility: "accessible", accessLevel: "owned", forwardingEnabled: false },
    });
    const graph = new NodeGraph({ nodes: [ids], edges: [] });
    const actions = graph.getAvailableActions("ids-1");
    assert.ok(!actions.some(a => a.id === "reconfigure"));
  });

  it("cancel-trace available on owned security-monitor", () => {
    const mon = createSecurityMonitor("mon-1", {
      attributes: { visibility: "accessible", accessLevel: "owned" },
    });
    const graph = new NodeGraph({ nodes: [mon], edges: [] });
    const actions = graph.getAvailableActions("mon-1");
    assert.ok(actions.some(a => a.id === "cancel-trace"));
  });

  it("access-darknet available on wan", () => {
    const wan = createWAN("wan-1");
    const graph = new NodeGraph({ nodes: [wan], edges: [] });
    const actions = graph.getAvailableActions("wan-1");
    assert.ok(actions.some(a => a.id === "access-darknet"));
    // WAN should NOT have probe/exploit
    assert.ok(!actions.some(a => a.id === "probe"));
  });

  it("reboot available on owned node", () => {
    const gw = createGateway("gw", {
      attributes: { visibility: "accessible", accessLevel: "owned" },
    });
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(actions.some(a => a.id === "reboot"));
  });

  it("cancel-probe available when probing flag set", () => {
    const gw = createGateway("gw", {
      attributes: { visibility: "accessible", probing: true },
    });
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(actions.some(a => a.id === "cancel-probe"));
  });
});

// ── Action execution ─────────────────────────────────────────

describe("action execution", () => {
  it("probe action calls ctx.startProbe with nodeId", () => {
    const ctx = mockCtx();
    const gw = createGateway("gw", { attributes: { visibility: "accessible" } });
    const graph = new NodeGraph({ nodes: [gw], edges: [] }, ctx);
    graph.executeAction("gw", "probe");
    assert.equal(ctx.calls.startProbe?.length, 1);
    assert.deepEqual(ctx.calls.startProbe[0], ["gw"]);
  });

  it("reconfigure action sets forwardingEnabled false and calls ctx", () => {
    const ctx = mockCtx();
    const ids = createIDS("ids-1", {
      attributes: { visibility: "accessible", accessLevel: "owned" },
    });
    const graph = new NodeGraph({ nodes: [ids], edges: [] }, ctx);
    graph.executeAction("ids-1", "reconfigure");
    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, false);
    assert.equal(ctx.calls.reconfigureNode?.length, 1);
    assert.deepEqual(ctx.calls.reconfigureNode[0], ["ids-1"]);
  });

  it("cancel-trace action calls ctx.cancelTrace", () => {
    const ctx = mockCtx();
    const mon = createSecurityMonitor("mon-1", {
      attributes: { visibility: "accessible", accessLevel: "owned" },
    });
    const graph = new NodeGraph({ nodes: [mon], edges: [] }, ctx);
    graph.executeAction("mon-1", "cancel-trace");
    assert.equal(ctx.calls.cancelTrace?.length, 1);
  });

  it("access-darknet action calls ctx.openDarknetsStore", () => {
    const ctx = mockCtx();
    const wan = createWAN("wan-1");
    const graph = new NodeGraph({ nodes: [wan], edges: [] }, ctx);
    graph.executeAction("wan-1", "access-darknet");
    assert.equal(ctx.calls.openDarknetsStore?.length, 1);
  });
});

// ── Action templates ─────────────────────────────────────────

describe("action templates", () => {
  it("all templates have id, label, requires, and effects", () => {
    for (const [name, template] of Object.entries(ACTION_TEMPLATES)) {
      assert.ok(template.id, `${name} missing id`);
      assert.ok(template.label, `${name} missing label`);
      assert.ok(Array.isArray(template.requires), `${name} requires not an array`);
      assert.ok(Array.isArray(template.effects), `${name} effects not an array`);
    }
  });

  it("all templates have desc field", () => {
    for (const [name, template] of Object.entries(ACTION_TEMPLATES)) {
      assert.ok(template.desc, `${name} missing desc`);
    }
  });
});

// ── Lootable type distinction ────────────────────────────────

describe("lootable types", () => {
  it("fileserver and cryptovault have read/loot actions", () => {
    for (const factory of [createFileserver, createCryptovault]) {
      const def = factory("test");
      const actionIds = def.actions.map(a => a.id);
      assert.ok(actionIds.includes("read"), `${def.type} missing read`);
      assert.ok(actionIds.includes("loot"), `${def.type} missing loot`);
      assert.ok(actionIds.includes("cancel-read"), `${def.type} missing cancel-read`);
      assert.ok(actionIds.includes("cancel-loot"), `${def.type} missing cancel-loot`);
    }
  });

  it("non-lootable types do not have read/loot actions", () => {
    for (const factory of [createGateway, createRouter, createFirewall]) {
      const def = factory("test");
      const actionIds = def.actions.map(a => a.id);
      assert.ok(!actionIds.includes("read"), `${def.type} should not have read`);
      assert.ok(!actionIds.includes("loot"), `${def.type} should not have loot`);
    }
  });
});
