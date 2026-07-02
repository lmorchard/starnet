// @ts-check
// #187 Phase 5 — proof slice: convert three previously-instant actions to timed ones,
// exercising the full Phase 1-4 chain (declarable `timed` → synthesis → arm/tick/complete,
// unified abortable busy/abort, generic default overlay/drone/cue) on real gameplay verbs
// rather than a synthetic test fixture.
//
//   - `corrupt` (core verb, RECONFIGURE_ACTION in action-templates.js): trait-supplied via
//     the `detectable` trait, shared by reference across every IDS node — exercises the
//     Phase-1 new-object-per-node synthesis and the durationTable branch (previously
//     untested in a real-action context, only via the bare-operator/synthetic-fixture tests).
//   - `crack-vault` / `extract-key` (set-piece verbs, data/biomes/corporate-pieces/scattered.js):
//     inline ActionDefs on hand-authored puzzle nodes — exercises a flat `duration` and proves
//     "duds" (instant, feedback-less puzzle payouts) now get the generic-process overlay/drone/
//     completion cue via the layered feedback-profile fallback.
//
// Real gameplay setups are used throughout (initGame + node-factories / the actual exported
// set-piece defs), not a synthetic fixture — per the "node graph / set-piece test honesty"
// testing practice, intermediate state is only ever set up-front (never reset mid-scenario),
// and completion is asserted via the observable consequence (forwardingEnabled, cash, quality),
// not an intermediate flag.

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { NodeGraph } from "../js/core/node-graph/runtime.js";
import { mockCtx } from "../js/core/node-graph/ctx.js";
import { createGateway, createIDS } from "../js/core/node-graph/node-factories.js";
import { buildMiniNetwork } from "../js/core/node-graph/mini-network.js";
import { initGame, getState } from "../js/core/state.js";
import { emitEvent, on, off, E, clearHandlers } from "../js/core/events.js";
import { initNavigationCancelHandler } from "../js/core/node-graph/game-ctx.js";
import { A } from "../js/core/action-ids.js";
import { timedActiveAttr, getTimedActionAttrNames } from "../js/core/node-graph/timed-actions.js";
import { resolveFeedback, DEFAULT_PROFILE } from "../js/ui/feedback-profiles.js";
import { scatteredLock1, scatteredEncryptedVault2 } from "../data/biomes/corporate-pieces/scattered.js";

/** Capture ACTION_FEEDBACK "cancel" payloads fired during fn(). */
function withCancelFeedback(fn) {
  /** @type {any[]} */
  const cancels = [];
  const h = (p) => { if (p?.phase === "cancel") cancels.push(p); };
  on(E.ACTION_FEEDBACK, h);
  fn();
  off(E.ACTION_FEEDBACK, h);
  return cancels;
}

function buildTwoIdsLAN() {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createIDS("ids-1"),
        createIDS("ids-2"),
      ],
      edges: [["gateway", "ids-1"], ["gateway", "ids-2"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 0, moneyCost: "F" },
  };
}

function buildOneIdsLAN() {
  return {
    graphDef: {
      nodes: [
        createGateway("gateway", { attributes: { visibility: "accessible" } }),
        createIDS("ids-1"),
      ],
      edges: [["gateway", "ids-1"]],
      triggers: [],
    },
    meta: { startNode: "gateway", startCash: 0, moneyCost: "F" },
  };
}

/** The real scatteredLock1 (n=1) set-piece, unprefixed via buildMiniNetwork (no instantiate()) —
 * node/quality names stay exactly as authored: "switch-a", "gate", "vault", "locks-opened". */
function buildLockLAN() {
  return buildMiniNetwork({
    nodes: scatteredLock1.nodes,
    edges: scatteredLock1.internalEdges,
    triggers: scatteredLock1.triggers,
  });
}

/** The real scatteredEncryptedVault2 (n=2) set-piece, unprefixed — "key-gen-1"/"key-gen-2"/"vault". */
function buildKeyVaultLAN() {
  return buildMiniNetwork({
    nodes: scatteredEncryptedVault2.nodes,
    edges: scatteredEncryptedVault2.internalEdges,
    triggers: scatteredEncryptedVault2.triggers,
  });
}

