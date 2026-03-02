// @ts-check
// Seeded PRNG module — Mulberry32 with named streams.
// Replaces all gameplay Math.random() calls for deterministic runs.
// Visual-only randomness (graph.js) stays on Math.random().

// ── Mulberry32 core ──────────────────────────────────────

/**
 * Advance Mulberry32 state by one step. Returns new state and a [0,1) float.
 * @param {number} state
 * @returns {{ next: number, value: number }}
 */
function advance(state) {
  let s = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { next: s, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

// ── djb2 string hash ─────────────────────────────────────

/**
 * Hash a string to a 32-bit integer (djb2).
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// ── Stream state ─────────────────────────────────────────

/** Named RNG stream constants — use these instead of string literals. */
export const RNG = Object.freeze({
  EXPLOIT: "exploit",
  COMBAT:  "combat",
  ICE:     "ice",
  LOOT:    "loot",
  WORLD:   "world",
});

const STREAM_NAMES = Object.values(RNG);

/** @type {string} */
let _seed = "";

/** @type {Record<string, { state: number, forced: number[] }>} */
const streams = {};

// ── Public API ───────────────────────────────────────────

/**
 * Initialize all PRNG streams from a master seed string.
 * If no seed provided, generates a random one using Math.random().
 * @param {string} [seedString]
 */
export function initRng(seedString) {
  _seed = seedString ?? ("run-" + Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0"));
  for (const name of STREAM_NAMES) {
    streams[name] = { state: hashString(_seed + ":" + name), forced: [] };
  }
}

/**
 * Returns a random float [0, 1) from the named stream.
 * @param {string} stream
 * @returns {number}
 */
export function random(stream) {
  const st = streams[stream];
  if (!st) throw new Error(`Unknown RNG stream: "${stream}"`);
  if (st.forced.length > 0) return /** @type {number} */ (st.forced.shift());
  const { next, value } = advance(st.state);
  st.state = next;
  return value;
}

/**
 * Returns a random integer in [min, max] (inclusive) from the named stream.
 * @param {string} stream
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(stream, min, max) {
  return min + Math.floor(random(stream) * (max - min + 1));
}

/**
 * Returns a random element from the array using the named stream.
 * @template T
 * @param {string} stream
 * @param {T[]} arr
 * @returns {T}
 */
export function randomPick(stream, arr) {
  return arr[Math.floor(random(stream) * arr.length)];
}

/**
 * In-place Fisher-Yates shuffle using a raw RNG function. Returns the array.
 * @template T
 * @param {() => number} rngFn
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffleWith(rngFn, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rngFn() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * In-place Fisher-Yates shuffle using the named stream. Returns the array.
 * @template T
 * @param {string} stream
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(stream, arr) {
  return shuffleWith(() => random(stream), arr);
}

/**
 * Returns a 6-char alphanumeric ID string from the named stream.
 * @param {string} stream
 * @returns {string}
 */
export function randomId(stream) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(random(stream) * chars.length)];
  }
  return id;
}

/** Returns the current seed string. */
export function getSeed() {
  return _seed;
}

// ── Serialization ────────────────────────────────────────

/** Serialize all stream states for save/load. */
export function serializeRng() {
  /** @type {Record<string, number>} */
  const out = {};
  for (const name of STREAM_NAMES) {
    out[name] = streams[name].state;
  }
  return { seed: _seed, streams: out };
}

/**
 * Restore all stream states from serialized data.
 * @param {{ seed: string, streams: Record<string, number> }} data
 */
export function deserializeRng(data) {
  _seed = data.seed;
  for (const name of STREAM_NAMES) {
    if (!streams[name]) streams[name] = { state: 0, forced: [] };
    streams[name].state = data.streams[name] ?? 0;
    streams[name].forced = [];
  }
}

// ── Standalone factory ───────────────────────────────────

/**
 * Create an independent Mulberry32 RNG seeded from a string.
 * Does NOT touch any named gameplay stream — safe to use in generators.
 * @param {string} seedString
 * @returns {() => number}
 */
export function makeSeededRng(seedString) {
  let state = hashString(seedString);
  return function rng() {
    const { next, value } = advance(state);
    state = next;
    return value;
  };
}

// ── Test helpers (prefixed with _ to signal test-only) ───

/**
 * Queue a forced value that random() returns once before resuming normal sequence.
 * @param {string} stream
 * @param {number} value
 */
export function _forceNext(stream, value) {
  const st = streams[stream];
  if (!st) throw new Error(`Unknown RNG stream: "${stream}"`);
  st.forced.push(value);
}
