import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { instantiate } from "./set-pieces.js";
import { SET_PIECES, entryPoint, combinationLock, deadmanCircuit, idsRelayChain, honeyPot, encryptedVault, cascadeShutdown, tripwireGauntlet, probeBurstAlarm, noisySensor, tamperDetect, scatteredLock1, scatteredLock3, scatteredLock5, scatteredKeyVault2, scatteredKeyVault3, scatteredEncryptedVault2, scatteredEncryptedVault3 } from "../../../data/biomes/corporate-pieces.js";
import { NodeGraph } from "../node-graph/runtime.js";
import { mockCtx } from "../node-graph/ctx.js";
import { createMessage } from "../node-graph/message.js";
import { isScriptAction } from "../actions/scripts.js";

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
    // combinationLock still has graph-level triggers (vault-reveal)
    const inst = instantiate(combinationLock, "v1");
    assert.ok(inst.triggers.some((t) => t.id === "v1/vault-reveal"));
  });

  it("rewrites node-attr condition nodeId in graph-level triggers", () => {
    const inst = instantiate(combinationLock, "v1");
    const revealTrigger = inst.triggers.find((t) => t.id === "v1/vault-reveal");
    assert.ok(revealTrigger);
    const when = /** @type {import('./types.js').NodeAttrCondition} */ (revealTrigger.when);
    assert.equal(when.nodeId, "v1/vault");
  });

  it("rewrites set-node-attr effect nodeId", () => {
    const inst = instantiate(combinationLock, "v1");
    const revealTrigger = inst.triggers.find((t) => t.id === "v1/vault-reveal");
    const setAttrEffect = /** @type {import('./types.js').SetNodeAttrEffect} */ (revealTrigger?.then[0]);
    assert.equal(setAttrEffect.nodeId, "v1/vault");
  });

  it("per-node triggers are preserved on nodes (not in graph triggers)", () => {
    // honeyPot now has per-node triggers on the honey-pot node
    const inst = instantiate(honeyPot, "hp1");
    assert.equal(inst.triggers.length, 0, "graph-level triggers should be empty");
    const pot = inst.nodes.find(n => n.id === "hp1/honey-pot");
    assert.ok(pot?.triggers?.length >= 1, "honey-pot node should have per-node triggers");
  });
});

describe("instantiate: all-of operator inputs are prefixed", () => {
  it("rewrites inputs in all-of operator configs", () => {
    const inst = instantiate(combinationLock, "v1");
    const gate = inst.nodes.find((n) => n.id === "v1/gate");
    const allOfOperator = gate?.operators?.[0];
    assert.deepEqual(allOfOperator?.inputs, ["v1/switch-a", "v1/switch-b", "v1/switch-c"]);
  });
});

describe("instantiate: external ports are prefixed", () => {
  it("returns prefixed external port IDs", () => {
    const inst = instantiate(idsRelayChain, "east");
    assert.deepEqual(inst.externalPorts, ["east/ids", "east/monitor"]);
  });
});

describe("instantiate: log-template quality names are prefixed", () => {
  it("rewrites ${quality:name} tokens in log-template effects", () => {
    /** @type {import('./set-pieces.js').SetPieceDef} */
    const piece = {
      id: "test-log-tmpl",
      description: "test",
      nodes: [{
        id: "node-a",
        type: "test",
        attributes: {},
        actions: [{
          id: "scan",
          label: "Scan",
          requires: [],
          effects: [
            { effect: "log-template", template: "Progress: ${quality:counter}/3 done" },
          ],
        }],
      }],
      internalEdges: [],
      externalPorts: ["node-a"],
    };
    const inst = instantiate(piece, "t1");
    const action = inst.nodes[0].actions[0];
    const tmplEffect = action.effects[0];
    assert.equal(tmplEffect.template, "Progress: ${quality:t1/counter}/3 done");
  });

  it("rewrites multiple quality refs in one template", () => {
    /** @type {import('./set-pieces.js').SetPieceDef} */
    const piece = {
      id: "test-multi-tmpl",
      description: "test",
      nodes: [{
        id: "node-a",
        type: "test",
        attributes: {},
        actions: [{
          id: "scan",
          label: "Scan",
          requires: [],
          effects: [
            { effect: "log-template", template: "A=${quality:alpha} B=${quality:beta}" },
          ],
        }],
      }],
      internalEdges: [],
      externalPorts: ["node-a"],
    };
    const inst = instantiate(piece, "p1");
    const tmplEffect = inst.nodes[0].actions[0].effects[0];
    assert.equal(tmplEffect.template, "A=${quality:p1/alpha} B=${quality:p1/beta}");
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

    assert.ok(ctx.calls.revealNode?.length > 0);
    assert.deepEqual(ctx.calls.revealNode[0], ["v1/vault"]);
    // Reward moved to vault crack-vault action, not the trigger
    assert.equal(ctx.calls.giveReward, undefined);
  });
});

