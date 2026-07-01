// @ts-check
import { on, emitEvent, E } from "../../core/events.js";
import { getState } from "../../core/state.js";
import { GRADE_INDEX } from "../../core/grades.js";
import { createSfx } from "./engine.js";
import { resolveCue } from "./cues.js";
import { CUES, CUE_IDS } from "./defs.js";
import { DRONES, resolveDrone } from "./drones.js";

// SFX on/off is a client preference (NOT game state).
const SFX_PREF_KEY = "starnet:sfx-enabled";
function loadPref() {
  try { const v = localStorage.getItem(SFX_PREF_KEY); return v === null ? true : v === "true"; }
  catch { return true; }
}
function savePref(on) { try { localStorage.setItem(SFX_PREF_KEY, String(!!on)); } catch { /* ignore */ } }

let _sfx = null;
// Seed from the persisted pref at module load so isSfxEnabled() is correct even when
// initSfxRenderer() never runs (e.g. the Strudel engine is selected — this module still owns
// the SFX pref + HUD state). initSfxRenderer() re-reads it (harmless).
let _enabled = loadPref();
let _prevHealth = null;
let _prevDeck = null;
const _last = {};   // cueId -> last play time (ms), for dedupe
const _drones = new Map();   // "<nodeId>:<action>" -> active drone handle (timed actions in progress)
const _reveal = { last: -1e9, count: 0 };   // reveal burst tracker (renderer-only, not game state)

const REVEAL_BURST_MS = 250;   // reveals within this window cascade (ascending run)

// Events routed straight through resolveCue().
const ROUTED = [
  E.ACTION_RESOLVED, E.NODE_REVEALED, E.NODE_ACCESSED, E.PLAYER_NAVIGATED,
  E.ALERT_GLOBAL_RAISED, E.ALERT_COOLED, E.ALERT_TRACE_STARTED, E.ALERT_TRACE_CANCELLED,
  E.NODE_ALERT_RAISED,
  E.ICE_DETECT_PENDING, E.ICE_DETECTED, E.ICE_EJECTED, E.ICE_REBOOTED, E.ICE_DISABLED, E.ICE_MOVED,
  E.RUN_STARTED, E.RUN_ENDED, E.MISSION_COMPLETE, E.EXPLOIT_DISCLOSED, E.EXPLOIT_PARTIAL_BURN,
];

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : 0);

/**
 * Play a cue by id, with optional spec overrides. Dedupes identical cues within 50ms unless
 * `noDedupe` (reveal bursts must cascade, not collapse).
 */
function playCueId(id, overrides, { noDedupe = false } = {}) {
  if (!id || !_sfx) return;
  const spec = CUES[id];
  if (!spec) return;
  const t = nowMs();
  if (!noDedupe && t - (_last[id] ?? -1e9) < 50) return;
  _last[id] = t;
  _sfx.play(overrides ? { ...spec, ...overrides } : spec);
}

/**
 * NODE_REVEALED → the "discovery rush". Pitch the reveal blip up by node grade (S brightest), and
 * step it up further for each reveal in a burst so a cluster of unlocked neighbors ascends into a
 * rising run. No dedupe — bursts must stack. Pitch is applied as an oscillator `detune` (cents).
 */
function playReveal(nodeId) {
  const t = nowMs();
  const cascade = t - _reveal.last < REVEAL_BURST_MS ? _reveal.count + 1 : 0;
  _reveal.last = t;
  _reveal.count = cascade;
  const grade = getState()?.nodes?.[nodeId]?.grade;
  const gradeSemis = GRADE_INDEX[grade] ?? 0;     // F=0 … S=5
  const semis = gradeSemis + cascade * 2;          // grade lift + whole-step per burst step
  playCueId("reveal", { detune: semis * 100 }, { noDedupe: true });
}

/** Stop and forget every active drone (run end, SFX disabled). */
function stopAllDrones() {
  for (const h of _drones.values()) h.stop();
  _drones.clear();
}

/**
 * Drive the sustained "action in progress" drones from ACTION_FEEDBACK.
 * start → begin a drone keyed by node+action; progress → reshape it; complete/cancel → stop it.
 */
