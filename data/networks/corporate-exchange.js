// @ts-check
/**
 * Network C: "Corporate Exchange"
 *
 * 12-15 node network with aggressive ICE and simple structural defense.
 * Move fast or get caught. Tests pace pressure mechanics.
 * Set-pieces: idsRelayChain, noisySensor, probeBurstAlarm, honeyPot, officeCluster.
 */

import { instantiate } from "../../js/core/network/set-pieces.js";
import { SET_PIECES } from "../biomes/corporate-pieces.js";
import {
  createGateway, createRouter, createFirewall, createCryptovault,
  createWAN,
} from "../../js/core/node-graph/node-factories.js";
import { disguiseTrapNodes } from "../../js/core/network/disguise.js";
import { makeSeededRng } from "../../js/core/rng.js";

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
  // fw-1 is finesse-only (Flow Subversion Session 1): it can't be brute-forced — it trusts
  // the credential that flows in from switch-2 (SNIFF that flow → REPLAY the token here).
  const fw = createFirewall("fw-1", { grade: "A", finesse: { key: "fw-root-key" } });
  const vault = createCryptovault("vault-1", { grade: "A" });
  const wan = createWAN("wan");

  // ── Set-piece instances ──────────────────────────────
  const sec = instantiate(SET_PIECES.idsRelayChain, "sec");
  const noise = instantiate(SET_PIECES.noisySensor, "noise");
  const burst = instantiate(SET_PIECES.probeBurstAlarm, "burst");
  const pot = instantiate(SET_PIECES.honeyPot, "pot");
  const office = instantiate(SET_PIECES.officeCluster, "office");

  const secNodes = sec.nodes;
  const noiseNodes = noise.nodes;
  const burstNodes = burst.nodes;
  const potNodes = pot.nodes;
  const officeNodes = office.nodes;

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
    ["gateway", "wan"],
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
    // ICE resident node owned → disable ICE
    {
      id: "ice-resident-owned",
      when: { type: "node-attr", nodeId: "sec/monitor", attr: "accessLevel", eq: "owned" },
      then: [{ effect: "ctx-call", method: "disableIce", args: [] }],
    },
  ];

  // Static network: deterministic disguise via an arbitrary stable seed (this
  // string only seeds the disguise pick — changing it changes which loot type
  // the honey-pot masquerades as) so the honey-pot still looks like a loot node.
  disguiseTrapNodes(nodes, makeSeededRng("corporate-exchange-honeypot"));

  return {
    graphDef: {
      nodes,
      // Set-piece spreads infer edges as string[][] and triggers as a widened
      // union; both are correct at runtime — assert the NodeGraphDef field shapes.
      edges: /** @type {[string, string][]} */ (edges),
      triggers: /** @type {import("../../js/core/node-graph/types.js").TriggerDef[]} */ (triggers),
    },
    meta: {
      name: "Corporate Exchange",
      startNode: "gateway",
      startCash: 200,
      moneyCost: "A",
      ice: { grade: "B", startNode: "sec/monitor" },
      // Flow substrate (declarative, visual-only): typed packets riding real edges.
      // Each renders once both endpoints are revealed (fog-of-war). A money artery flows
      // toward the gateway and off-LAN via the WAN; the gateway↔switch-1 edge carries a
      // mix (money one way, control the other); audit climbs toward security; an encrypted
      // credential gates the firewall.
      flows: [
        { from: "switch-1", to: "gateway", type: "money", rate: 0.8 },
        { from: "gateway", to: "wan", type: "money", rate: 0.7 },
        { from: "gateway", to: "switch-1", type: "control", rate: 0.4 },
        { from: "office/fileserver", to: "switch-1", type: "data", rate: 0.5 },
        { from: "switch-2", to: "sec/ids", type: "audit", rate: 0.35 },
        { from: "switch-2", to: "fw-1", type: "credential", rate: 0.25, encrypted: true, key: "fw-root-key" },
      ],
    },
  };
}