// ---------------------------------------------------------------------------
// Functional tests: instantiated set-pieces run correctly in NodeGraph
// ---------------------------------------------------------------------------

describe("ids-relay-chain: alert forwarding and subversion", () => {
  it("alert propagates through IDS to monitor when forwardingEnabled:true", () => {
    const ctx = mockCtx();
    const inst = instantiate(idsRelayChain, "east");
    const nodes = inst.nodes;
    const graph = new NodeGraph({ nodes, edges: inst.edges, triggers: inst.triggers }, ctx);

    // Send an alert into IDS — relay forwards it to monitor — monitor flags alerted:true
    // and its report operator reports the alert to the global alert layer.
    graph.sendMessage("east/ids", createMessage({ type: "alert", origin: "probe-node", payload: {} }));
    assert.equal(graph.getNodeState("east/monitor").alerted, true);
    assert.equal(ctx.calls.recordMonitorAlert?.length, 1);
    assert.deepEqual(ctx.calls.recordMonitorAlert[0], ["east/monitor"]);
  });

  it("corrupt action requires owned", () => {
    const ctx = mockCtx();
    const inst = instantiate(idsRelayChain, "east");
    const graph = new NodeGraph(inst, ctx);

    // Not owned — action unavailable
    const available = graph.getAvailableActions("east/ids");
    assert.ok(!available.map((a) => a.id).includes("corrupt"));
  });

  it("corrupt action available when owned; sets forwardingEnabled:false", () => {
    const ctx = mockCtx();
    const inst = instantiate(idsRelayChain, "east");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("east/ids").attributes.accessLevel = "owned";
    const available = graph.getAvailableActions("east/ids");
    assert.ok(available.map((a) => a.id).includes("corrupt"));

    graph.executeAction("east/ids", "corrupt");
    assert.equal(graph.getNodeState("east/ids").forwardingEnabled, false);
  });

  it("corrupt severs the chain — alert no longer reaches monitor", () => {
    const ctx = mockCtx();
    const inst = instantiate(idsRelayChain, "east");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("east/ids").attributes.accessLevel = "owned";
    graph.executeAction("east/ids", "corrupt");

    graph.sendMessage("east/ids", createMessage({ type: "alert", origin: "probe-node", payload: {} }));
    assert.equal(graph.getNodeState("east/monitor").alerted, false);
    assert.equal(ctx.calls.setGlobalAlert, undefined);
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
    assert.equal(ctx.calls.revealNode, undefined);
  });

  it("vault-reveal fires when all 3 activated, clears concealed", () => {
    const ctx = mockCtx();
    const inst = instantiate(combinationLock, "v1");
    const graph = new NodeGraph(inst, ctx);

    for (const sw of ["v1/switch-a", "v1/switch-b", "v1/switch-c"]) {
      graph._nodes.get(sw).attributes.accessLevel = "owned";
    }
    graph.executeAction("v1/switch-a", "activate");
    graph.executeAction("v1/switch-b", "activate");
    graph.executeAction("v1/switch-c", "activate");

    assert.equal(graph.getNodeState("v1/vault").concealed, false);
    assert.ok(ctx.calls.revealNode?.length > 0);
    assert.deepEqual(ctx.calls.revealNode[0], ["v1/vault"]);
    // Reward comes from crack-vault action, not the trigger
    assert.equal(ctx.calls.giveReward, undefined);
  });

  it("crack-vault action available after opened + owned, gives reward", () => {
    const ctx = mockCtx();
    const inst = instantiate(combinationLock, "v1");
    const graph = new NodeGraph(inst, ctx);

    for (const sw of ["v1/switch-a", "v1/switch-b", "v1/switch-c"]) {
      graph._nodes.get(sw).attributes.accessLevel = "owned";
    }
    graph.executeAction("v1/switch-a", "activate");
    graph.executeAction("v1/switch-b", "activate");
    graph.executeAction("v1/switch-c", "activate");

    // Vault is opened but not yet owned — crack-vault unavailable
    let available = graph.getAvailableActions("v1/vault").map(a => a.id);
    assert.ok(!available.includes("crack-vault"));

    // Own the vault
    graph._nodes.get("v1/vault").attributes.accessLevel = "owned";
    available = graph.getAvailableActions("v1/vault").map(a => a.id);
    assert.ok(available.includes("crack-vault"));

    graph.executeAction("v1/vault", "crack-vault");
    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [1500]);

    // Can't crack twice — opened set back to false
    available = graph.getAvailableActions("v1/vault").map(a => a.id);
    assert.ok(!available.includes("crack-vault"));
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
    graph.tick(100);
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
    assert.equal(ctx.calls.revealNode, undefined);

    graph.executeAction("seg1/panel-gamma", "align");
    assert.ok(ctx.calls.revealNode?.length > 0);
    assert.deepEqual(ctx.calls.revealNode[0], ["seg1/hidden-subnet"]);
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
    assert.equal(graph.getAvailableActions("mk1/vault-node").map((a) => a.id).includes("unlock-vault"), false);
  });

  it("loot action available after both tokens extracted; reward dispensed", () => {
    const ctx = mockCtx();
    const inst = instantiate(SET_PIECES.multiKeyVault, "mk1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("mk1/key-server-1").attributes.accessLevel = "owned";
    graph._nodes.get("mk1/key-server-2").attributes.accessLevel = "owned";
    graph._nodes.get("mk1/vault-node").attributes.accessLevel = "owned";

    graph.executeAction("mk1/key-server-1", "extract-token");
    graph.executeAction("mk1/key-server-2", "extract-token");
    assert.equal(graph.getQuality("mk1/auth-tokens"), 2);

    const available = graph.getAvailableActions("mk1/vault-node").map((a) => a.id);
    assert.ok(available.includes("unlock-vault"));

    graph.executeAction("mk1/vault-node", "unlock-vault");
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
    graph.tick(120); // clock period is 120 at grade D
    const actions = graph.getAvailableActions("ev1/key-gen").map((a) => a.id);
    assert.ok(actions.includes("extract-key"), "key ready after clock fires");
  });

  it("fetch-vault bonus unavailable without extracted key; available after extraction", () => {
    const ctx = mockCtx();
    const inst = instantiate(encryptedVault, "ev1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("ev1/key-gen").attributes.accessLevel = "owned";
    graph._nodes.get("ev1/vault").attributes.accessLevel = "owned";

    // Before clock: no key → key bonus unavailable
    assert.ok(!graph.getAvailableActions("ev1/vault").map((a) => a.id).includes("fetch-vault"));

    // Fire clock, extract key, then claim the vault bonus
    graph.tick(120);
    graph.executeAction("ev1/key-gen", "extract-key");
    assert.equal(graph.getQuality("ev1/decryption-key"), 1);

    const available = graph.getAvailableActions("ev1/vault").map((a) => a.id);
    assert.ok(available.includes("fetch-vault"));

    graph.executeAction("ev1/vault", "fetch-vault");
    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [3000]);
    assert.equal(graph.getQuality("ev1/decryption-key"), 0);
  });

  // Regression (#TBD): the vault's key-gated bonus action must NOT reuse the
  // core "fetch" verb id, or it (a) shadows the lootable trait's standard FETCH
  // — making the vault's macguffins (incl. mission targets) uncollectable — and
  // (b) renders top-level instead of under the EXEC ▸ submenu.
  it("standard macguffin FETCH survives the trait merge (not shadowed by the bonus)", () => {
    const ctx = mockCtx();
    const inst = instantiate(encryptedVault, "ev1");
    const graph = new NodeGraph(inst, ctx);

    const fetch = graph._nodes.get("ev1/vault").actions.find((a) => a.id === "fetch");
    assert.ok(fetch, "standard lootable FETCH must not be shadowed by the key bonus");
    // It must be the macguffin-loot action (sets `looting`), not the flat-reward bonus.
    assert.ok(
      fetch.effects.some((e) => e.effect === "set-attr" && e.attr === "looting"),
      "the surviving 'fetch' must be the lootable FETCH, not the bonus action",
    );
  });

  it("key bonus action uses a non-core id so it groups under EXEC", () => {
    const inst = instantiate(encryptedVault, "ev1");
    const vaultDef = inst.nodes.find((n) => n.id === "ev1/vault");
    const bonus = vaultDef.actions.find((a) => a.label === "Fetch Vault");
    assert.ok(bonus, "Fetch Vault action present on vault def");
    assert.ok(
      isScriptAction(bonus.id),
      "Fetch Vault must be a script action (under EXEC), not the core 'fetch' verb",
    );
  });

  it("key expires on next clock cycle if not looted in time", () => {
    const ctx = mockCtx();
    const inst = instantiate(encryptedVault, "ev1");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("ev1/key-gen").attributes.accessLevel = "owned";
    graph._nodes.get("ev1/vault").attributes.accessLevel = "owned";

    // First clock cycle: extract the key
    graph.tick(120);
    graph.executeAction("ev1/key-gen", "extract-key");
    assert.equal(graph.getQuality("ev1/decryption-key"), 1);

    // Don't loot — let next clock cycle fire and expire the key
    graph.tick(120);
    assert.equal(graph.getQuality("ev1/decryption-key"), 0);
    assert.equal(graph.getNodeState("ev1/key-gen").keyReady, true); // new key ready
    assert.ok(!graph.getAvailableActions("ev1/vault").map((a) => a.id).includes("loot"));
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
    // Subvert only relay-a — the subvert action uses emit-message to send
    // subvert-ping directly to watchdog (bypassing relay-a's own operators),
    // which resets the watchdog timer. Need 5 more ticks for it to expire (grade D).
    graph.executeAction("cs1/relay-a", "subvert");
    graph.tick(5); // watchdog period elapses without further messages (grade D)

    assert.equal(ctx.calls.startTrace?.length, 1);
  });
});