describe("corrupt (#187 Phase 5): timed IDS subversion", () => {
  before(() => { clearHandlers(); initNavigationCancelHandler(); });

  it("does not disable forwarding on dispatch — only arms", () => {
    initGame(buildOneIdsLAN, "corrupt-arm");
    const graph = getState().nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");

    graph.executeAction("ids-1", A.CORRUPT);

    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, true, "forwarding untouched at dispatch");
    assert.equal(getState().nodes["ids-1"].forwardingEnabled, true, "game state mirrors the graph");
    assert.equal(graph.getNodeState("ids-1")[timedActiveAttr(A.CORRUPT)], true, "arm flag set");
  });

  it("completes at the grade-scaled duration, disabling forwarding and firing reconfigureNode/ACTION_RESOLVED exactly once", () => {
    initGame(buildOneIdsLAN, "corrupt-complete");
    const graph = getState().nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");
    assert.equal(graph.getNodeState("ids-1").grade, "C", "default IDS grade is C (durationTable C:15)");

    /** @type {any[]} */
    const resolved = [];
    on(E.ACTION_RESOLVED, (p) => { if (p.action === A.CORRUPT) resolved.push(p); });

    graph.executeAction("ids-1", A.CORRUPT);
    graph.tick(16); // 1 tick to resolve duration from the grade table + 15 progress ticks (grade C)

    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, false, "forwarding disabled on completion");
    assert.equal(resolved.length, 1, "ACTION_RESOLVED fires exactly once");
    assert.equal(resolved[0].nodeId, "ids-1");
  });

  it("durationTable branch: a C-grade IDS completes at exactly 15 progress ticks (16 total with the resolve tick)", () => {
    initGame(buildOneIdsLAN, "corrupt-duration-table");
    const graph = getState().nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");
    const { durationAttr } = getTimedActionAttrNames(A.CORRUPT);

    graph.executeAction("ids-1", A.CORRUPT);
    graph.tick(1); // resolves duration from the grade table
    assert.equal(graph.getNodeState("ids-1")[durationAttr], 15, "duration resolved from durationTable[C]");
    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, true, "not complete yet");

    graph.tick(14); // 14 of 15 progress ticks
    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, true, "still one tick short of completion");

    graph.tick(1); // the 15th progress tick completes it
    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, false, "completes at exactly 15 progress ticks");
  });

  it("mid-action ABORT cancels the subversion — forwarding stays enabled, no reconfigure", () => {
    initGame(buildOneIdsLAN, "corrupt-abort");
    const graph = getState().nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");

    graph.executeAction("ids-1", A.CORRUPT);
    graph.tick(5); // partway through

    const cancels = withCancelFeedback(() => graph.executeAction("ids-1", A.ABORT));

    assert.equal(cancels.length, 1, "exactly one cancel feedback");
    assert.equal(cancels[0].nodeId, "ids-1");
    assert.equal(cancels[0].action, A.CORRUPT);
    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, true, "forwarding untouched by an aborted corrupt");
    assert.equal(graph.getNodeState("ids-1")[timedActiveAttr(A.CORRUPT)], false, "arm flag cleared");

    // Ticking further must not complete a cancelled action.
    graph.tick(20);
    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, true, "still untouched after further ticks");
  });

  it("PLAYER_NAVIGATED cancels an in-progress corrupt — forwarding stays enabled", () => {
    initGame(buildOneIdsLAN, "corrupt-nav-cancel");
    const graph = getState().nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");

    graph.executeAction("ids-1", A.CORRUPT);
    graph.tick(3);

    const cancels = withCancelFeedback(() => emitEvent(E.PLAYER_NAVIGATED, {}));

    assert.equal(cancels.length, 1, "exactly one cancel feedback");
    assert.equal(cancels[0].action, A.CORRUPT);
    assert.equal(graph.getNodeState("ids-1").forwardingEnabled, true, "nav-away cancels the subversion");
  });

  it("shared-trait synthesis: a two-IDS network gets its OWN synthesized corrupt operator on BOTH nodes", () => {
    // Bare NodeGraph, no initGame needed — this is pure trait/synthesis wiring, the same
    // level as tests/timed-synthesis.test.js's idempotency check.
    const graph = new NodeGraph(
      { nodes: [createGateway("gateway"), createIDS("ids-1"), createIDS("ids-2")], edges: [] },
      mockCtx(),
    );
    const ids1 = /** @type {any} */ (graph)._nodes.get("ids-1");
    const ids2 = /** @type {any} */ (graph)._nodes.get("ids-2");

    const op1 = ids1.operators.find((o) => o.name === "timed-action" && o.action === A.CORRUPT);
    const op2 = ids2.operators.find((o) => o.name === "timed-action" && o.action === A.CORRUPT);
    assert.ok(op1, "ids-1 has its own synthesized corrupt operator");
    assert.ok(op2, "ids-2 has its own synthesized corrupt operator");
    assert.notEqual(op1, op2, "each node got a distinct operator object, not a shared reference");

    // Both nodes must be independently armable — arming one must not affect the other
    // (would indicate the underlying ActionDef/operator was mutated in place and shared).
    graph.setNodeAttr("ids-1", "accessLevel", "owned");
    graph.setNodeAttr("ids-2", "accessLevel", "owned");
    graph.executeAction("ids-1", A.CORRUPT);
    assert.equal(graph.getNodeState("ids-1")[timedActiveAttr(A.CORRUPT)], true, "ids-1 armed");
    assert.ok(!graph.getNodeState("ids-2")[timedActiveAttr(A.CORRUPT)], "ids-2 untouched");
  });
});

