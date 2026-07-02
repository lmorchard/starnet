// @ts-check
// One-shot SFX cue DATA (superdough value specs) + the event→cue resolver. Ported and tuned from
// the known-good cues in js/audio/strudel-spike.js (branch strudel-ingame-spike).
//
// `_dur` is the voice duration passed to superdough(value, ctx.currentTime+lookahead, dur) — NOT 0,
// which @strudel/web 1.3.0 drops as "in the past" (see sfx.js); the rest of each object is the
// superdough value (note/s/cutoff/envelope/gain/room/resonance). Phase-1 event coverage per
// issue #254; other routed events degrade to no cue (extend in a follow-up).
//
// #187 Phase 3: `resolveActionCue` resolves the *timed-action completion* cue id — a distinct,
// new concept from `resolveCue` above (which maps whole game EVENT TYPES like NODE_REVEALED or
// ACTION_RESOLVED to a cue, not per-action-id timed-action completions). There is no legacy
// per-action completion-cue map to fall back to, so the chain is just inline → central
// (ACTION_FEEDBACK_PROFILES) → DEFAULT_PROFILE.completionCue.
import { E } from "../../../core/events.js";
import { ACTION_FEEDBACK_PROFILES, DEFAULT_PROFILE } from "../../../ui/feedback-profiles.js";

export const CUES = {
  // node discovery — short bright blip
  reveal:        { note: "c6", s: "square",   cutoff: 3000, attack: 0.001, decay: 0.05, sustain: 0,   release: 0.04, gain: 0.35, _dur: 0.08 },
  // node access gained — softer chime with a little space
  access:        { note: "c5", s: "triangle", cutoff: 5000, attack: 0.002, decay: 0.25, sustain: 0,   release: 0.2,  gain: 0.5, room: 0.4, _dur: 0.35 },
  // exploit resolved — bright on success, low/dark on failure
  "xploit.ok":   { note: "g4", s: "sawtooth", cutoff: 1800, attack: 0.001, decay: 0.12, sustain: 0,   release: 0.06, gain: 0.5,  _dur: 0.14 },
  "xploit.fail": { note: "g2", s: "sawtooth", cutoff: 1800, attack: 0.001, decay: 0.12, sustain: 0,   release: 0.06, gain: 0.5,  _dur: 0.14 },
  // global alert escalation — resonant growl
  "alert.up":    { note: "a2", s: "sawtooth", cutoff: 900,  resonance: 8,  attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.15, gain: 0.55, _dur: 0.5 },
  // ICE locked on — sharp square stab
  "ice.detected":{ note: "d3", s: "square",   cutoff: 1200, attack: 0.001, decay: 0.18, sustain: 0,   release: 0.1,  gain: 0.5,  _dur: 0.2 },
  // trace started — low ominous square
  "trace.start": { note: "e2", s: "square",   cutoff: 600,  attack: 0.001, decay: 0.4,  sustain: 0,   release: 0.3,  gain: 0.6,  _dur: 0.5 },
  // process.done — DEFAULT_PROFILE.completionCue fallback (#187 Phase 4b): short, soft blip for
  // any timed action with no bespoke completion cue. A feel-DRAFT default (the Phase 4a session
  // tuned the *visual* generic overlay with Les, not audio) — tunable later via preview/sfx.html.
  "process.done": { note: "e5", s: "sine",    cutoff: 2200, attack: 0.002, decay: 0.12, sustain: 0,   release: 0.1,  gain: 0.35, _dur: 0.15 },
};

/**
 * Map a game event to its one-shot cue spec (or null for no cue).
 * @param {string} type  the E.* event type
 * @param {any} payload  the event payload
 * @returns {object|null}
 */
export function resolveCue(type, payload) {
  switch (type) {
    case E.NODE_REVEALED: return CUES.reveal;
    case E.NODE_ACCESSED: return CUES.access;
    case E.ACTION_RESOLVED: return payload?.success === false ? CUES["xploit.fail"] : CUES["xploit.ok"];
    // Suppress the alert blip when it escalates to trace — trace.start carries that moment.
    case E.ALERT_GLOBAL_RAISED: return payload?.next === "trace" ? null : CUES["alert.up"];
    case E.ICE_DETECTED: return CUES["ice.detected"];
    case E.ALERT_TRACE_STARTED: return CUES["trace.start"];
    default: return null;
  }
}

/**
 * Resolve the completion-cue id for a timed action's ACTION_FEEDBACK "complete" phase (#187
 * Phase 3): inline (the "start" payload's `feedback.completionCue`) → central
 * (ACTION_FEEDBACK_PROFILES[actionId].completionCue) → DEFAULT_PROFILE.completionCue. As of
 * #187 Phase 4b, CUES["process.done"] is a real (feel-DRAFT) spec, so the DEFAULT fallback plays
 * real audio instead of degrading silently.
 * @param {string} actionId
 * @param {{ completionCue?: string }} [inline]
 * @returns {string}
 */
export function resolveActionCue(actionId, inline = {}) {
  const central = ACTION_FEEDBACK_PROFILES[actionId] ?? {};
  return inline?.completionCue ?? central.completionCue ?? DEFAULT_PROFILE.completionCue;
}
