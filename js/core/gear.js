// @ts-check
// Gear registry and loadout-effect resolver (E2 Phase 1).
// Pure data + logic — no DOM, no events, no burn wiring (Phase 2).
// Only imports: balance.js.

import { DAMPENER_HEAT_MULT, RECON_BITE_BONUS } from "./balance.js";

/**
 * A piece of smash-tooling gear the player can own and equip.
 * @typedef {{ id: string, name: string, kind: "select"|"heat"|"bite", price: number, desc: string }} Gear
 */

/** The Analysis-family gear roster (single-tier). */
export const GEAR = /** @type {Object.<string, Gear>} */ ({
  "analyzer":  { id: "analyzer",  name: "Analyzer",  kind: "select", price: 400, desc: "Fires best-matched rounds first instead of a blind spray." },
  "dampener":  { id: "dampener",  name: "Dampener",  kind: "heat",   price: 350, desc: "Quiets the barrage — less heat per round." },
  "recon-rig": { id: "recon-rig", name: "Recon Rig", kind: "bite",   price: 350, desc: "Sharper targeting — matched rounds bite harder." },
});

/** All known gear ids. */
export const ALL_GEAR_IDS = Object.keys(GEAR);

/**
 * Look up a gear item by id.
 * @param {string} id
 * @returns {Gear|null}
 */
export function gearById(id) {
  return GEAR[id] ?? null;
}

/**
 * Return a catalog view of all gear items, optionally marking which are owned.
 * Mirrors getPackCatalog() shape for the store UI.
 * @param {import('./types.js').StarnetProfile | null} [profile]
 * @returns {{ id: string, name: string, kind: string, price: number, desc: string, owned: boolean }[]}
 */
export function getGearCatalog(profile = null) {
  return ALL_GEAR_IDS.map((id) => {
    const g = GEAR[id];
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      price: g.price,
      desc: g.desc,
      owned: profile ? (Array.isArray(profile.gear) && profile.gear.includes(id)) : false,
    };
  });
}

/**
 * Resolve an equipped loadout (array of gear ids) → the burn's effective modifiers.
 * Unknown ids in the array are silently ignored (they produce no effect).
 * @param {string[]} [loadoutIds]
 * @returns {{ selection: "best-match"|"blind", heatMult: number, biteBonus: number }}
 */
export function resolveLoadoutEffects(loadoutIds = []) {
  const has = (/** @type {string} */ id) => Array.isArray(loadoutIds) && loadoutIds.includes(id);
  return {
    selection: has("analyzer") ? "best-match" : "blind",
    heatMult:  has("dampener") ? DAMPENER_HEAT_MULT : 1,
    biteBonus: has("recon-rig") ? RECON_BITE_BONUS : 0,
  };
}
