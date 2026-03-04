// @ts-check
/**
 * Network B: "Research Station"
 *
 * Complex 15-18 node network with circuit puzzles and no ICE.
 * Player has time to think. Tests structural defense mechanics.
 * Set-pieces: deadmanCircuit, combinationLock, encryptedVault, tamperDetect.
 */

import { instantiate, SET_PIECES } from "../../js/core/node-graph/set-pieces.js";
import {
  createGateway, createRouter, createFileserver, enrichWithGameActions,
} from "../../js/core/node-graph/game-types.js";

/**
 * @returns {{ graphDef: import('../../js/core/node-graph/runtime.js').NodeGraphDef, meta: object }}
 */
export function buildNetwork() {
  // ── Standalone nodes ─────────────────────────────────
  const gateway = createGateway("gateway", {
    attributes: { visibility: "accessible" },
  });
  const spine1 = createRouter("spine-1");
  const spine2 = createRouter("spine-2");
  const archive = createFileserver("archive-1", { grade: "D" });

  // ── Set-piece instances ──────────────────────────────
  const deadman = instantiate(SET_PIECES.deadmanCircuit, "deadman");
  const lock = instantiate(SET_PIECES.combinationLock, "lock");
  const crypto = instantiate(SET_PIECES.encryptedVault, "crypto");
  const tamper = instantiate(SET_PIECES.tamperDetect, "tamper");

  // Enrich set-piece nodes with standard game actions
  const deadmanNodes = deadman.nodes.map(n => enrichWithGameActions(n));
  const lockNodes = lock.nodes.map(n => {
    const isLootable = n.type === "cryptovault";
    return enrichWithGameActions(n, { lootable: isLootable });
  });
  const cryptoNodes = crypto.nodes.map(n => {
    const isLootable = n.type === "cryptovault";
    return enrichWithGameActions(n, { lootable: isLootable });
  });
  const tamperNodes = tamper.nodes.map(n => enrichWithGameActions(n));

  // ── Merge all nodes ──────────────────────────────────
  const nodes = [
    gateway, spine1, spine2, archive,
    ...deadmanNodes,
    ...lockNodes,
    ...cryptoNodes,
    ...tamperNodes,
  ];

  // ── Edges ────────────────────────────────────────────
  const edges = [
    // Set-piece internal edges
    ...deadman.edges,
    ...lock.edges,
    ...crypto.edges,
    ...tamper.edges,
    // Backbone
    ["gateway", "spine-1"],
    ["spine-1", "spine-2"],
    // Spine-1 branches
    ["spine-1", "deadman/heartbeat-relay"],
    ["spine-1", "lock/switch-a"],
    ["spine-1", "archive-1"],
    // Spine-2 branches
    ["spine-2", "lock/switch-b"],
    ["spine-2", "lock/switch-c"],
    ["spine-2", "crypto/key-gen"],
    ["spine-2", "tamper/ids"],
    // Cross-links between set-pieces
    ["tamper/tamper-relay", "crypto/vault"],
  ];

  // ── Triggers ─────────────────────────────────────────
  const triggers = [
    ...deadman.triggers,
    ...lock.triggers,
    ...crypto.triggers,
    ...tamper.triggers,
  ];

  return {
    graphDef: { nodes, edges, triggers },
    meta: {
      name: "Research Station",
      startNode: "gateway",
      startCash: 0,
      moneyCost: "B",
      startHand: ["common", "common", "uncommon", "uncommon", "rare"],
      ice: null,
    },
  };
}
