// @ts-check
/**
 * Network C: "Corporate Exchange"
 *
 * 12-15 node network with aggressive ICE and simple structural defense.
 * Move fast or get caught. Tests pace pressure mechanics.
 * Set-pieces: idsRelayChain, noisySensor, probeBurstAlarm, honeyPot, officeCluster.
 */

import { instantiate, SET_PIECES } from "../../js/core/node-graph/set-pieces.js";
import {
  createGateway, createRouter, createFirewall, createCryptovault,
  createWAN, enrichWithGameActions,
} from "../../js/core/node-graph/game-types.js";

/**
 * @returns {{ graphDef: import('../../js/core/node-graph/runtime.js').NodeGraphDef, meta: object }}
 */
export function buildNetwork() {
  // ── Standalone nodes ─────────────────────────────────
  const gateway = createGateway("gateway", {
    attributes: { visibility: "accessible" },
  });
  const switch1 = createRouter("switch-1");
  const switch2 = createRouter("switch-2");
  const fw = createFirewall("fw-1", { grade: "A" });
  const vault = createCryptovault("vault-1", { grade: "A" });
  const wan = createWAN("wan");

  // ── Set-piece instances ──────────────────────────────
  const sec = instantiate(SET_PIECES.idsRelayChain, "sec");
  const noise = instantiate(SET_PIECES.noisySensor, "noise");
  const burst = instantiate(SET_PIECES.probeBurstAlarm, "burst");
  const pot = instantiate(SET_PIECES.honeyPot, "pot");
  const office = instantiate(SET_PIECES.officeCluster, "office");

  // Enrich set-piece nodes with standard game actions
  const LOOTABLE_TYPES = new Set(["fileserver", "cryptovault", "workstation"]);
  const enrich = nodes => nodes.map(n =>
    enrichWithGameActions(n, { lootable: LOOTABLE_TYPES.has(n.type) })
  );

  const secNodes = enrich(sec.nodes);
  const noiseNodes = enrich(noise.nodes);
  const burstNodes = enrich(burst.nodes);
  const potNodes = enrich(pot.nodes);
  const officeNodes = enrich(office.nodes);

  // ── Merge all nodes ──────────────────────────────────
  const nodes = [
    gateway, switch1, switch2, fw, vault, wan,
    ...secNodes,
    ...noiseNodes,
    ...burstNodes,
    ...potNodes,
    ...officeNodes,
  ];

  // ── Edges ────────────────────────────────────────────
  const edges = [
    // Set-piece internal edges
    ...sec.edges,
    ...noise.edges,
    ...burst.edges,
    ...pot.edges,
    ...office.edges,
    // Backbone
    ["gateway", "switch-1"],
    ["switch-1", "switch-2"],
    // Switch-1 branches (outer ring — sensors, WAN)
    ["switch-1", "noise/sensor"],
    ["switch-1", "burst/scanner"],
    ["switch-1", "office/fileserver"],
    ["switch-1", "wan"],
    // Switch-2 branches (inner ring — security, vault)
    ["switch-2", "sec/ids"],
    ["switch-2", "fw-1"],
    ["switch-2", "pot/honey-pot"],
    // Firewall gates the vault
    ["fw-1", "vault-1"],
  ];

  // ── Triggers ─────────────────────────────────────────
  const triggers = [
    ...sec.triggers,
    ...noise.triggers,
    ...burst.triggers,
    ...pot.triggers,
    ...office.triggers,
  ];

  return {
    graphDef: { nodes, edges, triggers },
    meta: {
      name: "Corporate Exchange",
      startNode: "gateway",
      startCash: 200,
      moneyCost: "A",
      startHandSpec: { count: 5, grade: "B" },
      ice: { grade: "B", startNode: "sec/monitor" },
    },
  };
}
