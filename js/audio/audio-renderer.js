// @ts-check
import { on, emitEvent, E } from "../core/events.js";
import { deriveProgress, deriveThreat } from "./signals.js";
import { selectScore, ALL_SCORES } from "./scores/index.js";
import { HUB_AMBIENT } from "./scores/hub.js";
import { createAudioEngine } from "./engine.js";

// Music on/off is a client preference (NOT game state — audio is never serialized).
const MUSIC_PREF_KEY = "starnet:music-enabled";
function loadMusicPref() {
  try {
    const v = localStorage.getItem(MUSIC_PREF_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}
function saveMusicPref(on) {
  try { localStorage.setItem(MUSIC_PREF_KEY, String(!!on)); } catch { /* ignore */ }
}

// Fade timings (seconds).
const HUB_FADE_IN = 3;     // hub ambient swells in gently
const RUN_FADE_IN = 1.2;   // run music comes up fairly quick
const RUN_END_FADE = 2;    // run music fades out on jack-out (requested)
const SWITCH_FADE = 0.8;   // brief dip between tracks / live score switches

let _engine = null;
// Seed from the persisted pref at module load so isMusicEnabled() is correct even when
// initAudioRenderer() never runs (e.g. the Strudel engine is selected — this module still
// owns the music pref + HUD state). initAudioRenderer() re-reads it (harmless).
let _enabled = loadMusicPref();
let _armed = false;        // AudioContext unlocked (first gesture)
let _runActive = false;
let _biome = "corporate";
let _currentScore = null;  // the selected RUN score (per-run pick or manual override)
let _playing = null;       // score object currently started, or null (set optimistically)
let _gen = 0;              // transition generation — cancels stale crossfades

/** What should be sounding right now: nothing in the hub if disabled/unarmed, else hub ambient or the run score. */
function desiredScore() {
  if (!_enabled || !_armed) return null;
  return _runActive ? (_currentScore || HUB_AMBIENT) : HUB_AMBIENT;
}

/**
 * Reconcile playback toward desiredScore() with fades. Crossfades by fading the current
 * track out, then starting the next after the fade. A generation counter cancels a
 * superseded transition (e.g. jack out then immediately start a new run).
 */
function refresh(fadeIn = HUB_FADE_IN, fadeOut = SWITCH_FADE) {
  if (!_engine) return;
  const want = desiredScore();
  if (want === _playing) return;          // already playing / already decided
  const gen = ++_gen;
  const prev = _playing;
  _playing = want;                        // optimistic: re-entrant calls with same want no-op

  if (want === null) { _engine.stop(fadeOut); return; }

  if (prev === null && !_engine.isStarted()) {
    _engine.setScore(want);
    _engine.start(fadeIn);
    return;
  }
  // something is playing (or still tearing down) → fade out, then start the new track
  _engine.stop(fadeOut);
  setTimeout(() => {
    if (gen !== _gen || !_engine) return; // a newer transition superseded this one
    _engine.setScore(want);
    _engine.start(fadeIn);
  }, fadeOut * 1000 + 90);
}

/**
 * Wire the audio engine to the event bus. Browser-only — do NOT import from headless
 * entry points (scripts/playtest.js, scripts/bot/cli.js).
 *
 * Playback: a calm hub ambient plays in the overworld; a fresh biome score plays during a
 * run; transitions and jack-out are faded. All gated on the music on/off preference.
 */
export function initAudioRenderer() {
  const engine = createAudioEngine();
  _engine = engine;
  _enabled = loadMusicPref();

  // AudioContext needs a user gesture to start. On the first gesture, unlock it and bring
  // up the hub ambient (the player boots into the hub).
  function arm() {
    if (_armed) return;
    _armed = true;
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
    engine.unlock();
    refresh(HUB_FADE_IN);
  }
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);

  on(E.STATE_CHANGED, (state) => {
    if (!state) return;
    engine.setProgress(deriveProgress(state));
    engine.setThreat(deriveThreat(state));
  });

  on(E.RUN_STARTED, ({ state }) => {
    _runActive = true;
    _biome = state?.spec?.biome ?? state?.meta?.biome ?? "corporate";
    _currentScore = selectScore(_biome);   // fresh pick each run
    refresh(RUN_FADE_IN, SWITCH_FADE);
  });

  on(E.RUN_ENDED, () => {
    _runActive = false;
    refresh(HUB_FADE_IN, RUN_END_FADE);    // fade the run music out, ambient back in
  });

  return engine;
}

/** @returns {boolean} whether music is enabled (the on/off preference). */
export function isMusicEnabled() { return _enabled; }

/** @returns {string|null} name of the track currently sounding (hub ambient or run score). */
export function getNowPlayingName() { return _playing?.name ?? null; }

/** @returns {string|null} name of the selected RUN score (the per-run pick / manual override). */
export function getCurrentScoreName() { return _currentScore?.name ?? null; }

/** @returns {boolean} whether a run's music is the live track (so a switch takes effect now). */
export function isRunMusicLive() { return _enabled && _runActive; }

/** @returns {string[]} display names of all selectable run scores. */
export function listScoreNames() { return ALL_SCORES.map((s) => s.name); }

/**
 * Enable or disable music, persisting the choice. Reconciles playback with a fade.
 * @param {boolean} on
 * @returns {boolean} the new enabled state
 */
export function setMusicEnabled(on) {
  _enabled = !!on;
  saveMusicPref(_enabled);
  refresh(_runActive ? RUN_FADE_IN : HUB_FADE_IN, SWITCH_FADE);
  emitEvent(E.MUSIC_CHANGED, { enabled: _enabled });  // keep HUD button + console in sync
  return _enabled;
}

/** Flip music on↔off. @returns {boolean} the new enabled state */
export function toggleMusic() { return setMusicEnabled(!_enabled); }

/**
 * Switch the selected RUN score by name (exact, else case-insensitive substring — so
 * "neon" matches "Corporate — Neon"). Live-switches (faded) if a run is playing; otherwise
 * applies to the next run.
 * @param {string} name
 * @returns {string|null} the matched score's name, or null
 */
export function setScoreByName(name) {
  const q = String(name ?? "").toLowerCase();
  if (!q) return null;
  const target = ALL_SCORES.find((s) => s.name.toLowerCase() === q)
    || ALL_SCORES.find((s) => s.name.toLowerCase().includes(q));
  if (!target) return null;
  _currentScore = target;
  if (_runActive) refresh(RUN_FADE_IN, SWITCH_FADE);
  return target.name;
}

/**
 * Switch the selected RUN score to a random different one. Genuinely random (manual action,
 * not seeded run state).
 * @returns {string|null} the new score's name, or null
 */
export function randomScore() {
  if (ALL_SCORES.length === 0) return null;
  const others = ALL_SCORES.filter((s) => s !== _currentScore);
  const pool = others.length ? others : ALL_SCORES;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  _currentScore = pick;
  if (_runActive) refresh(RUN_FADE_IN, SWITCH_FADE);
  return pick.name;
}
