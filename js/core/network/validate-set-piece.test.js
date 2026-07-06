import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateSetPiece } from "./validate-set-piece.js";
import { instantiate } from "./set-pieces.js";
import { NodeGraph } from "../node-graph/runtime.js";
import { mockCtx } from "../node-graph/ctx.js";
import { SET_PIECES } from "../../../data/biomes/corporate-pieces.js";
import { ATOMICS } from "../../../data/biomes/corporate-pieces/atomics.js";
import { BACKBONE_PIECES } from "../../../data/biomes/corporate-pieces/backbone.js";

/** Every piece in the corporate biome catalog, keyed by export name. */
const CATALOG = { ...SET_PIECES, ...ATOMICS, ...BACKBONE_PIECES };

/** @param {{errors: any[]}} result @param {string} check */
function checks(result, check) {
  return result.errors.filter((e) => e.check === check);
}

/**
 * Minimal valid one-node piece, deep-cloneable, used as a base for broken-def tests.
 * @returns {any}
 */
function basePiece() {
  return {
    id: "test-piece",
    description: "test",
    nodes: [
      { id: "n1", type: "generic", traits: ["graded", "hackable", "rebootable"], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
    ],
    internalEdges: [],
    triggers: [],
    externalPorts: ["n1"],
    ports: [{ nodeId: "n1", direction: "inbound", wantsTags: [], required: true }],
  };
}

// ---------------------------------------------------------------------------
// Static reference checks (1-4)
// ---------------------------------------------------------------------------

describe("validateSetPiece: edge-endpoint (1)", () => {
  it("flags an internalEdges endpoint that is not a declared node", () => {
    const def = basePiece();
    def.internalEdges = [["n1", "ghost"]];
    assert.ok(checks(validateSetPiece(def), "edge-endpoint").length >= 1);
  });
  it("passes when both endpoints are declared", () => {
    const def = basePiece();
    def.nodes.push({ id: "n2", type: "generic", traits: ["graded", "hackable", "rebootable"], attributes: {}, operators: [], actions: [] });
    def.internalEdges = [["n1", "n2"]];
    assert.equal(checks(validateSetPiece(def), "edge-endpoint").length, 0);
  });
});

describe("validateSetPiece: port-target (2)", () => {
  it("flags an externalPort that is not a declared node", () => {
    const def = basePiece();
    def.externalPorts = ["ghost"];
    assert.ok(checks(validateSetPiece(def), "port-target").length >= 1);
  });
  it("flags a ports[].nodeId that is not a declared node", () => {
    const def = basePiece();
    def.ports = [{ nodeId: "ghost", direction: "inbound", wantsTags: [], required: true }];
    assert.ok(checks(validateSetPiece(def), "port-target").length >= 1);
  });
});

describe("validateSetPiece: lateral-port (13)", () => {
  it("flags a port declaring direction lateral (unwired — see #39)", () => {
    const def = basePiece();
    def.nodes.push({ id: "n2", type: "generic", traits: [], attributes: {}, operators: [], actions: [] });
    def.internalEdges = [["n1", "n2"]];
    def.ports = [
      { nodeId: "n1", direction: "inbound", wantsTags: [], required: true },
      { nodeId: "n2", direction: "lateral", wantsTags: [], required: true },
    ];
    const fired = checks(validateSetPiece(def), "lateral-port");
    assert.ok(fired.some((e) => e.nodeId === "n2"), "n2's lateral port should be flagged");
  });
  it("passes when ports are only inbound/outbound", () => {
    const def = basePiece();
    def.ports = [{ nodeId: "n1", direction: "inbound", wantsTags: [], required: true }];
    assert.equal(checks(validateSetPiece(def), "lateral-port").length, 0);
  });
});

describe("validateSetPiece: operator-input (3)", () => {
  it("flags an all-of input that is not a declared node", () => {
    const def = basePiece();
    def.nodes[0].operators = [{ name: "all-of", inputs: ["n1", "ghost"] }];
    assert.ok(checks(validateSetPiece(def), "operator-input").length >= 1);
  });
});

describe("validateSetPiece: destinations-edge (4)", () => {
  it("flags a destination with no internalEdges path from the emitting node", () => {
    const def = basePiece();
    def.nodes.push({ id: "n2", type: "generic", traits: [], attributes: {}, operators: [], actions: [] });
    def.nodes[0].operators = [{ name: "relay", destinations: ["n2"] }];
    // no internalEdges connecting n1 and n2 → hidden channel
    assert.ok(checks(validateSetPiece(def), "destinations-edge").length >= 1);
  });
  it("passes when the destination is connected by an internalEdge", () => {
    const def = basePiece();
    def.nodes.push({ id: "n2", type: "generic", traits: [], attributes: {}, operators: [], actions: [] });
    def.nodes[0].operators = [{ name: "relay", destinations: ["n2"] }];
    def.internalEdges = [["n1", "n2"]];
    assert.equal(checks(validateSetPiece(def), "destinations-edge").length, 0);
  });
});

// ---------------------------------------------------------------------------
// Static semantic checks (5-9)
// ---------------------------------------------------------------------------

describe("validateSetPiece: core-verb-shadow (5) — catches #153", () => {
  it("flags an authored action that shadows a trait-provided core verb", () => {
    const def = basePiece();
    // lootable provides FETCH; authoring id:"fetch" shadows it (the #153 unwinnable-run bug).
    def.nodes[0].traits = ["graded", "hackable", "rebootable", "lootable"];
    def.nodes[0].actions = [{ id: "fetch", label: "Fetch", requires: [], effects: [] }];
    assert.ok(checks(validateSetPiece(def), "core-verb-shadow").length >= 1);
  });
  it("does NOT flag a distinct id like fetch-vault on a lootable node", () => {
    const def = basePiece();
    def.nodes[0].traits = ["graded", "hackable", "rebootable", "lootable"];
    def.nodes[0].actions = [{ id: "fetch-vault", label: "Fetch Vault", requires: [], effects: [] }];
    assert.equal(checks(validateSetPiece(def), "core-verb-shadow").length, 0);
  });
});

describe("validateSetPiece: ctx-method (6)", () => {
  it("flags a ctx-call with a method name that is not on CtxInterface", () => {
    const def = basePiece();
    def.nodes[0].actions = [{ id: "go", label: "Go", requires: [], effects: [{ effect: "ctx-call", method: "notARealMethod", args: [] }] }];
    assert.ok(checks(validateSetPiece(def), "ctx-method").length >= 1);
  });
  it("flags a report operator whose call is not a ctx method", () => {
    const def = basePiece();
    def.nodes[0].operators = [{ name: "report", on: "alert", call: "nope" }];
    assert.ok(checks(validateSetPiece(def), "ctx-method").length >= 1);
  });
  it("passes for real ctx methods (startTrace, giveReward, log)", () => {
    const def = basePiece();
    def.nodes[0].actions = [{ id: "go", label: "Go", requires: [], effects: [
      { effect: "ctx-call", method: "startTrace", args: [] },
      { effect: "ctx-call", method: "giveReward", args: [100] },
      { effect: "ctx-call", method: "log", args: ["hi"] },
    ] }];
    assert.equal(checks(validateSetPiece(def), "ctx-method").length, 0);
  });
});

describe("validateSetPiece: quality consistency (7) — catches #215 class", () => {
  it("flags a quality read by a gate that nothing writes", () => {
    const def = basePiece();
    def.triggers = [{ id: "t", when: { type: "quality-gte", name: "never-written", value: 1 }, then: [] }];
    assert.ok(checks(validateSetPiece(def), "quality-read-without-write").length >= 1);
  });
  it("passes when the quality is both written and read", () => {
    const def = basePiece();
    def.nodes[0].actions = [{ id: "inc", label: "Inc", requires: [], effects: [{ effect: "quality-delta", name: "q", delta: 1 }] }];
    def.triggers = [{ id: "t", when: { type: "quality-gte", name: "q", value: 1 }, then: [] }];
    assert.equal(checks(validateSetPiece(def), "quality-read-without-write").length, 0);
    assert.equal(checks(validateSetPiece(def), "quality-write-without-read").length, 0);
  });
  it("exempts dynamic quality-from-attr reads", () => {
    const def = basePiece();
    def.nodes[0].actions = [{ id: "go", label: "Go", requires: [{ type: "quality-from-attr", attr: "keyName", gte: 1 }], effects: [] }];
    assert.equal(checks(validateSetPiece(def), "quality-read-without-write").length, 0);
  });
});

describe("validateSetPiece: enabled-attr (8)", () => {
  it("flags an enabledAttr that is not an attribute on the node", () => {
    const def = basePiece();
    def.nodes[0].operators = [{ name: "relay", enabledAttr: "ghostAttr" }];
    assert.ok(checks(validateSetPiece(def), "enabled-attr").length >= 1);
  });
  it("passes when the enabledAttr is a declared attribute", () => {
    const def = basePiece();
    def.nodes[0].attributes = { accessLevel: "locked", relayEnabled: true };
    def.nodes[0].operators = [{ name: "relay", enabledAttr: "relayEnabled" }];
    assert.equal(checks(validateSetPiece(def), "enabled-attr").length, 0);
  });
});

describe("validateSetPiece: watchdog-armed (9) — static angle on #215", () => {
  it("flags a watchdog that is neither armable nor fed by a clock", () => {
    const def = basePiece();
    def.nodes[0].operators = [{ name: "watchdog", period: 5 }];
    assert.ok(checks(validateSetPiece(def), "watchdog-armed").length >= 1);
  });
  it("passes an armable watchdog (cascade-shutdown shape)", () => {
    const def = basePiece();
    def.nodes[0].operators = [{ name: "watchdog", period: 5, armable: true }];
    assert.equal(checks(validateSetPiece(def), "watchdog-armed").length, 0);
  });
  it("passes a watchdog fed by an in-piece clock (deadman shape)", () => {
    const def = basePiece();
    def.id = "deadman-like";
    def.nodes = [
      { id: "clock", type: "generic", traits: [], attributes: {}, operators: [{ name: "clock", period: 3 }], actions: [] },
      { id: "wd", type: "generic", traits: [], attributes: {}, operators: [{ name: "watchdog", period: 5 }], actions: [] },
    ];
    def.internalEdges = [["clock", "wd"]];
    def.externalPorts = ["clock"];
    def.ports = [{ nodeId: "clock", direction: "inbound", wantsTags: [], required: true }];
    assert.equal(checks(validateSetPiece(def), "watchdog-armed").length, 0);
  });
});

// ---------------------------------------------------------------------------
// Instantiated / behavioral checks (10-12)
// ---------------------------------------------------------------------------

describe("validateSetPiece: namespace-leak (10) — direct #215 analog", () => {
  it("flags a trigger nodeId that does not exist in the piece (survives instantiate as a dangling prefixed ref)", () => {
    const def = basePiece();
    def.triggers = [{ id: "t", when: { type: "node-attr", nodeId: "ghost", attr: "x", eq: true }, then: [] }];
    assert.ok(checks(validateSetPiece(def), "namespace-leak").length >= 1);
  });
  it("passes a well-formed reference to a declared node", () => {
    const def = basePiece();
    def.nodes[0].attributes = { accessLevel: "locked", x: false };
    def.triggers = [{ id: "t", when: { type: "node-attr", nodeId: "n1", attr: "x", eq: true }, then: [] }];
    assert.equal(checks(validateSetPiece(def), "namespace-leak").length, 0);
  });
});

describe("validateSetPiece: reachability (11)", () => {
  it("flags a non-scatter node with no edge to it that is not a port", () => {
    const def = basePiece();
    def.nodes.push({ id: "island", type: "generic", traits: [], attributes: {}, operators: [], actions: [] });
    // island has no edges and is not a port → unreachable
    assert.ok(checks(validateSetPiece(def), "reachability").length >= 1);
  });
  it("exempts scatter nodes (scattered-key-vault shape)", () => {
    const def = basePiece();
    def.nodes.push({ id: "scattered-key", type: "generic", scatter: true, traits: [], attributes: {}, operators: [], actions: [] });
    assert.equal(checks(validateSetPiece(def), "reachability").length, 0);
  });
});

describe("validateSetPiece: concealed-reachability (12)", () => {
  it("flags a non-concealed node reachable from inbound only through a concealed hub", () => {
    // The switch-arrangement deadlock in miniature: two panels connect only to a concealed hub
    // they are meant to unlock, so the player can never reach them to solve the puzzle.
    const def = basePiece();
    def.nodes = [
      { id: "panel-a", type: "generic", traits: [], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
      { id: "panel-b", type: "generic", traits: [], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
      { id: "hub", type: "generic", traits: [], attributes: { accessLevel: "locked", concealed: true }, operators: [], actions: [] },
    ];
    def.internalEdges = [["panel-a", "hub"], ["panel-b", "hub"]];
    def.externalPorts = ["panel-a", "panel-b", "hub"];
    def.ports = [
      { nodeId: "panel-a", direction: "inbound", wantsTags: [], required: true },
      { nodeId: "panel-b", direction: "lateral", wantsTags: [], required: true },
      { nodeId: "hub", direction: "outbound", wantsTags: [], required: false },
    ];
    const fired = checks(validateSetPiece(def), "concealed-reachability");
    assert.ok(fired.some((e) => e.nodeId === "panel-b"), "panel-b should be flagged");
  });

  it("passes when panels reach each other without the concealed hub (the fix)", () => {
    // Same puzzle, but the panels are chained so each is reachable without traversing the hub.
    const def = basePiece();
    def.nodes = [
      { id: "panel-a", type: "generic", traits: [], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
      { id: "panel-b", type: "generic", traits: [], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
      { id: "hub", type: "generic", traits: [], attributes: { accessLevel: "locked", concealed: true }, operators: [], actions: [] },
    ];
    def.internalEdges = [["panel-a", "panel-b"], ["panel-a", "hub"], ["panel-b", "hub"]];
    def.externalPorts = ["panel-a", "panel-b", "hub"];
    def.ports = [
      { nodeId: "panel-a", direction: "inbound", wantsTags: [], required: true },
      { nodeId: "panel-b", direction: "lateral", wantsTags: [], required: true },
      { nodeId: "hub", direction: "outbound", wantsTags: [], required: false },
    ];
    assert.equal(checks(validateSetPiece(def), "concealed-reachability").length, 0);
  });

  it("does not flag a concealed reward node reached through a non-concealed hub", () => {
    // combinationLock shape: switches route through a normal (non-concealed) gate to the vault.
    const def = basePiece();
    def.nodes = [
      { id: "sw-a", type: "generic", traits: [], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
      { id: "sw-b", type: "generic", traits: [], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
      { id: "gate", type: "generic", traits: [], attributes: { accessLevel: "locked" }, operators: [], actions: [] },
      { id: "vault", type: "generic", traits: [], attributes: { accessLevel: "locked", concealed: true }, operators: [], actions: [] },
    ];
    def.internalEdges = [["sw-a", "gate"], ["sw-b", "gate"], ["gate", "vault"]];
    def.externalPorts = ["sw-a", "sw-b", "gate"];
    def.ports = [
      { nodeId: "sw-a", direction: "inbound", wantsTags: [], required: true },
      { nodeId: "sw-b", direction: "lateral", wantsTags: [], required: true },
      { nodeId: "gate", direction: "outbound", wantsTags: [], required: false },
    ];
    assert.equal(checks(validateSetPiece(def), "concealed-reachability").length, 0);
  });
});

// ---------------------------------------------------------------------------
// Catalog sweep — runs over every piece automatically (auto-covers new biomes)
// ---------------------------------------------------------------------------

describe("validateSetPiece: full catalog passes", () => {
  for (const [name, def] of Object.entries(CATALOG)) {
    it(`${name} (${def.id}) has no validation errors`, () => {
      const result = validateSetPiece(def);
      assert.equal(
        result.valid,
        true,
        `validateSetPiece(${def.id}) returned errors:\n` +
          result.errors.map((e) => `  [${e.check}] ${e.nodeId ?? "(piece)"}: ${e.message}`).join("\n")
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Behavioral no-trace-at-init (12) — generalizes the #215 reproduction
// ---------------------------------------------------------------------------

// Comfortably past the largest period/periodTable in the catalog (key-gen clock F=150,
// deadman watchdog F=80). A freshly-placed piece must not self-trace with no player action.
const MAX_TICKS = 300;

describe("no-trace-at-init (12): pieces do not self-trace without player action", () => {
  for (const [name, def] of Object.entries(CATALOG)) {
    it(`${name} (${def.id}) fires no startTrace after ${MAX_TICKS} idle ticks`, () => {
      const inst = instantiate(def, "t");
      const ctx = mockCtx();
      const graph = new NodeGraph(inst, ctx);
      graph.tick(MAX_TICKS);
      assert.equal(
        ctx.calls.startTrace,
        undefined,
        `${def.id} called startTrace ${ctx.calls.startTrace?.length}x with no player action — insta-trace regression`
      );
    });
  }

  it("DOES fire when a watchdog has no feeder and is not armable (the #215 reproduction in miniature)", () => {
    /** @type {any} */
    const broken = {
      id: "free-running-watchdog",
      description: "watchdog with no heartbeat — should latch and trace at init",
      nodes: [
        { id: "wd", type: "watchdog-daemon", traits: ["graded"], attributes: {}, operators: [{ name: "watchdog", period: 3 }], actions: [] },
        {
          id: "latch", type: "alarm-latch", traits: ["graded"], attributes: { latched: false },
          operators: [{ name: "latch" }], actions: [],
          triggers: [{ id: "fired", when: { type: "node-attr", attr: "latched", eq: true }, then: [{ effect: "ctx-call", method: "startTrace", args: [] }] }],
        },
      ],
      internalEdges: [["wd", "latch"]],
      triggers: [],
      externalPorts: ["wd"],
      ports: [{ nodeId: "wd", direction: "inbound", wantsTags: [], required: true }],
    };
    const inst = instantiate(broken, "t");
    const ctx = mockCtx();
    const graph = new NodeGraph(inst, ctx);
    graph.tick(MAX_TICKS);
    assert.ok(ctx.calls.startTrace?.length >= 1, "expected the free-running watchdog to fire startTrace");
    // And the static check catches the same bug:
    assert.ok(checks(validateSetPiece(broken), "watchdog-armed").length >= 1);
  });
});
