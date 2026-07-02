// @ts-check
// Hub target-list generation. Two kinds of target:
//   1. Procedural tiers — a small fixed set of difficulty tiers, seeds derived from the profile's
//      hub-visit counter so the list is deterministic per profile state and rotates on return.
//   2. Authored jobs — one per hand-crafted named network (#261), always available so set-piece
//      and Flow Subversion content is reachable from normal hub play (not just deep-links).
//
// This is deliberately minimal — the flat list is the seam where richer navigation (a map / world
// hierarchy) will grow later.

import { NAMED_NETWORKS } from "../../../data/networks/index.js";

/** @typedef {import('../types.js').StarnetProfile} StarnetProfile */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   seed?: string,
 *   spec?: { threat: string, wealth: string, complexity: string, depth: string },
 *   network?: string,
 * }} HubTarget
 * A procedural target carries `seed` + `spec`; an authored target carries `network`
 * (a NAMED_NETWORKS key). `launchTarget` in js/ui/hub.js branches on `network`.
 */

/** @type {{ id: string, label: string, spec: NonNullable<HubTarget["spec"]> }[]} */
const TIERS = [
  { id: "soft",     label: "Soft target — residential edge", spec: { threat: "F", wealth: "D", complexity: "F", depth: "F" } },
  { id: "standard", label: "Standard job — corporate LAN",   spec: { threat: "C", wealth: "B", complexity: "C", depth: "C" } },
  { id: "hard",     label: "Hard mark — hardened vault",      spec: { threat: "A", wealth: "S", complexity: "B", depth: "B" } },
];

// Friendly labels for the authored jobs; falls back to a title-cased key for any unmapped network.
const AUTHORED_LABELS = {
  "corporate-foothold": "Corporate Foothold — authored",
  "research-station": "Research Station — authored",
  "corporate-exchange": "Corporate Exchange — Flow Subversion",
};

const titleCase = (key) =>
  key.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** One always-available authored target per registered named network. */
function authoredTargets() {
  return Object.keys(NAMED_NETWORKS).map((network) => ({
    id: `authored-${network}`,
    label: AUTHORED_LABELS[network] ?? titleCase(network),
    network,
  }));
}

/**
 * Build the hub's target list: procedural tiers (seeded by hub-visit count) + authored jobs.
 * @param {StarnetProfile} profile
 * @returns {HubTarget[]}
 */
export function generateTargets(profile) {
  const visit = profile._hubVisits ?? 0;
  const procgen = TIERS.map((t) => ({ ...t, seed: `target-${visit}-${t.id}` }));
  return [...procgen, ...authoredTargets()];
}
