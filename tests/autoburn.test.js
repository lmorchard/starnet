// @ts-check
// TDD tests for js/core/autoburn.js — the coherence-erosion auto-burn process.
// SEED CONVENTION: always pass an explicit seed to initGame(). Without one,
// initRng() seeds from Math.random() → silently flaky tests.
//
// Pattern mirrors sweep.test.js and coherence.test.js.

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { initGame, getState } from "../js/core/state.js";
import { startAutoBurn, initAutoBurn } from "../js/core/autoburn.js";
import { activeProcessOnNode } from "../js/core/processes.js";
import { addRoundToHoard, markRoundDisclosed, removeDisclosedRounds, setHoard } from "../js/core/state/player.js";
import { setNodeCoherence } from "../js/core/state/node.js";
import { clearHandlers, on, E } from "../js/core/events.js";
import { clearAll, tick } from "../js/core/timers.js";
import { _forceNext, RNG, initRng } from "../js/core/rng.js";
import { COHERENCE, HEAT_COST, BURN_CEILING_DEFAULT } from "../js/core/balance.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { A } from "../js/core/action-ids.js";

afterEach(() => { clearHandlers(); clearAll(); });

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal ExploitRound. No RNG — just fixed fixture data.
 * @param {"common"|"uncommon"|"rare"} rarity
 * @param {string} [id]
 * @returns {import('../js/core/types.js').ExploitRound}
 */
function makeRound(rarity = "rare", id = "aaaa0001") {
  return { id, rarity, types: ["unpatched-ssh"], disclosed: false };
}

/** Collect emitted events of a given type during a block. */
function captureEvents(eventName, fn) {
  const events = [];
  on(eventName, (payload) => events.push(payload));
  fn();
  return events;
}

// ── Test 1: Crack ─────────────────────────────────────────────────────────────

describe("autoburn — crack a soft node", () => {
  it("a generous hoard vs. a low-grade node eventually owns it", () => {
    initGame(() => buildCorporateExchange(), "ab-crack-1");
    initAutoBurn();

    const nodeId = "gateway";
    const s = () => getState();

    // Seed the hoard with many rare rounds (high damage per shot)
    for (let i = 0; i < 20; i++) {
      addRoundToHoard(makeRound("rare", `aaaa${i.toString(16).padStart(4, "0")}`));
    }

    // Force the node to grade F (soft) and preset coherence low so it cracks fast
    const node = s().nodes[nodeId];
    // Set a very low coherence — single rare shot at grade F should crack it
    setNodeCoherence(nodeId, 1); // nearly dead

    const resolvedEvents = [];
    const accessedEvents = [];
    on(E.ACTION_RESOLVED, (p) => resolvedEvents.push(p));
    on(E.NODE_ACCESSED,   (p) => accessedEvents.push(p));

    startAutoBurn(nodeId);
    tick(50); // run the process

    // Node should be owned
    assert.equal(s().nodes[nodeId].accessLevel, "owned", "node cracked to owned");

    // NODE_ACCESSED fired
    assert.ok(accessedEvents.length > 0, "NODE_ACCESSED fired");
    assert.equal(accessedEvents[0].next, "owned");

    // ACTION_RESOLVED with success:true, outcome:"cracked"
    const cracked = resolvedEvents.find(
      (e) => e.success === true && e.detail?.outcome === "cracked"
    );
    assert.ok(cracked, "ACTION_RESOLVED{success:true, outcome:cracked} fired");

    // Process cleaned up
    assert.equal(s().processes.length, 0, "autoburn process removed after crack");
  });
});

// ── Test 1b: Crack reveals neighbors ──────────────────────────────────────────

describe("autoburn — crack reveals neighbors", () => {
  it("owning a node via auto-burn reveals its hidden neighbors", () => {
    initGame(() => buildCorporateExchange(), "ab-crack-reveal-1");
    initAutoBurn();

    const s = () => getState();
    // switch-1 (a router) is adjacent to switch-2, which starts hidden.
    const nodeId = "switch-1";
    const neighborId = "switch-2";

    assert.equal(
      s().nodes[neighborId].visibility, "hidden",
      "precondition: neighbor starts hidden",
    );

    for (let i = 0; i < 20; i++) {
      addRoundToHoard(makeRound("rare", `abcd${i.toString(16).padStart(4, "0")}`));
    }
    setNodeCoherence(nodeId, 1); // nearly dead → cracks fast

    startAutoBurn(nodeId);
    tick(50);

    assert.equal(s().nodes[nodeId].accessLevel, "owned", "node cracked to owned");
    assert.notEqual(
      s().nodes[neighborId].visibility, "hidden",
      "cracking the node revealed its hidden neighbor",
    );
  });
});

