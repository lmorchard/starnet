// @ts-check
// Grade scale utilities — shared by the generator, balance tables, and future modules.
// Grade order: F (easiest) < D < C < B < A < S (hardest).

/** Ordered grade array, ascending difficulty. */
export const GRADES = ["F", "D", "C", "B", "A", "S"];

/** @type {Record<string, number>} Grade letter → index (0=F, 5=S). */
export const GRADE_INDEX = Object.fromEntries(GRADES.map((g, i) => [g, i]));

/**
 * Parse a grade string. Returns the canonical uppercase letter, or null if invalid.
 * @param {string | null | undefined} s
 * @returns {string | null}
 */
export function parseGrade(s) {
  if (!s) return null;
  const upper = String(s).toUpperCase();
  return GRADE_INDEX[upper] !== undefined ? upper : null;
}

/**
 * Return the sub-array of GRADES between minGrade and maxGrade (inclusive).
 * @param {string} minGrade
 * @param {string} maxGrade
 * @returns {string[]}
 */
export function gradeRange(minGrade, maxGrade) {
  const lo = GRADE_INDEX[minGrade] ?? 0;
  const hi = GRADE_INDEX[maxGrade] ?? GRADES.length - 1;
  return GRADES.slice(Math.min(lo, hi), Math.max(lo, hi) + 1);
}

/**
 * Clamp a grade index to valid bounds and return the grade letter.
 * @param {number} index
 * @returns {string}
 */
export function clampGrade(index) {
  return GRADES[Math.max(0, Math.min(GRADES.length - 1, Math.round(index)))];
}

/**
 * Return the grade N steps above (+) or below (-) the given grade, clamped.
 * @param {string} grade
 * @param {number} delta
 * @returns {string}
 */
export function shiftGrade(grade, delta) {
  return clampGrade((GRADE_INDEX[grade] ?? 0) + delta);
}

/**
 * Pick a random grade between minGrade and maxGrade (inclusive) using rng().
 * rng() must return a [0,1) float.
 * @param {() => number} rng
 * @param {string} minGrade
 * @param {string} maxGrade
 * @returns {string}
 */
export function randomGrade(rng, minGrade, maxGrade) {
  const range = gradeRange(minGrade, maxGrade);
  return range[Math.floor(rng() * range.length)];
}
