// @ts-check
/**
 * Corporate biome — set-piece catalog for corporate LAN networks.
 *
 * Flavor: enterprise firewalls, IDS chains, fileservers, workstations,
 * security monitors, cryptovaults. The default biome for the current game.
 */

/** @typedef {import('../../js/core/network/set-pieces.js').BiomeDef} BiomeDef */
/** @typedef {import('../../js/core/network/set-pieces.js').SetPieceDef} SetPieceDef */

import {
  idsRelayChain, nthAlarm, combinationLock, deadmanCircuit,
  switchArrangement, multiKeyVault, honeyPot, encryptedVault,
  cascadeShutdown, tripwireGauntlet, probeBurstAlarm, noisySensor,
  tamperDetect, serverBank, officeCluster,
  largeServerBank, vaultCluster, defensePlex, fortifiedGate, dataCenter,
  scatteredLock1, scatteredLock3, scatteredLock5,
  scatteredKeyVault2, scatteredKeyVault3,
  scatteredEncryptedVault2, scatteredEncryptedVault3,
  entryPoint, singleRouter, singleFirewall,
  singleWorkstation, singleFileserver,
} from "./corporate-pieces.js";

/** @type {SetPieceDef[]} */
const catalog = [
  // Atomics
  entryPoint,
  singleRouter,
  singleFirewall,
  singleWorkstation,
  singleFileserver,
  // Filler / treasure
  serverBank,
  officeCluster,
  switchArrangement,
  // Defense
  idsRelayChain,
  noisySensor,
  // Pressure / trap
  nthAlarm,
  deadmanCircuit,
  tripwireGauntlet,
  probeBurstAlarm,
  cascadeShutdown,
  honeyPot,
  // Puzzle / treasure
  multiKeyVault,
  combinationLock,
  encryptedVault,
  // Defense + puzzle
  tamperDetect,
  // Scattered variants (nodes distributed across network)
  scatteredLock1,
  scatteredLock3,
  scatteredLock5,
  scatteredKeyVault2,
  scatteredKeyVault3,
  scatteredEncryptedVault2,
  scatteredEncryptedVault3,
  // Scaled variants (higher cost tiers)
  largeServerBank,
  vaultCluster,
  defensePlex,
  fortifiedGate,
  dataCenter,
];

/** @type {BiomeDef} */
export const CORPORATE_BIOME = {
  id: "corporate",
  defaultBudget: { threat: "C", wealth: "B", complexity: "C", depth: "C" },
  catalog,
};

/**
 * Filter the catalog by tags. Returns pieces that have ALL specified tags.
 * @param {SetPieceDef[]} cat
 * @param {string[]} tags
 * @returns {SetPieceDef[]}
 */
export function filterByTags(cat, tags) {
  if (tags.length === 0) return cat;
  return cat.filter(piece =>
    piece.tags && tags.every(t => piece.tags.includes(t))
  );
}

/**
 * Filter the catalog by any of the specified tags. Returns pieces that have
 * at least one of the specified tags.
 * @param {SetPieceDef[]} cat
 * @param {string[]} tags
 * @returns {SetPieceDef[]}
 */
export function filterByAnyTag(cat, tags) {
  if (tags.length === 0) return cat;
  return cat.filter(piece =>
    piece.tags && tags.some(t => piece.tags.includes(t))
  );
}
