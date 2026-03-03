// @ts-check
// Unit tests for the pure tab completion function.
//
// State is constructed as minimal plain objects — no game engine init required.
// This validates that tabComplete is truly headless and dependency-free (aside
// from the VULNERABILITY_TYPES list it imports for buy completion).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tabComplete, VERBS } from "../js/core/console-commands.js";

// ── Minimal state builders ────────────────────────────────

/** @param {{ selectedNodeId?: string|null, nodes?: Object, hand?: any[] }} [opts] */
function makeState({ selectedNodeId = null, nodes = {}, hand = [] } = {}) {
  return { selectedNodeId, nodes, player: { hand } };
}

function makeNode(id, label = id, visibility = "accessible") {
  return { id, label, visibility };
}

/**
 * @param {string} id
 * @param {string} name
 * @param {"fresh"|"worn"|"disclosed"} [decayState]
 */
function makeCard(id, name, decayState = "fresh") {
  return { id, name, decayState, rarity: "common", quality: 0.5, targetVulnTypes: [], usesRemaining: 3 };
}

// ── Verb completion ───────────────────────────────────────

describe("tabComplete: verb completion", () => {
  const state = makeState();

  it("single unambiguous verb prefix completes with trailing space", () => {
    const r = tabComplete("sel", state);
    assert.equal(r.completed, "select ");
    assert.deepEqual(r.suggestions, []);
  });

  it("multi-match verb prefix returns LCP and all suggestions", () => {
    // "ca" matches cancel-probe, cancel-exploit, cancel-read, cancel-loot, cancel-trace
    const r = tabComplete("ca", state);
    assert.ok(r.suggestions.length >= 5);
    // LCP of cancel-* is "cancel-"
    assert.ok(r.completed?.startsWith("cancel-"));
    r.suggestions.forEach(s => assert.ok(s.startsWith("cancel-")));
  });

  it("no match returns null completed and empty suggestions", () => {
    const r = tabComplete("zzz", state);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
  });

  it("empty partial returns all verbs as suggestions", () => {
    const r = tabComplete("", state);
    assert.equal(r.suggestions.length, VERBS.length);
  });

  it("exact verb match still completes with trailing space", () => {
    const r = tabComplete("probe", state);
    assert.equal(r.completed, "probe ");
  });
});

// ── Status noun completion ────────────────────────────────

describe("tabComplete: status noun completion", () => {
  const state = makeState();

  it("unambiguous noun prefix completes", () => {
    const r = tabComplete("status ic", state);
    assert.equal(r.completed, "status ice ");
    assert.deepEqual(r.suggestions, []);
  });

  it("ambiguous noun prefix shows suggestions", () => {
    // "s" matches summary (only summary starts with s in STATUS_NOUNS)
    const r = tabComplete("status s", state);
    assert.equal(r.completed, "status summary ");
  });

  it("empty partial after status shows all nouns", () => {
    const r = tabComplete("status ", state);
    assert.ok(r.suggestions.length === 6); // summary ice hand node alert mission
  });
});

// ── Node completion ───────────────────────────────────────