function handleActionFeedback(payload) {
  if (!_sfx) return;
  const { nodeId, action, phase, progress } = payload || {};
  const key = `${nodeId}:${action}`;
  if (phase === "start") {
    if (_drones.has(key)) return;   // already running (e.g. a duplicate start) — don't restart
    const id = resolveDrone(action);
    if (!id) return;
    _drones.set(key, _sfx.startDrone(DRONES[id]));
  } else if (phase === "progress") {
    _drones.get(key)?.setProgress(progress ?? 0);
  } else if (phase === "complete" || phase === "cancel") {
    _drones.get(key)?.stop();
    _drones.delete(key);
  }
}

/**
 * Wire the SFX engine to the event bus. Browser-only — do NOT import from headless entry
 * points (scripts/playtest.js, scripts/bot/cli.js).
 */
export function initSfxRenderer() {
  _sfx = createSfx();
  _enabled = loadPref();
  _sfx.setEnabled(_enabled);

  // AudioContext needs a user gesture; unlock on first gesture (independent of music).
  let armed = false;
  function arm() {
    if (armed) return;
    armed = true;
    window.removeEventListener("pointerdown", arm);
    window.removeEventListener("keydown", arm);
    _sfx.unlock();
  }
  window.addEventListener("pointerdown", arm);
  window.addEventListener("keydown", arm);

  for (const type of ROUTED) {
    on(type, (payload) => {
      // Reveal is special: grade pitch + ascending burst cascade, no dedupe.
      if (type === E.NODE_REVEALED) { playReveal(payload?.nodeId); return; }

      const id = resolveCue(type, payload);
      if (!id) return;
      // Pitch the global-alert-escalation cue (an fm growl) up a step at red.
      if (type === E.ALERT_GLOBAL_RAISED && id === "alert.up") {
        playCueId("alert.up", { detune: payload?.next === "red" ? 300 : 0 });
        return;
      }
      // Per-node alert: pitch up a step at red.
      if (type === E.NODE_ALERT_RAISED && id === "node.alert") {
        playCueId(id, { detune: payload?.next === "red" ? 200 : -100 });
        return;
      }
      // Exploit wear: pitch drops as the card wears down (fewer uses left = lower).
      if (type === E.EXPLOIT_PARTIAL_BURN && id === "burn") {
        const left = Math.max(0, payload?.usesRemaining ?? 0);
        playCueId(id, { detune: -100 * (3 - Math.min(3, left)) });
        return;
      }
      playCueId(id);
    });
  }

  // Sustained drones for timed actions in progress.
  on(E.ACTION_FEEDBACK, handleActionFeedback);

  // Health/deck damage has no event — diff on STATE_CHANGED; rebaseline on run start.
  on(E.RUN_STARTED, ({ state }) => {
    stopAllDrones();   // clean slate (a stale drone can't survive into a new run)
    _prevHealth = state?.player?.health?.current ?? null;
    _prevDeck = state?.player?.deckIntegrity?.current ?? null;
  });
  on(E.RUN_ENDED, stopAllDrones);
  on(E.STATE_CHANGED, (state) => {
    if (!state) return;
    const h = state.player?.health?.current;
    const d = state.player?.deckIntegrity?.current;
    if (_prevHealth != null && h != null && h < _prevHealth) playCueId("hurt.health");
    if (_prevDeck != null && d != null && d < _prevDeck) playCueId("hurt.deck");
    if (h != null) _prevHealth = h;
    if (d != null) _prevDeck = d;
  });

  return _sfx;
}

/** @returns {boolean} */
export function isSfxEnabled() { return _enabled; }

/**
 * Enable/disable SFX, persisted. Emits SFX_CHANGED so the HUD button + console stay in sync.
 * @param {boolean} on @returns {boolean}
 */
export function setSfxEnabled(on) {
  _enabled = !!on;
  savePref(_enabled);
  _sfx?.setEnabled(_enabled);
  if (!_enabled) stopAllDrones();   // silence any in-progress drones immediately
  emitEvent(E.SFX_CHANGED, { enabled: _enabled });
  return _enabled;
}

/** Flip SFX on/off. @returns {boolean} */
export function toggleSfx() { return setSfxEnabled(!_enabled); }

/** Play a cue by id (for the console `sfx test` command + harness). @param {string} id */
export function playCue(id) { playCueId(id); }

/** @returns {string[]} all cue ids */
export function listCues() { return [...CUE_IDS]; }