describe("crack-vault (#187 Phase 5): timed set-piece verb", () => {
  before(() => { clearHandlers(); initNavigationCancelHandler(); });

  /** Bring the real scatteredLock1 vault to its unlockable state directly (per the brief:
   * "you may set attrs directly" — the lock-opening circuit itself is exercised elsewhere,
   * this test is about crack-vault's own timed behavior). */
  function armLock() {
    initGame(buildLockLAN, "crack-vault-" + Math.random());
    const graph = getState().nodeGraph;
    graph.setQuality("locks-opened", 1);
    graph.setNodeAttr("vault", "accessLevel", "owned");
    return graph;
  }

  it("does not grant the reward on dispatch — only arms", () => {
    const graph = armLock();
    const cashBefore = getState().player.cash;

    graph.executeAction("vault", "crack-vault");

    assert.equal(getState().player.cash, cashBefore, "no reward at dispatch");
    assert.equal(graph.getNodeState("vault").cracked, false, "cracked stays false at dispatch");
    assert.equal(graph.getNodeState("vault")[timedActiveAttr("crack-vault")], true, "arm flag set");
  });

  it("completes after the flat duration — reward granted once, cracked flips true", () => {
    const graph = armLock();
    const cashBefore = getState().player.cash;

    graph.executeAction("vault", "crack-vault");
    graph.tick(20); // flat duration:20

    assert.equal(getState().player.cash, cashBefore + 1500, "reward granted exactly once on completion");
    assert.equal(graph.getNodeState("vault").cracked, true, "cracked flips true on completion");

    // No re-payout on further ticks (the operator resets progress/active and the action's
    // own `cracked:false` requirement now blocks re-arming).
    graph.tick(20);
    assert.equal(getState().player.cash, cashBefore + 1500, "no double payout");
  });

  it("nav-away mid-action cancels — no reward, cracked stays false", () => {
    const graph = armLock();
    const cashBefore = getState().player.cash;

    graph.executeAction("vault", "crack-vault");
    graph.tick(10); // partway through the 20-tick duration

    const cancels = withCancelFeedback(() => emitEvent(E.PLAYER_NAVIGATED, {}));

    assert.equal(cancels.length, 1, "exactly one cancel feedback");
    assert.equal(cancels[0].action, "crack-vault");
    assert.equal(getState().player.cash, cashBefore, "no reward from a cancelled crack");
    assert.equal(graph.getNodeState("vault").cracked, false, "cracked stays false");

    graph.tick(20); // further ticks must not resurrect a cancelled action
    assert.equal(getState().player.cash, cashBefore, "still no reward after further ticks");
  });
});

