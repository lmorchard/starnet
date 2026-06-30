# Research — current Tone.js audio subsystem

Factual map of the existing engine (the thing being replaced). Three independent
audio surfaces, all wired to the event bus.

## 1. One-shot SFX cues

- `js/audio/sfx/defs.js` — cue catalog (pure specs: `kind` = blip/sweep/chord/noise/fm + params)
- `js/audio/sfx/cues.js` — `E.*` event → cue id mapping (lines ~18–60)
- `js/audio/sfx/renderer.js` — event listener wiring, dedupe (50ms), pitch transforms (lines ~100–165)
- `js/audio/sfx/engine.js` — Tone synthesis of one-shots (lines ~43–119)

Event→cue highlights: `ACTION_RESOLVED` (probe/dump/corrupt/xploit.ok/xploit.fail/fetch*/mine*),
`NODE_REVEALED` (pitch by grade + cascade), `NODE_ACCESSED`, `PLAYER_NAVIGATED`,
`ALERT_GLOBAL_RAISED`/`ALERT_COOLED`/`ALERT_TRACE_STARTED`/`ALERT_TRACE_CANCELLED`,
`NODE_ALERT_RAISED`, `ICE_*` (pending/detected/ejected/rebooted/disabled/moved),
`RUN_STARTED`/`RUN_ENDED`, `MISSION_COMPLETE`, `EXPLOIT_DISCLOSED`, `EXPLOIT_PARTIAL_BURN`.

## 2. Two-axis reactive music

- `js/audio/signals.js` — **pure** `deriveProgress(state)` (owned/total nodes), `deriveThreat(state)` (alert ladder + injury). Engine-agnostic. REUSE AS-IS.
- `js/audio/mixer.js` — **pure** `computeMix(score, progress, threat)` → per-layer gains + master filter
- `js/audio/engine.js` — Tone music engine + state machine
- `js/audio/scores/*.js` — score data (8 corporate variants + hub ambient); layers have `axis: base|progress|threat`, smoothstep gating, sections, drone-wander
- `js/audio/harmony.js`, `rhythm.js` — pure drone-wander + note-grid helpers
- `js/audio/audio-renderer.js` — bridge: `on(STATE_CHANGED) → engine.setProgress/setThreat`; `RUN_STARTED/ENDED` swap hub↔run; music on/off pref

## 3. Progress-driven ACTION DRONES  ← the surface NOT named in issue #254 Phase 1

- `js/audio/sfx/drones.js` — drone specs per timed action (pure data)
- `js/audio/sfx/renderer.js` (lines ~75–94) — `on(E.ACTION_FEEDBACK, ...)` → start/setProgress/stop a drone keyed by `${nodeId}:${action}`
- `js/audio/sfx/engine.js` (lines ~121–227) — `startDrone(spec) → { setProgress(p), stop() }`; sources osc/noise/fm/dual; filter→ampGain(LFO or progress)→fadeGain; param sweeps `{from,to}` lerped by progress with 0.12s ramps; reboot loops (ignores progress)

Drone catalog (`DRONES` in drones.js): `probe`, `xploit`, `dump`, `fetch`, `mine`,
`lie-low`, `reboot` — each a distinct timbre (cutoff sweep, detune beat, amp LFO, etc.).

### How a drone is driven (the porting contract)

1. Timed-action operator (`js/core/node-graph/operators.js`) ticks every 100ms; sets
   node attrs (`exploiting`, `_ta_xploit_progress`, `_ta_xploit_duration`) and emits
   `E.ACTION_FEEDBACK { nodeId, action, phase, progress }`.
   - `phase: "start"` (progress 0) → renderer calls `startDrone(DRONES[action])`
   - `phase: "progress"` → `progress = newProgress/duration` (0..1 **fraction**) → `drone.setProgress(p)`
   - `phase: "complete"|"cancel"` → `drone.stop()`
2. `js/core/node-graph/timed-actions.js` lists the 7 timed actions + their active attrs.

This is event-driven and engine-agnostic at the contract layer (`ACTION_FEEDBACK`), so a
superdough/Strudel engine can subscribe the same way — but **sustained, progress-modulated
drones are not superdough's native one-shot idiom**; approach is an open design question.

## Public surfaces to mirror

- Music engine (`engine.js`): `setScore`, `start(fadeIn)`, `stop(fade)`, `setProgress`, `setThreat`, `isStarted`, `getMasterInput`, `forceWander`, score-list helpers via audio-renderer
- SFX engine (`sfx/engine.js`): `play(spec)`, `startDrone(spec)→{setProgress,stop}`, `setEnabled`, `unlock`, `getMasterInput`
- Prefs: music on/off and SFX on/off are localStorage client prefs, never serialized

## Spike reference (to promote)

- Branch `strudel-ingame-spike`, `js/audio/strudel-spike.js`: SFX `CUES` (one-shots) +
  reactive `stack()` + boot/poll. **Confirm whether the spike covered drones** — likely
  one-shots + music only, so drones are net-new porting in Phase 1.
