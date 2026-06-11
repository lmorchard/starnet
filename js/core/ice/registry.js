// @ts-check
// Catalog of ICE type presets. Each entry combines a focus, a behavior
// pattern, a trigger list, and an effect list into a named type that
// procgen and network meta can reference.

import { GRADE_INDEX } from "../grades.js";

/** @type {Object<string, any>} */
export const ICE_TYPES = {};

/** @param {{ typeId: string, [key: string]: any }} type */
export function registerType(type) {
  ICE_TYPES[type.typeId] = type;
}

export function getType(typeId) {
  return ICE_TYPES[typeId] ?? null;
}

// Session-1 catalog: one preset per pre-reinvention grade, preserving the
// grade-based behavior of the old singleton so existing networks play
// identically after migration.

function classicFor(grade) {
  const pattern =
    grade === "D" || grade === "F" ? "patrol-random" :
    grade === "A" || grade === "S" ? "player-hunter" :
    "disturbance-tracker";
  return {
    typeId: `patrol-classic-${grade}`,
    focus: "roaming",
    behaviorPattern: pattern,
    grade,
    triggers: ["on-dwell-grade"],
    effects: [{ atom: "raise-alert", params: {} }],
  };
}

for (const grade of ["S", "A", "B", "C", "D", "F"]) {
  registerType(classicFor(grade));
}

// Session: health-deck-damage. Damaging presets — grade-agnostic (instance
// grade is set at spawn). Alert-raise is intentionally NOT bundled: these ICE
// attack the health / deck clocks, not the trace clock.
registerType({
  typeId: "sentinel",
  focus: "roaming",
  behaviorPattern: "disturbance-tracker",
  triggers: ["on-dwell-grade"],
  effects: [{ atom: "damage-health", params: { amount: 20 } }],
});

registerType({
  typeId: "spike",
  focus: "roaming",
  behaviorPattern: "disturbance-tracker",
  triggers: ["on-dwell-grade"],
  effects: [{ atom: "damage-deck", params: { amount: 20 } }],
});

/**
 * Pick the ICE type id for a spawned instance. Damaging presets only appear at
 * threat B+; below that the network's single ICE stays classic (alert-only).
 * Pure: `roll` is a float in [0, 1) supplied by the caller's seeded stream.
 * (Biome-biasing is a deferred tuning seam — grade gating only for the MVP.)
 * Grade ordering reuses the canonical GRADE_INDEX (F=0 … S=5) so there's a
 * single source of truth.
 * @param {string} grade
 * @param {number} roll
 * @returns {string}
 */
export function pickIceTypeId(grade, roll) {
  if ((GRADE_INDEX[grade] ?? 0) < GRADE_INDEX.B) return `patrol-classic-${grade}`;
  if (roll < 0.5) return `patrol-classic-${grade}`;
  if (roll < 0.75) return "sentinel";
  return "spike";
}