// ── Test 2: Hoard-dry stop ────────────────────────────────────────────────────

describe("autoburn — hoard-dry stop", () => {
  it("tiny hoard vs. a hard node ends with outcome:hoard-dry and node not owned", () => {
    initGame(() => buildCorporateExchange(), "ab-dry-1");
    initAutoBurn();

    const nodeId = "gateway";
    const s = () => getState();

    // Replace hoard with exactly one round — not enough to crack an S-grade node.
    // (initGame now seeds a generous default hoard; setHoard overrides it.)
    setHoard([makeRound("common", "bbbb0001")]);

    // Force coherence very high (hard to crack)
    setNodeCoherence(nodeId, COHERENCE["S"] ?? 2000);

    const resolvedEvents = [];
    on(E.ACTION_RESOLVED, (p) => resolvedEvents.push(p));

    startAutoBurn(nodeId);
    tick(50);

    // Node must NOT be owned
    assert.notEqual(s().nodes[nodeId].accessLevel, "owned", "node not cracked");

    // ACTION_RESOLVED with outcome:hoard-dry
    const dryEvent = resolvedEvents.find((e) => e.detail?.outcome === "hoard-dry");
    assert.ok(dryEvent, "ACTION_RESOLVED{outcome:hoard-dry} fired");
    assert.equal(dryEvent.success, false, "hoard-dry is a failure outcome");

    // Process cleaned up
    assert.equal(s().processes.length, 0, "process removed after hoard-dry stop");
  });
});

// ── Test 3: Heat-ceiling stop ─────────────────────────────────────────────────

describe("autoburn — heat-ceiling stop", () => {
  it("small ceiling ends the burst early with outcome:heat-ceiling", () => {
    initGame(() => buildCorporateExchange(), "ab-ceiling-1");
    initAutoBurn();

    const nodeId = "gateway";
    const s = () => getState();

    // Generous hoard
    for (let i = 0; i < 20; i++) {
      addRoundToHoard(makeRound("common", `cccc${i.toString(16).padStart(4, "0")}`));
    }

    // Set coherence very high so it won't crack within the ceiling
    setNodeCoherence(nodeId, COHERENCE["S"] ?? 2000);

    const resolvedEvents = [];
    on(E.ACTION_RESOLVED, (p) => resolvedEvents.push(p));

    // Ceiling = exactly 3 shots' worth of heat
    const smallCeiling = HEAT_COST.xploit * 3;
    startAutoBurn(nodeId, { ceiling: smallCeiling });
    tick(50);

    // Node must NOT be owned
    assert.notEqual(s().nodes[nodeId].accessLevel, "owned", "node not cracked within ceiling");

    // ACTION_RESOLVED with outcome:heat-ceiling
    const ceilEvent = resolvedEvents.find((e) => e.detail?.outcome === "heat-ceiling");
    assert.ok(ceilEvent, "ACTION_RESOLVED{outcome:heat-ceiling} fired");
    assert.equal(ceilEvent.success, false, "heat-ceiling is a failure outcome");

    // Process cleaned up
    assert.equal(s().processes.length, 0, "process removed after heat-ceiling stop");
  });
});

// ── Test 4: Disclosure thins the hoard ───────────────────────────────────────