describe("tabComplete: node completion", () => {
  const state = makeState({
    nodes: {
      gateway: makeNode("gateway", "Gateway"),
      "router-1": makeNode("router-1", "Router Alpha"),
      "ids-1": makeNode("ids-1", "IDS Primary"),
      hidden: makeNode("hidden", "Hidden Node", "hidden"),
    },
  });

  it("matches node by id prefix", () => {
    const r = tabComplete("select ga", state);
    assert.equal(r.completed, "select gateway ");
    assert.deepEqual(r.suggestions, []);
  });

  it("matches node by label prefix (case-insensitive)", () => {
    const r = tabComplete("select rou", state);
    assert.equal(r.completed, "select router-1 ");
  });

  it("hidden nodes are excluded", () => {
    const r = tabComplete("select hi", state);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
  });

  it("multiple matches show suggestions and complete to LCP", () => {
    // "router-1" and "ids-1" both visible, but different prefixes — test with shared prefix
    const state2 = makeState({
      nodes: {
        "router-a": makeNode("router-a", "Router A"),
        "router-b": makeNode("router-b", "Router B"),
      },
    });
    const r = tabComplete("select ro", state2);
    // LCP of ["router-a", "router-b"] = "router-"
    assert.equal(r.completed, "select router-");
    assert.ok(r.suggestions.includes("router-a"));
    assert.ok(r.suggestions.includes("router-b"));
  });

  it("probe, read, loot, reconfigure, reboot all complete nodes", () => {
    for (const verb of ["probe", "read", "loot", "reconfigure", "reboot"]) {
      const r = tabComplete(`${verb} ga`, state);
      assert.equal(r.completed, `${verb} gateway `);
    }
  });

  it("status node <id> completes the node id at position 3", () => {
    const r = tabComplete("status node ga", state);
    assert.equal(r.completed, "status node gateway ");
  });
});

// ── Card completion ───────────────────────────────────────

describe("tabComplete: card completion (exploit, implicit form)", () => {
  const hand = [
    makeCard("weak-auth-1", "AuthBrute Prime"),
    makeCard("stale-firmware-2", "SnmpWalker Zero"),
    makeCard("kernel-exploit-3", "RingZero X"),
  ];
  const state = makeState({
    selectedNodeId: "gateway",
    nodes: { gateway: makeNode("gateway", "Gateway") },
    hand,
  });

  it("completes card by name prefix", () => {
    const r = tabComplete("exploit Auth", state);
    assert.equal(r.completed, "exploit AuthBrute Prime ");
    assert.deepEqual(r.suggestions, []);
  });

  it("completes card by id prefix (new behavior)", () => {
    const r = tabComplete("exploit weak", state);
    assert.equal(r.completed, "exploit weak-auth-1 ");
    assert.deepEqual(r.suggestions, []);
  });

  it("id prefix completion takes priority over name match", () => {
    // "stale" matches the id "stale-firmware-2", not any name
    const r = tabComplete("exploit stale", state);
    assert.equal(r.completed, "exploit stale-firmware-2 ");
  });

  it("multiple id matches show id LCP and suggestions", () => {
    const hand2 = [
      makeCard("weak-auth-1", "AuthBrute Prime"),
      makeCard("weak-auth-5", "DefCred μ"),
    ];
    const state2 = makeState({ selectedNodeId: "gateway", nodes: {}, hand: hand2 });
    const r = tabComplete("exploit weak-auth-", state2);
    // LCP of ["weak-auth-1", "weak-auth-5"] = "weak-auth-"
    // partial = "weak-auth-", lcp = "weak-auth-" → same length → no improvement
    assert.equal(r.completed, null);
    assert.ok(r.suggestions.some(s => s.includes("weak-auth-1")));
    assert.ok(r.suggestions.some(s => s.includes("weak-auth-5")));
  });

  it("suggestions show id  name format", () => {
    const hand2 = [
      makeCard("weak-auth-1", "AuthBrute Prime"),
      makeCard("stale-firmware-2", "SnmpWalker Zero"),
    ];
    const state2 = makeState({ selectedNodeId: "gateway", nodes: {}, hand: hand2 });
    const r = tabComplete("exploit ", state2);
    // empty partial → all cards match; display shows "id  name"
    assert.ok(r.suggestions.some(s => s.includes("weak-auth-1") && s.includes("AuthBrute Prime")));
    assert.ok(r.suggestions.some(s => s.includes("stale-firmware-2") && s.includes("SnmpWalker Zero")));
  });

  it("disclosed cards are excluded from completion", () => {
    const hand2 = [
      makeCard("weak-auth-1", "AuthBrute Prime", "disclosed"),
      makeCard("stale-firmware-2", "SnmpWalker Zero"),
    ];
    const state2 = makeState({ selectedNodeId: "gateway", nodes: {}, hand: hand2 });
    const r = tabComplete("exploit weak", state2);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
  });

  it("without selected node, exploit completes nodes instead", () => {
    const state2 = makeState({
      selectedNodeId: null,
      nodes: { gateway: makeNode("gateway", "Gateway") },
      hand,
    });
    const r = tabComplete("exploit ga", state2);
    assert.equal(r.completed, "exploit gateway ");
  });
});

