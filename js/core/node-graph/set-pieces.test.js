import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { instantiate, SET_PIECES, combinationLock, deadmanCircuit, idsRelayChain } from "./set-pieces.js";
import { NodeGraph } from "./runtime.js";
import { mockCtx } from "./ctx.js";
import { createMessage } from "./message.js";

// ---------------------------------------------------------------------------
// instantiate() — structural correctness
// ---------------------------------------------------------------------------

describe("instantiate: node IDs are prefixed", () => {
  it("prefixes all node IDs with the given prefix", () => {
    const inst = instantiate(idsRelayChain, "east");
    const ids = inst.nodes.map((n) => n.id);
    assert.ok(ids.includes("east/ids"));
    assert.ok(ids.includes("east/monitor"));
    assert.ok(!ids.includes("ids"));
    assert.ok(!ids.includes("monitor"));
  });
});

describe("instantiate: edges are prefixed", () => {
  it("rewrites both ends of every internal edge", () => {
    const inst = instantiate(idsRelayChain, "east");
    assert.deepEqual(inst.edges[0], ["east/ids", "east/monitor"]);
  });
});

describe("instantiate: trigger IDs and nodeIds are prefixed", () => {
  it("prefixes trigger IDs", () => {
    const inst = instantiate(idsRelayChain, "east");
    assert.ok(inst.triggers.some((t) => t.id === "east/alert-reached-monitor"));
  });

  it("rewrites node-attr condition nodeId", () => {
    const inst = instantiate(deadmanCircuit, "dm1");
    const firedTrigger = inst.triggers.find((t) => t.id === "dm1/deadman-fired");
    assert.ok(firedTrigger);
    const when = /** @type {import('./types.js').NodeAttrCondition} */ (firedTrigger.when);
    assert.equal(when.nodeId, "dm1/alarm-latch");
  });

  it("rewrites set-node-attr effect nodeId", () => {
    const inst = instantiate(combinationLock, "v1");
    const revealTrigger = inst.triggers.find((t) => t.id === "v1/vault-reveal");
    const setAttrEffect = /** @type {import('./types.js').SetNodeAttrEffect} */ (revealTrigger?.then[0]);
    assert.equal(setAttrEffect.nodeId, "v1/vault");
  });
});

describe("instantiate: all-of atom inputs are prefixed", () => {
  it("rewrites inputs in all-of atom configs", () => {
    const inst = instantiate(combinationLock, "v1");
    const gate = inst.nodes.find((n) => n.id === "v1/gate");
    const allOfAtom = gate?.atoms?.[0];
    assert.deepEqual(allOfAtom?.inputs, ["v1/switch-a", "v1/switch-b", "v1/switch-c"]);
  });
});

describe("instantiate: external ports are prefixed", () => {
  it("returns prefixed external port IDs", () => {
    const inst = instantiate(idsRelayChain, "east");
    assert.deepEqual(inst.externalPorts, ["east/ids", "east/monitor"]);
  });
});