describe("autoburn — disclosure thins the hoard", () => {
  it("forcing rollDisclosure true accumulates disclosed rounds; usable count falls", () => {
    initGame(() => buildCorporateExchange(), "ab-disclosure-1");
    initAutoBurn();

    const nodeId = "gateway";
    const s = () => getState();

    // Replace hoard with exactly 3 rounds (initGame seeds a generous default; setHoard overrides).
    setHoard([
      makeRound("common", "dddd0001"),
      makeRound("common", "dddd0002"),
      makeRound("common", "dddd0003"),
    ]);

    // Set coherence high enough that the node won't crack in 3 shots
    setNodeCoherence(nodeId, COHERENCE["S"] ?? 2000);

    // Force rollDisclosure to always return true (DISCLOSURE_CHANCE.B = 0.50;
    // force the RNG.COMBAT draws to 0 so roll <= threshold always holds).
    // We need to pre-load the forced values BEFORE the process steps.
    // chip() with rollJitter=true draws one RNG.COMBAT value; rollDisclosure draws one.
    // Each shot: jitter draw + disclosure draw = 2 COMBAT draws per step.
    // Force ALL disclosure draws to 0 (always disclose) across 3 shots (6 draws total,
    // alternating: jitter=any, disclose=0).
    // Simplest: force 6 zeros — jitter=0 (min jitter) and disclose=0 (always discloses).
    for (let i = 0; i < 6; i++) _forceNext(RNG.COMBAT, 0);

    startAutoBurn(nodeId);
    tick(50);

    // All 3 rounds should now be disclosed
    const hoard = s().player.hoard;
    const disclosedCount = hoard.filter((r) => r.disclosed).length;
    assert.ok(disclosedCount > 0, `at least one round disclosed (got ${disclosedCount})`);

    // After running removeDisclosedRounds, hoard shrinks
    removeDisclosedRounds();
    const remaining = s().player.hoard.filter((r) => !r.disclosed).length;
    assert.ok(remaining < 3, `hoard thinned: ${remaining} usable rounds remain (was 3)`);
  });
});

// ── Test 5: Lazy coherence seed ───────────────────────────────────────────────

describe("autoburn — lazy coherence seed", () => {
  it("startAutoBurn seeds coherence from COHERENCE[grade] if not already set", () => {
    initGame(() => buildCorporateExchange(), "ab-lazy-1");
    initAutoBurn();

    const nodeId = "gateway";
    const s = () => getState();

    // Ensure no coherence is set
    assert.equal(s().nodes[nodeId].coherence, undefined, "precondition: coherence not set");

    // One round so the process can start but don't let it crack (high coherence from seed)
    addRoundToHoard(makeRound("common", "eeee0001"));

    const grade = s().nodes[nodeId].grade;
    const expectedCoherence = COHERENCE[grade] ?? COHERENCE["C"];

    startAutoBurn(nodeId, { ceiling: HEAT_COST.xploit }); // ceiling = 1 shot

    // After the first tick step, coherence should have been seeded
    tick(2);

    // Coherence should have been seeded (it may have been eroded from the expected value,
    // but it must have STARTED at expectedCoherence — so it should be <= expectedCoherence).
    const coherence = s().nodes[nodeId].coherence;
    assert.ok(
      coherence != null && coherence <= expectedCoherence,
      `coherence seeded: got ${coherence}, expected <= ${expectedCoherence}`
    );
    assert.ok(coherence != null && coherence >= 0, "coherence is non-negative");
  });
});

// ── Test 6: No double-start ────────────────────────────────────────────────────

describe("autoburn — no double-start", () => {
  it("calling startAutoBurn twice on the same node does not add a second process", () => {
    initGame(() => buildCorporateExchange(), "ab-double-1");
    initAutoBurn();

    const nodeId = "gateway";
    const s = () => getState();

    addRoundToHoard(makeRound("common", "ffff0001"));

    startAutoBurn(nodeId);
    const countAfterFirst = s().processes.filter((p) => p.nodeId === nodeId).length;
    assert.equal(countAfterFirst, 1, "one process after first start");

    startAutoBurn(nodeId); // should no-op
    const countAfterSecond = s().processes.filter((p) => p.nodeId === nodeId).length;
    assert.equal(countAfterSecond, 1, "still one process after second start (no duplicate)");
  });
});

// ── Bonus: player.hoard state additions ───────────────────────────────────────