describe("extract-key (#187 Phase 5): timed set-piece verb", () => {
  before(() => { clearHandlers(); initNavigationCancelHandler(); });

  function armKeyGen() {
    initGame(buildKeyVaultLAN, "extract-key-" + Math.random());
    const graph = getState().nodeGraph;
    graph.setNodeAttr("key-gen-1", "accessLevel", "owned");
    return graph;
  }

  it("does not extract on dispatch — only arms", () => {
    const graph = armKeyGen();

    graph.executeAction("key-gen-1", "extract-key");

    assert.equal(graph.getNodeState("key-gen-1").keyExtracted, false, "not extracted at dispatch");
    assert.equal(graph.getQuality("decryption-keys"), 0, "quality untouched at dispatch");
    assert.equal(graph.getNodeState("key-gen-1")[timedActiveAttr("extract-key")], true, "arm flag set");
  });

  it("completes after the flat duration — keyExtracted flips true, quality increments once", () => {
    const graph = armKeyGen();

    graph.executeAction("key-gen-1", "extract-key");
    graph.tick(20); // flat duration:20

    assert.equal(graph.getNodeState("key-gen-1").keyExtracted, true, "extracted on completion");
    assert.equal(graph.getQuality("decryption-keys"), 1, "quality incremented exactly once");
  });

  it("nav-away mid-action cancels — no extraction, quality stays at 0", () => {
    const graph = armKeyGen();

    graph.executeAction("key-gen-1", "extract-key");
    graph.tick(10);

    const cancels = withCancelFeedback(() => emitEvent(E.PLAYER_NAVIGATED, {}));

    assert.equal(cancels.length, 1, "exactly one cancel feedback");
    assert.equal(cancels[0].action, "extract-key");
    assert.equal(graph.getNodeState("key-gen-1").keyExtracted, false, "still not extracted");
    assert.equal(graph.getQuality("decryption-keys"), 0, "quality still untouched");

    graph.tick(20);
    assert.equal(graph.getQuality("decryption-keys"), 0, "still untouched after further ticks");
  });
});

describe("legibility (#187 Phase 5): converted actions resolve to the generic-process default, not a silent dud", () => {
  it("corrupt has no central feedback-profile entry — resolves entirely to DEFAULT_PROFILE", () => {
    assert.deepEqual(resolveFeedback(A.CORRUPT), DEFAULT_PROFILE);
  });

  it("crack-vault has no central feedback-profile entry — resolves entirely to DEFAULT_PROFILE", () => {
    assert.deepEqual(resolveFeedback("crack-vault"), DEFAULT_PROFILE);
  });

  it("extract-key has no central feedback-profile entry — resolves entirely to DEFAULT_PROFILE", () => {
    assert.deepEqual(resolveFeedback("extract-key"), DEFAULT_PROFILE);
  });

  it("corrupt's live 'start' ACTION_FEEDBACK (durationTable branch) carries no inline override, so it resolves to DEFAULT_PROFILE too", () => {
    initGame(buildOneIdsLAN, "corrupt-legibility");
    const graph = getState().nodeGraph;
    graph.setNodeAttr("ids-1", "accessLevel", "owned");

    /** @type {any[]} */
    const starts = [];
    const h = (p) => { if (p.phase === "start") starts.push(p); };
    on(E.ACTION_FEEDBACK, h);
    graph.executeAction("ids-1", A.CORRUPT);
    graph.tick(1); // durationTable branch resolves duration + emits "start"
    off(E.ACTION_FEEDBACK, h);

    assert.equal(starts.length, 1, "corrupt emits a 'start' ACTION_FEEDBACK (durationTable branch)");
    assert.equal("feedback" in starts[0], false, "no inline feedback override declared on RECONFIGURE_ACTION");
    assert.deepEqual(resolveFeedback(starts[0].action, starts[0].feedback), DEFAULT_PROFILE);
  });
});
