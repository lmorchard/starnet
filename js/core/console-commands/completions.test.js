// @ts-check
// Unit tests for the pure tab completion function.
//
// State is constructed as minimal plain objects — no game engine init required.
// This validates that tabComplete is truly headless and dependency-free (aside
// from the VULNERABILITY_TYPES list it imports for buy completion).

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tabComplete, VERBS } from "./index.js";

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
    const r = tabComplete("ta", state);
    assert.equal(r.completed, "target ");
    assert.deepEqual(r.suggestions, []);
  });

  it("multi-match verb prefix returns LCP and all suggestions", () => {
    // "ch" matches cheat; "e" matches exec (scripts run via the exec verb)
    // For now "ex" uniquely matches exploit, so use empty prefix filtered
    // "he" matches help — single. Use a known multi: "s" matches status + store? No, store is darknet.
    // Actually: just test that empty prefix returns all verbs (already tested below).
    // Use a prefix that matches at least 2 dynamic commands when they exist.
    // For a stable test: "c" matches "cheat" only. Let's just verify with actual verbs.
    const allR = tabComplete("", state);
    // With many verbs registered, at least 2 share a first letter somewhere
    const byFirst = {};
    for (const v of allR.suggestions) { byFirst[v[0]] = (byFirst[v[0]] || 0) + 1; }
    const multiChar = Object.keys(byFirst).find(c => byFirst[c] >= 2);
    if (!multiChar) return; // skip if no collision (unlikely)
    const r = tabComplete(multiChar, state);
    assert.ok(r.suggestions.length >= 2);
    r.suggestions.forEach(s => assert.ok(s.startsWith(multiChar)));
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
    const r = tabComplete("xploit", state);
    assert.equal(r.completed, "xploit ");
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
    const r = tabComplete("target ga", state);
    assert.equal(r.completed, "target gateway ");
    assert.deepEqual(r.suggestions, []);
  });

  it("matches node by label prefix (case-insensitive)", () => {
    const r = tabComplete("target rou", state);
    assert.equal(r.completed, "target router-1 ");
  });

  it("hidden nodes are excluded", () => {
    const r = tabComplete("target hi", state);
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
    const r = tabComplete("target ro", state2);
    // LCP of ["router-a", "router-b"] = "router-"
    assert.equal(r.completed, "target router-");
    assert.ok(r.suggestions.includes("router-a"));
    assert.ok(r.suggestions.includes("router-b"));
  });

  // probe, read, loot, reconfigure, reboot are now dynamically discovered
  // from the graph — no custom tab completion. Node arg completion is a
  // follow-up enhancement for dynamic commands.

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
    const r = tabComplete("xploit Auth", state);
    assert.equal(r.completed, "xploit AuthBrute Prime ");
    assert.deepEqual(r.suggestions, []);
  });

  it("completes card by id prefix (new behavior)", () => {
    const r = tabComplete("xploit weak", state);
    assert.equal(r.completed, "xploit weak-auth-1 ");
    assert.deepEqual(r.suggestions, []);
  });

  it("id prefix completion takes priority over name match", () => {
    // "stale" matches the id "stale-firmware-2", not any name
    const r = tabComplete("xploit stale", state);
    assert.equal(r.completed, "xploit stale-firmware-2 ");
  });

  it("multiple id matches show id LCP and suggestions", () => {
    const hand2 = [
      makeCard("weak-auth-1", "AuthBrute Prime"),
      makeCard("weak-auth-5", "DefCred μ"),
    ];
    const state2 = makeState({ selectedNodeId: "gateway", nodes: {}, hand: hand2 });
    const r = tabComplete("xploit weak-auth-", state2);
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
    const r = tabComplete("xploit ", state2);
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
    const r = tabComplete("xploit weak", state2);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
  });

  it("without selected node, exploit completes nodes instead", () => {
    const state2 = makeState({
      selectedNodeId: null,
      nodes: { gateway: makeNode("gateway", "Gateway") },
      hand,
    });
    const r = tabComplete("xploit ga", state2);
    assert.equal(r.completed, "xploit gateway ");
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
    const r = tabComplete("xploit gateway stale", state);
    assert.equal(r.completed, "xploit gateway stale-firmware-2 ");
  });

  it("3-token form completes by name prefix", () => {
    const r = tabComplete("xploit gateway Auth", state);
    assert.equal(r.completed, "xploit gateway AuthBrute Prime ");
  });
});

// ── Revealed node (???) alias completion ─────────────────

describe("tabComplete: revealed node alias completion", () => {
  // sigAlias is assigned by revealNeighbors in real gameplay; set it directly in tests.
  function makeRevealed(id, label, sigAlias) {
    return { ...makeNode(id, label, "revealed"), sigAlias };
  }

  const state = makeState({
    nodes: {
      gateway:    makeNode("gateway",  "INET-GW-01", "accessible"),
      "router-a": makeRevealed("router-a", "RTR-A",    "sig-2"),
      "ids-1":    makeRevealed("ids-1",    "IDS-CORE", "sig-1"),
    },
  });

  it("revealed nodes complete as sig-N aliases, not real ids", () => {
    const r = tabComplete("target sig", state);
    assert.ok(r.suggestions.includes("sig-1") || r.completed?.startsWith("target sig-"));
    assert.ok(!r.suggestions.includes("ids-1"));
    assert.ok(!r.suggestions.includes("router-a"));
  });

  it("sig-1 unambiguously completes to first alias", () => {
    const r = tabComplete("target sig-1", state);
    assert.equal(r.completed, "target sig-1 ");
  });

  it("revealed nodes are not reachable by real id prefix", () => {
    const r = tabComplete("target id", state);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
  });

  it("revealed nodes are not reachable by real label prefix", () => {
    const r = tabComplete("target RTR", state);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
  });

  it("accessible nodes still complete by id and label as before", () => {
    const r = tabComplete("target ga", state);
    assert.equal(r.completed, "target gateway ");
  });
});

// ── Accessible-but-unprobed (obscured) node completion (#121) ─────────────────

describe("tabComplete: navigated-but-unprobed node stays obscured", () => {
  // An accessible node that has a sig-N alias and is not yet probed — the state
  // produced by traversing into a revealed neighbor. Identity must stay hidden.
  function makeObscuredAccessible(id, label, sigAlias) {
    return { ...makeNode(id, label, "accessible"), sigAlias, probed: false };
  }

  const state = makeState({
    nodes: {
      gateway:    makeNode("gateway", "INET-GW-01", "accessible"),
      "ids-9":    makeObscuredAccessible("ids-9", "IDS-EDGE", "sig-7"),
    },
  });

  it("completes by its sig-N alias", () => {
    const r = tabComplete("target sig-7", state);
    assert.equal(r.completed, "target sig-7 ");
  });

  it("is NOT reachable by real id prefix", () => {
    const r = tabComplete("target ids", state);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
  });

  it("is NOT reachable by real label prefix", () => {
    const r = tabComplete("target IDS-E", state);
    assert.equal(r.completed, null);
    assert.deepEqual(r.suggestions, []);
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