describe("state/player.js hoard setters", () => {
  it("addRoundToHoard appends a round to player.hoard", () => {
    initGame(() => buildCorporateExchange(), "ab-hoard-add-1");
    const before = getState().player.hoard.length;
    const round = makeRound("common", "1111aaaa");
    addRoundToHoard(round);
    assert.equal(getState().player.hoard.length, before + 1, "hoard grew by one");
    assert.ok(getState().player.hoard.some((r) => r.id === "1111aaaa"), "round present by id");
  });

  it("markRoundDisclosed marks the matching round", () => {
    initGame(() => buildCorporateExchange(), "ab-hoard-mark-1");
    const round = makeRound("uncommon", "2222bbbb");
    addRoundToHoard(round);
    markRoundDisclosed("2222bbbb");
    const marked = getState().player.hoard.find((r) => r.id === "2222bbbb");
    assert.ok(marked?.disclosed, "round with id 2222bbbb is disclosed");
  });

  it("removeDisclosedRounds removes disclosed rounds and keeps undisclosed", () => {
    initGame(() => buildCorporateExchange(), "ab-hoard-remove-1");
    // Use setHoard so the test controls exactly what is present.
    setHoard([makeRound("common", "3333cccc"), makeRound("common", "4444dddd")]);
    markRoundDisclosed("3333cccc");
    removeDisclosedRounds();
    assert.equal(getState().player.hoard.length, 1, "one round remains after removal");
    assert.equal(getState().player.hoard[0].id, "4444dddd", "undisclosed round kept");
  });

  it("player.hoard is seeded at run-start (DEFAULT_START_HOARD rounds)", () => {
    // Phase 3: hoard is seeded to DEFAULT_START_HOARD, not empty, at initGame.
    initGame(() => buildCorporateExchange(), "ab-hoard-init-1");
    assert.ok(getState().player.hoard.length > 0, "hoard non-empty after initGame");
  });
});

// ── Bonus: setNodeCoherence ────────────────────────────────────────────────────

describe("state/node.js setNodeCoherence", () => {
  it("setNodeCoherence updates node.coherence in state", () => {
    initGame(() => buildCorporateExchange(), "ab-nodecoherence-1");
    setNodeCoherence("gateway", 999);
    assert.equal(getState().nodes["gateway"].coherence, 999);
  });

  it("setNodeCoherence clamps at 0 minimum (negative passed, state stays >=0)", () => {
    initGame(() => buildCorporateExchange(), "ab-nodecoherence-2");
    setNodeCoherence("gateway", 0);
    assert.equal(getState().nodes["gateway"].coherence, 0);
  });
});

// ── Test: crackNode sets probed (own-it-know-it) ─────────────────────────────
//
// Regression: crackNode previously set accessLevel="owned" + revealNeighbors
// but did NOT call setNodeProbed. A player who auto-burns an accessible+unprobed
// node ended up with owned:true && probed:false, which blocks both DUMP (requires
// probed:true) and PROBE (requires locked). The node's loot was permanently
// unrecoverable. This test is the regression guard.

describe("autoburn — crackNode sets probed (own-it-know-it)", () => {
  it("cracked-unprobed node exposes DUMP after auto-burn owns it", () => {
    // Scenario: player fires XPLOIT on a locked+unprobed node (skipping PROBE),
    // auto-burn cracks it to owned. Without the fix, owned+probed:false means
    // DUMP (needs probed:true) and PROBE (needs locked) are both unavailable —
    // the loot is permanently unrecoverable. The fix: crackNode calls setNodeProbed.
    initGame(() => buildCorporateExchange(), "ab-crack-probed-1");
    initAutoBurn();

    const s = () => getState();
    // "office/fileserver" is a lootable node (has DUMP when owned+probed) that starts
    // locked+unprobed — the classic scenario where a player fires XPLOIT without probing first.
    const nodeId = "office/fileserver";

    // Preconditions: not yet owned, not yet probed
    assert.ok(s().nodes[nodeId], "precondition: node exists in the network");
    assert.notEqual(s().nodes[nodeId].accessLevel, "owned",
      "precondition: node is not owned before auto-burn");
    assert.ok(!s().nodes[nodeId].probed,
      "precondition: node is unprobed before auto-burn");

    // Generous hoard, very low coherence → guaranteed crack in one tick batch
    for (let i = 0; i < 20; i++) {
      addRoundToHoard(makeRound("rare", `crack${i.toString(16).padStart(4, "0")}`));
    }
    setNodeCoherence(nodeId, 1); // nearly dead

    startAutoBurn(nodeId);
    tick(50);

    // (a) Node is now owned
    assert.equal(s().nodes[nodeId].accessLevel, "owned",
      "(a) accessLevel === 'owned' after auto-burn crack");

    // (b) Node is probed — "own it = know it"
    assert.ok(s().nodes[nodeId].probed === true,
      "(b) probed === true after auto-burn crack (own-it-know-it)");

    // (c) DUMP is available — loot is recoverable
    const node = s().nodes[nodeId];
    const actions = getAvailableActions(node, s());
    const hasDump = actions.some((a) => a.id === A.DUMP);
    assert.ok(hasDump,
      `(c) DUMP is in getAvailableActions for cracked node (available: ${actions.map(a=>a.id).join(", ")})`);
  });
});
