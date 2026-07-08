// @ts-check
/**
 * Network A: "Corporate Foothold"
 *
 * Simple 10-12 node network introducing the basic loop. Tutorial-adjacent.
 * Set-pieces: idsRelayChain, nthAlarm, multiKeyVault, serverBank.
 * No ICE.
 */

import { instantiate } from "../../js/core/network/set-pieces.js";
import { SET_PIECES } from "../biomes/corporate-pieces.js";
import {
  createGateway, createRouter, createWAN,
} from "../../js/core/node-graph/node-factories.js";

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

  const secNodes = sec.nodes;
  const alarmNodes = alarm.nodes;
  const vaultNodes = vault.nodes;
  const officeNodes = office.nodes;

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
    graphDef: {
      nodes,
      // Set-piece spreads infer edges as string[][] and triggers as a widened
      // union; both are correct at runtime — assert the NodeGraphDef field shapes.
      edges: /** @type {[string, string][]} */ (edges),
      triggers: /** @type {import("../../js/core/node-graph/types.js").TriggerDef[]} */ (triggers),
    },
    meta: {
      name: "Corporate Foothold",
      startNode: "gateway",
      startCash: 1000,
      moneyCost: "C",
      // Gentle intro ICE (#114). Grade C is the most forgiving disturbance-tracking
      // tier (move 7s, dwell 5.5s, noise threshold 5) and takes 2 detections to
      // trace — real pressure that teaches the mechanic without being punishing.
      // Stationed at the router-1 hub so it patrols the whole LAN and crosses the
      // player's path; losses are clean trace losses, not stuck/tick-cap.
      ice: { grade: "C", startNode: "router-1" },
    },
  };
}
