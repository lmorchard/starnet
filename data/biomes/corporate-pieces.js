// @ts-check
/**
 * Corporate biome set-pieces — barrel.
 *
 * The catalog was split into section modules under `corporate-pieces/`:
 *   defense   — detection / IDS / tamper
 *   traps     — alarms, deadman, honeypot, cascade
 *   puzzles   — locks, vaults, switch arrangements
 *   filler    — treasure / capacity
 *   scaled    — larger variants for higher budgets
 *   scattered — independently-placed scatter nodes
 *   atomics   — single-node pieces (+ ATOMICS catalog)
 *   scenarios — narrative-flavored configurations
 *   backbone  — spine nodes (+ BACKBONE_PIECES catalog)
 *
 * This module re-exports every piece (so existing imports are unchanged) and
 * assembles the SET_PIECES catalog. Infrastructure (instantiate, typedefs)
 * lives in js/core/network/set-pieces.js.
 */

/**
 * Re-declared locally to resolve the `export *` type-name ambiguity: each
 * section module declares its own `SetPieceDef` typedef, so without this the
 * star re-exports would collide (TS2308).
 * @typedef {import("../../js/core/network/set-pieces.js").SetPieceDef} SetPieceDef
 */

export * from "./corporate-pieces/defense.js";
export * from "./corporate-pieces/traps.js";
export * from "./corporate-pieces/puzzles.js";
export * from "./corporate-pieces/filler.js";
export * from "./corporate-pieces/scaled.js";
export * from "./corporate-pieces/scattered.js";
export * from "./corporate-pieces/atomics.js";
export * from "./corporate-pieces/scenarios.js";
export * from "./corporate-pieces/backbone.js";

// Local bindings needed to assemble the SET_PIECES catalog below.
import {
  idsRelayChain,
  noisySensor,
  tamperDetect,
} from "./corporate-pieces/defense.js";
import {
  nthAlarm,
  deadmanCircuit,
  honeyPot,
  cascadeShutdown,
  tripwireGauntlet,
  probeBurstAlarm,
} from "./corporate-pieces/traps.js";
import {
  combinationLock,
  switchArrangement,
  multiKeyVault,
  encryptedVault,
} from "./corporate-pieces/puzzles.js";
import { serverBank, officeCluster } from "./corporate-pieces/filler.js";
import {
  largeServerBank,
  vaultCluster,
  defensePlex,
  fortifiedGate,
  dataCenter,
} from "./corporate-pieces/scaled.js";
import {
  scatteredLock1,
  scatteredLock3,
  scatteredLock5,
  scatteredKeyVault2,
  scatteredKeyVault3,
  scatteredEncryptedVault2,
  scatteredEncryptedVault3,
} from "./corporate-pieces/scattered.js";

/**
 * Convenience catalog of all set-pieces.
 */
export const SET_PIECES = {
  idsRelayChain,
  nthAlarm,
  combinationLock,
  deadmanCircuit,
  switchArrangement,
  multiKeyVault,
  honeyPot,
  encryptedVault,
  cascadeShutdown,
  tripwireGauntlet,
  probeBurstAlarm,
  noisySensor,
  tamperDetect,
  serverBank,
  officeCluster,
  // Scaled variants
  largeServerBank,
  vaultCluster,
  defensePlex,
  fortifiedGate,
  dataCenter,
  // Scattered variants
  scatteredLock1,
  scatteredLock3,
  scatteredLock5,
  scatteredKeyVault2,
  scatteredKeyVault3,
  scatteredEncryptedVault2,
  scatteredEncryptedVault3,
};