describe("tripwire-gauntlet: 8-tick delay from probe to alarm (grade D)", () => {
  it("sensor flags triggered immediately on probe-noise", () => {
    const ctx = mockCtx();
    const inst = instantiate(tripwireGauntlet, "tg1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("tg1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(graph.getNodeState("tg1/sensor").triggered, true);
    assert.equal(graph.getNodeState("tg1/alarm").triggered, false);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("alarm does not fire before 8 ticks (grade D)", () => {
    const ctx = mockCtx();
    const inst = instantiate(tripwireGauntlet, "tg1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("tg1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    graph.tick(7); // one tick short of the full 8-tick delay
    assert.equal(graph.getNodeState("tg1/alarm").triggered, false);
    assert.equal(ctx.calls.startTrace, undefined);
  });

  it("alarm fires and trace starts on tick 8 (grade D)", () => {
    const ctx = mockCtx();
    const inst = instantiate(tripwireGauntlet, "tg1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("tg1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    graph.tick(8);
    assert.equal(graph.getNodeState("tg1/alarm").triggered, true);
    assert.equal(ctx.calls.startTrace?.length, 1);
  });
});

// ---------------------------------------------------------------------------
// probe-burst-alarm: tally operator + repeating trigger
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
// noisy-sensor: debounce operator
// ---------------------------------------------------------------------------
describe("noisy-sensor: first probe per window raises alert, subsequent suppressed", () => {
  it("raises alert on first probe-noise", () => {
    const ctx = mockCtx();
    const inst = instantiate(noisySensor, "ns1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(ctx.calls.setGlobalAlert?.length, 1);
    assert.deepEqual(ctx.calls.setGlobalAlert[0], ["yellow"]);
  });

  it("suppresses second probe during cooldown — no additional alert", () => {
    const ctx = mockCtx();
    const inst = instantiate(noisySensor, "ns1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(ctx.calls.setGlobalAlert?.length, 1);

    // Second probe within cooldown — debounce suppresses it, no second alert
    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(ctx.calls.setGlobalAlert?.length, 1);
  });

  it("raises alert again after cooldown expires (5 ticks, grade D)", () => {
    const ctx = mockCtx();
    const inst = instantiate(noisySensor, "ns1");
    const graph = new NodeGraph(inst, ctx);

    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(ctx.calls.setGlobalAlert?.length, 1);

    graph.tick(5); // expire the 5-tick cooldown (grade D)
    graph.sendMessage("ns1/sensor", createMessage({ type: "probe-noise", origin: "player", payload: {} }));
    assert.equal(ctx.calls.setGlobalAlert?.length, 2); // second window, second alert
  });
});

// ---------------------------------------------------------------------------
// tamper-detect: sequencing puzzle — neutralize relay before reconfiguring IDS
// ---------------------------------------------------------------------------
describe("tamper-detect: corrupting IDS without neutralizing relay triggers trace", () => {
  it("corrupting IDS without neutralizing triggers tamper trace", () => {
    const ctx = mockCtx();
    const inst = instantiate(tamperDetect, "td1");
    const graph = new NodeGraph(inst, ctx);

    // Give player ownership so corrupt is available
    graph._nodes.get("td1/ids").attributes.accessLevel = "owned";
    graph.executeAction("td1/ids", "corrupt");

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

  it("neutralizing tamper relay before corrupt prevents trace", () => {
    const ctx = mockCtx();
    const inst = instantiate(tamperDetect, "td1");
    const graph = new NodeGraph(inst, ctx);

    // Own and neutralize the tamper relay first
    graph._nodes.get("td1/tamper-relay").attributes.accessLevel = "owned";
    graph.executeAction("td1/tamper-relay", "neutralize");
    assert.equal(graph.getNodeState("td1/tamper-relay").forwardingEnabled, false);

    // Now corrupt the IDS safely
    graph._nodes.get("td1/ids").attributes.accessLevel = "owned";
    graph.executeAction("td1/ids", "corrupt");

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
    assert.equal(ctx.calls.recordMonitorAlert?.length, 1);
    assert.deepEqual(ctx.calls.recordMonitorAlert[0], ["td1/security-monitor"]);
  });
});

// ---------------------------------------------------------------------------
// Scattered combination lock — quality-based communication
// ---------------------------------------------------------------------------

describe("scatteredLock3: instantiation prefixes quality names", () => {
  it("prefixes quality refs in switch actions and core trigger", () => {
    const inst = instantiate(scatteredLock3, "sl");
    // Check switch action quality-delta
    const sw = inst.nodes.find(n => n.id === "sl/switch-a");
    const activateAction = sw.actions.find(a => a.id === "activate");
    const qualityEffect = activateAction.effects.find(e => e.effect === "quality-delta");
    assert.equal(qualityEffect.name, "sl/locks-opened");

    // Check trigger quality-gte
    const trigger = inst.triggers.find(t => t.id === "sl/vault-reveal");
    assert.equal(trigger.when.name, "sl/locks-opened");

    // Check scan-lock log-template
    const gate = inst.nodes.find(n => n.id === "sl/gate");
    const scanAction = gate.actions.find(a => a.id === "scan-lock");
    const tmplEffect = scanAction.effects.find(e => e.effect === "log-template");
    assert.ok(tmplEffect.template.includes("${quality:sl/locks-opened}"));
  });

  it("scattered nodes have scatter:true attribute", () => {
    const switches = scatteredLock3.nodes.filter(n => n.scatter);
    assert.equal(switches.length, 3);
    const core = scatteredLock3.nodes.filter(n => !n.scatter);
    assert.equal(core.length, 2); // gate + vault
  });
});

describe("scatteredLock3: quality communication in NodeGraph", () => {
  it("vault not revealed until all 3 switches activated", () => {
    const ctx = mockCtx();
    const inst = instantiate(scatteredLock3, "sl");
    const graph = new NodeGraph(inst, ctx);

    // Own all switches
    for (const sw of ["sl/switch-a", "sl/switch-b", "sl/switch-c"]) {
      graph._nodes.get(sw).attributes.accessLevel = "owned";
    }

    // Activate 2 — vault should NOT reveal
    graph.executeAction("sl/switch-a", "activate");
    graph.executeAction("sl/switch-b", "activate");
    assert.equal(ctx.calls.revealNode, undefined);

    // Activate 3rd — vault reveals
    graph.executeAction("sl/switch-c", "activate");
    assert.ok(ctx.calls.revealNode?.length > 0);
    assert.deepEqual(ctx.calls.revealNode[0], ["sl/vault"]);
    assert.equal(graph.getNodeState("sl/vault").concealed, false);
  });
});

describe("scatteredLock3: scan-lock action reports progress", () => {
  it("reports 0/3 initially, then 1/3 after one activation", () => {
    const ctx = mockCtx();
    const inst = instantiate(scatteredLock3, "sl");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("sl/gate").attributes.accessLevel = "owned";
    graph.executeAction("sl/gate", "scan-lock");
    assert.ok(ctx.calls.log?.some(args => args[0] === "Combination lock: 0/3 switches activated"));

    // Activate one switch
    graph._nodes.get("sl/switch-a").attributes.accessLevel = "owned";
    graph.executeAction("sl/switch-a", "activate");
    graph.executeAction("sl/gate", "scan-lock");
    assert.ok(ctx.calls.log?.some(args => args[0] === "Combination lock: 1/3 switches activated"));
  });
});

describe("scatteredLock3: crack-vault requires all switches + owned", () => {
  it("gives reward when all switches activated and vault owned", () => {
    const ctx = mockCtx();
    const inst = instantiate(scatteredLock3, "sl");
    const graph = new NodeGraph(inst, ctx);

    for (const sw of ["sl/switch-a", "sl/switch-b", "sl/switch-c"]) {
      graph._nodes.get(sw).attributes.accessLevel = "owned";
    }
    graph.executeAction("sl/switch-a", "activate");
    graph.executeAction("sl/switch-b", "activate");
    graph.executeAction("sl/switch-c", "activate");

    // Vault not owned — crack-vault unavailable
    let available = graph.getAvailableActions("sl/vault").map(a => a.id);
    assert.ok(!available.includes("crack-vault"));

    // Own vault
    graph._nodes.get("sl/vault").attributes.accessLevel = "owned";
    available = graph.getAvailableActions("sl/vault").map(a => a.id);
    assert.ok(available.includes("crack-vault"));

    graph.executeAction("sl/vault", "crack-vault");
    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [1500]);
  });

  it("crack-vault is one-shot — spent after the first crack", () => {
    const ctx = mockCtx();
    const inst = instantiate(scatteredLock3, "sl");
    const graph = new NodeGraph(inst, ctx);

    for (const sw of ["sl/switch-a", "sl/switch-b", "sl/switch-c"]) {
      graph._nodes.get(sw).attributes.accessLevel = "owned";
    }
    graph.executeAction("sl/switch-a", "activate");
    graph.executeAction("sl/switch-b", "activate");
    graph.executeAction("sl/switch-c", "activate");
    graph._nodes.get("sl/vault").attributes.accessLevel = "owned";

    // First crack pays out.
    graph.executeAction("sl/vault", "crack-vault");
    assert.equal(ctx.calls.giveReward?.length, 1);

    // The vault is now spent: crack-vault is no longer offered, so the player
    // cannot keep cracking it for cash. (Without a one-shot guard, the monotonic
    // requires — owned + locks-opened>=n — stay true forever and it repeats.)
    const available = graph.getAvailableActions("sl/vault").map((a) => a.id);
    assert.ok(!available.includes("crack-vault"), "crack-vault should be spent after one crack");
  });
});

describe("scatteredLock variants: correct switch counts and thresholds", () => {
  it("scatteredLock1 has 1 switch", () => {
    assert.equal(scatteredLock1.nodes.filter(n => n.scatter).length, 1);
    const trigger = scatteredLock1.triggers[0];
    assert.equal(trigger.when.value, 1);
  });

  it("scatteredLock5 has 5 switches", () => {
    assert.equal(scatteredLock5.nodes.filter(n => n.scatter).length, 5);
    const trigger = scatteredLock5.triggers[0];
    assert.equal(trigger.when.value, 5);
  });
});

// ---------------------------------------------------------------------------
// Scattered multi-key vault — quality-based communication
// ---------------------------------------------------------------------------

describe("scatteredKeyVault: quality communication", () => {
  it("scatteredKeyVault2 has 2 scattered key-servers", () => {
    assert.equal(scatteredKeyVault2.nodes.filter(n => n.scatter).length, 2);
    assert.equal(scatteredKeyVault2.nodes.filter(n => !n.scatter).length, 1);
  });

  it("unlock-vault requires all tokens collected", () => {
    const ctx = mockCtx();
    const inst = instantiate(scatteredKeyVault2, "kv");
    const graph = new NodeGraph(inst, ctx);

    // Own and extract from both keys
    for (const ks of ["kv/key-server-1", "kv/key-server-2"]) {
      graph._nodes.get(ks).attributes.accessLevel = "owned";
      graph.executeAction(ks, "extract-token");
    }

    // Own vault and unlock
    graph._nodes.get("kv/vault-node").attributes.accessLevel = "owned";
    const available = graph.getAvailableActions("kv/vault-node").map(a => a.id);
    assert.ok(available.includes("unlock-vault"));

    graph.executeAction("kv/vault-node", "unlock-vault");
    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [5000]);
  });

  it("scan-vault reports progress", () => {
    const ctx = mockCtx();
    const inst = instantiate(scatteredKeyVault3, "kv");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("kv/vault-node").attributes.accessLevel = "owned";
    graph.executeAction("kv/vault-node", "scan-vault");
    assert.ok(ctx.calls.log?.some(args => args[0] === "Key vault: 0/3 tokens collected"));
  });
});

// ---------------------------------------------------------------------------
// Scattered encrypted vault — quality-based communication
// ---------------------------------------------------------------------------

describe("scatteredEncryptedVault: quality communication", () => {
  it("scatteredEncryptedVault2 has 2 scattered key-gens", () => {
    assert.equal(scatteredEncryptedVault2.nodes.filter(n => n.scatter).length, 2);
    assert.equal(scatteredEncryptedVault2.nodes.filter(n => !n.scatter).length, 1);
  });

  it("decrypt-loot requires all keys", () => {
    const ctx = mockCtx();
    const inst = instantiate(scatteredEncryptedVault2, "ev");
    const graph = new NodeGraph(inst, ctx);

    // Own and extract from both key-gens
    for (const kg of ["ev/key-gen-1", "ev/key-gen-2"]) {
      graph._nodes.get(kg).attributes.accessLevel = "owned";
      graph.executeAction(kg, "extract-key");
    }

    // Own vault and decrypt
    graph._nodes.get("ev/vault").attributes.accessLevel = "owned";
    graph.executeAction("ev/vault", "decrypt-loot");
    assert.equal(ctx.calls.giveReward?.length, 1);
    assert.deepEqual(ctx.calls.giveReward[0], [3000]);
  });

  it("scan-vault reports progress", () => {
    const ctx = mockCtx();
    const inst = instantiate(scatteredEncryptedVault3, "ev");
    const graph = new NodeGraph(inst, ctx);

    graph._nodes.get("ev/vault").attributes.accessLevel = "owned";
    graph.executeAction("ev/vault", "scan-vault");
    assert.ok(ctx.calls.log?.some(args => args[0] === "Encrypted vault: 0/3 keys collected"));
  });
});

describe("entryPoint: WAN offers in-run darknet access", () => {
  it("access-darknet is available on the WAN node", () => {
    const inst = instantiate(entryPoint, "entry");
    const graph = new NodeGraph(inst, mockCtx());
    const available = graph.getAvailableActions("entry/wan").map((a) => a.id);
    assert.ok(available.includes("access-darknet"));
  });

  it("executing access-darknet opens the broker", () => {
    const ctx = mockCtx();
    const inst = instantiate(entryPoint, "entry");
    const graph = new NodeGraph(inst, ctx);
    graph.executeAction("entry/wan", "access-darknet");
    assert.equal(ctx.calls.openDarknetsStore?.length, 1);
  });
});
