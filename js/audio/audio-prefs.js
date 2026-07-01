// @ts-check
// Engine-neutral audio preferences: the music + SFX on/off toggles, their localStorage
// persistence, and the MUSIC_CHANGED / SFX_CHANGED events the HUD buttons and console
// commands listen on. These are client preferences, NOT game state (audio is never serialized).
//
// This module is the single owner of the audio prefs. The Strudel engine (js/audio/strudel/
// index.js) reads them and listens to the change events. Seeded from localStorage at module
// load so isMusicEnabled()/isSfxEnabled() are correct for the HUD before any engine boots.
import { emitEvent, E } from "../core/events.js";

const MUSIC_PREF_KEY = "starnet:music-enabled";
const SFX_PREF_KEY = "starnet:sfx-enabled";

function loadPref(key) {
  try { const v = localStorage.getItem(key); return v === null ? true : v === "true"; }
  catch { return true; }
}
function savePref(key, on) {
  try { localStorage.setItem(key, String(!!on)); } catch { /* ignore */ }
}

let _musicEnabled = loadPref(MUSIC_PREF_KEY);
let _sfxEnabled = loadPref(SFX_PREF_KEY);

/** @returns {boolean} whether music is enabled (the on/off preference). */
export function isMusicEnabled() { return _musicEnabled; }

/**
 * Enable or disable music, persisting the choice. Emits MUSIC_CHANGED so the HUD button,
 * the `music` command, and the audio engine stay in sync.
 * @param {boolean} on
 * @returns {boolean} the new enabled state
 */
export function setMusicEnabled(on) {
  _musicEnabled = !!on;
  savePref(MUSIC_PREF_KEY, _musicEnabled);
  emitEvent(E.MUSIC_CHANGED, { enabled: _musicEnabled });
  return _musicEnabled;
}

/** Flip music on↔off. @returns {boolean} the new enabled state */
export function toggleMusic() { return setMusicEnabled(!_musicEnabled); }

/** @returns {boolean} whether SFX are enabled (the on/off preference). */
export function isSfxEnabled() { return _sfxEnabled; }

/**
 * Enable or disable SFX, persisting the choice. Emits SFX_CHANGED so the HUD button,
 * the `sfx` command, and the audio engine stay in sync.
 * @param {boolean} on
 * @returns {boolean} the new enabled state
 */
export function setSfxEnabled(on) {
  _sfxEnabled = !!on;
  savePref(SFX_PREF_KEY, _sfxEnabled);
  emitEvent(E.SFX_CHANGED, { enabled: _sfxEnabled });
  return _sfxEnabled;
}

/** Flip SFX on↔off. @returns {boolean} the new enabled state */
export function toggleSfx() { return setSfxEnabled(!_sfxEnabled); }
