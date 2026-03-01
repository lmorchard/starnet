// @ts-check
// Tests for gateAccess — neighbor reveal gating per node type.

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { NETWORK } from "../data/network.js";
import { initState, getState } from "../js/state.js";
import { clearAll } from "../js/timers.js";
import { getGateAccess } from "../js/node-types.js";
import { launchExploit } from "../js/combat.js";
import { handleProbeScanTimer } from "../js/probe-exec.js";
import { setNodeAccessLevel, setNodeVisible } from "../js/state/node.js";
import { initNodeLifecycle } from "../js/node-lifecycle.js";
import { on, off, E } from "../js/events.js";
import { RNG, _forceNext } from "../js/rng.js";

initNodeLifecycle();

// ── getGateAccess return values ─────────────────────────────────────────────

describe("getGateAccess returns correct values per type", () => {
  it('gateway defaults to "probed"', () => {
    assert.equal(getGateAccess({ type: "gateway", grade: "D" }), "probed");
  });
  it('workstation defaults to "probed"', () => {
    assert.equal(getGateAccess({ type: "workstation", grade: "C" }), "probed");
  });
  it('fileserver defaults to "probed"', () => {
    assert.equal(getGateAccess({ type: "fileserver", grade: "B" }), "probed");
  });
  it('cryptovault defaults to "probed"', () => {
    assert.equal(getGateAccess({ type: "cryptovault", grade: "S" }), "probed");
  });
  it('wan defaults to "probed"', () => {
    assert.equal(getGateAccess({ type: "wan", grade: "F" }), "probed");
  });
  it('router is "compromised"', () => {
    assert.equal(getGateAccess({ type: "router", grade: "C" }), "compromised");
  });
  it('firewall is "owned"', () => {
    assert.equal(getGateAccess({ type: "firewall", grade: "A" }), "owned");
  });
  it('ids is "owned"', () => {
    assert.equal(getGateAccess({ type: "ids", grade: "C" }), "owned");
  });
  it('security-monitor is "owned"', () => {
    assert.equal(getGateAccess({ type: "security-monitor", grade: "B" }), "owned");
  });
});

// ── Probe-triggered reveal ──────────────────────────────────────────────────

describe("Probe reveals neighbors for probed-gated nodes", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
  });

  it("probing gateway reveals its hidden neighbors", () => {
    const s = getState();
    // Gateway neighbors (excluding WAN which starts accessible)
    const neighbors = (s.adjacency["gateway"] || []).filter(
      (nid) => s.nodes[nid]?.type !== "wan"
    );
    // Precondition: neighbors are hidden
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "hidden", `${nid} should start hidden`);
    }

    // Simulate probe completion
    handleProbeScanTimer({ nodeId: "gateway" });

    // Neighbors should now be revealed
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "revealed",
        `${nid} should be revealed after probing gateway`);
    }
  });
});

describe("Probe does NOT reveal neighbors for gated nodes", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
    // Make firewall accessible so it can be probed
    const s = getState();
    setNodeVisible("firewall", "accessible");
  });

  it("probing firewall (owned-gated) does not reveal hidden neighbors", () => {
    const s = getState();
    const neighbors = (s.adjacency["firewall"] || []).filter(
      (nid) => s.nodes[nid].visibility === "hidden"
    );
    assert.ok(neighbors.length > 0, "firewall should have hidden neighbors");

    handleProbeScanTimer({ nodeId: "firewall" });

    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "hidden",
        `${nid} should remain hidden after probing owned-gated firewall`);
    }
  });

  it("probing router (compromised-gated) does not reveal hidden neighbors", () => {
    const s = getState();
    setNodeVisible("router-a", "accessible");
    const neighbors = (s.adjacency["router-a"] || []).filter(
      (nid) => s.nodes[nid].visibility === "hidden"
    );
    assert.ok(neighbors.length > 0, "router-a should have hidden neighbors");

    handleProbeScanTimer({ nodeId: "router-a" });

    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "hidden",
        `${nid} should remain hidden after probing compromised-gated router`);
    }
  });
});

// ── Exploit-triggered reveal ────────────────────────────────────────────────

describe("Exploit reveals neighbors at correct gate levels", () => {
  beforeEach(() => {
    clearAll();
    initState(NETWORK);
  });

  it("exploiting router (compromised-gated) locked→compromised reveals neighbors", () => {
    const s = getState();
    setNodeVisible("router-a", "accessible");
    const neighbors = (s.adjacency["router-a"] || []).filter(
      (nid) => s.nodes[nid].visibility === "hidden"
    );
    assert.ok(neighbors.length > 0, "router-a should have hidden neighbors");

    // Force combat roll to succeed + flavor pick
    _forceNext(RNG.COMBAT, 0);
    _forceNext(RNG.COMBAT, 0);
    launchExploit("router-a", s.player.hand[0].id);

    assert.equal(s.nodes["router-a"].accessLevel, "compromised");
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "revealed",
        `${nid} should be revealed after compromising router`);
    }
  });

  it("exploiting firewall (owned-gated) locked→compromised does NOT reveal neighbors", () => {
    const s = getState();
    setNodeVisible("firewall", "accessible");
    const neighbors = (s.adjacency["firewall"] || []).filter(
      (nid) => s.nodes[nid].visibility === "hidden"
    );
    assert.ok(neighbors.length > 0, "firewall should have hidden neighbors");

    _forceNext(RNG.COMBAT, 0);
    _forceNext(RNG.COMBAT, 0);
    launchExploit("firewall", s.player.hand[0].id);

    assert.equal(s.nodes["firewall"].accessLevel, "compromised");
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "hidden",
        `${nid} should remain hidden after compromising owned-gated firewall`);
    }
  });

  it("exploiting firewall (owned-gated) compromised→owned reveals neighbors", () => {
    const s = getState();
    setNodeVisible("firewall", "accessible");
    setNodeAccessLevel("firewall", "compromised");

    const neighbors = (s.adjacency["firewall"] || []).filter(
      (nid) => s.nodes[nid].visibility === "hidden"
    );
    assert.ok(neighbors.length > 0, "firewall should have hidden neighbors");

    _forceNext(RNG.COMBAT, 0);
    _forceNext(RNG.COMBAT, 0);
    launchExploit("firewall", s.player.hand[0].id);

    assert.equal(s.nodes["firewall"].accessLevel, "owned");
    for (const nid of neighbors) {
      assert.equal(s.nodes[nid].visibility, "revealed",
        `${nid} should be revealed after owning firewall`);
    }
  });
});
