// @ts-check
// Supply heuristic — replenish the exploit hoard by buying research packs from
// the broker, and jack out if the bot is truly out of ammo with no way to restock.

/** @typedef {import('../types.js').WorldModel} WorldModel */
/** @typedef {import('../types.js').ScoredAction} ScoredAction */

import { getPackCatalog } from "../../../js/core/packs.js";
import { A } from "../../../js/core/action-ids.js";

const STRATEGY = "supply";
const BUY_PACK_SCORE = 55;
const NO_AMMO_JACKOUT = 10;
// Buy a pack when usable ammo drops to/below this (matches the mine threshold).
const LOW_HOARD_THRESHOLD = 5;

/**
 * @param {WorldModel} world
 * @returns {ScoredAction[]}
 */
export function supplyStrategy(world) {
  /** @type {ScoredAction[]} */
  const proposals = [];

  if (world.needsExploit.length === 0) return proposals;
  if (world.hoardUsable >= LOW_HOARD_THRESHOLD) return proposals;

  const pack = cheapestAffordablePack(world);
  const canMine = world.minable && world.minable.length > 0;

  // Buy a pack to restock the hoard if we can afford one.
  if (pack) {
    proposals.push({
      action: "buy-pack",
      nodeId: null,
      score: BUY_PACK_SCORE,
      reason: `buy ${pack.name} pack (¥${pack.price})`,
      strategy: STRATEGY,
      payload: { packId: pack.id },
    });
  }

  // Truly stuck: no usable ammo, nothing minable, and can't afford a pack —
  // jack out rather than spin. Low score so any real move wins.
  if (world.hoardUsable === 0 && !canMine && !pack) {
    proposals.push({
      action: A.JACKOUT,
      nodeId: null,
      score: NO_AMMO_JACKOUT,
      reason: "no ammo, can't mine or buy — jack out",
      strategy: STRATEGY,
    });
  }

  return proposals;
}

/**
 * Pick the cheapest pack the player can currently afford.
 * @param {WorldModel} world
 * @returns {{ id: string, name: string, price: number } | null}
 */
function cheapestAffordablePack(world) {
  const affordable = getPackCatalog()
    .filter((p) => p.price <= world.player.cash)
    .sort((a, b) => a.price - b.price);
  return affordable[0] ?? null;
}
