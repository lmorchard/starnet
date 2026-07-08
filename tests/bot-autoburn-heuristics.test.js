import test from "node:test";
import assert from "node:assert/strict";
import { exploreStrategy } from "../scripts/bot/heuristics/explore.js";
import { securityStrategy } from "../scripts/bot/heuristics/security.js";
import { supplyStrategy } from "../scripts/bot/heuristics/supply.js";
import { A } from "../js/core/action-ids.js";

// Shared minimal WorldModel stub for the auto-burn heuristics.
function world(over = {}) {
  return {
    revealed: [],
    needsProbe: [],
    needsExploit: [],
    minable: [],
    security: [],
    nodes: new Map(),
    availableActions: new Map(),
    hoardUsable: 5,
    failedNodes: new Set(),
    iceCooldown: new Set(),
    player: { selectedNodeId: null, cash: 0, alertLevel: "yellow", traceActive: false },
    mission: { targetNodeId: null },
    shortestPath: () => null,
    ...over,
  };
}

// ── explore ─────────────────────────────────────────────────────────

test("explore proposes a payload-less XPLOIT when hoardUsable > 0", () => {
  const w = world({
    needsExploit: ["target"],
    hoardUsable: 3,
    nodes: new Map([["target", { type: "server", vulnerabilities: [{ id: "weak-auth" }] }]]),
  });
  const props = exploreStrategy(w).filter((p) => p.action === A.XPLOIT);
  assert.equal(props.length, 1);
  assert.equal(props[0].nodeId, "target");
  // No exploitId / card payload on the auto-burn proposal.
  assert.equal(props[0].payload?.exploitId, undefined);
});

test("explore proposes NO XPLOIT when hoardUsable === 0", () => {
  const w = world({
    needsExploit: ["target"],
    hoardUsable: 0,
    nodes: new Map([["target", { type: "server", vulnerabilities: [{ id: "weak-auth" }] }]]),
  });
  const props = exploreStrategy(w).filter((p) => p.action === A.XPLOIT);
  assert.equal(props.length, 0);
});

test("explore skips nodes in failedNodes", () => {
  const w = world({
    needsExploit: ["target"],
    hoardUsable: 5,
    failedNodes: new Set(["target"]),
    nodes: new Map([["target", { type: "server", vulnerabilities: [{ id: "weak-auth" }] }]]),
  });
  const props = exploreStrategy(w).filter((p) => p.action === A.XPLOIT);
  assert.equal(props.length, 0);
});

// ── security ────────────────────────────────────────────────────────

test("security proposes a payload-less XPLOIT on a probed IDS when hoardUsable > 0", () => {
  const w = world({
    security: ["ids-1"],
    hoardUsable: 2,
    nodes: new Map([["ids-1", {
      type: "ids", visibility: "accessible", accessLevel: "open",
      probed: true, forwardingEnabled: true, vulnerabilities: [{ id: "weak-auth" }],
    }]]),
  });
  const props = securityStrategy(w).filter((p) => p.action === A.XPLOIT);
  assert.equal(props.length, 1);
  assert.equal(props[0].nodeId, "ids-1");
  assert.equal(props[0].payload?.exploitId, undefined);
});

test("security proposes NO XPLOIT on a probed IDS when hoardUsable === 0", () => {
  const w = world({
    security: ["ids-1"],
    hoardUsable: 0,
    nodes: new Map([["ids-1", {
      type: "ids", visibility: "accessible", accessLevel: "open",
      probed: true, forwardingEnabled: true, vulnerabilities: [{ id: "weak-auth" }],
    }]]),
  });
  const props = securityStrategy(w).filter((p) => p.action === A.XPLOIT);
  assert.equal(props.length, 0);
});

// ── supply ──────────────────────────────────────────────────────────

test("supply buys the cheapest affordable pack when hoard is low", () => {
  const w = world({
    needsExploit: ["target"],
    hoardUsable: 0,
    minable: [],
    player: { cash: 1000, selectedNodeId: null },
  });
  const props = supplyStrategy(w);
  const buy = props.find((p) => p.action === "buy-pack");
  assert.ok(buy, "expected a buy-pack proposal");
  assert.equal(typeof buy.payload.packId, "string");
});

test("supply proposes JACKOUT when dry, no minable, can't afford a pack", () => {
  const w = world({
    needsExploit: ["target"],
    hoardUsable: 0,
    minable: [],
    player: { cash: 0, selectedNodeId: null },
  });
  const props = supplyStrategy(w);
  assert.ok(props.some((p) => p.action === A.JACKOUT), "expected a jackout proposal");
  assert.ok(!props.some((p) => p.action === "buy-pack"), "should not buy with no cash");
});

test("supply does NOT jack out when a minable node exists (mine replenishes)", () => {
  const w = world({
    needsExploit: ["target"],
    hoardUsable: 0,
    minable: [{ nodeId: "owned-1", vulnTypes: new Set() }],
    player: { cash: 0, selectedNodeId: null },
  });
  const props = supplyStrategy(w);
  assert.ok(!props.some((p) => p.action === A.JACKOUT), "should rely on mine, not jack out");
});

test("supply is inert when hoard has usable rounds", () => {
  const w = world({ needsExploit: ["target"], hoardUsable: 5, player: { cash: 1000 } });
  assert.equal(supplyStrategy(w).length, 0);
});
