// @ts-check
/**
 * Budget tables and grade utilities for procedural network generation.
 *
 * Translates the 4-axis network spec (threat/wealth/complexity/depth as grades)
 * into concrete parameters the skeleton generator and slot filler use.
 */

/** @typedef {import('./set-pieces.js').NetworkSpec} NetworkSpec */

import { GRADE_INDEX, shiftGrade, clampGrade } from "../grades.js";

// ---------------------------------------------------------------------------
// Grade-to-number conversion (for budget arithmetic)
// ---------------------------------------------------------------------------

/** Grade → numeric value (1-6). Higher = more. */
const GRADE_VALUE = { F: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };

/**
 * Convert a grade letter to a numeric value (1-6).
 * @param {string} grade
 * @returns {number}
 */
export function gradeToNumber(grade) {
  return GRADE_VALUE[grade] ?? 1;
}

/**
 * Convert a numeric value (1-6) to a grade letter, clamped.
 * @param {number} n
 * @returns {string}
 */
export function numberToGrade(n) {
  return clampGrade(n - 1); // clampGrade uses 0-based index
}

// ---------------------------------------------------------------------------
// Depth table: depth grade → max hop count from gateway
// ---------------------------------------------------------------------------

/** @type {Record<string, number>} */
export const DEPTH_TABLE = {
  F: 2,
  D: 3,
  C: 4,
  B: 5,
  A: 6,
  S: 7,
};

/**
 * Get max hop count for a depth grade.
 * @param {string} depthGrade
 * @returns {number}
 */
export function maxDepth(depthGrade) {
  return DEPTH_TABLE[depthGrade] ?? 3;
}

// ---------------------------------------------------------------------------
// Tag weights: how each budget axis biases tag selection
// ---------------------------------------------------------------------------

/**
 * For each budget axis, the relative weight of each tag. Higher weight = more
 * likely the skeleton assigns that tag when the axis is high.
 * @type {Record<string, Record<string, number>>}
 */
export const TAG_WEIGHTS = {
  threat:     { defense: 3, pressure: 2, trap: 1 },
  wealth:     { treasure: 3, filler: 1 },
  complexity: { puzzle: 3, gate: 2 },
};

// ---------------------------------------------------------------------------
// Grade modifier: how network spec shifts node grades within set-pieces
// ---------------------------------------------------------------------------

/**
 * Compute the grade offset to apply to all node base grades.
 * Averaged from threat and complexity axes.
 * @param {NetworkSpec} spec
 * @returns {number} - offset to add to grade index (can be negative)
 */
export function gradeModifier(spec) {
  const t = gradeToNumber(spec.threat);
  const c = gradeToNumber(spec.complexity);
  const avg = (t + c) / 2;
  // C (3) is neutral (offset 0). Each step above/below shifts by 1.
  return Math.round(avg - 3);
}

// ---------------------------------------------------------------------------
// Starting cash: derived from wealth grade
// ---------------------------------------------------------------------------

/** @type {Record<string, number>} */
export const START_CASH_TABLE = {
  F: 0,
  D: 100,
  C: 200,
  B: 500,
  A: 1000,
  S: 2000,
};

/**
 * Get starting cash for a wealth grade.
 * @param {string} wealthGrade
 * @returns {number}
 */
export function startCash(wealthGrade) {
  return START_CASH_TABLE[wealthGrade] ?? 200;
}

// ---------------------------------------------------------------------------
// Cost budget: total set-piece cost points available for a network
// ---------------------------------------------------------------------------

/**
 * Compute the total cost budget for a network spec. Higher budgets allow
 * more and bigger set-pieces. The budget scales with all 4 axes.
 * @param {NetworkSpec} spec
 * @returns {number} - total cost points (each set-piece costs gradeToNumber(cost))
 */
export function costBudget(spec) {
  const t = gradeToNumber(spec.threat);
  const w = gradeToNumber(spec.wealth);
  const c = gradeToNumber(spec.complexity);
  const d = gradeToNumber(spec.depth);
  // Budget scales with axes. Higher specs need more expensive pieces,
  // so the multiplier increases with total magnitude.
  const sum = t + w + c + d;
  const multiplier = sum >= 16 ? 2.5 : sum >= 12 ? 2.0 : 1.5;
  return Math.max(8, Math.round(sum * multiplier));
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { shiftGrade, clampGrade, GRADE_INDEX };
