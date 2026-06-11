// @ts-check
// Hub target-list generation. v1: a small fixed set of difficulty tiers, with
// seeds derived from the profile's hub-visit counter so the list is deterministic
// for a given profile state and rotates as the player returns to the hub.
//
// This is deliberately minimal — the flat list is the seam where richer
// navigation (a map / world hierarchy) will grow later.

/** @typedef {import('../types.js').StarnetProfile} StarnetProfile */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   seed: string,
 *   spec: { threat: string, wealth: string, complexity: string, depth: string },
 * }} HubTarget
 */

/** @type {{ id: string, label: string, spec: HubTarget["spec"] }[]} */
const TIERS = [
  { id: "soft",     label: "Soft target — residential edge", spec: { threat: "F", wealth: "D", complexity: "F", depth: "F" } },
  { id: "standard", label: "Standard job — corporate LAN",   spec: { threat: "C", wealth: "B", complexity: "C", depth: "C" } },
  { id: "hard",     label: "Hard mark — hardened vault",      spec: { threat: "A", wealth: "S", complexity: "B", depth: "B" } },
];

/**
 * Build the hub's target list. Seeds incorporate the profile's hub-visit counter
 * so each visit offers a fresh-but-deterministic set.
 * @param {StarnetProfile} profile
 * @returns {HubTarget[]}
 */
export function generateTargets(profile) {
  const visit = profile._hubVisits ?? 0;
  return TIERS.map((t) => ({ ...t, seed: `target-${visit}-${t.id}` }));
}
