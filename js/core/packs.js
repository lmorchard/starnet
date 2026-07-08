// @ts-check
// Research packs — blind-box assortments sold at the darknet broker.
// This is the primary accumulation channel for the in-run and hub stores.
// Part of the E1 "exploit hoard + coherence auto-burn" rework (Phase 6).

import { generateHoard } from "./hoard.js";

/** @typedef {import('./types.js').ExploitRound} ExploitRound */

/**
 * Pack definitions — blind-box assortments priced per pack.
 * PLACEHOLDER values — feel / census tuned later.
 */
export const PACKS = [
  { id: "cache-common",  name: "Common Cache",       mix: { common: 12 },                     price: 120 },
  { id: "dump-mixed",    name: "Mixed Signal Dump",   mix: { common: 6, uncommon: 3 },          price: 300 },
  { id: "req-rare",      name: "Rare Requisition",    mix: { common: 2, uncommon: 2, rare: 1 }, price: 650 },
];

/**
 * Return a catalog view of available packs (size computed, mix is a fresh copy).
 * @returns {{ id: string, name: string, mix: Record<string, number>, price: number, size: number }[]}
 */
export function getPackCatalog() {
  return PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    mix: { ...p.mix },
    price: p.price,
    size: Object.values(p.mix).reduce((a, b) => a + b, 0),
  }));
}

/**
 * Open a pack — returns the ExploitRounds it contains.
 * Returns [] for an unknown packId.
 * @param {string} packId
 * @returns {ExploitRound[]}
 */
export function openPack(packId) {
  const pack = PACKS.find((p) => p.id === packId);
  return pack ? generateHoard(pack.mix) : [];
}
