// @ts-check
/**
 * Corporate biome — set-piece catalog for corporate LAN networks.
 *
 * Flavor: enterprise firewalls, IDS chains, fileservers, workstations,
 * security monitors, cryptovaults. The default biome for the current game.
 */

/** @typedef {import('../../js/core/network/set-pieces.js').BiomeDef} BiomeDef */
/** @typedef {import('../../js/core/network/set-pieces.js').SetPieceDef} SetPieceDef */

/** @typedef {import('../../js/core/network/set-pieces.js').SubBiomeDef} SubBiomeDef */
/** @typedef {import('../../js/core/network/set-pieces.js').RecipeDef} RecipeDef */

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
  backboneRouter, backboneFirewall, backboneHub,
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
  // Backbone (hierarchical networks)
  backboneRouter,
  backboneFirewall,
  backboneHub,
];

// ---------------------------------------------------------------------------
// Sub-biomes — curated filters over the catalog with grade tendencies
// ---------------------------------------------------------------------------

/** @type {SubBiomeDef} */
export const securityOps = {
  id: "security-ops",
  name: "Security Operations",
  description: "IDS monitoring stations, alarm systems, and countermeasures.",
  pieceIds: [
    "ids-relay-chain", "noisy-sensor", "tamper-detect", "defense-plex",
    "nth-alarm", "deadman-circuit", "probe-burst-alarm",
    "cascade-shutdown", "honey-pot", "tripwire-gauntlet",
    "single-firewall", "single-router", "single-workstation",
    "fortified-gate",
  ],
  requiredPieceIds: ["ids-relay-chain"],
  baseGrades: { threat: "B", wealth: "F", complexity: "D", depth: "C" },
};

/** @type {SubBiomeDef} */
export const serverRoom = {
  id: "server-room",
  name: "Server Room",
  description: "Racks of fileservers and cryptovaults. Data-rich, lightly secured.",
  pieceIds: [
    "server-bank", "large-server-bank", "data-center", "vault-cluster",
    "single-fileserver", "single-router",
    "encrypted-vault", "multi-key-vault",
  ],
  requiredPieceIds: [],
  baseGrades: { threat: "F", wealth: "B", complexity: "D", depth: "C" },
};

/** @type {SubBiomeDef} */
export const officeFloor = {
  id: "office-floor",
  name: "Office Floor",
  description: "Workstations and shared drives. Light security, small rewards.",
  pieceIds: [
    "office-cluster", "single-workstation", "single-fileserver",
    "single-router", "switch-arrangement",
  ],
  requiredPieceIds: [],
  baseGrades: { threat: "F", wealth: "D", complexity: "F", depth: "D" },
};

/** @type {SubBiomeDef} */
export const executiveSuite = {
  id: "executive-suite",
  name: "Executive Suite",
  description: "High-value targets behind strong access controls.",
  pieceIds: [
    "fortified-gate", "combination-lock", "encrypted-vault", "vault-cluster",
    "single-firewall", "single-router", "single-workstation", "multi-key-vault",
  ],
  requiredPieceIds: [],
  baseGrades: { threat: "C", wealth: "A", complexity: "B", depth: "C" },
};

/** @type {SubBiomeDef[]} */
export const SUB_BIOMES = [securityOps, serverRoom, officeFloor, executiveSuite];

// ---------------------------------------------------------------------------
// Recipes — formulas for composing networks from sub-biome wings
// ---------------------------------------------------------------------------

/** @type {RecipeDef} */
export const defenseContractor = {
  id: "defense-contractor",
  name: "Defense Contractor",
  description: "Heavy security posture. Double security operations wing.",
  mandatoryWings: ["security-ops", "security-ops"],
  optionalPool: [
    { subBiomeId: "server-room", weight: 3 },
    { subBiomeId: "office-floor", weight: 1 },
  ],
};

/** @type {RecipeDef} */
export const fashionBrand = {
  id: "fashion-brand",
  name: "Fashion Brand",
  description: "Light security, more offices and executive access.",
  mandatoryWings: ["security-ops"],
  optionalPool: [
    { subBiomeId: "office-floor", weight: 3 },
    { subBiomeId: "executive-suite", weight: 2 },
    { subBiomeId: "server-room", weight: 1 },
  ],
};

/** @type {RecipeDef} */
export const techCompany = {
  id: "tech-company",
  name: "Tech Company",
  description: "Moderate security, heavy on server infrastructure.",
  mandatoryWings: ["security-ops"],
  optionalPool: [
    { subBiomeId: "server-room", weight: 3 },
    { subBiomeId: "office-floor", weight: 2 },
    { subBiomeId: "executive-suite", weight: 1 },
  ],
};

/** @type {RecipeDef[]} */
export const RECIPES = [defenseContractor, fashionBrand, techCompany];

// ---------------------------------------------------------------------------
// Biome definition
// ---------------------------------------------------------------------------

/** @type {BiomeDef} */
export const CORPORATE_BIOME = {
  id: "corporate",
  defaultBudget: { threat: "C", wealth: "B", complexity: "C", depth: "C" },
  catalog,
  subBiomes: SUB_BIOMES,
  recipes: RECIPES,
  backbonePieceIds: ["backbone-router", "backbone-firewall", "backbone-hub"],
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
