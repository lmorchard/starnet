// @ts-check
/**
 * Network A: "Corporate Foothold"
 *
 * Simple 10-12 node network introducing the basic loop. Tutorial-adjacent.
 * Set-pieces: idsRelayChain, nthAlarm, multiKeyVault, serverBank.
 * No ICE.
 */

import { instantiate, SET_PIECES } from "../../js/core/node-graph/set-pieces.js";
import {
  createGateway, createRouter, createWAN, createGameNode,
} from "../../js/core/node-graph/game-types.js";

/**
 * @returns {{ graphDef: import('../../js/core/node-graph/runtime.js').NodeGraphDef, meta: object }}
 */
export function buildNetwork() {
  // ── Standalone nodes ─────────────────────────────────
  const gateway = createGateway("gateway", {
    attributes: { visibility: "accessible" },
  });
  const router1 = createRouter("router-1");
  const wan = createWAN("wan");

  // ── Set-piece instances ──────────────────────────────
  const sec = instantiate(SET_PIECES.idsRelayChain, "sec");
  const alarm = instantiate(SET_PIECES.nthAlarm, "alarm");
  const vault = instantiate(SET_PIECES.multiKeyVault, "vault");
  const office = instantiate(SET_PIECES.officeCluster, "office");

  // Compose set-piece nodes with game-type factories
  const secNodes = sec.nodes.map(createGameNode);
  const alarmNodes = alarm.nodes.map(createGameNode);
  const vaultNodes = vault.nodes.map(createGameNode);
  const officeNodes = office.nodes.map(createGameNode);

  // ── Merge all nodes ──────────────────────────────────
  const nodes = [
    gateway, router1, wan,
    ...secNodes,
    ...alarmNodes,
    ...vaultNodes,
    ...officeNodes,
  ];

  // ── Edges: internal + cross-component wiring ─────────
  const edges = [
    // Set-piece internal edges
    ...sec.edges,
    ...alarm.edges,
    ...vault.edges,
    ...office.edges,
    // Backbone
    ["gateway", "router-1"],
    ["gateway", "wan"],
    // Router-1 to components
    ["router-1", "sec/ids"],
    ["router-1", "alarm/sensor"],
    ["router-1", "vault/key-server-1"],
    ["router-1", "vault/key-server-2"],
    ["router-1", "office/fileserver"],
  ];

  // ── Triggers ─────────────────────────────────────────
  const triggers = [
    ...sec.triggers,
    ...alarm.triggers,
    ...vault.triggers,
    ...office.triggers,
  ];

  return {
    graphDef: { nodes, edges, triggers },
    meta: {
      name: "Corporate Foothold",
      startNode: "gateway",
      startCash: 0,
      moneyCost: "C",
      startHand: ["common", "common", "uncommon", "uncommon"],
      ice: null,
    },
  };
}
