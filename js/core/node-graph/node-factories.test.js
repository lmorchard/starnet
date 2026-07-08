import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeGraph } from "./runtime.js";
import { mockCtx } from "./ctx.js";
import { resolveTraits } from "./traits.js";
import {
  createGateway, createRouter, createIDS, createSecurityMonitor,
  createFileserver, createCryptovault, createFirewall, createWAN,
} from "./node-factories.js";

// Helper: resolve factory output to get full attributes/operators/actions
function resolve(def) { return resolveTraits(def); }

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
      const raw = factory(`test-${name}`);
      assert.equal(raw.id, `test-${name}`);
      assert.equal(raw.type, name);
      assert.ok(raw.attributes);
      // Factories with traits: resolve to check full shape
      const def = resolve(raw);
      assert.ok(Array.isArray(def.operators));
      assert.ok(Array.isArray(def.actions));
      // All hackable nodes have these base attributes after resolution
      if (raw.traits && raw.traits.includes("hackable")) {
        assert.equal(typeof def.attributes.visibility, "string");
        assert.equal(typeof def.attributes.accessLevel, "string");
        assert.equal(typeof def.attributes.probed, "boolean");
      }
    });
  }
});

// ── Traits assignment ────────────────────────────────────────

describe("traits assignment", () => {
  it("each factory assigns expected traits", () => {
    const expected = {
      gateway: ["graded", "hackable", "rebootable", "gate"],
      router: ["graded", "hackable", "rebootable", "relay", "gate"],
      ids: ["graded", "hackable", "rebootable", "detectable", "gate"],
      "security-monitor": ["graded", "hackable", "rebootable", "security", "gate"],
      fileserver: ["graded", "hackable", "rebootable", "lootable", "gate"],
      cryptovault: ["graded", "hackable", "rebootable", "lootable", "gate"],
      firewall: ["graded", "hackable", "rebootable", "gate"],
    };
    const factories = { gateway: createGateway, router: createRouter, ids: createIDS,
      "security-monitor": createSecurityMonitor, fileserver: createFileserver,
      cryptovault: createCryptovault, firewall: createFirewall };
    for (const [type, factory] of Object.entries(factories)) {
      const def = factory(`test-${type}`);
      assert.deepStrictEqual(def.traits, expected[type], `${type} traits mismatch`);
    }
  });

  it("WAN uses the darknet trait", () => {
    const wan = createWAN("wan-1");
    assert.deepStrictEqual(wan.traits, ["darknet"]);
  });


});

// ── Default attributes ───────────────────────────────────────

describe("default attributes", () => {
  it("gateway defaults to hidden/locked", () => {
    const gw = resolve(createGateway("gw"));
    assert.equal(gw.attributes.visibility, "hidden");
    assert.equal(gw.attributes.accessLevel, "locked");
    assert.equal(gw.attributes.gateAccess, "probed");
  });

  it("config overrides default attributes", () => {
    const gw = resolve(createGateway("gw", {
      grade: "A",
      attributes: { visibility: "accessible" },
    }));
    assert.equal(gw.attributes.grade, "A");
    assert.equal(gw.attributes.visibility, "accessible");
  });

  it("ids defaults forwardingEnabled to true", () => {
    const ids = resolve(createIDS("ids-1"));
    assert.equal(ids.attributes.forwardingEnabled, true);
    assert.equal(ids.attributes.gateAccess, "owned");
  });

  it("firewall defaults to grade A with gateAccess owned", () => {
    const fw = resolve(createFirewall("fw-1"));
    assert.equal(fw.attributes.grade, "A");
    assert.equal(fw.attributes.gateAccess, "owned");
  });

  it("wan starts accessible and owned", () => {
    const wan = createWAN("wan-1");
    assert.equal(wan.attributes.visibility, "accessible");
    assert.equal(wan.attributes.accessLevel, "owned");
  });

  it("fileserver has lootCount attribute", () => {
    const fs = resolve(createFileserver("fs-1"));
    assert.deepEqual(fs.attributes.lootCount, [1, 2]);
  });

  it("cryptovault has higher default grade", () => {
    const cv = resolve(createCryptovault("cv-1"));
    assert.equal(cv.attributes.grade, "B");
    assert.deepEqual(cv.attributes.lootCount, [1, 3]);
  });
});

