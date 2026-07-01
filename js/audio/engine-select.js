// @ts-check
// Audio engine selection — a client preference (NOT game state; audio is never serialized).
// Chooses between the Strudel + superdough engine (default) and the legacy Tone.js engine (opt-in,
// pending removal — #267). Read once at boot by js/ui/main.js; switching requires a page reload.

/** @type {readonly ["tone", "strudel"]} */
export const AUDIO_ENGINES = ["tone", "strudel"];

const ENGINE_PREF_KEY = "starnet:audio-engine";
const DEFAULT_ENGINE = "strudel";

/**
 * @returns {"tone"|"strudel"} the selected audio engine, defaulting to "strudel".
 */
export function getAudioEngine() {
  try {
    const v = localStorage.getItem(ENGINE_PREF_KEY);
    return AUDIO_ENGINES.includes(/** @type {any} */ (v)) ? /** @type {any} */ (v) : DEFAULT_ENGINE;
  } catch {
    return DEFAULT_ENGINE;
  }
}

/**
 * Persist the audio engine choice. No-ops (but still returns the value) if storage is unavailable.
 * @param {string} name
 * @returns {"tone"|"strudel"|null} the validated engine name, or null if invalid.
 */
export function setAudioEngine(name) {
  if (!AUDIO_ENGINES.includes(/** @type {any} */ (name))) return null;
  try { localStorage.setItem(ENGINE_PREF_KEY, name); } catch { /* ignore */ }
  return /** @type {any} */ (name);
}
