// @ts-check
// Persistence + validation for the resizable-layout sizes (sidebar width,
// log-pane height, hand height). UI chrome — deliberately kept OUT of the game
// state object so save/load of a run stays pure (see CLAUDE.md). Mirrors the
// load/save/normalize idiom of profile-store.js.

const LAYOUT_KEY = "starnet:layout";

/** Default sizes in px. `sidebarW` matches the historical fixed 400px. */
export const DEFAULT_LAYOUT = { sidebarW: 400, logH: 260, handH: 200 };

/**
 * Static sanity bounds used when normalizing a persisted payload. The live
 * viewport-relative maximum (≈50vw / 60vh / 60% of sidebar) is enforced during
 * drag in resizers.js; these just keep a stored value finite and on-screen.
 */
export const SIZE_BOUNDS = {
  sidebarW: { min: 280, max: 1200 },
  logH:     { min: 64,  max: 1200 },
  handH:    { min: 80,  max: 1200 },
};

/**
 * Clamp a size to [min, max]. Non-finite / non-number input falls back to min.
 * @param {unknown} px
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clampSize(px, min, max) {
  const n = typeof px === "number" ? px : NaN;
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Coerce an arbitrary parsed payload into a valid layout: every key from
 * DEFAULT_LAYOUT is taken from `raw` (clamped to its static bounds) or falls
 * back to the default. Unknown keys are dropped. Pure.
 * @param {unknown} raw
 * @returns {{ sidebarW: number, logH: number, handH: number }}
 */
export function normalizeLayout(raw) {
  const src = raw && typeof raw === "object" ? /** @type {any} */ (raw) : {};
  const out = /** @type {any} */ ({});
  for (const key of /** @type {(keyof typeof DEFAULT_LAYOUT)[]} */ (Object.keys(DEFAULT_LAYOUT))) {
    const { min, max } = SIZE_BOUNDS[key];
    out[key] = key in src ? clampSize(src[key], min, max) : DEFAULT_LAYOUT[key];
  }
  return out;
}

/**
 * Load the layout from localStorage, normalized. Corrupt/absent payload →
 * defaults. Never throws.
 * @returns {{ sidebarW: number, logH: number, handH: number }}
 */
export function loadLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

/**
 * Persist the layout (normalized first so we never store junk).
 * @param {{ sidebarW: number, logH: number, handH: number }} layout
 */
export function saveLayout(layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(normalizeLayout(layout)));
  } catch {
    // storage full / unavailable — non-fatal, sizes just won't persist
  }
}
