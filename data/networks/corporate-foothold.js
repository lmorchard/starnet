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
  createGateway, createRouter, enrichWithGameActions,
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

  // ── Set-piece instances ──────────────────────────────
  const sec = instantiate(SET_PIECES.idsRelayChain, "sec");
  const alarm = instantiate(SET_PIECES.nthAlarm, "alarm");
  const vault = instantiate(SET_PIECES.multiKeyVault, "vault");
  const office = instantiate(SET_PIECES.officeCluster, "office");

  // Enrich set-piece nodes with standard game actions
  const LOOTABLE_TYPES = new Set(["fileserver", "cryptovault", "key-server", "workstation"]);
  const enrich = nodes => nodes.map(n =>
    enrichWithGameActions(n, { lootable: LOOTABLE_TYPES.has(n.type) })
  );

  const secNodes = enrich(sec.nodes);
  const alarmNodes = enrich(alarm.nodes);
  const vaultNodes = enrich(vault.nodes);
  const officeNodes = enrich(office.nodes);

  // ── Merge all nodes ──────────────────────────────────
  const nodes = [
    gateway, router1,
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
      startHandSpec: { count: 4, grade: "C" },
      ice: null,
    },
  };
}
