import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { instantiate, SET_PIECES, combinationLock, deadmanCircuit, idsRelayChain, honeyPot, encryptedVault, cascadeShutdown, tripwireGauntlet, probeBurstAlarm, noisySensor, tamperDetect } from "./set-pieces.js";
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

  it("activating one instance does not trigger the other", () => {
    const ctx = mockCtx();
    const inst1 = instantiate(combinationLock, "v1");
    const inst2 = instantiate(combinationLock, "v2");
    const graph = new NodeGraph({
      nodes: [...inst1.nodes, ...inst2.nodes],
      edges: [...inst1.edges, ...inst2.edges],
      triggers: [...inst1.triggers, ...inst2.triggers],
    }, ctx);

    for (const sw of ["v1/switch-a", "v1/switch-b", "v1/switch-c"]) {
      graph._nodes.get(sw).attributes.accessLevel = "owned";
    }
    graph.executeAction("v1/switch-a", "activate");
    graph.executeAction("v1/switch-b", "activate");
    graph.executeAction("v1/switch-c", "activate");

    assert.equal(graph.getNodeState("v1/vault").visible, true);
    assert.equal(graph.getNodeState("v2/vault").visible, false);
    assert.equal(ctx.calls.giveReward?.length, 1);
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
    assert.equal(graph.getQuality("mk1/auth-tokens"), 2);

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

describe("honey-pot: exploit attempt fires counter-trace", () => {
  it("no trace before any exploit message", () => {
    const ctx = mockCtx();
    const inst = instantiate(honeyPot, "hp1");
    const graph = new NodeGraph(inst, ctx);

    assert.equal(graph.getNodeState("hp1/honey-pot").poisoned, false);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("exploit message on honey-pot fires startTrace immediately", () => {
    const ctx = mockCtx();
    const inst = instantiate(honeyPot, "hp1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("hp1/honey-pot", createMessage({ type: "exploit", origin: "player", payload: {} }));
    assert.equal(graph.getNodeState("hp1/honey-pot").poisoned, true);
    assert.equal(ctx.calls.startTrace?.length, 1);
  });

  it("non-exploit messages don't trigger the trap", () => {
    const ctx = mockCtx();
    const inst = instantiate(honeyPot, "hp1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("hp1/honey-pot", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(graph.getNodeState("hp1/honey-pot").poisoned, false);
    assert.equal(ctx.calls.startTrace, undefined);
  });
});

describe("encrypted-vault: key expiry forces timing pressure", () => {
  it("extract-key unavailable before clock fires", () => {
    const ctx = mockCtx();
    const inst = instantiate(encryptedVault, "ev1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("ev1/key-gen").attributes.accessLevel = "owned";
    const actions = graph.getAvailableActions("ev1/key-gen").map((a) => a.id);
    assert.ok(!actions.includes("extract-key"), "key not ready before clock fires");
  });

  it("clock fires → key becomes ready → extract-key available", () => {
    const ctx = mockCtx();
    const inst = instantiate(encryptedVault, "ev1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("ev1/key-gen").attributes.accessLevel = "owned";
    graph.tick(5); // clock period is 5
    const actions = graph.getAvailableActions("ev1/key-gen").map((a) => a.id);
    assert.ok(actions.includes("extract-key"), "key ready after clock fires");
  });

  it("loot unavailable without extracted key; available after extraction", () => {
    const ctx = mockCtx();
    const inst = instantiate(encryptedVault, "ev1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("ev1/key-gen").attributes.accessLevel = "owned";
    graph._nodes.get("ev1/vault").attributes.accessLevel = "owned";

    // Before clock: no key → loot unavailable
    assert.ok(!graph.getAvailableActions("ev1/vault").map((a) => a.id).includes("loot"));

    // Fire clock, extract key, then loot
    graph.tick(5);
    graph.executeAction("ev1/key-gen", "extract-key");
    assert.equal(graph.getQuality("ev1/decryption-key"), 1);

    const available = graph.getAvailableActions("ev1/vault").map((a) => a.id);
    assert.ok(available.includes("loot"));

    graph.executeAction("ev1/vault", "loot");
    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [3000]);
    assert.equal(graph.getQuality("ev1/decryption-key"), 0);
  });
});

describe("cascade-shutdown: subvert all relays before watchdog expires", () => {
  it("reward not given if fewer than 3 relays subverted", () => {
    const ctx = mockCtx();
    const inst = instantiate(cascadeShutdown, "cs1");
    const graph = new NodeGraph(inst, ctx);

    for (const r of ["cs1/relay-a", "cs1/relay-b"]) {
      graph._nodes.get(r).attributes.accessLevel = "owned";
    }
    graph.executeAction("cs1/relay-a", "subvert");
    graph.executeAction("cs1/relay-b", "subvert");

    assert.equal(ctx.calls.giveReward, undefined);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("subverting all 3 before watchdog fires gives reward, no trace", () => {
    const ctx = mockCtx();
    const inst = instantiate(cascadeShutdown, "cs1");
    const graph = new NodeGraph(inst, ctx);

    for (const r of ["cs1/relay-a", "cs1/relay-b", "cs1/relay-c"]) {
      graph._nodes.get(r).attributes.accessLevel = "owned";
    }
    // Subvert all 3 without advancing time
    graph.executeAction("cs1/relay-a", "subvert");
    graph.executeAction("cs1/relay-b", "subvert");
    graph.executeAction("cs1/relay-c", "subvert");

    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [2000]);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("watchdog fires trace if not all relays subverted in time", () => {
    const ctx = mockCtx();
    const inst = instantiate(cascadeShutdown, "cs1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("cs1/relay-a").attributes.accessLevel = "owned";
    // Subvert only relay-a, then let watchdog expire (period: 4)
    // Subverting relay-a sends subvert-ping → relay-a relays it... but
    // relay-a's relay atom is now forwardingEnabled:false. Actually the
    // relay forwards BEFORE forwardingEnabled is set (action effects run after).
    // The subvert-ping from the action's emit-message propagates to watchdog,
    // resetting the timer. So we need 4 more ticks after the last message.
    graph.executeAction("cs1/relay-a", "subvert");
    graph.tick(4); // watchdog period elapses without further messages

    assert.equal(ctx.calls.startTrace?.length, 1);
  });
});

describe("tripwire-gauntlet: 6-tick delay from probe to alarm", () => {
  it("sensor flags triggered immediately on probe-noise", () => {
    const ctx = mockCtx();
    const inst = instantiate(tripwireGauntlet, "tg1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("tg1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(graph.getNodeState("tg1/sensor").triggered, true);
    assert.equal(graph.getNodeState("tg1/alarm").triggered, false);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("alarm does not fire before 6 ticks", () => {
    const ctx = mockCtx();
    const inst = instantiate(tripwireGauntlet, "tg1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("tg1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    graph.tick(5); // one tick short of the full 6-tick chain
    assert.equal(graph.getNodeState("tg1/alarm").triggered, false);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("alarm fires and trace starts on tick 6", () => {
    const ctx = mockCtx();
    const inst = instantiate(tripwireGauntlet, "tg1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("tg1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    graph.tick(6);
    assert.equal(graph.getNodeState("tg1/alarm").triggered, true);
    assert.equal(ctx.calls.startTrace?.length, 1);
  });
});

// ---------------------------------------------------------------------------
// probe-burst-alarm: tally atom + repeating trigger
// ---------------------------------------------------------------------------
describe("probe-burst-alarm: spawns ICE every 3rd probe via tally + repeating trigger", () => {
  it("does not spawn ICE before 3 probes", () => {
    const ctx = mockCtx();
    const inst = instantiate(probeBurstAlarm, "pb1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("pb1/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    graph.sendMessage("pb1/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(ctx.calls.spawnICE, undefined);
    assert.equal(graph.getQuality("pb1/probe-bursts"), 2);
  });

  it("spawns ICE and resets counter at probe 3", () => {
    const ctx = mockCtx();
    const inst = instantiate(probeBurstAlarm, "pb1");
    const graph = new NodeGraph(inst, ctx);

    for (let i = 0; i < 3; i++) {
      graph.sendMessage("pb1/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    }
    assert.equal(ctx.calls.spawnICE?.length, 1);
    assert.equal(graph.getQuality("pb1/probe-bursts"), 0); // reset by trigger effects
  });

  it("spawns ICE again after another burst of 3 probes (repeating)", () => {
    const ctx = mockCtx();
    const inst = instantiate(probeBurstAlarm, "pb1");
    const graph = new NodeGraph(inst, ctx);

    for (let i = 0; i < 6; i++) {
      graph.sendMessage("pb1/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    }
    assert.equal(ctx.calls.spawnICE?.length, 2);
  });

  it("instantiate prefixes quality name for isolation", () => {
    const ctx = mockCtx();
    const inst1 = instantiate(probeBurstAlarm, "a");
    const inst2 = instantiate(probeBurstAlarm, "b");
    const graph = new NodeGraph({
      nodes: [...inst1.nodes, ...inst2.nodes],
      edges: [...inst1.edges, ...inst2.edges],
      triggers: [...inst1.triggers, ...inst2.triggers],
    }, ctx);

    // Send 3 probes to instance a only
    for (let i = 0; i < 3; i++) {
      graph.sendMessage("a/scanner", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    }
    // Only a's ICE spawned, b's counter is still 0
    assert.equal(graph.getQuality("a/probe-bursts"), 0); // reset after trigger
    assert.equal(graph.getQuality("b/probe-bursts"), 0); // untouched
    assert.equal(ctx.calls.spawnICE?.length, 1);
  });
});

// ---------------------------------------------------------------------------
// noisy-sensor: debounce atom
// ---------------------------------------------------------------------------
describe("noisy-sensor: first probe per window raises alert, subsequent suppressed", () => {
  it("raises alert on first probe-noise", () => {
    const ctx = mockCtx();
    const inst = instantiate(noisySensor, "ns1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(graph.getNodeState("ns1/alarm-flag").triggered, true);
    assert.equal(ctx.calls.setGlobalAlert?.length, 1);
  });

  it("suppresses second probe during cooldown", () => {
    const ctx = mockCtx();
    const inst = instantiate(noisySensor, "ns1");
    const graph = new NodeGraph(inst, ctx);

    // First probe triggers alarm-flag
    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    // Manually reset flag to test suppression behavior
    graph._nodes.get("ns1/alarm-flag").attributes.triggered = false;

    // Second probe within cooldown — sensor suppresses it
    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(graph.getNodeState("ns1/alarm-flag").triggered, false);
  });

  it("forwards probe again after cooldown expires (4 ticks)", () => {
    const ctx = mockCtx();
    const inst = instantiate(noisySensor, "ns1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    graph._nodes.get("ns1/alarm-flag").attributes.triggered = false;

    graph.tick(4); // expire the 4-tick cooldown
    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(graph.getNodeState("ns1/alarm-flag").triggered, true);
  });
});

// ---------------------------------------------------------------------------
// tamper-detect: sequencing puzzle — neutralize relay before reconfiguring IDS
// ---------------------------------------------------------------------------
describe("tamper-detect: reconfiguring IDS without neutralizing relay triggers trace", () => {
  it("reconfiguring IDS without neutralizing triggers tamper trace", () => {
    const ctx = mockCtx();
    const inst = instantiate(tamperDetect, "td1");
    const graph = new NodeGraph(inst, ctx);

    // Give player ownership so reconfigure is available
    graph._nodes.get("td1/ids").attributes.accessLevel = "owned";
    graph.executeAction("td1/ids", "reconfigure");

    assert.equal(graph.getNodeState("td1/tamper-flag").triggered, true);
    assert.equal(ctx.calls.startTrace?.length, 1);
  });

  it("all connections are visible in graph edges (no hidden channels)", () => {
    const inst = instantiate(tamperDetect, "td1");
    // All node-to-node relationships must appear as edges
    const edgePairs = inst.edges.map(([a, b]) => `${a}->${b}`);
    assert.ok(edgePairs.some((e) => e.includes("td1/ids") && e.includes("td1/security-monitor")));
    assert.ok(edgePairs.some((e) => e.includes("td1/ids") && e.includes("td1/tamper-relay")));
    assert.ok(edgePairs.some((e) => e.includes("td1/tamper-relay") && e.includes("td1/tamper-flag")));
  });

  it("neutralizing tamper relay before reconfigure prevents trace", () => {
    const ctx = mockCtx();
    const inst = instantiate(tamperDetect, "td1");
    const graph = new NodeGraph(inst, ctx);

    // Own and neutralize the tamper relay first
    graph._nodes.get("td1/tamper-relay").attributes.accessLevel = "owned";
    graph.executeAction("td1/tamper-relay", "neutralize");
    assert.equal(graph.getNodeState("td1/tamper-relay").forwardingEnabled, false);

    // Now reconfigure the IDS safely
    graph._nodes.get("td1/ids").attributes.accessLevel = "owned";
    graph.executeAction("td1/ids", "reconfigure");

    assert.equal(graph.getNodeState("td1/tamper-flag").triggered, false);
    assert.equal(ctx.calls.startTrace, undefined);
    assert.equal(graph.getNodeState("td1/ids").forwardingEnabled, false); // IDS silenced
  });

  it("normal alert still propagates to security-monitor while IDS is active", () => {
    const ctx = mockCtx();
    const inst = instantiate(tamperDetect, "td1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("td1/ids", createMessage({ type: "alert", origin: "probe-node", payload: {} }));
    assert.equal(graph.getNodeState("td1/security-monitor").alerted, true);
    assert.equal(ctx.calls.setGlobalAlert?.length, 1);
  });
});
