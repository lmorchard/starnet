// @ts-nocheck
// Tone.js wrapper. The only module that touches Web Audio. Imports the vendored bundle.
import * as Tone from "tone";
import { computeMix } from "./mixer.js";
import { makeSeededRng, getSeed } from "../core/rng.js";
import { transposeDiatonic, consonantSteps, pickNextStep } from "./harmony.js";
import { normalizeStep, ratchetOffsets, shouldFire } from "./rhythm.js";

const GRID = "8n";          // default step grid
const RAMP_UP = 0.3;        // threat fast attack (s)
const RAMP_DOWN = 1.5;      // threat slow release (s)
const RAMP_PROGRESS = 1.0;  // progress crossfade (s)
const DRONE_BARS_DEFAULT = 4; // bars between drone wander steps (if score opts in without specifying)

export function createAudioEngine() {
  let started = false;
  let score = null;
  let progress = 0, threat = 0;
  let lastThreat = 0;
  let master, masterFilter, reverb;
  const layers = {};        // key → { gain, voice, seq, sustainSynth }
  const muted = {};         // key → bool (playground only)

  // Section automation — periodically masks a subset of progress layers for arrangement variety.
  let sectionsEnabled = true;   // master toggle (playground A/B; on in-game)
  let sectionActive = null;     // Set of progress keys audible this section (null = no sections)
  let sectionIdx = 0;
  let sectionRng = null;
  let sectionTimerId = null;
  let maskable = new Set();     // progress-axis layer keys eligible for masking

  // Drone harmonic wander — periodically planes the sustained "wander" layers (drone, +hub pad)
  // to another diatonic degree so the harmonic bed evolves over a run instead of holding one
  // chord. Seeded per run (independent of gameplay RNG), bar-quantized, no immediate repeat.
  let rhythmRng = null;     // seeded :rhythm stream for per-step prob (never gameplay RNG)
  let droneRng = null;
  let droneTimerId = null;
  let droneStep = 0;            // current diatonic-step offset in effect
  let droneSteps = null;        // allowed offsets for this score (from consonantSteps)
  const retiring = new Set();   // { id, synth } — old wander synths fading out, disposed after their tail

  // Param-event recycling. Web Audio never prunes past automation events, so a sequenced
  // synth's frequency timeline grows unbounded as it plays (worst on the fast arps) →
  // audio-thread stutter that compounds over a run. The cure is recreating the synth.
  // We do it once a layer falls silent (gain ~0) for a click-free swap; a long-audible
  // layer is force-recycled as a backstop.
  const dirty = {};          // key → has been audible since last recycle
  const lastGain = {};       // key → last computed target gain
  const applied = {};        // key → last gain actually ramped (skip redundant ramps)
  const audibleSince = {};   // key → ms timestamp it last became audible
  let appliedCutoff = -1, appliedQ = -1;
  let recycleTimer = null;
  let fadeTimer = null;      // pending teardown after a fade-out
  const RECYCLE_CHECK_MS = 4000;
  const FORCE_RECYCLE_MS = 120000;
  const nowMs = () => (typeof performance !== "undefined" ? performance.now() : 0);

  function buildMasterBus() {
    master = new Tone.Gain(0.9).toDestination();
    reverb = new Tone.Reverb({ decay: 2.4, wet: 0.16 }).connect(master);
    masterFilter = new Tone.Filter({ frequency: 8000, type: "lowpass", Q: 0.7 }).connect(reverb);
  }

  function drumVoices() {
    const kick = new Tone.MembraneSynth({ octaves: 6, envelope: { attack: 0.001, decay: 0.25, sustain: 0 } });
    // Snare = noise crack + a tonal BODY thump for punch. Pure noise reads as a wash; the
    // MembraneSynth body (a short pitched transient ~D3) supplies the impact. Tweak by ear:
    // snareBody volume = body↔crack balance; its note = body pitch; noise decay = snappiness.
    const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.45, sustain: 0.18 } });
    const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.028, octaves: 2, envelope: { attack: 0.001, decay: 0.23, sustain: 0.03 } });
    const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } });
    snare.volume.value = -9; snareBody.volume.value = -9; hat.volume.value = -20;
    return { kick, snare, snareBody, hat };
  }

  // Render one sequenced step through the rhythm model: prob gate (seeded), then ratchet into N
  // evenly-spaced sub-hits in the cell. `trigger(value, time, vel, dur)` does the actual Tone call
  // for the layer's voice. Plain steps (ratchet 1, prob 1, no vel) collapse to a single hit.
  function playStep(trigger, step, time, grid) {
    const n = normalizeStep(step);
    if (!n) return;                                   // rest
    if (!shouldFire(n.prob, rhythmRng)) return;       // glitch: skip this loop
    if (n.ratchet === 1) {                            // common case: skip the per-tick seconds math
      trigger(n.value, time, n.vel, grid);            // dur = the full cell (grid notation string)
      return;
    }
    const cell = Tone.Time(grid).toSeconds();
    const dur = cell / n.ratchet;                     // sub-cell length so ratchets don't smear
    for (const off of ratchetOffsets(cell, n.ratchet)) trigger(n.value, time + off, n.vel, dur);
  }

  function buildLayer(spec) {
    const gain = new Tone.Gain(0).connect(masterFilter);
    const grid = spec.grid || GRID;

    if (spec.sustain) {
      // continuously sustained chord, gain-controlled. A factory so a wander layer can mint a
      // FRESH synth per chord change — each instance is triggered exactly once (attack, then one
      // release), so it never accumulates the unbounded param automation that Web Audio can't
      // prune (the same compounding-crackle hazard the sequenced-layer recycler exists for).
      const makeSynth = () => {
        const s = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: spec.synth.type || "fatsawtooth", count: spec.synth.count, spread: spec.synth.spread },
          envelope: { attack: spec.synth.attack ?? 1, decay: 0.3, sustain: 1, release: spec.synth.release ?? 2 },
        }).connect(gain);
        if (spec.synth.volume != null) s.volume.value = spec.synth.volume;
        return s;
      };
      // wander layers remember their home chord so each plane is relative to home (no drift)
      layers[spec.key] = {
        gain, sustainSynth: makeSynth(), sustain: spec.sustain,
        wander: !!spec.wander, wanderHome: spec.sustain, currentNotes: spec.sustain,
        makeSynth, releaseSec: spec.synth.release ?? 2,
      };
      return;
    }

    if (spec.synth.kind === "drums") {
      const voices = drumVoices();
      const trim = spec.synth.volume ?? 0;
      Object.values(voices).forEach((v) => { v.connect(gain); if (trim) v.volume.value += trim; });
      // velocity threads through; drum voices keep their own short hold times (dur ignored).
      const hit = (tok, t, vel) => {
        const v = vel == null ? undefined : vel;
        if (tok === "snare") { voices.snare.triggerAttackRelease("16n", t, v); voices.snareBody.triggerAttackRelease("D3", "16n", t, v); }
        else if (tok === "hat") voices.hat.triggerAttackRelease("32n", t, v);
        else voices.kick.triggerAttackRelease("C1", "8n", t, v);
      };
      const seq = new Tone.Sequence((time, step) => playStep(hit, step, time, grid), spec.pattern, grid);
      seq.start(0);
      layers[spec.key] = { gain, voices, seq };
      return;
    }

    if (spec.synth.kind === "poly") {
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: spec.synth.type || "triangle" },
        envelope: { attack: spec.synth.attack, decay: spec.synth.decay, sustain: spec.synth.sustain, release: spec.synth.release },
      }).connect(gain);
      if (spec.synth.volume != null) s.volume.value = spec.synth.volume;
      const hit = (note, t, vel, dur) => s.triggerAttackRelease(note, dur, t, vel == null ? undefined : vel);
      const seq = new Tone.Sequence((time, step) => playStep(hit, step, time, grid), spec.pattern, grid);
      seq.start(0);
      layers[spec.key] = { gain, voice: s, seq };
      return;
    }

    // Monophonic line (bass / lead / arps). A single Synth is far cheaper than a
    // PolySynth — no per-note voice allocation/GC — which matters on the fast 16th arps.
    const s = new Tone.Synth({
      oscillator: { type: spec.synth.type || "sawtooth" },
      envelope: { attack: spec.synth.attack, decay: spec.synth.decay, sustain: spec.synth.sustain, release: spec.synth.release },
    }).connect(gain);
    if (spec.synth.volume != null) s.volume.value = spec.synth.volume;
    const hit = (note, t, vel, dur) => s.triggerAttackRelease(note, dur, t, vel == null ? undefined : vel);
    const seq = new Tone.Sequence((time, step) => playStep(hit, step, time, grid), spec.pattern, grid);
    seq.start(0);
    layers[spec.key] = { gain, voice: s, seq };
  }

  function applyMix(immediate) {
    if (!score) return;
    const mix = computeMix(score, progress, threat);
    for (const [key, layer] of Object.entries(layers)) {
      let target = muted[key] ? 0 : (mix.gains[key] ?? 0);
      // Section mask is subtractive: it can only silence an already-earned progress
      // layer, never force one in. Drone (base) and threat layers are exempt.
      if (sectionsEnabled && sectionActive && maskable.has(key) && !sectionActive.has(key)) target = 0;
      if (target > 0.01 && !dirty[key]) { dirty[key] = true; audibleSince[key] = nowMs(); }
      lastGain[key] = target;
      // Only schedule a ramp when this layer's target actually moved — avoids piling
      // automation events on params that didn't change (most layers, most updates).
      if (immediate || Math.abs(target - (applied[key] ?? -1)) > 1e-4) {
        layer.gain.gain.rampTo(target, immediate ? 0.01 : RAMP_PROGRESS);
        applied[key] = target;
      }
    }
    const tRamp = immediate ? 0.01 : (threat >= lastThreat ? RAMP_UP : RAMP_DOWN);
    if (immediate || Math.abs(mix.masterCutoff - appliedCutoff) > 0.5) {
      masterFilter.frequency.rampTo(mix.masterCutoff, tRamp); appliedCutoff = mix.masterCutoff;
    }
    if (immediate || Math.abs(mix.masterQ - appliedQ) > 1e-3) {
      masterFilter.Q.rampTo(mix.masterQ, tRamp); appliedQ = mix.masterQ;
    }
    lastThreat = threat;
  }

  // Advance to the next section on a bar boundary: seeded-random, no immediate repeat.
  function advanceSection() {
    const secs = score?.sections;
    if (!secs || secs.length === 0) return;
    if (secs.length === 1) {
      sectionIdx = 0;
    } else {
      let idx;
      do { idx = Math.floor(sectionRng() * secs.length); } while (idx === sectionIdx);
      sectionIdx = idx;
    }
    sectionActive = new Set(secs[sectionIdx]);
    applyMix(false);
  }

  // Dispose a retired wander synth once its release tail has gone silent (click-free) — keeps the
  // count of live synths bounded so nothing accumulates over a run.
  function retireSynth(synth, releaseSec) {
    const rec = { synth };
    rec.id = setTimeout(() => {
      try { synth.releaseAll?.(); synth.dispose(); } catch { /* already gone */ }
      retiring.delete(rec);
    }, (releaseSec + 1.5) * 1000);
    retiring.add(rec);
  }

  // Plane the wander layers to the next diatonic degree. Each layer mints a FRESH synth that
  // attacks the new chord while the outgoing synth releases the old — the slow attack/release
  // envelopes overlap on the shared gain into a gapless morph. Recreating (vs. retriggering one
  // synth) means each instance is triggered exactly once, so no synth accumulates unbounded
  // param automation — the compounding-crackle hazard Web Audio's un-prunable timelines create.
  function wanderDrone() {
    if (!droneSteps || !score?.root || !score?.mode) return;
    droneStep = pickNextStep(droneRng, droneStep, droneSteps);
    for (const layer of Object.values(layers)) {
      if (!layer.wander || !layer.sustainSynth) continue;
      const next = transposeDiatonic(layer.wanderHome, score.root, score.mode, droneStep);
      const old = layer.sustainSynth;
      old.triggerRelease(layer.currentNotes);
      const fresh = layer.makeSynth();
      fresh.triggerAttack(next);
      layer.sustainSynth = fresh;
      layer.currentNotes = next;
      retireSynth(old, layer.releaseSec ?? 2);
    }
  }

  // Recreate a sequenced layer's synth + sequence, clearing its accumulated param
  // automation. The new gain is set instantly to the layer's current target (≈0 for a
  // silent recycle → no click; no rampTo event added). Sustained layers don't accumulate
  // (one trigger) and the master bus is left intact (no reverb regen).
  function recycleLayer(key) {
    const l = layers[key];
    if (!l || !l.seq) return;
    const spec = score.layers.find((s) => s.key === key);
    if (!spec) return;
    l.seq.dispose();
    l.voice?.dispose?.();
    if (l.voices) Object.values(l.voices).forEach((v) => v.dispose?.());
    l.gain.dispose();
    buildLayer(spec);                                  // fresh synth + seq + gain(0) → masterFilter
    layers[key].gain.gain.value = lastGain[key] ?? 0;  // restore level instantly
    applied[key] = lastGain[key] ?? 0;
  }

  function recycleTick() {
    const now = nowMs();
    for (const [key, l] of Object.entries(layers)) {
      if (!l?.seq || !dirty[key]) continue;            // only sequenced layers that have played
      const silent = (lastGain[key] ?? 0) <= 0.011;
      const longAudible = now - (audibleSince[key] ?? now) > FORCE_RECYCLE_MS;
      if (silent || longAudible) {
        recycleLayer(key);
        dirty[key] = false;
        audibleSince[key] = now;
      }
    }
  }

  // Full synchronous teardown — disposes every node and resets all transient state.
  function teardown() {
    Tone.Transport.stop();
    if (recycleTimer != null) { clearInterval(recycleTimer); recycleTimer = null; }
    if (fadeTimer != null) { clearTimeout(fadeTimer); fadeTimer = null; }
    for (const k of Object.keys(dirty)) delete dirty[k];
    for (const k of Object.keys(lastGain)) delete lastGain[k];
    for (const k of Object.keys(applied)) delete applied[k];
    for (const k of Object.keys(audibleSince)) delete audibleSince[k];
    appliedCutoff = -1; appliedQ = -1;
    if (sectionTimerId != null) { Tone.Transport.clear(sectionTimerId); sectionTimerId = null; }
    sectionActive = null; sectionIdx = 0; sectionRng = null; maskable = new Set();
    if (droneTimerId != null) { Tone.Transport.clear(droneTimerId); droneTimerId = null; }
    droneRng = null; droneStep = 0; droneSteps = null;
    rhythmRng = null;
    for (const rec of retiring) { clearTimeout(rec.id); try { rec.synth.dispose(); } catch { /* already gone */ } }
    retiring.clear();
    for (const key of Object.keys(layers)) {
      const layer = layers[key];
      layer.seq?.dispose?.();
      layer.voice?.dispose?.();
      if (layer.sustainSynth) { layer.sustainSynth.releaseAll?.(); layer.sustainSynth.dispose?.(); }
      if (layer.voices) Object.values(layer.voices).forEach((v) => v.dispose?.());
      layer.gain?.dispose?.();
      delete layers[key];
    }
    masterFilter?.dispose?.();
    reverb?.dispose?.();
    master?.dispose?.();
    masterFilter = reverb = master = undefined;
    started = false;
  }

  return {
    /**
     * Set the active score. If the engine is already running and the score
     * actually changes, rebuild the live graph so the synths + section state match
     * the new score. (Relies on method-call invocation: `engine.setScore(...)`.)
     * @param {object} s score object
     */
    setScore(s) {
      if (s === score) return undefined;
      const wasStarted = started;
      if (wasStarted) this.stop();
      score = s;
      return wasStarted ? this.start() : undefined; // resolves when the rebuilt graph is running
    },

    /** @param {number} [fadeInSec] ramp master gain up from 0 over this many seconds */
    async start(fadeInSec = 0) {
      if (started || !score) return;
      if (fadeTimer != null) { clearTimeout(fadeTimer); fadeTimer = null; }  // cancel a pending teardown
      await Tone.start();
      // Buffer the scheduler against main-thread jank (the game's visuals get busier as a
      // run grows). Music doesn't need low latency, so a larger lookahead trades latency
      // for glitch-resistance.
      Tone.getContext().lookAhead = 0.2;
      buildMasterBus();
      if (fadeInSec > 0) { master.gain.value = 0; master.gain.rampTo(0.9, fadeInSec); }
      Tone.Transport.bpm.value = score?.bpm ?? 100;
      // seeded stream for per-step `prob` (glitch); deterministic per run, never gameplay RNG.
      rhythmRng = makeSeededRng((getSeed() || "audio") + ":rhythm");
      for (const spec of score.layers) buildLayer(spec);
      // kick off sustained layers
      for (const layer of Object.values(layers)) {
        if (layer.sustainSynth) layer.sustainSynth.triggerAttack(layer.sustain);
      }
      // section automation: mask a rotating subset of progress layers over time
      maskable = new Set(score.layers.filter((l) => l.axis === "progress").map((l) => l.key));
      if (score.sections && score.sections.length) {
        sectionRng = makeSeededRng((getSeed() || "audio") + ":sections");
        sectionIdx = 0;
        sectionActive = new Set(score.sections[0]);
        const bars = score.sectionBars || 8;
        sectionTimerId = Tone.Transport.scheduleRepeat(() => advanceSection(), `${bars}m`, `${bars}m`);
      } else {
        sectionActive = null;
      }
      // drone harmonic wander: opt-in via score.root/mode + at least one `wander` sustained layer
      const wanderLayers = Object.values(layers).filter((l) => l.wander && l.sustainSynth);
      const droneHome = layers.drone?.wanderHome ?? wanderLayers[0]?.wanderHome;
      if (score.root && score.mode && droneHome && wanderLayers.length) {
        droneSteps = consonantSteps(droneHome, score.root, score.mode);
        droneStep = 0;
        droneRng = makeSeededRng((getSeed() || "audio") + ":drone");
        const dBars = score.droneBars || DRONE_BARS_DEFAULT;
        droneTimerId = Tone.Transport.scheduleRepeat(() => wanderDrone(), `${dBars}m`, `${dBars}m`);
      }
      applyMix(true);
      Tone.Transport.start();
      recycleTimer = setInterval(recycleTick, RECYCLE_CHECK_MS);  // prune accumulated synth params
      started = true;
    },

    /** @param {number} [fadeSec] ramp master gain to 0 over this many seconds, then tear down */
    stop(fadeSec = 0) {
      if (!started) return;
      if (fadeSec > 0 && master) {
        master.gain.rampTo(0, fadeSec);
        if (fadeTimer != null) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(() => { fadeTimer = null; teardown(); }, fadeSec * 1000 + 60);
      } else {
        teardown();
      }
    },

    setProgress(x) {
      const v = Math.max(0, Math.min(1, x));
      if (Math.abs(v - progress) < 1e-3) return;  // STATE_CHANGED fires often; skip no-op rampTo storms
      progress = v;
      if (started) applyMix(false);
    },
    setThreat(x) {
      const v = Math.max(0, Math.min(1, x));
      if (Math.abs(v - threat) < 1e-3) return;
      threat = v;
      if (started) applyMix(false);
    },

    // playground-only
    setMuted(key, isMuted) { muted[key] = isMuted; if (started) applyMix(false); },
    setSectionsEnabled(on) { sectionsEnabled = !!on; if (started) applyMix(false); },
    isStarted() { return started; },

    /**
     * Force an immediate drone wander (ear-check aid — skips the bar wait). No-op if the
     * active score doesn't wander.
     * @returns {{ step: number, layers: Record<string, string[]> } | null}
     */
    forceWander() {
      if (!started || !droneSteps) return null;
      wanderDrone();
      const out = {};
      for (const [key, l] of Object.entries(layers)) if (l.wander) out[key] = l.currentNotes;
      return { step: droneStep, layers: out };
    },

    /** Resume the AudioContext (needs a user gesture) WITHOUT starting playback. */
    async unlock() { await Tone.start(); },

    /** Diagnostic snapshot of structures that could accumulate over a long run. */
    _debugStats() {
      const T = Tone.getTransport();
      const safe = (fn) => { try { const v = fn(); return v == null ? -1 : v; } catch { return -1; } };
      // Probe several known Tone-internal event-timeline paths for a Param/Signal.
      const evLen = (node) => {
        if (!node) return null;
        const tries = {
          _events: () => node._events?.length,
          param: () => node._param?._events?.length,
          input: () => node.input?._events?.length,
        };
        const out = {};
        for (const [k, fn] of Object.entries(tries)) { const v = safe(fn); if (v !== -1) out[k] = v; }
        return Object.keys(out).length ? out : null;
      };
      const pick = (o) => (o ? (o._events ?? o.param ?? o.input) : -1);
      const per = {};
      for (const [k, l] of Object.entries(layers)) {
        per[k] = `g${pick(evLen(l.gain?.gain))}/f${pick(evLen(l.voice?.frequency))}`;
      }
      return {
        transportScheduled: safe(() => Object.keys(T._scheduledEvents || {}).length),
        mFiltFreq: pick(evLen(masterFilter?.frequency)),
        mFiltQ: pick(evLen(masterFilter?.Q)),
        layers: per,
      };
    },

    // exposed for deferred SFX / vocal one-shots (constraint from the spec)
    getMasterInput() { return masterFilter; },
  };
}
