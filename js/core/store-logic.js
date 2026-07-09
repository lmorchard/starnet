// @ts-check
// Headless darknet broker buy logic.
// Both the DOM store modal (store.js) and the console buy command (console.js)
// delegate to this module. No DOM dependencies.
//
// Phase 6 (E1): store now sells research packs → hoard rounds.

import { getState } from "./state.js";
import { addCash, addRoundToHoard } from "./state/player.js";
import { withdraw, addRoundToHoard as profileAddRound, addGear, hasGear } from "./profile/index.js";
import { getPackCatalog, openPack } from "./packs.js";
import { gearById } from "./gear.js";

/**
 * Resolve a catalog pack from a 1-based index or a pack id string (exact match,
 * then unique prefix). Returns null if unresolved/ambiguous.
 * @param {number | string} indexOrPackId
 * @returns {{ id: string, name: string, mix: Record<string, number>, price: number, size: number } | null}
 */
function findPackItem(indexOrPackId) {
  const catalog = getPackCatalog();
  if (typeof indexOrPackId === "number") {
    return indexOrPackId >= 1 && indexOrPackId <= catalog.length ? catalog[indexOrPackId - 1] : null;
  }
  const lower = String(indexOrPackId).toLowerCase();
  const exact = catalog.filter((c) => c.id.toLowerCase() === lower);
  if (exact.length === 1) return exact[0];
  const prefix = catalog.filter((c) => c.id.toLowerCase().startsWith(lower));
  return prefix.length === 1 ? prefix[0] : null;
}

/**
 * Buy a research pack from the broker into the in-run hoard (spends in-run cash).
 * @param {number | string} indexOrPackId — 1-based catalog index or pack id string
 * @returns {{ pack: { id: string, name: string, size: number }, price: number, rounds: import('./types.js').ExploitRound[] } | null}
 */
export function buyFromStore(indexOrPackId) {
  const item = findPackItem(indexOrPackId);
  if (!item) return null;
  const state = getState();
  if (state.player.cash < item.price) return null;
  addCash(-item.price);
  const rounds = openPack(item.id);
  for (const round of rounds) addRoundToHoard(round);
  return { pack: { id: item.id, name: item.name, size: item.size }, price: item.price, rounds };
}

/**
 * Buy a research pack from the broker into a persistent profile (spends bank cash,
 * adds rounds to the profile hoard). Used by the overworld hub's darknet store.
 * @param {import('./types.js').StarnetProfile} profile
 * @param {number | string} indexOrPackId
 * @returns {{ pack: { id: string, name: string, size: number }, price: number, rounds: import('./types.js').ExploitRound[] } | null}
 */
export function buyFromStoreToProfile(profile, indexOrPackId) {
  const item = findPackItem(indexOrPackId);
  if (!item) return null;
  if (profile.bank < item.price) return null;
  withdraw(profile, item.price);
  const rounds = openPack(item.id);
  for (const round of rounds) profileAddRound(profile, round);
  return { pack: { id: item.id, name: item.name, size: item.size }, price: item.price, rounds };
}

/**
 * Buy a gear item from the broker into a persistent profile (spends bank cash,
 * adds to profile.gear). Hub/profile context only — the in-run store sells packs only.
 * @param {import('./types.js').StarnetProfile} profile
 * @param {string} gearId
 * @returns {{ gear: import('./gear.js').Gear, price: number } | null}
 */
export function buyGearToProfile(profile, gearId) {
  const gear = gearById(gearId);
  if (!gear) return null;
  if (hasGear(profile, gearId)) return null;
  if (profile.bank < gear.price) return null;
  withdraw(profile, gear.price);
  addGear(profile, gearId);
  return { gear, price: gear.price };
}