describe("instantiate: two instances have independent IDs", () => {
  it("inst1 and inst2 have no overlapping node IDs", () => {
    const inst1 = instantiate(combinationLock, "v1");
    const inst2 = instantiate(combinationLock, "v2");
    const ids1 = new Set(inst1.nodes.map((n) => n.id));
    const ids2 = new Set(inst2.nodes.map((n) => n.id));
    for (const id of ids2) {
      assert.ok(!ids1.has(id), `Collision: ${id}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Behavioral tests: instantiated set-pieces run correctly in NodeGraph
// ---------------------------------------------------------------------------

describe("ids-relay-chain: alert forwarding and subversion", () => {
  it("alert propagates through IDS to monitor when forwardingEnabled:true", () => {
    const ctx = mockCtx();
    const inst = instantiate(idsRelayChain, "east");
    const graph = new NodeGraph(inst, ctx);

    // Send an alert into IDS — relay forwards it to monitor — monitor flags alerted:true
    graph.sendMessage("east/ids", createMessage({ type: "alert", origin: "probe-node", payload: {} }));
    assert.equal(ctx.calls.setGlobalAlert?.length, 1);
    assert.deepEqual(ctx.calls.setGlobalAlert[0], ["yellow"]);
  });

  it("reconfigure action requires owned", () => {
    const ctx = mockCtx();
    const inst = instantiate(idsRelayChain, "east");
    const graph = new NodeGraph(inst, ctx);

    // Not owned — action unavailable
    const available = graph.getAvailableActions("east/ids");
    assert.ok(!available.map((a) => a.id).includes("reconfigure"));
  });

  it("reconfigure action available when owned; sets forwardingEnabled:false", () => {
    const ctx = mockCtx();
    const inst = instantiate(idsRelayChain, "east");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("east/ids").attributes.accessLevel = "owned";
    const available = graph.getAvailableActions("east/ids");
    assert.ok(available.map((a) => a.id).includes("reconfigure"));

    graph.executeAction("east/ids", "reconfigure");
    assert.equal(graph.getNodeState("east/ids").forwardingEnabled, false);
  });
});

describe("combination-lock: all three switches must activate", () => {
  it("vault-reveal trigger does not fire until all 3 switches are activated", () => {
    const ctx = mockCtx();
    const inst = instantiate(combinationLock, "v1");
    const graph = new NodeGraph(inst, ctx);

    // Own the switches
    for (const sw of ["v1/switch-a", "v1/switch-b"]) {
      graph._nodes.get(sw).attributes.accessLevel = "owned";
    }

    graph.executeAction("v1/switch-a", "activate");
    graph.executeAction("v1/switch-b", "activate");
    assert.equal(ctx.calls.giveReward, undefined);
    assert.equal(graph.getNodeState("v1/vault").visible, false);
  });

  it("vault-reveal fires and giveReward called when all 3 activated", () => {
    const ctx = mockCtx();
    const inst = instantiate(combinationLock, "v1");
    const graph = new NodeGraph(inst, ctx);

    for (const sw of ["v1/switch-a", "v1/switch-b", "v1/switch-c"]) {
      graph._nodes.get(sw).attributes.accessLevel = "owned";
    }
    graph.executeAction("v1/switch-a", "activate");
    graph.executeAction("v1/switch-b", "activate");
    graph.executeAction("v1/switch-c", "activate");

    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [1500]);
    assert.equal(graph.getNodeState("v1/vault").visible, true);
  });
});

describe("deadman-circuit: heartbeat suppresses alarm, blocking fires it", () => {
  it("heartbeat keeps alarm disarmed", () => {
    const ctx = mockCtx();
    const inst = instantiate(deadmanCircuit, "dm1");
    const graph = new NodeGraph(inst, ctx);

    // Send heartbeat before each tick — watchdog timer resets each period,
    // never reaches period (5), alarm-latch stays unlatched
    for (let i = 0; i < 6; i++) {
      graph.sendMessage("dm1/heartbeat-relay",
        createMessage({ type: "heartbeat", origin: "system", payload: {} }));
      graph.tick(1);
    }
    assert.equal(graph.getNodeState("dm1/alarm-latch").latched, false);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("blocking heartbeat relay causes trace after watchdog period elapses", () => {
    const ctx = mockCtx();
    const inst = instantiate(deadmanCircuit, "dm1");
    const graph = new NodeGraph(inst, ctx);

    // Block the relay — no heartbeat gets through to watchdog
    graph._nodes.get("dm1/heartbeat-relay").attributes.forwardingEnabled = false;

    // Tick watchdog period (5) — watchdog fires "set" → latch arms → trace triggers
    graph.tick(5);
    assert.equal(graph.getNodeState("dm1/alarm-latch").latched, true);
    assert.equal(ctx.calls.startTrace?.length, 1);
  });
});

describe("switch-arrangement: quality-delta reveals hidden subnet", () => {
  it("aligning all three panels reveals hidden-subnet", () => {
    const ctx = mockCtx();
    const inst = instantiate(SET_PIECES.switchArrangement, "seg1");
    const graph = new NodeGraph(inst, ctx);

    for (const p of ["seg1/panel-alpha", "seg1/panel-beta", "seg1/panel-gamma"]) {
      graph._nodes.get(p).attributes.accessLevel = "owned";
    }

    graph.executeAction("seg1/panel-alpha", "align");
    graph.executeAction("seg1/panel-beta", "align");
    assert.equal(graph.getNodeState("seg1/hidden-subnet").visible, false);

    graph.executeAction("seg1/panel-gamma", "align");
    assert.equal(graph.getNodeState("seg1/hidden-subnet").visible, true);
    assert.ok(ctx.calls.revealNode?.length > 0);
  });

  it("align action is idempotent — can't align twice", () => {
    const ctx = mockCtx();
    const inst = instantiate(SET_PIECES.switchArrangement, "seg1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("seg1/panel-alpha").attributes.accessLevel = "owned";
    graph.executeAction("seg1/panel-alpha", "align");

    // Second align should fail — requires aligned:false but it's now true
    assert.throws(() => graph.executeAction("seg1/panel-alpha", "align"));
  });
});

describe("multi-key-vault: requires two tokens before looting", () => {
  it("loot action unavailable with fewer than 2 tokens", () => {
    const ctx = mockCtx();
    const inst = instantiate(SET_PIECES.multiKeyVault, "mk1");
    const graph = new NodeGraph(inst, ctx);

    // vault starts owned in this set-piece
    assert.equal(graph.getAvailableActions("mk1/vault-node").map((a) => a.id).includes("loot"), false);
  });

  it("loot action available after both tokens extracted; reward dispensed", () => {
    const ctx = mockCtx();
    const inst = instantiate(SET_PIECES.multiKeyVault, "mk1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("mk1/key-server-1").attributes.accessLevel = "owned";
    graph._nodes.get("mk1/key-server-2").attributes.accessLevel = "owned";

    graph.executeAction("mk1/key-server-1", "extract-token");
    graph.executeAction("mk1/key-server-2", "extract-token");
    assert.equal(graph.getQuality("auth-tokens"), 2);

    const available = graph.getAvailableActions("mk1/vault-node").map((a) => a.id);
    assert.ok(available.includes("loot"));

    graph.executeAction("mk1/vault-node", "loot");
    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [5000]);
  });
});

describe("nth-alarm: trace fires after N probe-noise messages", () => {
  it("startTrace not called after N-1 messages", () => {
    const ctx = mockCtx();
    const inst = instantiate(SET_PIECES.nthAlarm, "t1");
    const graph = new NodeGraph(inst, ctx);

    // n=3; send 2 — counter hasn't reached threshold, alarm-latch stays unlatched
    for (let i = 0; i < 2; i++) {
      graph.sendMessage("t1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    }
    assert.equal(graph.getNodeState("t1/alarm-latch").latched, false);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("startTrace called on Nth message", () => {
    const ctx = mockCtx();
    const inst = instantiate(SET_PIECES.nthAlarm, "t1");
    const graph = new NodeGraph(inst, ctx);

    // n=3; on 3rd message counter emits "set" → alarm-latch.latched=true → trigger fires
    for (let i = 0; i < 3; i++) {
      graph.sendMessage("t1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    }
    assert.equal(graph.getNodeState("t1/alarm-latch").latched, true);
    assert.equal(ctx.calls.startTrace?.length, 1);
  });
});
