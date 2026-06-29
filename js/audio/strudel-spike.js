// @ts-nocheck
// IN-GAME STRUDEL + SUPERDOUGH SPIKE — throwaway de-risk (not the real engine).
//
// Proves the two open unknowns before any engine rebuild:
//   1. superdough SFX firing on REAL game events (latency / rapid-fire on the live bus),
//   2. Strudel reactive music driven by the EXISTING progress/threat signals, in the real game,
//   3. performance under game load (play a run, watch FPS/CPU, listen for dropouts).
//
// Gated behind window.strudelSpike.start()/stop() — does NOT auto-run and does NOT touch the
// shipped Tone audio. For a clean A/B + perf read, toggle the Tone music OFF first, then start().
//
// Requires @strudel/web loaded globally (classic <script> in index.html). initStrudel() registers
// the pattern fns + superdough/evaluate/hush/signal as window globals ASYNCHRONOUSLY — poll for
// them. (Findings from the audio-reference Strudel work; see that session's notes.)
import { on, off, E } from "../core/events.js";
import { deriveProgress, deriveThreat } from "./signals.js";
import { getState } from "../core/state/index.js";

let booted = false;
let running = false;
const subs = [];   // [type, handler] pairs, for off() on stop()

// Live axes the reactive pattern reads each cycle (mirrors audio-renderer's STATE_CHANGED bridge).
window.gProgress = 0;
window.gThreat = 0;

async function ensureBooted() {
  if (booted) return true;
  if (typeof window.initStrudel !== "function") {
    console.warn("[strudel-spike] @strudel/web not loaded (check the <script> in index.html)");
    return false;
  }
  window.initStrudel();
  const t0 = Date.now();
  while (typeof window.evaluate !== "function" || typeof window.superdough !== "function") {
    if (Date.now() - t0 > 10000) { console.warn("[strudel-spike] timed out waiting for strudel globals"); return false; }
    await new Promise((r) => setTimeout(r, 60));
  }
  await window.getAudioContext().resume();
  if (typeof window.samples === "function") window.samples("github:tidalcycles/dirt-samples").catch(() => {});
  booted = true;
  return true;
}

// ---- SFX: direct superdough one-shots on real game events --------------------------------------
const sfx = (value, dur) => { try { window.superdough(value, 0, dur); } catch (_) { /* dropped */ } };
const CUES = [
  [E.NODE_REVEALED,       () => sfx({ note: "c6", s: "square",   cutoff: 3000, attack: 0.001, decay: 0.05, sustain: 0, release: 0.04, gain: 0.35 }, 0.08)],
  [E.NODE_ACCESSED,       () => sfx({ note: "c5", s: "triangle", cutoff: 5000, attack: 0.002, decay: 0.25, sustain: 0, release: 0.2, gain: 0.5, room: 0.4 }, 0.35)],
  [E.ACTION_RESOLVED,     (p) => sfx({ note: p?.success === false ? "g2" : "g4", s: "sawtooth", cutoff: 1800, attack: 0.001, decay: 0.12, sustain: 0, release: 0.06, gain: 0.5 }, 0.14)],
  [E.ALERT_GLOBAL_RAISED, () => sfx({ note: "a2", s: "sawtooth", cutoff: 900, resonance: 8, attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.15, gain: 0.55 }, 0.5)],
  [E.ICE_DETECTED,        () => sfx({ note: "d3", s: "square",   cutoff: 1200, attack: 0.001, decay: 0.18, sustain: 0, release: 0.1, gain: 0.5 }, 0.2)],
  [E.ALERT_TRACE_STARTED, () => sfx({ note: "e2", s: "square",   cutoff: 600, attack: 0.001, decay: 0.4, sustain: 0, release: 0.3, gain: 0.6 }, 0.5)],
];

// ---- reactive music: pattern params read the live axes via signal() ----------------------------
function startMusic() {
  const prog = window.signal(() => window.gProgress || 0);
  const threat = window.signal(() => window.gThreat || 0);
  const program = window.stack(
    // driving bass — always present; filter opens + level rises with THREAT
    window.note("c2 c2 c2 c2 g1 g1 g1 g1").s("sawtooth").lpf(threat.range(300, 3500)).gain(threat.range(0.35, 0.85)),
    // arp — climbs up to an octave + speeds up as PROGRESS (LAN owned) rises
    window.note("c4 eb4 g4 bb4").s("triangle").add(window.note(prog.range(0, 12))).fast(prog.range(1, 2)).gain(0.28).room(0.4),
    // tension hats — barely there until THREAT climbs
    window.sound("hh*8").gain(threat.range(0, 0.45)),
  ).cpm(30);
  window.hush();
  program.play();
}

// ---- lifecycle ---------------------------------------------------------------------------------
async function start() {
  if (running) return;
  if (!(await ensureBooted())) return;
  const s = getState();
  if (s) { window.gProgress = deriveProgress(s); window.gThreat = deriveThreat(s); }
  const stateHandler = (state) => {
    if (!state) return;
    window.gProgress = deriveProgress(state);
    window.gThreat = deriveThreat(state);
  };
  on(E.STATE_CHANGED, stateHandler); subs.push([E.STATE_CHANGED, stateHandler]);
  for (const [type, fn] of CUES) { on(type, fn); subs.push([type, fn]); }
  startMusic();
  running = true;
  console.log("[strudel-spike] started — superdough SFX on game events + reactive Strudel music.");
}

function stop() {
  for (const [type, fn] of subs) off(type, fn);
  subs.length = 0;
  if (typeof window.hush === "function") window.hush();
  running = false;
  console.log("[strudel-spike] stopped");
}

// Fire one representative cue on demand (for confirming the superdough SFX path without needing
// to trigger a real game event). start() must have run first.
function testSfx() {
  if (!booted) { console.warn("[strudel-spike] call start() first"); return; }
  CUES[1][1]();   // the NODE_ACCESSED chime
}

window.strudelSpike = { start, stop, testSfx };
console.log("[strudel-spike] loaded — call strudelSpike.start() after a click (toggle Tone music OFF first for a clean A/B + perf read).");