// ── Operators (resolved) ─────────────────────────────────────

describe("operators", () => {
  it("router has relay operator", () => {
    const r = resolve(createRouter("r-1"));
    assert.ok(r.operators.some(o => o.name === "relay" && !o.filter));
  });

  it("ids has relay(filter:alert) and flag(on:alert)", () => {
    const ids = resolve(createIDS("ids-1"));
    assert.ok(ids.operators.some(o => o.name === "relay" && o.filter === "alert"));
    assert.ok(ids.operators.some(o => o.name === "flag" && o.on === "alert"));
  });

  it("security-monitor has flag(on:alert)", () => {
    const mon = resolve(createSecurityMonitor("mon-1"));
    assert.ok(mon.operators.some(o => o.name === "flag" && o.on === "alert"));
  });

  it("gateway and firewall have timed-action operators from hackable", () => {
    for (const factory of [createGateway, createFirewall]) {
      const def = resolve(factory("test"));
      // hackable trait provides timed-action operators for probe (+ mine for some types).
      // Phase 3 (E1): xploit is now a progressive process (autoburn), not a timed action —
      // the xploit timed-action operator was removed from hackable in this phase.
      assert.ok(def.operators.some(o => o.name === "timed-action" && o.action === "probe"),
        "probe timed-action present");
      assert.ok(!def.operators.some(o => o.name === "timed-action" && o.action === "xploit"),
        "xploit timed-action removed (now autoburn process)");
    }
  });

  it("wan has the lie-low timed-action operator (#174) and the darknet + lie-low actions", () => {
    // Supplied by the darknet trait, so resolve before inspecting operators/actions/attrs.
    const def = resolve(createWAN("test"));
    assert.ok(def.operators.some(o => o.name === "timed-action" && o.action === "lie-low"),
      "WAN carries the lie-low timed-action");
    assert.ok(def.actions.some(a => a.id === "access-darknet"));
    assert.ok(def.actions.some(a => a.id === "lie-low"));
    assert.equal(def.attributes.lieLowUsesRemaining, 2);
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
    assert.ok(actions.some(a => a.id === "xploit"));
  });

  it("exploit not available on owned node", () => {
    const gw = createGateway("gw", { attributes: { visibility: "accessible", accessLevel: "owned" } });
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(!actions.some(a => a.id === "xploit"));
  });

  it("exploit still available on open node", () => {
    const gw = createGateway("gw", { attributes: { visibility: "accessible", accessLevel: "open" } });
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(actions.some(a => a.id === "xploit"));
  });

  it("exploit not available on hidden node", () => {
    const gw = createGateway("gw");
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(!actions.some(a => a.id === "xploit"));
  });

  it("dump available on open unread fileserver", () => {
    const fs = createFileserver("fs", {
      attributes: { visibility: "accessible", accessLevel: "open" },
    });
    const graph = new NodeGraph({ nodes: [fs], edges: [] });
    const actions = graph.getAvailableActions("fs");
    assert.ok(actions.some(a => a.id === "dump"));
  });

  it("fetch available on owned read fileserver", () => {
    const fs = createFileserver("fs", {
      attributes: { visibility: "accessible", accessLevel: "owned", read: true },
    });
    const graph = new NodeGraph({ nodes: [fs], edges: [] });
    const actions = graph.getAvailableActions("fs");
    assert.ok(actions.some(a => a.id === "fetch"));
  });

  it("fetch not available when already looted", () => {
    const fs = createFileserver("fs", {
      attributes: { visibility: "accessible", accessLevel: "owned", read: true, looted: true },
    });
    const graph = new NodeGraph({ nodes: [fs], edges: [] });
    const actions = graph.getAvailableActions("fs");
    assert.ok(!actions.some(a => a.id === "fetch"));
  });

  it("corrupt available on open IDS with forwarding enabled", () => {
    const ids = createIDS("ids-1", {
      attributes: { visibility: "accessible", accessLevel: "open" },
    });
    const graph = new NodeGraph({ nodes: [ids], edges: [] });
    const actions = graph.getAvailableActions("ids-1");
    assert.ok(actions.some(a => a.id === "corrupt"));
  });

  it("corrupt not available when forwarding already disabled", () => {
    const ids = createIDS("ids-1", {
      attributes: { visibility: "accessible", accessLevel: "owned", forwardingEnabled: false },
    });
    const graph = new NodeGraph({ nodes: [ids], edges: [] });
    const actions = graph.getAvailableActions("ids-1");
    assert.ok(!actions.some(a => a.id === "corrupt"));
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

  it("abort available when probing flag set", () => {
    const gw = createGateway("gw", {
      attributes: { visibility: "accessible", probing: true },
    });
    const graph = new NodeGraph({ nodes: [gw], edges: [] });
    const actions = graph.getAvailableActions("gw");
    assert.ok(actions.some(a => a.id === "abort"));
  });
});

// ── Action execution ─────────────────────────────────────────

describe("action execution", () => {
  it("probe action sets probing attribute to true", () => {
    const ctx = mockCtx();
    const gw = createGateway("gw", { attributes: { visibility: "accessible" } });
    const graph = new NodeGraph({ nodes: [gw], edges: [] }, ctx);
    graph.executeAction("gw", "probe");
    assert.equal(graph.getNodeState("gw").probing, true);
  });

  it("corrupt action sets forwardingEnabled false and calls ctx (timed — #187 Phase 5)", () => {
    const ctx = mockCtx();
    const ids = createIDS("ids-1", {
      attributes: { visibility: "accessible", accessLevel: "owned" },
    });
    const graph = new NodeGraph({ nodes: [ids], edges: [] }, ctx);
    graph.executeAction("ids-1", "corrupt");
    // Dispatch only arms it — forwardingEnabled/reconfigureNode resolve on completion.
    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, true);
    assert.equal(ctx.calls.reconfigureNode, undefined);

    graph.tick(16); // grade C: 1 tick to resolve duration from the table + 15 progress ticks
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
    // executeAction fires the action's ctx-call effect exactly once. There is no
    // owned-cancel-trace trigger — cancelling a trace is explicit, player-driven only.
    graph.executeAction("mon-1", "cancel-trace");
    assert.equal(ctx.calls.cancelTrace?.length, 1, "cancelTrace should be called exactly once");
  });

  it("access-darknet action calls ctx.openDarknetsStore", () => {
    const ctx = mockCtx();
    const wan = createWAN("wan-1");
    const graph = new NodeGraph({ nodes: [wan], edges: [] }, ctx);
    graph.executeAction("wan-1", "access-darknet");
    assert.equal(ctx.calls.openDarknetsStore?.length, 1);
  });
});

// ── Lootable type distinction ────────────────────────────────

describe("lootable types", () => {
  it("fileserver and cryptovault have dump/fetch actions (resolved)", () => {
    for (const factory of [createFileserver, createCryptovault]) {
      const def = resolve(factory("test"));
      const actionIds = def.actions.map(a => a.id);
      assert.ok(actionIds.includes("dump"), `${def.type} missing dump`);
      assert.ok(actionIds.includes("fetch"), `${def.type} missing fetch`);
      assert.ok(actionIds.includes("abort"), `${def.type} missing abort`);
    }
  });

  it("non-lootable types do not have dump/fetch actions (resolved)", () => {
    for (const factory of [createGateway, createRouter, createFirewall]) {
      const def = resolve(factory("test"));
      const actionIds = def.actions.map(a => a.id);
      assert.ok(!actionIds.includes("dump"), `${def.type} should not have dump`);
      assert.ok(!actionIds.includes("fetch"), `${def.type} should not have fetch`);
    }
  });
});