describe("tabComplete: card completion (exploit, explicit form)", () => {
  const hand = [
    makeCard("weak-auth-1", "AuthBrute Prime"),
    makeCard("stale-firmware-2", "SnmpWalker Zero"),
  ];
  const state = makeState({
    selectedNodeId: null,
    nodes: { gateway: makeNode("gateway", "Gateway") },
    hand,
  });

  it("3-token form completes the card by id prefix", () => {
    const r = tabComplete("exploit gateway stale", state);
    assert.equal(r.completed, "exploit gateway stale-firmware-2 ");
  });

  it("3-token form completes by name prefix", () => {
    const r = tabComplete("exploit gateway Auth", state);
    assert.equal(r.completed, "exploit gateway AuthBrute Prime ");
  });
});

// ── buy vuln-id completion ────────────────────────────────

describe("tabComplete: buy vuln-id completion", () => {
  const state = makeState();

  it("completes a unique vuln-id prefix", () => {
    const r = tabComplete("buy kernel", state);
    assert.equal(r.completed, "buy kernel-exploit ");
  });

  it("ambiguous prefix shows suggestions with vuln names", () => {
    // "un" matches "unpatched-ssh"
    const r = tabComplete("buy un", state);
    assert.equal(r.completed, "buy unpatched-ssh ");
  });

  it("empty partial shows all vuln ids", () => {
    const r = tabComplete("buy ", state);
    assert.ok(r.suggestions.length > 0);
    // suggestions include "id  Name" format
    assert.ok(r.suggestions.some(s => s.includes("unpatched-ssh")));
  });

  it("no match returns null", () => {
    const r = tabComplete("buy zzz", state);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
  });
});

// ── cheat sub-command completion ──────────────────────────

describe("tabComplete: cheat completion", () => {
  const nodes = {
    gateway: makeNode("gateway", "Gateway"),
    "ids-1": makeNode("ids-1", "IDS Primary"),
  };
  const state = makeState({ nodes });

  it("completes cheat sub-commands", () => {
    const r = tabComplete("cheat gi", state);
    assert.equal(r.completed, "cheat give ");
  });

  it("cheat give shows sub-commands", () => {
    const r = tabComplete("cheat give ", state);
    assert.ok(r.suggestions.includes("matching"));
    assert.ok(r.suggestions.includes("card"));
    assert.ok(r.suggestions.includes("cash"));
  });

  it("cheat give card completes rarities", () => {
    const r = tabComplete("cheat give card com", state);
    assert.equal(r.completed, "cheat give card common ");
  });

  it("cheat give matching completes nodes", () => {
    const r = tabComplete("cheat give matching ga", state);
    assert.equal(r.completed, "cheat give matching gateway ");
  });

  it("cheat set alert completes alert levels", () => {
    const r = tabComplete("cheat set alert gr", state);
    assert.equal(r.completed, "cheat set alert green ");
  });

  it("cheat own completes nodes", () => {
    const r = tabComplete("cheat own ga", state);
    assert.equal(r.completed, "cheat own gateway ");
  });

  it("cheat trace completes start/end", () => {
    const r = tabComplete("cheat trace ", state);
    assert.ok(r.suggestions.includes("start"));
    assert.ok(r.suggestions.includes("end"));
  });

  it("cheat summon-ice completes nodes", () => {
    const r = tabComplete("cheat summon-ice ga", state);
    assert.equal(r.completed, "cheat summon-ice gateway ");
  });
});
